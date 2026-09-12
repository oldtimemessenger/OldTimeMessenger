import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import type { Session } from '@supabase/supabase-js';
import * as ApiClient from '@/lib/api-client-react';
import { configureApi } from './api';
import supabase, { SUPABASE_AUTH_CONFIGURED } from './supabase';

export { SUPABASE_AUTH_CONFIGURED, supabase };

WebBrowser.maybeCompleteAuthSession();

export const AUTH_BYPASS_ENABLED =
  process.env.EXPO_PUBLIC_SKIP_AUTH === 'true' &&
  process.env.NODE_ENV !== 'production';
const configuredOAuthProviders = new Set(
  (process.env.EXPO_PUBLIC_SUPABASE_OAUTH_PROVIDERS ?? 'google,apple')
    .split(',')
    .map((provider) => provider.trim().toLowerCase())
    .filter(Boolean),
);
export const OAUTH_PROVIDERS = {
  apple: configuredOAuthProviders.has('apple'),
  google: configuredOAuthProviders.has('google'),
};
export function assertSupabaseConfigured() {
  if (!SUPABASE_AUTH_CONFIGURED) {
    throw new Error('Supabase Auth is not configured for this build. Set EXPO_PUBLIC_SUPABASE_URL and a public Supabase key.');
  }
}

const registerAuthUnauthorizedHandler = (
  ApiClient as unknown as {
    setAuthUnauthorizedHandler: (handler: (() => void | Promise<void>) | null) => void;
  }
).setAuthUnauthorizedHandler;

export type OAuthProvider = 'google' | 'apple';

export function getAuthRedirectUri(flow?: 'recovery') {
  if (Platform.OS !== 'web') {
    const query = flow ? `?type=${encodeURIComponent(flow)}` : '';
    return `old-time-mobile://auth/callback${query}`;
  }
  return Linking.createURL('auth/callback', {
    scheme: 'old-time-mobile',
    queryParams: flow ? { type: flow } : undefined,
  });
}

function callbackParams(callbackUrl: string) {
  const url = new URL(callbackUrl);
  const query = new URLSearchParams(url.search);
  const hash = new URLSearchParams(url.hash.replace(/^#/, ''));
  return {
    code: query.get('code') ?? hash.get('code'),
    type: query.get('type') ?? hash.get('type'),
    accessToken: query.get('access_token') ?? hash.get('access_token'),
    refreshToken: query.get('refresh_token') ?? hash.get('refresh_token'),
    error: query.get('error') ?? hash.get('error'),
    errorDescription: query.get('error_description') ?? hash.get('error_description'),
    errorCode: query.get('error_code') ?? hash.get('error_code'),
  };
}

function safeAuthDetail(value: string) {
  return value
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/https?:\/\/\S+/gi, '[link removed]')
    .trim()
    .slice(0, 240);
}

export async function completeAuthCallback(callbackUrl: string): Promise<'oauth' | 'recovery'> {
  assertSupabaseConfigured();
  const params = callbackParams(callbackUrl);
  if (params.error || params.errorDescription) {
    const detail = [params.errorDescription, params.error].filter(Boolean).map((value) => safeAuthDetail(value as string)).join(' — ');
    const code = params.errorCode ? ` (${safeAuthDetail(params.errorCode)})` : '';
    throw new Error(`OAuth provider error${code}: ${detail || 'The provider did not complete sign-in.'}`);
  }
  if (params.code) {
    const exchanged = await supabase.auth.exchangeCodeForSession(params.code);
    if (exchanged.error) throw new Error(`OAuth callback exchange failed: ${exchanged.error.message}`);
    return params.type === 'recovery' ? 'recovery' : 'oauth';
  }
  if (params.accessToken && params.refreshToken) {
    const session = await supabase.auth.setSession({
      access_token: params.accessToken,
      refresh_token: params.refreshToken,
    });
    if (session.error) throw new Error('The sign-in session could not be restored.');
    return params.type === 'recovery' ? 'recovery' : 'oauth';
  }
  const current = await supabase.auth.getSession();
  if (!current.data.session) throw new Error('The sign-in response was incomplete. Please try again.');
  return params.type === 'recovery' ? 'recovery' : 'oauth';
}

export async function signInWithOAuth(provider: OAuthProvider): Promise<'redirecting' | 'completed'> {
  assertSupabaseConfigured();
  const redirectTo = getAuthRedirectUri();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: {
      redirectTo,
      skipBrowserRedirect: Platform.OS !== 'web',
    },
  });

  if (error) throw error;
  if (!data.url) throw new Error(`Supabase did not return a ${provider} sign-in URL.`);
  if (Platform.OS === 'web') {
    window.location.assign(data.url);
    return 'redirecting';
  }

  const result = await WebBrowser.openAuthSessionAsync(data.url, redirectTo);
  if (result.type !== 'success') throw new Error('Sign-in was cancelled.');

  await completeAuthCallback(result.url);
  return 'completed';
}

export async function sendEmailCode(email: string, shouldCreateUser: boolean) {
  assertSupabaseConfigured();
  return supabase.auth.signInWithOtp({
    email: email.trim(),
    options: { shouldCreateUser },
  });
}

export async function verifyEmailCode(email: string, token: string) {
  assertSupabaseConfigured();
  return supabase.auth.verifyOtp({
    email: email.trim(),
    token: token.trim(),
    type: 'email',
  });
}

export function getSafeAuthError(error: unknown, fallback = 'Please try again.') {
  const rawMessage = error instanceof Error ? error.message : '';
  const message = rawMessage.toLowerCase();
  if (message.includes('oauth provider error:') || message.includes('oauth provider error (')) {
    const detail = safeAuthDetail(rawMessage.split(':').slice(1).join(':'));
    return detail ? `The identity provider could not complete sign-in: ${detail}` : fallback;
  }
  if (message.includes('oauth callback exchange failed:')) {
    const detail = safeAuthDetail(rawMessage.split(':').slice(1).join(':'));
    return detail ? `The sign-in callback could not be verified: ${detail}` : fallback;
  }
  if (message.includes('invalid login credentials')) return 'That sign-in code was not accepted.';
  if (message.includes('email not confirmed')) return 'Please confirm your email before signing in.';
  if (message.includes('invalid or expired otp') || message.includes('otp has expired') || message.includes('token has expired')) {
    return 'That verification code is invalid or expired. Request a new code and try again.';
  }
  if (message.includes('too many requests') || message.includes('rate limit') || message.includes('over_email_send_rate_limit')) {
    return 'Too many emails were requested. Wait a moment, then try again.';
  }
  if (message.includes('user already registered') || message.includes('already registered')) {
    return 'An account with this email already exists. Sign in instead.';
  }
  if (message.includes('password should be at least') || message.includes('password must be at least')) {
    return 'Use the six-digit email code to sign in.';
  }
  if (message.includes('network request failed') || message.includes('failed to fetch') || message.includes('fetch failed')) {
    return 'Old Time could not reach the sign-in service. Check your connection and try again.';
  }
  if (message.includes('invalid api key') || message.includes('api key is invalid')) {
    return 'This Old Time build cannot reach its sign-in service. Install the latest build and try again.';
  }
  if (message.includes('unsupported provider') || message.includes('provider is not enabled')) {
    return 'That sign-in option is not enabled yet. Use an email code instead.';
  }
  if (message.includes('cancel')) return 'Sign-in was cancelled.';
  if (message.includes('expired') || message.includes('invalid')) return 'That sign-in link is no longer valid.';
  return fallback;
}

type AuthContextValue = {
  isLoaded: boolean;
  isSignedIn: boolean;
  userId: string | null;
  session: Session | null;
  getToken: (forceRefresh?: boolean) => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);
let refreshSessionPromise: Promise<string | null> | null = null;

async function getFreshAccessToken(forceRefresh = false): Promise<string | null> {
  if (!SUPABASE_AUTH_CONFIGURED) return null;

  const current = await supabase.auth.getSession();
  const session = current.data.session;
  const expiresAt = session?.expires_at ?? 0;
  const stillFresh = Boolean(session?.access_token) && expiresAt > Math.floor(Date.now() / 1000) + 60;
  if (!forceRefresh && stillFresh) return session!.access_token;

  if (!refreshSessionPromise) {
    refreshSessionPromise = supabase.auth.refreshSession()
      .then(({ data, error }) => {
        if (error || !data.session) return null;
        return data.session.access_token;
      })
      .catch(() => null)
      .finally(() => {
        refreshSessionPromise = null;
      });
  }
  return refreshSessionPromise;
}

export function SupabaseAuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    if (!SUPABASE_AUTH_CONFIGURED) {
      setIsLoaded(true);
      return;
    }

    let mounted = true;
    void supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return;
      setSession(data.session);
      setIsLoaded(true);
    }).catch(() => {
      if (!mounted) return;
      setSession(null);
      setIsLoaded(true);
    });

    const { data } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!mounted) return;
      setSession(nextSession);
      setIsLoaded(true);
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web' || !SUPABASE_AUTH_CONFIGURED) return;
    if (AppState.currentState === 'active') {
      supabase.auth.startAutoRefresh();
    }
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void supabase.auth.startAutoRefresh();
      else supabase.auth.stopAutoRefresh();
    });
    return () => {
      subscription.remove();
      supabase.auth.stopAutoRefresh();
    };
  }, []);

  useEffect(() => {
    configureApi((forceRefresh) => SUPABASE_AUTH_CONFIGURED
      ? getFreshAccessToken(forceRefresh)
      : Promise.resolve(null));
    registerAuthUnauthorizedHandler(async () => {
      if (!SUPABASE_AUTH_CONFIGURED) return;
      try {
        await getFreshAccessToken(true);
      } catch {
        // Keep the local session on transient refresh failures. The retried
        // request will surface the authentication error without signing out.
      }
    });
    return () => registerAuthUnauthorizedHandler(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    isLoaded,
    isSignedIn: Boolean(session?.user),
    userId: session?.user.id ?? null,
    session,
    getToken: getFreshAccessToken,
    signOut: async () => {
      if (!SUPABASE_AUTH_CONFIGURED) return;
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    },
  }), [isLoaded, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used inside SupabaseAuthProvider');
  return value;
}