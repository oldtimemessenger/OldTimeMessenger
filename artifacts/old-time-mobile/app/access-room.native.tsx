import { LiveKitRoom, AudioSession, useLocalParticipant, useTracks, VideoTrack } from '@livekit/react-native';
import { Track, type LocalVideoTrack } from 'livekit-client';
import { getCurrentEventLiveKitToken, type CurrentEventParticipantAction } from '@workspace/api-client-react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AccessRoomUi } from '@/components/AccessRoomUi';
import { useAccessRoomController } from '@/hooks/useAccessRoomController';
import { useColors } from '@/hooks/useColors';
import { setupLiveKit } from '@/lib/livekitGlobals';
import { useOldTime } from '@/context/OldTimeContext';

 function NativeAccessContent({ room, messages, giftEvents, canPublishCamera, onSendMessage, onLeave, onParticipantAction, onCameraError }: { room: NonNullable<ReturnType<typeof useAccessRoomController>['room']>; messages: ReturnType<typeof useAccessRoomController>['messages']; giftEvents: ReturnType<typeof useAccessRoomController>['giftEvents']; canPublishCamera: boolean; onSendMessage: (body: string) => Promise<void>; onLeave: () => void; onParticipantAction: (participantId: number, action: CurrentEventParticipantAction['action']) => Promise<void>; onCameraError: (message: string | null) => void }) {
  const { localParticipant } = useLocalParticipant();
  const canSpeak = room.viewer.role !== 'listener';
  const micEnabled = canSpeak && localParticipant.isMicrophoneEnabled;
  const cameraEnabled = canSpeak && localParticipant.isCameraEnabled;
  const cameraTracks = useTracks([Track.Source.Camera]);
  const [cameraFacing, setCameraFacing] = useState<'front' | 'back'>('front');
  const switchCamera = async () => {
    const publication = localParticipant.getTrackPublication(Track.Source.Camera);
    const track = publication?.track as LocalVideoTrack | undefined;
    const nextFacing = cameraFacing === 'front' ? 'back' : 'front';
    if (!track) return;
    try {
      onCameraError(null);
      await track.restartTrack({ facingMode: nextFacing === 'front' ? 'user' : 'environment' });
      setCameraFacing(nextFacing);
    } catch (error) {
      onCameraError(error instanceof Error ? error.message : 'The camera could not switch.');
    }
  };
  const videoStage = cameraTracks.length ? (
    <View style={styles.videoGrid}>
      {cameraTracks.map((trackRef, index) => (
        <VideoTrack key={`${trackRef.participant.identity}-${trackRef.publication.trackSid}`} trackRef={trackRef} style={cameraTracks.length === 1 ? styles.singleVideo : cameraTracks.length > 9 ? styles.quarterVideo : cameraTracks.length > 4 ? styles.thirdVideo : styles.gridVideo} objectFit="cover" mirror={trackRef.participant.identity === localParticipant.identity && cameraFacing === 'front'} zOrder={index} />
      ))}
    </View>
  ) : undefined;
  return (
    <AccessRoomUi
      room={room}
      messages={messages}
      giftEvents={giftEvents}
      audioConnected
      micEnabled={micEnabled}
      cameraEnabled={cameraEnabled}
      cameraFacing={cameraFacing}
      videoStage={videoStage}
      onSendMessage={onSendMessage}
      onToggleMic={() => { if (canSpeak) void localParticipant.setMicrophoneEnabled(!micEnabled); }}
      onToggleCamera={canPublishCamera ? () => {
        if (!canSpeak || !canPublishCamera) return;
        onCameraError(null);
        void localParticipant.setCameraEnabled(!cameraEnabled).catch((error) => onCameraError(error instanceof Error ? error.message : 'The camera could not start.'));
      } : undefined}
      onSwitchCamera={canPublishCamera && cameraEnabled ? () => { if (canSpeak) void switchCamera(); } : undefined}
      onLeave={onLeave}
      onParticipantAction={onParticipantAction}
    />
  );
}

export default function AccessRoomScreenNative() {
  const colors = useColors();
  const router = useRouter();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const controller = useAccessRoomController(roomId ?? '');
  const { currentUserId } = useOldTime();
  const [token, setToken] = useState<{ token: string; url: string; canPublish: boolean; canPublishCamera: boolean } | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [liveKitReady, setLiveKitReady] = useState<boolean | null>(null);
  const role = controller.room?.viewer.role;
  const muted = controller.room?.viewer.muted;
  const cameraGiftId = controller.giftEvents
    .filter((event) => event.benefit.type === 'camera_access' && String(event.recipient.id) === String(currentUserId))
    .at(-1)?.id;

  useEffect(() => {
    const ready = setupLiveKit();
    setLiveKitReady(ready);
    if (!ready) {
      setAudioError('Live audio is unavailable in this app build.');
      return;
    }

    void AudioSession.startAudioSession().catch(() => {
      setAudioError('Live audio could not start.');
    });
    return () => { void AudioSession.stopAudioSession(); };
  }, []);

  useEffect(() => {
    if (!controller.room?.id || !controller.room.viewer.participantId) return;
    setToken(null);
     void getCurrentEventLiveKitToken(controller.room.id).then((result) => setToken({
       ...result,
       canPublishCamera: Boolean((result as typeof result & { canPublishCamera?: boolean }).canPublishCamera),
     })).catch((error) => setAudioError(error instanceof Error ? error.message : 'Live audio could not connect.'));
  }, [controller.room?.id, controller.room?.viewer.participantId, muted, role, cameraGiftId]);

  const leave = useCallback(async () => {
    await controller.leave();
    router.back();
  }, [controller.leave, router]);

  if (liveKitReady !== true || controller.loading || !controller.room || !token) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.mutedForeground, marginTop: 12 }}>{audioError ?? 'Joining Access…'}</Text></View>;
  if (!controller.room.isLive) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.foreground }]}>This room has ended</Text></View>;

  return (
    <View style={styles.room}>
      <LiveKitRoom serverUrl={token.url} token={token.token} connect audio video={false} onError={(error) => setAudioError(error.message)} onDisconnected={() => undefined}>
        <NativeAccessContent room={controller.room} messages={controller.messages} giftEvents={controller.giftEvents} canPublishCamera={token.canPublishCamera} onCameraError={setAudioError} onSendMessage={controller.sendMessage} onLeave={() => void leave()} onParticipantAction={controller.participantAction} />
      </LiveKitRoom>
      {audioError ? <View style={styles.mediaError}><Text style={styles.mediaErrorText}>{audioError}</Text></View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  room: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  title: { fontSize: 22, fontWeight: '800' },
  videoGrid: { flex: 1, flexDirection: 'row', flexWrap: 'wrap' },
  singleVideo: { width: '100%', height: '100%' },
  gridVideo: { width: '50%', height: '50%' },
  thirdVideo: { width: '33.333%', height: '33.333%' },
  quarterVideo: { width: '25%', height: '25%' },
  mediaError: { position: 'absolute', top: 88, left: 16, right: 16, padding: 12, borderRadius: 14, backgroundColor: 'rgba(180,15,29,0.94)' },
  mediaErrorText: { color: '#fff', fontSize: 13, lineHeight: 18, fontWeight: '700', textAlign: 'center' },
});