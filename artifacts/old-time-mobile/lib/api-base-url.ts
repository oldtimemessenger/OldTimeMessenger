import Constants from 'expo-constants';

const DEVELOPMENT_FALLBACK_ORIGIN = 'https://old-time-messenger--kingvercetti59.replit.app';

function normalizeOrigin(value: string): string {
  const candidate = /^[a-z][a-z\d+.-]*:\/\//i.test(value) ? value : `https://${value}`;
  const url = new URL(candidate);
  if (!__DEV__ && url.protocol !== 'https:') {
    throw new Error('Production API origin must use HTTPS.');
  }
  if (url.username || url.password || url.search || url.hash || (url.pathname && url.pathname !== '/')) {
    throw new Error('API origin must not contain credentials, a path, query parameters, or a fragment.');
  }
  return url.origin;
}

function configuredOrigin(): string | null {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const candidates = [
    process.env.EXPO_PUBLIC_DOMAIN,
    typeof extra?.domain === 'string' ? extra.domain : null,
    typeof extra?.apiDomain === 'string' ? extra.apiDomain : null,
    __DEV__ && typeof Constants.expoConfig?.hostUri === 'string' ? Constants.expoConfig.hostUri : null,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return normalizeOrigin(candidate.trim());
    }
  }
  return null;
}

/**
 * Resolve the API origin used by the mobile client.
 *
 * Web previews should prefer the live page origin so local routers stay in sync.
 * Native builds must never return an empty string — an empty host produces
 * network failures that surface as generic 404 / "not found" errors.
 */
export function apiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  const configured = configuredOrigin();
  if (configured) return configured;
  if (__DEV__) return DEVELOPMENT_FALLBACK_ORIGIN;
  throw new Error('EXPO_PUBLIC_DOMAIN must be configured for production builds.');
}

/** True when the resolved host is only the hard-coded fallback. */
export function isApiBaseUrlFallback(): boolean {
  if (typeof window !== 'undefined' && window.location?.origin) return false;
  return __DEV__ && configuredOrigin() === null;
}
