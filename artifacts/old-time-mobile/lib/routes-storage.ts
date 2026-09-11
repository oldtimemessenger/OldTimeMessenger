import AsyncStorage from '@react-native-async-storage/async-storage';
export { distanceBetweenMeters } from './route-recording';

export type RouteActivity = 'run' | 'walk' | 'ride' | 'hike' | 'skate';
export type RouteStatus = 'recording' | 'paused';
export type RouteValidation = 'pending' | 'verified' | 'needs_review';

export type RoutePoint = {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number | null;
  speed: number | null;
  altitude: number | null;
};

export type ActiveRoute = {
  id: string;
  activity: RouteActivity;
  status: RouteStatus;
  startedAt: number;
  elapsedSeconds: number;
  lastResumedAt: number | null;
  distanceMeters: number;
  coordinates: RoutePoint[];
  validation: RouteValidation;
};

export type FinishedRoute = Omit<ActiveRoute, 'status' | 'lastResumedAt'> & {
  finishedAt: number;
  sharedAt: number | null;
};

export type RouteChallenge = {
  id: string;
  title: string;
  activity: RouteActivity;
  targetDistanceMeters: number;
  startsAt: number;
  endsAt: number;
  createdAt: number;
};

export type RoutesStore = {
  activeRoute: ActiveRoute | null;
  finishedRoutes: FinishedRoute[];
  challenges: RouteChallenge[];
  bodyWeightKg: number;
};

export const emptyRoutesStore: RoutesStore = {
  activeRoute: null,
  finishedRoutes: [],
  challenges: [],
  bodyWeightKg: 70,
};

export const routeActivityProfiles: Record<RouteActivity, {
  targetPaceSecondsPerKm: number;
  caloriesPerKgHour: number;
  elevationMetersPerKm: number;
  defaultDistanceKm: number;
}> = {
  run: { targetPaceSecondsPerKm: 360, caloriesPerKgHour: 9.8, elevationMetersPerKm: 24, defaultDistanceKm: 5 },
  walk: { targetPaceSecondsPerKm: 720, caloriesPerKgHour: 3.5, elevationMetersPerKm: 12, defaultDistanceKm: 3 },
  ride: { targetPaceSecondsPerKm: 180, caloriesPerKgHour: 8, elevationMetersPerKm: 18, defaultDistanceKm: 12 },
  hike: { targetPaceSecondsPerKm: 900, caloriesPerKgHour: 6, elevationMetersPerKm: 35, defaultDistanceKm: 5 },
  skate: { targetPaceSecondsPerKm: 420, caloriesPerKgHour: 7, elevationMetersPerKm: 10, defaultDistanceKm: 6 },
};

export function routesStorageKey(userId: string) {
  return `old-time-routes-v1:${userId}`;
}

export async function loadRoutesStore(userId: string): Promise<RoutesStore> {
  const raw = await AsyncStorage.getItem(routesStorageKey(userId));
  if (!raw) return emptyRoutesStore;
  try {
    const parsed = JSON.parse(raw) as Partial<RoutesStore>;
    return {
      activeRoute: parsed.activeRoute ?? null,
      finishedRoutes: Array.isArray(parsed.finishedRoutes) ? parsed.finishedRoutes : [],
      challenges: Array.isArray(parsed.challenges) ? parsed.challenges : [],
      bodyWeightKg: typeof parsed.bodyWeightKg === 'number' && parsed.bodyWeightKg > 0 ? parsed.bodyWeightKg : 70,
    };
  } catch {
    await AsyncStorage.removeItem(routesStorageKey(userId));
    return emptyRoutesStore;
  }
}

export function saveRoutesStore(userId: string, store: RoutesStore) {
  return AsyncStorage.setItem(routesStorageKey(userId), JSON.stringify(store));
}

export function makeRouteId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function elapsedSeconds(route: Pick<ActiveRoute, 'elapsedSeconds' | 'lastResumedAt' | 'status'>, now = Date.now()) {
  if (route.status !== 'recording' || !route.lastResumedAt) return route.elapsedSeconds;
  return route.elapsedSeconds + Math.max(0, Math.floor((now - route.lastResumedAt) / 1000));
}

export function formatDuration(seconds: number) {
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${String(remainder).padStart(2, '0')}`;
}

export function formatDistance(meters: number) {
  if (meters < 1000) return `${Math.round(meters)} m`;
  return `${(meters / 1000).toFixed(2)} km`;
}

export function formatPace(seconds: number, meters: number) {
  if (meters < 10 || seconds <= 0) return '—';
  const secondsPerKm = seconds / (meters / 1000);
  return `${Math.floor(secondsPerKm / 60)}:${String(Math.round(secondsPerKm % 60)).padStart(2, '0')} /km`;
}

export function elevationGainMeters(points: RoutePoint[]) {
  return points.reduce((gain, point, index) => {
    const previous = points[index - 1];
    if (!previous || typeof point.altitude !== 'number' || typeof previous.altitude !== 'number') return gain;
    return gain + Math.max(0, point.altitude - previous.altitude);
  }, 0);
}

export function caloriesBurned(activity: RouteActivity, seconds: number, bodyWeightKg: number) {
  const profile = routeActivityProfiles[activity];
  return Math.max(0, Math.round(profile.caloriesPerKgHour * bodyWeightKg * (seconds / 3600)));
}

export function plannedRouteMetrics(activity: RouteActivity, distanceKm: number, bodyWeightKg: number) {
  const profile = routeActivityProfiles[activity];
  const safeDistanceKm = Math.max(0.1, distanceKm);
  const elapsed = Math.round(profile.targetPaceSecondsPerKm * safeDistanceKm);
  return {
    distanceMeters: Math.round(safeDistanceKm * 1000),
    elapsedSeconds: elapsed,
    calories: caloriesBurned(activity, elapsed, bodyWeightKg),
    elevationMeters: Math.round(profile.elevationMetersPerKm * safeDistanceKm),
    paceSecondsPerKm: profile.targetPaceSecondsPerKm,
  };
}

export function routeActivityLabel(activity: RouteActivity) {
  return activity.charAt(0).toUpperCase() + activity.slice(1);
}