import AsyncStorage from '@react-native-async-storage/async-storage';
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