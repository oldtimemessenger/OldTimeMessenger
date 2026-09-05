import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';
import type { PacePoint } from './pace-api';

export type PaceTrackedPoint = PacePoint & { recordedAt: number };
export type PaceRecordingStatus = 'recording' | 'paused' | 'finished';
export type PaceRecording = {
  id: string;
  status: PaceRecordingStatus;
  startedAt: number;
  elapsedSeconds: number;
  distanceKm: number;
  points: PaceTrackedPoint[];
};

export const PACE_RECORDING_STORAGE_KEY = '@old-time/pace-active-recording';
export const PACE_BACKGROUND_TASK_NAME = 'old-time-pace-background-location';

type PaceBackgroundTaskData = {
  locations?: Location.LocationObject[];
};

export function distanceBetweenKm(left: PacePoint, right: PacePoint) {
  const radians = (value: number) => value * Math.PI / 180;
  const deltaLatitude = radians(right.latitude - left.latitude);
  const deltaLongitude = radians(right.longitude - left.longitude);
  const a = Math.sin(deltaLatitude / 2) ** 2
    + Math.cos(radians(left.latitude)) * Math.cos(radians(right.latitude)) * Math.sin(deltaLongitude / 2) ** 2;
  return 6_371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function appendTrackedPoint(recording: PaceRecording, point: PaceTrackedPoint): PaceRecording {
  const previous = recording.points.at(-1);
  if (!previous || point.recordedAt > previous.recordedAt) {
    const increment = previous ? distanceBetweenKm(previous, point) : 0;
    if (!previous || increment >= 0.003) {
      return {
        ...recording,
        distanceKm: recording.distanceKm + increment,
        points: [...recording.points, point],
      };
    }
  }
  return recording;
}

export async function getStoredPaceRecording() {
  const raw = await AsyncStorage.getItem(PACE_RECORDING_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as PaceRecording;
  } catch {
    await AsyncStorage.removeItem(PACE_RECORDING_STORAGE_KEY);
    return null;
  }
}

export function savePaceRecording(recording: PaceRecording) {
  return AsyncStorage.setItem(PACE_RECORDING_STORAGE_KEY, JSON.stringify(recording));
}

export function clearPaceRecording() {
  return AsyncStorage.removeItem(PACE_RECORDING_STORAGE_KEY);
}

async function appendBackgroundLocations(locations: Location.LocationObject[]) {
  const stored = await getStoredPaceRecording();
  if (!stored || stored.status !== 'recording') return;

  let updated = stored;
  for (const location of locations) {
    updated = appendTrackedPoint(updated, {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      recordedAt: location.timestamp || Date.now(),
    });
  }

  if (updated !== stored) {
    await savePaceRecording(updated);
  }
}

if (Platform.OS !== 'web' && !TaskManager.isTaskDefined(PACE_BACKGROUND_TASK_NAME)) {
  TaskManager.defineTask<PaceBackgroundTaskData>(PACE_BACKGROUND_TASK_NAME, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    await appendBackgroundLocations(data.locations);
  });
}

const PACE_LOCATION_TASK_OPTIONS: Location.LocationTaskOptions = {
  accuracy: Location.Accuracy.BestForNavigation,
  distanceInterval: 10,
  timeInterval: 5_000,
  deferredUpdatesDistance: 10,
  deferredUpdatesInterval: 5_000,
  activityType: Location.ActivityType.Fitness,
  pausesUpdatesAutomatically: false,
  showsBackgroundLocationIndicator: true,
  foregroundService: {
    notificationTitle: 'Pace is recording',
    notificationBody: 'Old Time is recording your route until you finish.',
    notificationColor: '#6F20B4',
  },
};

export async function startPaceLocationUpdates() {
  if (Platform.OS === 'web') return false;
  if (await Location.hasStartedLocationUpdatesAsync(PACE_BACKGROUND_TASK_NAME)) return true;
  await Location.startLocationUpdatesAsync(PACE_BACKGROUND_TASK_NAME, PACE_LOCATION_TASK_OPTIONS);
  return true;
}

export async function stopPaceLocationUpdates() {
  if (Platform.OS === 'web') return false;
  if (!(await Location.hasStartedLocationUpdatesAsync(PACE_BACKGROUND_TASK_NAME))) return false;
  await Location.stopLocationUpdatesAsync(PACE_BACKGROUND_TASK_NAME);
  return true;
}