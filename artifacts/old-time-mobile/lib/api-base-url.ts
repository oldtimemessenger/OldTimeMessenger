import Constants from 'expo-constants';

const FALLBACK_DOMAIN = 'old-time-messenger--kingvercetti59.replit.app';

function stripProtocol(value: string): string {
  return value.replace(/^https?:\/\//i, '').replace(/\/+$/, '');
}

function domainFromExtra(): string | null {
  const extra = Constants.expoConfig?.extra as Record<string, unknown> | undefined;
  const candidates = [
    process.env.EXPO_PUBLIC_DOMAIN,
    typeof extra?.domain === 'string' ? extra.domain : null,
    typeof extra?.apiDomain === 'string' ? extra.apiDomain : null,
    typeof Constants.expoConfig?.hostUri === 'string' ? Constants.expoConfig.hostUri.split(':')[0] : null,
  ];
  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return stripProtocol(candidate.trim());
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

  const domain = domainFromExtra() ?? FALLBACK_DOMAIN;
  return `https://${domain}`;
}

/** True when the resolved host is only the hard-coded fallback. */
export function isApiBaseUrlFallback(): boolean {
  if (typeof window !== 'undefined' && window.location?.origin) return false;
  return domainFromExtra() === null;
}
