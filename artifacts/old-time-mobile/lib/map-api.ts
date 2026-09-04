import { apiBaseUrl } from '@/lib/api-base-url';

export type MapVisibility = 'public' | 'friends' | 'followers' | 'private';

export type MapComment = {
  id: number;
  pinId: number;
  author: { id: number; name: string; username: string };
  content: string;
  createdAt: number;
};

export type MapPin = {
  id: number;
  authorId: number;
  author: { id: number; name: string; username: string };
  latitude: number;
  longitude: number;
  caption: string | null;
  visibility: MapVisibility;
  createdAt: number;
  updatedAt: number;
  expiresAt: number | null;
  distanceKm: number;
  counts: { reactions: number; comments: number; saves: number };
  viewer: { reacted: boolean; saved: boolean };
};

export type DiscoveryItem = {
  id: number;
  platform: 'youtube' | 'tiktok' | 'x';
  url: string;
  embedHtml: string;
  title: string;
  creator: { name: string; handle: string | null };
  category: string | null;
  engagement: { views?: number; likes?: number; comments?: number; shares?: number };
  latitude: number | null;
  longitude: number | null;
  locationLabel: string | null;
  publishedAt: number | null;
  discoveredAt: number;
  distanceKm: number | null;
  score: number;
};

function baseUrl() {
  return apiBaseUrl();
}

async function request<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const origin = baseUrl();
  if (!origin) {
    throw new Error('Old Time could not reach the server. Check your connection and try again.');
  }
  let response: Response;
  try {
    response = await fetch(`${origin}${path}`, {
      ...init,
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
    });
  } catch {
    throw new Error('Old Time could not reach the server. Check your connection and try again.');
  }
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data && typeof data === 'object' && typeof data.error === 'string'
      ? data.error
      : 'The request could not be completed.');
  }
  return data as T;
}

export function getNearbyPins(token: string, latitude: number, longitude: number, radiusKm = 25) {
  return request<{ items: MapPin[] }>(
    token,
    `/api/map/pins/nearby?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&radiusKm=${encodeURIComponent(radiusKm)}`,
  );
}

export function getNearbyDiscoveryItems(token: string, latitude: number, longitude: number, radiusKm = 10) {
  return request<{ items: DiscoveryItem[]; usedGlobalFallback: boolean }>(
    token,
    `/api/discovery/nearby?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&radiusKm=${encodeURIComponent(radiusKm)}`,
  );
}

export function discoveryEmbedUrl(itemId: number) {
  return `${baseUrl()}/api/discovery/items/${itemId}/embed`;
}

export function getDiscoveryFeed(token: string, limit = 12) {
  return request<{ items: DiscoveryItem[] }>(
    token,
    `/api/discovery/feed?limit=${encodeURIComponent(limit)}`,
  );
}

export function createMapPin(token: string, input: {
  latitude: number; longitude: number; caption?: string; visibility: MapVisibility; expiresAt?: number | null;
}) {
  return request<MapPin>(token, '/api/map/pins', { method: 'POST', body: JSON.stringify(input) });
}

export function deleteMapPin(token: string, pinId: number) {
  return request<{ success: boolean }>(token, `/api/map/pins/${pinId}`, { method: 'DELETE' });
}

export function setMapPinRelation(token: string, pinId: number, relation: 'reaction' | 'save', active: boolean) {
  return request<{ success: boolean; active: boolean }>(token, `/api/map/pins/${pinId}/${relation}`, {
    method: active ? 'PUT' : 'DELETE',
  });
}

export function getMapPinComments(token: string, pinId: number) {
  return request<MapComment[]>(token, `/api/map/pins/${pinId}/comments`);
}

export function createMapPinComment(token: string, pinId: number, content: string) {
  return request<MapComment>(token, `/api/map/pins/${pinId}/comments`, {
    method: 'POST', body: JSON.stringify({ content }),
  });
}

export function reportMapPin(token: string, pinId: number, reason: 'spam' | 'harassment' | 'other') {
  return request<{ success: boolean }>(token, `/api/map/pins/${pinId}/report`, {
    method: 'POST', body: JSON.stringify({ reason }),
  });
}
