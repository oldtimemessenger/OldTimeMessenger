import { AndroidAudioTypePresets, AudioSession, LiveKitRoom, useLocalParticipant, useTracks, VideoTrack } from '@livekit/react-native';
import { Track } from 'livekit-client';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { CallVideoSurfaceHandle, CallVideoSurfaceProps } from './call-video-surface';

export type { CallVideoSurfaceHandle, CallVideoSurfaceProps } from './call-video-surface';

type VideoStageProps = Omit<CallVideoSurfaceProps, 'serverUrl' | 'token' | 'onConnectionChange'>;

const VideoStage = forwardRef<CallVideoSurfaceHandle, VideoStageProps>(function VideoStage({ muted, cameraEnabled, onError }, ref) {
  const colors = useColors();
  const { localParticipant } = useLocalParticipant();
  const cameraTracks = useTracks([Track.Source.Camera], { onlySubscribed: false });
  const screenShareTracks = useTracks([Track.Source.ScreenShare], { onlySubscribed: false });
  const remoteScreenShare = screenShareTracks.find((track) => !track.participant.isLocal);
  const localScreenShare = screenShareTracks.find((track) => track.participant.isLocal);
  const remoteCamera = cameraTracks.find((track) => !track.participant.isLocal);
  const localCamera = cameraTracks.find((track) => track.participant.isLocal);

  useImperativeHandle(ref, () => ({
    async setMuted(nextMuted) {
      await localParticipant.setMicrophoneEnabled(!nextMuted);
    },
    async setSpeaker(speaker) {
      const outputs = await AudioSession.getAudioOutputs();
      const output = speaker
        ? (outputs.includes('force_speaker') ? 'force_speaker' : 'speaker')
        : (outputs.includes('default') ? 'default' : 'earpiece');
      if (!outputs.includes(output)) throw new Error('The requested audio route is not available on this device.');
      await AudioSession.selectAudioOutput(output);
    },
    async setCameraEnabled(enabled) {
      await localParticipant.setCameraEnabled(enabled);
    },
    async switchCamera() {
      const camera = localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
      if (!camera) throw new Error('Turn on your camera before switching it.');
      await camera.mediaStreamTrack.applyConstraints({
        facingMode: camera.mediaStreamTrack.getSettings().facingMode === 'environment' ? 'user' : 'environment',
      });
    },
    async setScreenShareEnabled(enabled) {
      await localParticipant.setScreenShareEnabled(enabled);
    },
  }), [localParticipant]);

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
      {remoteScreenShare || localScreenShare || remoteCamera ? (
        <VideoTrack trackRef={remoteScreenShare ?? localScreenShare ?? remoteCamera!} style={{ ...StyleSheet.absoluteFillObject }} objectFit="cover" />
      ) : (
        <View style={[styles.waiting, { backgroundColor: colors.card }]}>
          <Text style={[styles.waitingTitle, { color: colors.foreground }]}>Waiting for video</Text>
          <Text style={[styles.waitingText, { color: colors.mutedForeground }]}>The other person will appear here when they join.</Text>
        </View>
      )}
      {localCamera && cameraEnabled ? (
        <View style={styles.localPreview}>
          <VideoTrack trackRef={localCamera} style={{ ...StyleSheet.absoluteFillObject }} objectFit="cover" mirror zOrder={1} />
        </View>
      ) : null}
    </View>
  );
});

export const CallVideoSurface = forwardRef<CallVideoSurfaceHandle, CallVideoSurfaceProps>(function CallVideoSurface({ serverUrl, token, muted, cameraEnabled, onError, onConnectionChange }, ref) {
  const [audioConfigured, setAudioConfigured] = useState(false);

  useEffect(() => {
    let active = true;
    void AudioSession.configureAudio({
      android: {
        preferredOutputList: ['speaker', 'earpiece'],
        audioTypeOptions: AndroidAudioTypePresets.communication,
      },
      ios: { defaultOutput: 'speaker' },
    }).then(() => {
      if (active) setAudioConfigured(true);
    }).catch((error: unknown) => {
      onError(error instanceof Error ? error.message : 'Call audio could not be configured.');
    });
    return () => { active = false; };
  }, [onError]);

  if (!audioConfigured) {
    return <View style={styles.stage} />;
  }

  return (
    <LiveKitRoom
      serverUrl={serverUrl}
      token={token}
      connect
      audio
      video={cameraEnabled}
      onError={(error) => onError(error.message)}
      onConnected={() => {
        void AudioSession.startAudioSession().then(() => onConnectionChange?.(true)).catch((error: unknown) => {
          onError(error instanceof Error ? error.message : 'Call audio could not start.');
        });
      }}
      onDisconnected={() => onConnectionChange?.(false)}
    >
      <VideoStage ref={ref} muted={muted} cameraEnabled={cameraEnabled} onError={onError} />
    </LiveKitRoom>
  );
});

const styles = StyleSheet.create({
  stage: { flex: 1, minHeight: 280, overflow: 'hidden', borderRadius: 24 },
  waiting: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  waitingTitle: { fontSize: 18, fontWeight: '800' },
  waitingText: { fontSize: 13, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  localPreview: { position: 'absolute', top: 14, right: 14, width: 104, height: 148, overflow: 'hidden', borderRadius: 16, borderWidth: 2, borderColor: '#fff' },
});