import { SUPABASE_AUTH_CONFIGURED } from './supabase';

export type AccessTokenFailure = 'unconfigured' | 'no_session' | 'refresh_failed';

let lastAccessTokenFailure: AccessTokenFailure | null = null;

export function setAccessTokenFailure(reason: AccessTokenFailure | null) {
  lastAccessTokenFailure = reason;
}

export function getAccessTokenFailure() {
  return lastAccessTokenFailure;
}

export function getMissingPublicEnv(): string[] {
  const missing: string[] = [];
  if (!process.env.EXPO_PUBLIC_SUPABASE_URL) missing.push('EXPO_PUBLIC_SUPABASE_URL');
  if (!process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY && !process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY) {
    missing.push('EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY or EXPO_PUBLIC_SUPABASE_ANON_KEY');
  }
  if (!process.env.EXPO_PUBLIC_API_URL && !process.env.EXPO_PUBLIC_DOMAIN) {
    missing.push('EXPO_PUBLIC_API_URL or EXPO_PUBLIC_DOMAIN');
  }
  return missing;
}

export function describeMissingAccessToken(): string {
  if (lastAccessTokenFailure === 'unconfigured' || !SUPABASE_AUTH_CONFIGURED) {
    const missing = getMissingPublicEnv();
    return missing.length
      ? `Sign in required: this build is missing ${missing.join(', ')}.`
      : 'Sign in required: Supabase is not configured for this build.';
  }
  if (lastAccessTokenFailure === 'refresh_failed') {
    return 'Sign in required: session refresh failed.';
  }
  return 'Sign in required: no session.';
}
