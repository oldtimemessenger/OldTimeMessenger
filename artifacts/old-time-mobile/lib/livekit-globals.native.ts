import { registerGlobals } from '@livekit/react-native';

// LiveKit's WebRTC globals must be installed before Room is constructed.
registerGlobals();