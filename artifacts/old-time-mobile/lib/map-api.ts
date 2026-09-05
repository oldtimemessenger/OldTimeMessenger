import { apiBaseUrl } from '@/lib/api-base-url';
import { mobileApiRequest } from '@/lib/mobile-api';

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

export type NearbyPlace = {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  category: string;
  openingHours: string | null;
  mapUri: string;
};

function baseUrl() {
  return apiBaseUrl();
}

const request = mobileApiRequest;

export function getNearbyPins(token: string, latitude: number, longitude: number, radiusKm = 25) {
  return request<{ items: MapPin[] }>(
    token,
    `/api/map/pins/nearby?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&radiusKm=${encodeURIComponent(radiusKm)}`,
  );
}

export function getNearbyPlaces(token: string, latitude: number, longitude: number, category: 'all' | 'restaurant' | 'cafe' | 'shop' | 'club' | 'gym' | 'park' | 'church', radiusMeters = 5_000) {
  return request<{ items: NearbyPlace[]; attribution: '© OpenStreetMap contributors' }>(
    token,
    `/api/map/places/nearby?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&category=${encodeURIComponent(category)}&radiusMeters=${encodeURIComponent(radiusMeters)}`,
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
