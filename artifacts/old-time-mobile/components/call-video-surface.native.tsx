import { LiveKitRoom, useLocalParticipant, useTracks, VideoTrack } from '@livekit/react-native';
import { Track } from 'livekit-client';
import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export type CallVideoSurfaceProps = {
  serverUrl: string;
  token: string;
  muted: boolean;
  cameraEnabled: boolean;
  onError: (message: string) => void;
};

function VideoStage({ muted, cameraEnabled, onError }: Omit<CallVideoSurfaceProps, 'serverUrl' | 'token'>) {
  const colors = useColors();
  const { localParticipant } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const remoteTrack = tracks.find((track) => !track.participant.isLocal);
  const localTrack = tracks.find((track) => track.participant.isLocal);

  useEffect(() => {
    void localParticipant.setMicrophoneEnabled(!muted).catch((error: unknown) => {
      onError(error instanceof Error ? error.message : 'Microphone could not be enabled.');
    });
  }, [localParticipant, muted, onError]);

  useEffect(() => {
    void localParticipant.setCameraEnabled(cameraEnabled).catch((error: unknown) => {
      onError(error instanceof Error ? error.message : 'Camera could not be enabled.');
    });
  }, [cameraEnabled, localParticipant, onError]);

  return (
    <View style={styles.stage}>
      {remoteTrack ? (
        <VideoTrack trackRef={remoteTrack} style={{ ...StyleSheet.absoluteFillObject }} objectFit="cover" />
      ) : (
        <View style={[styles.waiting, { backgroundColor: colors.card }]}>
          <Text style={[styles.waitingTitle, { color: colors.foreground }]}>Waiting for video</Text>
          <Text style={[styles.waitingText, { color: colors.mutedForeground }]}>The other person will appear here when they join.</Text>
        </View>
      )}
      {localTrack && cameraEnabled ? (
        <View style={styles.localPreview}>
          <VideoTrack trackRef={localTrack} style={{ ...StyleSheet.absoluteFillObject }} objectFit="cover" mirror zOrder={1} />
        </View>
      ) : null}
    </View>
  );
}

export function CallVideoSurface({ serverUrl, token, muted, cameraEnabled, onError }: CallVideoSurfaceProps) {
  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect
      audio
      video={cameraEnabled}
      onError={(error) => onError(error.message)}
    >
      <VideoStage muted={muted} cameraEnabled={cameraEnabled} onError={onError} />
    </LiveKitRoom>
  );
}

const styles = StyleSheet.create({
  stage: { flex: 1, minHeight: 280, overflow: 'hidden', borderRadius: 24 },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  waitingTitle: { fontSize: 18, fontWeight: '800' },
  waitingText: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  localPreview: { position: 'absolute', top: 14, right: 14, width: 104, height: 148, overflow: 'hidden', borderRadius: 16, borderWidth: 2, borderColor: '#fff' },
});