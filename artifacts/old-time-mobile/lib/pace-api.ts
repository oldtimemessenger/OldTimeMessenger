import { mobileApiRequest } from "@/lib/mobile-api";

export type PaceActivityType = "running" | "walking" | "cycling" | "hiking" | "jogging" | "other";
export type PaceVisibility = "public" | "followers" | "private";
export type PaceLifecycleStatus = "active" | "paused" | "finished" | "discarded";
export type PaceSyncStatus = "local" | "pending" | "uploading" | "synced" | "failed";

export type PacePoint = {
  sequence: number;
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  heading?: number;
};

export type PaceActivity = {
  id: number;
  activityUuid: string;
  activityType: PaceActivityType;
  title: string;
  description: string;
  visibility: PaceVisibility;
  lifecycleStatus: PaceLifecycleStatus;
  syncStatus: PaceSyncStatus;
  startedAt: number;
  endedAt: number | null;
  elapsedTimeSec: number;
  movingTimeSec: number;
  distanceMeters: number;
  averageSpeedMps: number;
  averagePaceSecPerKm: number;
  maxSpeedMps: number;
  elevationGainMeters: number;
  elevationLossMeters: number;
  calories: number | null;
  heartRateAverage: number | null;
  heartRateMax: number | null;
  heartRateMin: number | null;
  autoPauseEnabled: boolean;
  voiceAnnouncementsEnabled: boolean;
  hideStartEnd: boolean;
  privacyRadiusMeters: number;
  caption: string;
  photos: Array<{ objectPath: string; mimeType: string }>;
  challengeIds: number[];
  antiCheatSignals: null | Record<string, boolean>;
  leaderboardEligible: boolean;
  leaderboardIneligibleReason: string | null;
  route: Array<{ latitude: number; longitude: number }>;
  author: {
    id: number;
    name: string;
    username: string | null;
    avatarObjectPath: string | null;
  } | null;
  counts: { likes: number; comments: number };
  viewer: { liked: boolean; own: boolean };
  createdAt: number;
  updatedAt: number;
};

const request = mobileApiRequest;

export function createPaceActivity(token: string, input: {
  activityUuid: string;
  activityType: PaceActivityType;
  title?: string;
  description?: string;
  visibility?: PaceVisibility;
  autoPauseEnabled?: boolean;
  voiceAnnouncementsEnabled?: boolean;
  equipment?: string | null;
  challengeIds?: number[];
  hideStartEnd?: boolean;
  privacyRadiusMeters?: number;
  startedAt?: number;
}) {
  return request<PaceActivity>(token, "/api/pace/activities", {
    method: "POST",
    body: JSON.stringify(input),
  });
}

export function startPaceActivity(token: string, activityId: number) {
  return request<PaceActivity>(token, `/api/pace/activities/${activityId}/start`, { method: "PUT" });
}

export function appendPacePoints(token: string, activityId: number, points: PacePoint[], syncStatus?: PaceSyncStatus) {
  return request<{ success: boolean; accepted: number; acceptedSequences: number[]; activity: PaceActivity }>(token, `/api/pace/activities/${activityId}/points`, {
    method: "POST",
    body: JSON.stringify({ points, syncStatus }),
  });
}

export function pausePaceActivity(token: string, activityId: number, syncStatus?: PaceSyncStatus) {
  return request<PaceActivity>(token, `/api/pace/activities/${activityId}/pause`, {
    method: "PUT",
    body: JSON.stringify({ syncStatus }),
  });
}

export function resumePaceActivity(token: string, activityId: number, syncStatus?: PaceSyncStatus) {
  return request<PaceActivity>(token, `/api/pace/activities/${activityId}/resume`, {
    method: "PUT",
    body: JSON.stringify({ syncStatus }),
  });
}

export function finishPaceActivity(token: string, activityId: number, input: {
  endedAt?: number;
  elapsedTimeSec?: number;
  caption?: string;
  photos?: Array<{ objectPath: string; mimeType: string }>;
  visibility?: PaceVisibility;
  calories?: number | null;
  heartRateAverage?: number | null;
  heartRateMax?: number | null;
  heartRateMin?: number | null;
}) {
  return request<PaceActivity>(token, `/api/pace/activities/${activityId}/finish`, {
    method: "PUT",
    body: JSON.stringify(input),
  });
}

export function discardPaceActivity(token: string, activityId: number) {
  return request<{ success: boolean }>(token, `/api/pace/activities/${activityId}`, {
    method: "DELETE",
  });
}

export function retryPaceSync(token: string, activityId: number) {
  return request<PaceActivity>(token, `/api/pace/activities/${activityId}/sync-retry`, {
    method: "POST",
  });
}

export function getPaceHome(token: string) {
  return request<{
    activeCount: number;
    recentDistanceMeters: number;
    recentMovingTimeSec: number;
    recentActivities: PaceActivity[];
    nearbyActivity: Array<{ activityType: string; count: number }>;
    challenges: Array<{
      id: number;
      name: string;
      description: string;
      targetDistanceMeters: number | null;
      progressDistanceMeters: number;
    }>;
  }>(token, "/api/pace/home");
}

export function getPaceFeed(token: string, limit = 20) {
  return request<{ items: PaceActivity[] }>(token, `/api/pace/feed?limit=${encodeURIComponent(limit)}`);
}

export function getPaceHistory(token: string, input?: { limit?: number; activityType?: PaceActivityType }) {
  const params = new URLSearchParams();
  if (input?.limit) params.set("limit", String(input.limit));
  if (input?.activityType) params.set("activityType", input.activityType);
  return request<{ items: PaceActivity[] }>(token, `/api/pace/history${params.size ? `?${params.toString()}` : ""}`);
}

export function getPaceProfile(token: string, userId?: number) {
  return request<{
    user: {
      id: number;
      name: string;
      username: string | null;
      bio: string | null;
      avatarObjectPath: string | null;
    };
    stats: {
      totalActivities: number;
      totalDistanceMeters: number;
      totalMovingTimeSec: number;
      longestActivityMeters: number;
      bestPaceSecPerKm: number;
    };
    recent: PaceActivity[];
  }>(token, userId ? `/api/pace/profile/${userId}` : "/api/pace/profile");
}

export function getPaceNearby(token: string, latitude: number, longitude: number, radiusKm = 5) {
  return request<{ items: Array<{ activityType: string; count: number }> }>(
    token,
    `/api/pace/nearby?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}&radiusKm=${encodeURIComponent(radiusKm)}`,
  );
}
