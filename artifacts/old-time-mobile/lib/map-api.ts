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

function baseUrl() {
  const domain = process.env.EXPO_PUBLIC_DOMAIN;
  return domain ? `https://${domain}` : '';
}

async function request<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${baseUrl()}${path}`, {
    ...init,
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`,
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });
  const data = response.status === 204 ? null : await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(data && typeof data === 'object' && typeof data.error === 'string'
      ? data.error
      : 'The request could not be completed.');
  }
  return data as T;
}

export function getNearbyPins(token: string, latitude: number, longitude: number) {
  return request<{ items: MapPin[] }>(
    token,
    `/api/map/pins/nearby?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&radiusKm=25`,
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