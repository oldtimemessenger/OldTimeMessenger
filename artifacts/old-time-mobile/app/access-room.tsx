import { Room, RoomEvent, type RemoteTrackPublication, type RemoteParticipant } from 'livekit-client';
import { getCurrentEventLiveKitToken } from '@workspace/api-client-react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AccessRoomUi } from '@/components/AccessRoomUi';
import { useAccessRoomController } from '@/hooks/useAccessRoomController';
import { useColors } from '@/hooks/useColors';

function attachAudio(publication: RemoteTrackPublication, _participant: RemoteParticipant) {
  if (publication.kind !== 'audio' || !publication.track || typeof document === 'undefined') return;
  const element = publication.track.attach();
  element.autoplay = true;
  element.setAttribute('playsinline', 'true');
  element.style.position = 'fixed';
  element.style.width = '1px';
  element.style.height = '1px';
  element.style.opacity = '0';
  document.body.appendChild(element);
  return () => {
    publication.track?.detach(element);
    element.remove();
  };
}

export default function AccessRoomScreen() {
  const colors = useColors();
  const router = useRouter();
  const { roomId } = useLocalSearchParams<{ roomId: string }>();
  const controller = useAccessRoomController(roomId ?? '');
  const roomRef = useRef<Room | null>(null);
  const [audioConnected, setAudioConnected] = useState(false);
  const [micEnabled, setMicEnabled] = useState(false);
  const [audioError, setAudioError] = useState<string | null>(null);
  const role = controller.room?.viewer.role;
  const muted = controller.room?.viewer.muted;

  useEffect(() => {
    if (!controller.room?.id || !controller.room.viewer.participantId) return;
    let active = true;
    const liveRoom = new Room();
    roomRef.current = liveRoom;
    const cleanups = new Map<string, () => void>();
    const subscribed = (_track: unknown, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      const cleanup = attachAudio(publication, participant);
      if (cleanup) cleanups.set(`${participant.identity}:${publication.trackSid}`, cleanup);
    };
    const unsubscribed = (_track: unknown, publication: RemoteTrackPublication, participant: RemoteParticipant) => {
      const key = `${participant.identity}:${publication.trackSid}`;
      cleanups.get(key)?.();
      cleanups.delete(key);
    };
    liveRoom.on(RoomEvent.TrackSubscribed, subscribed).on(RoomEvent.TrackUnsubscribed, unsubscribed);
     void getCurrentEventLiveKitToken(controller.room.id).then(async (token) => {
       await liveRoom.connect(token.url, token.token);
      if (!active) return;
      setAudioConnected(true);
      if (token.canPublish) {
        await liveRoom.localParticipant.setMicrophoneEnabled(!muted);
        setMicEnabled(!muted);
      }
    }).catch((error) => {
      if (active) setAudioError(error instanceof Error ? error.message : 'Live audio could not connect.');
    });
    return () => {
      active = false;
      cleanups.forEach((cleanup) => cleanup());
      liveRoom.removeAllListeners();
      void liveRoom.disconnect();
      if (roomRef.current === liveRoom) roomRef.current = null;
      setAudioConnected(false);
      setMicEnabled(false);
    };
  }, [controller.room?.id, controller.room?.viewer.participantId, muted, role]);

  const toggleMic = useCallback(() => {
    const activeRoom = roomRef.current;
    if (!activeRoom) return;
    const next = !micEnabled;
    void activeRoom.localParticipant.setMicrophoneEnabled(next).then(() => setMicEnabled(next));
  }, [micEnabled]);

  const leave = useCallback(async () => {
    await controller.leave();
    router.back();
  }, [controller.leave, router]);

  if (controller.loading || !controller.room) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.mutedForeground, marginTop: 12 }}>Joining Access…</Text></View>;
  if (!controller.room.isLive) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.foreground }]}>This room has ended</Text><Text style={[styles.body, { color: colors.mutedForeground }]}>Go back to Access to find another live conversation.</Text></View>;

  return (
    <>
      <AccessRoomUi room={controller.room} messages={controller.messages} giftEvents={controller.giftEvents} audioConnected={audioConnected} micEnabled={micEnabled} onSendMessage={controller.sendMessage} onToggleMic={toggleMic} onLeave={() => void leave()} onParticipantAction={controller.participantAction} />
      {audioError ? <View pointerEvents="none" style={styles.audioError}><Text style={styles.audioErrorText}>{audioError}</Text></View> : null}
    </>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  title: { fontSize: 22, fontWeight: '800' },
  body: { fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 8 },
  audioError: { position: 'absolute', top: 100, left: 16, right: 16, borderRadius: 12, padding: 10, backgroundColor: 'rgba(182,66,61,0.92)' },
  audioErrorText: { color: '#fff', fontSize: 12, textAlign: 'center', fontWeight: '700' },
});