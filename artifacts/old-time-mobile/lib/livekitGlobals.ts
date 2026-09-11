import { Platform } from 'react-native';

let registrationResult: boolean | null = null;

export function setupLiveKit() {
  if (Platform.OS === 'web') return false;
  if (registrationResult !== null) return registrationResult;

  try {
    // Keep the native WebRTC module out of the web runtime and out of app
    // startup. Calls initialize this only after their screen is mounted.
    const { registerGlobals } = require('@livekit/react-native') as typeof import('@livekit/react-native');
    registerGlobals();
    registrationResult = true;
  } catch {
    registrationResult = false;
  }

  return registrationResult;
}