import type { ActiveRoute, RoutePoint } from './routes-storage';

export const ROUTE_MIN_SEGMENT_METERS = 3;
export const ROUTE_GPS_STALE_AFTER_MS = 15_000;

export function distanceBetweenMeters(
  a: Pick<RoutePoint, 'latitude' | 'longitude'>,
  b: Pick<RoutePoint, 'latitude' | 'longitude'>,
) {
  const earthRadius = 6_371_000;
  const latitudeDelta = (b.latitude - a.latitude) * Math.PI / 180;
  const longitudeDelta = (b.longitude - a.longitude) * Math.PI / 180;
  const latitudeA = a.latitude * Math.PI / 180;
  const latitudeB = b.latitude * Math.PI / 180;
  const haversine = Math.sin(latitudeDelta / 2) ** 2
    + Math.cos(latitudeA) * Math.cos(latitudeB) * Math.sin(longitudeDelta / 2) ** 2;
  return 2 * earthRadius * Math.atan2(Math.sqrt(haversine), Math.sqrt(1 - haversine));
}

export function appendRoutePoint(current: ActiveRoute, nextPoint: RoutePoint): ActiveRoute | null {
  const previous = current.coordinates.at(-1);
  if (!previous || nextPoint.timestamp <= previous.timestamp) return null;
  const segment = distanceBetweenMeters(previous, nextPoint);
  return {
    ...current,
    distanceMeters: current.distanceMeters + (segment >= ROUTE_MIN_SEGMENT_METERS ? segment : 0),
    coordinates: [...current.coordinates, nextPoint],
    validation: nextPoint.accuracy !== null && nextPoint.accuracy > 80
      ? 'needs_review'
      : current.validation === 'needs_review' ? 'needs_review' : 'pending',
  };
}

export function isRouteGpsStale(
  route: Pick<ActiveRoute, 'status' | 'coordinates'> | null,
  now = Date.now(),
  staleAfterMs = ROUTE_GPS_STALE_AFTER_MS,
) {
  if (!route || route.status !== 'recording') return false;
  const lastPoint = route.coordinates.at(-1);
  return !lastPoint || now - lastPoint.timestamp >= staleAfterMs;
}