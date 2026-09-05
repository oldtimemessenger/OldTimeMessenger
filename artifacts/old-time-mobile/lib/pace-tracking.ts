import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Location from "expo-location";
import type { PaceActivityType, PacePoint, PaceVisibility } from "@/lib/pace-api";

const ACTIVE_SESSION_KEY = "pace-active-session-v1";
const COMPLETED_LOCAL_KEY = "pace-completed-local-v1";

export type PaceTrackingSession = {
  activityUuid: string;
  activityId: number | null;
  activityType: PaceActivityType;
  visibility: PaceVisibility;
  autoPauseEnabled: boolean;
  voiceAnnouncementsEnabled: boolean;
  hideStartEnd: boolean;
  privacyRadiusMeters: number;
  startedAt: number;
  pausedAt: number | null;
  manualPaused: boolean;
  autoPaused: boolean;
  pauseStartedAt: number | null;
  totalPausedMs: number;
  points: PacePoint[];
  pendingPoints: PacePoint[];
  syncStatus: "local" | "pending" | "uploading" | "synced" | "failed";
  warning: string | null;
};

export type PaceLiveMetrics = {
  distanceMeters: number;
  elapsedTimeSec: number;
  movingTimeSec: number;
  averageSpeedMps: number;
  averagePaceSecPerKm: number;
  currentSpeedMps: number;
};

function randomId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function toRadians(value: number): number {
  return (value * Math.PI) / 180;
}

function distanceMeters(
  from: { latitude: number; longitude: number },
  to: { latitude: number; longitude: number },
): number {
  const earthRadius = 6371000;
  const dLat = toRadians(to.latitude - from.latitude);
  const dLon = toRadians(to.longitude - from.longitude);
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  return earthRadius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function createTrackingSession(input: {
  activityType: PaceActivityType;
  visibility: PaceVisibility;
  autoPauseEnabled: boolean;
  voiceAnnouncementsEnabled: boolean;
  hideStartEnd: boolean;
  privacyRadiusMeters: number;
}): PaceTrackingSession {
  return {
    activityUuid: `pace-${randomId()}`,
    activityId: null,
    activityType: input.activityType,
    visibility: input.visibility,
    autoPauseEnabled: input.autoPauseEnabled,
    voiceAnnouncementsEnabled: input.voiceAnnouncementsEnabled,
    hideStartEnd: input.hideStartEnd,
    privacyRadiusMeters: input.privacyRadiusMeters,
    startedAt: Date.now(),
    pausedAt: null,
    manualPaused: false,
    autoPaused: false,
    pauseStartedAt: null,
    totalPausedMs: 0,
    points: [],
    pendingPoints: [],
    syncStatus: "local",
    warning: null,
  };
}

export async function saveActiveTrackingSession(session: PaceTrackingSession | null): Promise<void> {
  if (!session) {
    await AsyncStorage.removeItem(ACTIVE_SESSION_KEY);
    return;
  }
  await AsyncStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify(session));
}

export async function loadActiveTrackingSession(): Promise<PaceTrackingSession | null> {
  const raw = await AsyncStorage.getItem(ACTIVE_SESSION_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PaceTrackingSession;
    if (!parsed?.activityUuid || !Array.isArray(parsed.points)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export async function appendCompletedLocalActivity(session: PaceTrackingSession): Promise<void> {
  const raw = await AsyncStorage.getItem(COMPLETED_LOCAL_KEY);
  const list = raw ? (JSON.parse(raw) as PaceTrackingSession[]) : [];
  const deduped = [session, ...list.filter((item) => item.activityUuid !== session.activityUuid)].slice(0, 60);
  await AsyncStorage.setItem(COMPLETED_LOCAL_KEY, JSON.stringify(deduped));
}

export async function loadCompletedLocalActivities(): Promise<PaceTrackingSession[]> {
  const raw = await AsyncStorage.getItem(COMPLETED_LOCAL_KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as PaceTrackingSession[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function deriveLiveMetrics(session: PaceTrackingSession, now = Date.now()): PaceLiveMetrics {
  let distance = 0;
  let movingMs = 0;
  let currentSpeed = 0;
  for (let index = 1; index < session.points.length; index += 1) {
    const prev = session.points[index - 1];
    const next = session.points[index];
    const dtMs = Math.max(0, next.timestamp - prev.timestamp);
    if (!dtMs) continue;
    const segmentDistance = distanceMeters(prev, next);
    distance += segmentDistance;
    const speed = typeof next.speed === "number" ? Math.max(0, next.speed) : segmentDistance / (dtMs / 1000);
    currentSpeed = speed;
    if (speed > 0.6) movingMs += dtMs;
  }
  const elapsedMs = Math.max(0, now - session.startedAt - session.totalPausedMs - (session.pauseStartedAt ? (now - session.pauseStartedAt) : 0));
  const elapsedSec = Math.round(elapsedMs / 1000);
  const movingSec = Math.round(movingMs / 1000);
  const averageSpeed = movingSec > 0 ? distance / movingSec : 0;
  return {
    distanceMeters: distance,
    elapsedTimeSec: elapsedSec,
    movingTimeSec: movingSec,
    averageSpeedMps: averageSpeed,
    averagePaceSecPerKm: distance > 0 ? movingSec / (distance / 1000) : 0,
    currentSpeedMps: currentSpeed,
  };
}

export function updateSessionWithPoint(session: PaceTrackingSession, point: Omit<PacePoint, "sequence">): PaceTrackingSession {
  const nextPoint: PacePoint = {
    ...point,
    sequence: session.points.length ? session.points[session.points.length - 1].sequence + 1 : 0,
  };
  return {
    ...session,
    points: [...session.points, nextPoint],
    pendingPoints: [...session.pendingPoints, nextPoint],
    syncStatus: "pending",
  };
}

export function consumeUploadBatch(session: PaceTrackingSession, acceptedSequences: number[]): PaceTrackingSession {
  const accepted = new Set(acceptedSequences);
  return {
    ...session,
    pendingPoints: session.pendingPoints.filter((point) => !accepted.has(point.sequence)),
    syncStatus: session.pendingPoints.length === accepted.size ? "synced" : "pending",
  };
}

export function takePendingPointBatches(session: PaceTrackingSession, batchSize = 80): PacePoint[][] {
  const batches: PacePoint[][] = [];
  for (let index = 0; index < session.pendingPoints.length; index += batchSize) {
    batches.push(session.pendingPoints.slice(index, index + batchSize));
  }
  return batches;
}

export function pauseSession(session: PaceTrackingSession, automatic = false): PaceTrackingSession {
  if (session.pauseStartedAt) return session;
  return {
    ...session,
    manualPaused: !automatic || session.manualPaused,
    autoPaused: automatic || session.autoPaused,
    pauseStartedAt: Date.now(),
    pausedAt: Date.now(),
  };
}

export function resumeSession(session: PaceTrackingSession): PaceTrackingSession {
  if (!session.pauseStartedAt) return {
    ...session,
    manualPaused: false,
    autoPaused: false,
  };
  const now = Date.now();
  return {
    ...session,
    totalPausedMs: session.totalPausedMs + Math.max(0, now - session.pauseStartedAt),
    pauseStartedAt: null,
    pausedAt: null,
    manualPaused: false,
    autoPaused: false,
  };
}

export async function ensureTrackingPermission(): Promise<{ granted: boolean; canAskAgain: boolean }> {
  const existing = await Location.getForegroundPermissionsAsync();
  if (existing.granted) return { granted: true, canAskAgain: existing.canAskAgain };
  const requested = await Location.requestForegroundPermissionsAsync();
  return { granted: requested.granted, canAskAgain: requested.canAskAgain };
}

export async function startLocationWatch(
  onPoint: (point: Omit<PacePoint, "sequence">) => void,
  onError: (message: string) => void,
) {
  try {
    return await Location.watchPositionAsync(
      {
        accuracy: Location.Accuracy.Balanced,
        timeInterval: 4_000,
        distanceInterval: 5,
      },
      (location) => {
        onPoint({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
          timestamp: location.timestamp || Date.now(),
          accuracy: typeof location.coords.accuracy === "number" ? location.coords.accuracy : undefined,
          altitude: typeof location.coords.altitude === "number" ? location.coords.altitude : undefined,
          speed: typeof location.coords.speed === "number" ? location.coords.speed : undefined,
          heading: typeof location.coords.heading === "number" ? location.coords.heading : undefined,
        });
      },
    );
  } catch (error) {
    onError(error instanceof Error ? error.message : "Location updates could not start.");
    return null;
  }
}
