import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export type CallVideoSurfaceProps = {
  serverUrl: string;
  token: string;
  muted: boolean;
  cameraEnabled: boolean;
  onError: (message: string) => void;
};

export function CallVideoSurface({ onError: _onError }: CallVideoSurfaceProps) {
  const colors = useColors();
  return (
    <View style={[styles.stage, { backgroundColor: colors.card }]}>
      <Text style={[styles.title, { color: colors.foreground }]}>Video calls need a phone preview</Text>
      <Text style={[styles.detail, { color: colors.mutedForeground }]}>Open this conversation on a device to use the camera.</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, minHeight: 280, borderRadius: 24, alignItems: 'center', justifyContent: 'center', padding: 24 },
  title: { fontSize: 17, fontWeight: '800', textAlign: 'center' },
  detail: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 6 },
});