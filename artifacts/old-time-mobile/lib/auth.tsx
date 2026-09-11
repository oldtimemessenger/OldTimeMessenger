import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as SecureStore from 'expo-secure-store';
import * as WebBrowser from 'expo-web-browser';
import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { AppState, Platform } from 'react-native';
import { createClient, type Session } from '@supabase/supabase-js';
import * as ApiClient from '@/lib/api-client-react';
import { configureApi } from './api';

WebBrowser.maybeCompleteAuthSession();

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

export const SUPABASE_AUTH_CONFIGURED = Boolean(supabaseUrl && supabaseAnonKey);
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
const clientUrl = supabaseUrl ?? 'https://old-time.invalid';
const clientAnonKey = supabaseAnonKey ?? 'old-time-missing-supabase-anon-key';

export function assertSupabaseConfigured() {
  if (!SUPABASE_AUTH_CONFIGURED) {
    throw new Error('Supabase Auth is not configured for this build. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.');
  }
}

// Keep this namespace separate from entries written by older builds. A stale
// Keychain item can fail inside the native module before JS can catch it.
const SECURE_STORAGE_PREFIX = 'old-time.supabase.v2.';
const SECURE_STORAGE_CHUNK_SIZE = 900;

type SecureStorageMetadata = {
  version: 1;
  chunks: number;
};

function secureStorageKey(key: string) {
  return `${SECURE_STORAGE_PREFIX}${key}`;
}

function secureStorageMetadataKey(key: string) {
  return `${secureStorageKey(key)}.meta`;
}

function secureStorageChunkKey(key: string, index: number) {
  return `${secureStorageKey(key)}.chunk.${index}`;
}

function secureStorageError(operation: string) {
  return new Error(`Secure authentication storage ${operation} failed.`);
}

async function secureStoreGetItem(key: string) {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    throw secureStorageError('read');
  }
}

async function secureStoreSetItem(key: string, value: string) {
  try {
    await SecureStore.setItemAsync(key, value, {
      keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK,
    });
  } catch {
    throw secureStorageError('write');
  }
}

async function secureStoreDeleteItem(key: string) {
  try {
    await SecureStore.deleteItemAsync(key);
  } catch {
    throw secureStorageError('delete');
  }
}

async function readSecureStorageMetadata(key: string): Promise<SecureStorageMetadata | null> {
  const raw = await secureStoreGetItem(secureStorageMetadataKey(key));
  if (!raw) return null;

  try {
    const parsed = JSON.parse(raw) as Partial<SecureStorageMetadata>;
    const chunks = parsed.chunks;
    if (parsed.version !== 1 || typeof chunks !== 'number' || !Number.isSafeInteger(chunks) || chunks < 1) return null;
    return { version: 1, chunks };
  } catch {
    return null;
  }
}

const secureAuthStorage = {
  async getItem(key: string) {
    const metadata = await readSecureStorageMetadata(key);
    if (metadata) {
      const chunks = await Promise.all(
        Array.from({ length: metadata.chunks }, (_, index) =>
          secureStoreGetItem(secureStorageChunkKey(key, index)),
        ),
      );
      if (chunks.some((chunk) => chunk === null)) {
        throw new Error('Secure authentication storage is incomplete.');
      }
      return chunks.join('');
    }

    // Migrate an existing Supabase session once. No new auth data is written
    // to AsyncStorage after this migration succeeds.
    const legacyValue = await AsyncStorage.getItem(key);
    if (legacyValue === null) return null;
    await this.setItem(key, legacyValue);
    await AsyncStorage.removeItem(key);
    return legacyValue;
  },

  async setItem(key: string, value: string) {
    const previous = await readSecureStorageMetadata(key);
    const chunks: string[] = [];
    for (let start = 0; start < value.length; start += SECURE_STORAGE_CHUNK_SIZE) {
      chunks.push(value.slice(start, start + SECURE_STORAGE_CHUNK_SIZE));
    }
    if (chunks.length === 0) chunks.push('');

    // Write the new chunks before committing metadata, so an interrupted
    // write leaves the previous complete value discoverable.
    await Promise.all(
      chunks.map((chunk, index) =>
        secureStoreSetItem(secureStorageChunkKey(key, index), chunk),
      ),
    );
    await secureStoreSetItem(
      secureStorageMetadataKey(key),
      JSON.stringify({ version: 1, chunks: chunks.length } satisfies SecureStorageMetadata),
    );

    if (previous && previous.chunks > chunks.length) {
      await Promise.all(
        Array.from({ length: previous.chunks - chunks.length }, (_, offset) =>
          secureStoreDeleteItem(secureStorageChunkKey(key, chunks.length + offset)),
        ),
      );
    }
  },

  async removeItem(key: string) {
    const metadata = await readSecureStorageMetadata(key);
    if (metadata) {
      await Promise.all(
        Array.from({ length: metadata.chunks }, (_, index) =>
          secureStoreDeleteItem(secureStorageChunkKey(key, index)),
        ),
      );
    }
    await secureStoreDeleteItem(secureStorageMetadataKey(key));
    // Clean up any legacy session that may not have been migrated yet.
    await AsyncStorage.removeItem(key);
  },
};

const authStorage = Platform.OS === 'web' ? AsyncStorage : secureAuthStorage;
const registerAuthUnauthorizedHandler = (
  ApiClient as unknown as {
    setAuthUnauthorizedHandler: (handler: (() => void | Promise<void>) | null) => void;
  }
).setAuthUnauthorizedHandler;

export const supabase = createClient(clientUrl, clientAnonKey, {
  auth: {
    storage: authStorage,
    autoRefreshToken: true,
    persistSession: true,
    // The Expo Router callback screen explicitly exchanges the OAuth code.
    // Automatic web URL detection would consume the same one-time code first.
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
});

export type OAuthProvider = 'google' | 'apple';

export function getAuthRedirectUri(flow?: 'recovery') {
  return Linking.createURL('auth/callback', {
    scheme: 'old-time',
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
  if (message.includes('invalid login credentials')) return 'Your email or password is incorrect.';
  if (message.includes('email not confirmed')) return 'Please confirm your email before signing in.';
  if (message.includes('invalid or expired otp') || message.includes('otp has expired') || message.includes('token has expired')) {
    return 'That verification code is invalid or expired. Request a new code and try again.';
  }
  if (message.includes('too many requests') || message.includes('rate limit') || message.includes('over_email_send_rate_limit')) {
    return 'Too many emails were requested. Wait a moment, then try again.';
  }
  if (message.includes('user already registered') || message.includes('already registered')) {
    return 'An account with this email already exists. Sign in instead or reset the password.';
  }
  if (message.includes('password should be at least') || message.includes('password must be at least')) {
    return 'Use a password with at least 8 characters.';
  }
  if (message.includes('unsupported provider') || message.includes('provider is not enabled')) {
    return 'That sign-in option is not enabled yet. Use email and password instead.';
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
  getToken: () => Promise<string | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

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
    configureApi(() => SUPABASE_AUTH_CONFIGURED
      ? supabase.auth.getSession().then(({ data }) => data.session?.access_token ?? null)
      : Promise.resolve(null));
    registerAuthUnauthorizedHandler(async () => {
      if (!SUPABASE_AUTH_CONFIGURED) return;
      try {
        const refreshed = await supabase.auth.refreshSession();
        if (refreshed.error || !refreshed.data.session) {
          await supabase.auth.signOut({ scope: 'local' });
        }
      } catch {
        await supabase.auth.signOut({ scope: 'local' });
      }
    });
    return () => registerAuthUnauthorizedHandler(null);
  }, []);

  const value = useMemo<AuthContextValue>(() => ({
    isLoaded,
    isSignedIn: Boolean(session?.user),
    userId: session?.user.id ?? null,
    session,
    getToken: async () => SUPABASE_AUTH_CONFIGURED
      ? (await supabase.auth.getSession()).data.session?.access_token ?? null
      : null,
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