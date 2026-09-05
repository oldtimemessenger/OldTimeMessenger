import { mobileApiRequest } from '@/lib/mobile-api';

export type AtmosphereItemKind = 'route' | 'motivation' | 'world' | 'hub' | 'pace' | 'map' | 'external';
export type AtmosphereAction = 'map' | 'hub' | 'pace' | 'external' | 'none';

export type AtmosphereItem = {
  id: string;
  kind: AtmosphereItemKind;
  origin: 'generated' | 'legitimate';
  label: string;
  title: string;
  description: string;
  category: string | null;
  locationLabel: string | null;
  coordinates: { latitude: number; longitude: number } | null;
  cta: { label: string; action: AtmosphereAction; value: string | null } | null;
};

export type AtmosphereFeed = {
  enabled: boolean;
  testMode: boolean;
  mix: { realContentCount: number; discoveryCount: number; discoveryRatio: number };
  items: AtmosphereItem[];
};

export function getAtmosphereFeed(token: string, input: {
  limit?: number;
  interests?: string[];
  latitude?: number | null;
  longitude?: number | null;
  sessionId: string;
  language?: string;
}) {
  const params = new URLSearchParams();
  if (input.limit) params.set('limit', String(input.limit));
  if (input.interests?.length) params.set('interests', input.interests.join(','));
  if (typeof input.latitude === 'number') params.set('latitude', String(input.latitude));
  if (typeof input.longitude === 'number') params.set('longitude', String(input.longitude));
  params.set('sessionId', input.sessionId);
  if (input.language) params.set('language', input.language);
  return mobileApiRequest<AtmosphereFeed>(token, `/api/atmosphere/feed?${params.toString()}`);
}

export function trackAtmosphereInteraction(token: string, input: {
  itemId: string;
  itemKind: AtmosphereItemKind;
  interaction: 'impression' | 'open' | 'dismiss' | 'complete';
  sessionId?: string;
  metadata?: Record<string, unknown>;
}) {
  return mobileApiRequest<{ success?: boolean }>(token, '/api/atmosphere/interactions', {
    method: 'POST',
    body: JSON.stringify(input),
  });
}