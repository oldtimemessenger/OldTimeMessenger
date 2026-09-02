export function apiBaseUrl(): string {
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin;
  }

  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : '';
}