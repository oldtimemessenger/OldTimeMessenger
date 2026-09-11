import { LiveKitRoom, AudioSession, useLocalParticipant } from '@livekit/react-native';
import { getCurrentEventLiveKitToken, type CurrentEventParticipantAction } from '@workspace/api-client-react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { AccessRoomUi } from '@/components/AccessRoomUi';
import { useAccessRoomController } from '@/hooks/useAccessRoomController';
import { useColors } from '@/hooks/useColors';
import { setupLiveKit } from '@/lib/livekitGlobals';

 function NativeAccessContent({ room, messages, giftEvents, onSendMessage, onLeave, onParticipantAction }: { room: NonNullable<ReturnType<typeof useAccessRoomController>['room']>; messages: ReturnType<typeof useAccessRoomController>['messages']; giftEvents: ReturnType<typeof useAccessRoomController>['giftEvents']; onSendMessage: (body: string) => Promise<void>; onLeave: () => void; onParticipantAction: (participantId: number, action: CurrentEventParticipantAction['action']) => Promise<void> }) {
  const { localParticipant } = useLocalParticipant();
  const canSpeak = room.viewer.role !== 'listener';
  const micEnabled = canSpeak && localParticipant.isMicrophoneEnabled;
  return (
    <AccessRoomUi
      room={room}
      messages={messages}
      giftEvents={giftEvents}
      audioConnected
      micEnabled={micEnabled}
      onSendMessage={onSendMessage}
      onToggleMic={() => { if (canSpeak) void localParticipant.setMicrophoneEnabled(!micEnabled); }}
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
  const [token, setToken] = useState<{ token: string; url: string; canPublish: boolean } | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);
  const [liveKitReady, setLiveKitReady] = useState<boolean | null>(null);
  const role = controller.room?.viewer.role;
  const muted = controller.room?.viewer.muted;

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
     void getCurrentEventLiveKitToken(controller.room.id).then(setToken).catch((error) => setAudioError(error instanceof Error ? error.message : 'Live audio could not connect.'));
  }, [controller.room?.id, controller.room?.viewer.participantId, muted, role]);

  const leave = useCallback(async () => {
    await controller.leave();
    router.back();
  }, [controller.leave, router]);

  if (liveKitReady !== true || controller.loading || !controller.room || !token) return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /><Text style={{ color: colors.mutedForeground, marginTop: 12 }}>{audioError ?? 'Joining Access…'}</Text></View>;
  if (!controller.room.isLive) return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={[styles.title, { color: colors.foreground }]}>This room has ended</Text></View>;

  return (
    <LiveKitRoom serverUrl={token.url} token={token.token} connect audio video={false} onError={(error) => setAudioError(error.message)} onDisconnected={() => undefined}>
      <NativeAccessContent room={controller.room} messages={controller.messages} giftEvents={controller.giftEvents} onSendMessage={controller.sendMessage} onLeave={() => void leave()} onParticipantAction={controller.participantAction} />
    </LiveKitRoom>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  title: { fontSize: 22, fontWeight: '800' },
});