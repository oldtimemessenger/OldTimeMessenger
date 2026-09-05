import { mobileApiRequest } from '@/lib/mobile-api';

export type PacePoint = { latitude: number; longitude: number };
export type PaceActivity = 'run' | 'walk' | 'bike' | 'hike';
export type PaceDifficulty = 'easy' | 'steady' | 'hard';
export type PaceKind = 'route' | 'challenge';

export type PaceAuthor = {
  id: number;
  name: string;
  username: string;
  avatarObjectPath?: string | null;
};

export type PaceRoute = {
  id: number;
  suggested: false;
  title: string;
  description: string;
  kind: PaceKind;
  visibility: 'public' | 'private';
  activity: PaceActivity;
  difficulty: PaceDifficulty;
  distanceKm: number;
  elevationM: number;
  durationMin: number;
  startLatitude: number;
  startLongitude: number;
  locationLabel: string;
  routeCoordinates: PacePoint[];
  createdAt: number;
  author: PaceAuthor;
  distanceFromYouKm: number | null;
  counts: { likes: number; comments: number; gifts: number };
  viewer: { liked: boolean; isOwner: boolean };
};

export type PaceSuggestion = {
  id: string;
  suggested: true;
  title: string;
  description: string;
  kind: PaceKind;
  visibility: 'public' | 'private';
  activity: PaceActivity;
  difficulty: PaceDifficulty;
  distanceKm: number;
  elevationM: number;
  durationMin: number;
  locationLabel: string;
  distanceFromYouKm: number;
  routeCoordinates: PacePoint[];
};

export type PaceComment = {
  id: number;
  routeId: number;
  content: string;
  createdAt: number;
  author: PaceAuthor;
  likes: number;
  liked: boolean;
};

const request = mobileApiRequest;

export function getPaceFeed(token: string, location?: PacePoint) {
  const query = new URLSearchParams();
  if (location) {
    query.set('latitude', String(location.latitude));
    query.set('longitude', String(location.longitude));
  }
  return request<{ items: PaceRoute[]; suggestions: PaceSuggestion[] }>(token, `/api/pace/feed?${query.toString()}`);
}

export function createPaceRoute(token: string, input: Omit<PaceRoute, 'id' | 'suggested' | 'createdAt' | 'author' | 'distanceFromYouKm' | 'counts' | 'viewer'>) {
  return request<PaceRoute>(token, '/api/pace/routes', { method: 'POST', body: JSON.stringify(input) });
}

export function setPaceRouteLike(token: string, routeId: number, active: boolean) {
  return request<{ success: boolean; active: boolean }>(token, `/api/pace/routes/${routeId}/like`, { method: active ? 'PUT' : 'DELETE' });
}

export function getPaceComments(token: string, routeId: number) {
  return request<{ items: PaceComment[] }>(token, `/api/pace/routes/${routeId}/comments`);
}

export function createPaceComment(token: string, routeId: number, content: string) {
  return request<PaceComment>(token, `/api/pace/routes/${routeId}/comments`, { method: 'POST', body: JSON.stringify({ content }) });
}

export function setPaceCommentLike(token: string, commentId: number, active: boolean) {
  return request<{ success: boolean; active: boolean }>(token, `/api/pace/comments/${commentId}/like`, { method: active ? 'PUT' : 'DELETE' });
}

export function sendPaceGift(token: string, routeId: number, gift: 'coffee' | 'idea' | 'heart' | 'gem' | 'studio' | 'time_is_up') {
  return request<{ success: boolean; gift: string; coinsSpent: number; goldEarned: number; coinsRemaining: number }>(token, `/api/pace/routes/${routeId}/gifts`, {
    method: 'POST',
    body: JSON.stringify({ gift }),
  });
}