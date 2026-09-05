import { forwardRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export type CallVideoSurfaceProps = {
  serverUrl: string;
  token: string;
  muted: boolean;
  cameraEnabled: boolean;
  onError: (message: string) => void;
  onConnectionChange?: (connected: boolean) => void;
};

export type CallVideoSurfaceHandle = {
  setMuted: (muted: boolean) => Promise<void>;
  setSpeaker: (speaker: boolean) => Promise<void>;
  setCameraEnabled: (enabled: boolean) => Promise<void>;
  switchCamera: () => Promise<void>;
  setScreenShareEnabled: (enabled: boolean) => Promise<void>;
};

export const CallVideoSurface = forwardRef<CallVideoSurfaceHandle, CallVideoSurfaceProps>(function CallVideoSurface({ onError: _onError }, _ref) {
  const colors = useColors();
  return (
    <View style={[styles.stage, { backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Video calls need a phone preview</Text>
      <Text style={[styles.detail, { color: colors.mutedForeground }]}>Open this conversation on a device to use the camera.</Text>
    </View>
  );
});

const styles = StyleSheet.create({
  stage: { flex: 1, minHeight: 280, borderRadius: 24, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  detail: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 6 },
});