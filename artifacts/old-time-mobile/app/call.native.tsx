import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { LiveKitRoom, useLocalParticipant, useTracks, VideoTrack, AudioSession } from '@livekit/react-native';
import { Track } from 'livekit-client';
import { endCall } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';
import { setupLiveKit } from '@/lib/livekitGlobals';

function CallControls({ callId, kind, onLeave }: { callId: string; kind: 'audio' | 'video'; onLeave: () => void }) {
  const colors = useColors();
  const { localParticipant } = useLocalParticipant();
  const [busy, setBusy] = useState(false);
  const cameraOn = localParticipant.isCameraEnabled;
  const microphoneOn = localParticipant.isMicrophoneEnabled;
  const screenOn = localParticipant.isScreenShareEnabled;

  const toggle = async (action: () => Promise<unknown>) => {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } catch (error) {
      Alert.alert('Call control unavailable', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const leave = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await endCall(Number(callId));
    } catch {
      // The room still closes locally if the network has already dropped.
    } finally {
      onLeave();
    }
  };

  return (
    <View style={styles.controls}>
      <Pressable accessibilityRole="button" accessibilityLabel={microphoneOn ? 'Mute microphone' : 'Unmute microphone'} onPress={() => void toggle(() => localParticipant.setMicrophoneEnabled(!microphoneOn))} style={[styles.control, { backgroundColor: colors.card }]}><Ionicons name={microphoneOn ? 'mic' : 'mic-off'} size={22} color={colors.foreground} /></Pressable>
      {kind === 'video' ? <Pressable accessibilityRole="button" accessibilityLabel={cameraOn ? 'Turn camera off' : 'Turn camera on'} onPress={() => void toggle(() => localParticipant.setCameraEnabled(!cameraOn))} style={[styles.control, { backgroundColor: colors.card }]}><Ionicons name={cameraOn ? 'videocam' : 'videocam-off'} size={22} color={colors.foreground} /></Pressable> : null}
      {kind === 'video' && Platform.OS === 'android' ? <Pressable accessibilityRole="button" accessibilityLabel={screenOn ? 'Stop screen sharing' : 'Share screen'} onPress={() => void toggle(() => localParticipant.setScreenShareEnabled(!screenOn))} style={[styles.control, { backgroundColor: colors.card }]}><Ionicons name={screenOn ? 'stop-circle' : 'phone-portrait-outline'} size={22} color={colors.foreground} /></Pressable> : null}
      <Pressable accessibilityRole="button" accessibilityLabel="End call" onPress={() => void leave()} style={[styles.control, styles.endControl]}><Ionicons name="call" size={22} color="#fffaf4" /></Pressable>
    </View>
  );
}

function RoomContent({ callId, kind, remoteName, onLeave }: { callId: string; kind: 'audio' | 'video'; remoteName: string; onLeave: () => void }) {
  const colors = useColors();
  const cameraTracks = useTracks([Track.Source.Camera]);
  const remoteTrack = useMemo(() => cameraTracks.find((track) => !track.participant.isLocal), [cameraTracks]);
  const localTrack = useMemo(() => cameraTracks.find((track) => track.participant.isLocal), [cameraTracks]);

  return (
    <View style={[styles.room, { backgroundColor: colors.background }]}>
      {kind === 'video' && remoteTrack ? <VideoTrack trackRef={remoteTrack} style={styles.remoteVideo} objectFit="cover" /> : <View style={[styles.audioStage, { backgroundColor: colors.secondary }]}><View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}><Ionicons name="person" size={38} color={colors.primaryForeground} /></View><Text style={[styles.remoteName, { color: colors.foreground }]}>{remoteName}</Text><Text style={[styles.audioStatus, { color: colors.mutedForeground }]}>Connected by voice</Text></View>}
      {kind === 'video' && localTrack ? <VideoTrack trackRef={localTrack} style={styles.localVideo} objectFit="cover" mirror zOrder={1} /> : null}
      <View style={styles.callTopBar}><Text style={styles.callBadge}>{kind === 'video' ? 'VIDEO CALL' : 'AUDIO CALL'}</Text><Text style={styles.callName}>{remoteName}</Text></View>
      <CallControls callId={callId} kind={kind} onLeave={onLeave} />
    </View>
  );
}

export default function CallScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ token: string; serverUrl: string; callId: string; kind: string; remoteName?: string; returnPath?: string }>();
  const kind = params.kind === 'audio' ? 'audio' : 'video';
  const [error, setError] = useState<string | null>(null);
  const [liveKitReady, setLiveKitReady] = useState<boolean | null>(null);

  useEffect(() => {
    if (!params.token || !params.serverUrl || !params.callId) {
      setLiveKitReady(false);
      return;
    }

    const ready = setupLiveKit();
    setLiveKitReady(ready);
    if (!ready) {
      setError('Calling is unavailable in this app build.');
      return;
    }

    void AudioSession.startAudioSession().catch(() => {
      setError('Audio calling could not start.');
    });
    return () => {
      void AudioSession.stopAudioSession();
    };
  }, [params.callId, params.serverUrl, params.token]);

  const leave = () => router.replace((params.returnPath === 'inbox' ? '/(tabs)/inbox' : '/(tabs)/discover') as never);
  if (!params.token || !params.serverUrl || !params.callId) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={[styles.errorTitle, { color: colors.foreground }]}>Call unavailable</Text><Text style={[styles.errorBody, { color: colors.mutedForeground }]}>This call invitation is missing or expired.</Text><Pressable onPress={leave} style={[styles.backButton, { backgroundColor: colors.primary }]}><Text style={{ color: colors.primaryForeground, fontWeight: '800' }}>Go back</Text></Pressable></View>;
  }
  if (liveKitReady !== true) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /><Text style={[styles.errorBody, { color: colors.mutedForeground }]}>{error ?? 'Preparing the call…'}</Text><Pressable onPress={leave} style={[styles.backButton, { backgroundColor: colors.primary }]}><Text style={{ color: colors.primaryForeground, fontWeight: '800' }}>Go back</Text></Pressable></View>;
  }

  return (
    <LiveKitRoom serverUrl={params.serverUrl} token={params.token} connect audio video={kind === 'video'} onError={(roomError) => setError(roomError.message)} onDisconnected={leave}>
      {error ? <View style={styles.center}><ActivityIndicator color={colors.primary} /><Text style={[styles.errorBody, { color: colors.mutedForeground }]}>{error}</Text></View> : <RoomContent callId={params.callId} kind={kind} remoteName={params.remoteName ?? 'Old Time friend'} onLeave={leave} />}
    </LiveKitRoom>
  );
}

const styles = StyleSheet.create({
  room: { flex: 1 },
  remoteVideo: { ...StyleSheet.absoluteFillObject },
  localVideo: { position: 'absolute', top: 64, right: 20, width: 120, height: 180, borderRadius: 24, overflow: 'hidden' },
  callTopBar: { position: 'absolute', top: 66, left: 20, right: 155, gap: 6 },
  callBadge: { color: '#fffaf4', fontFamily: 'Outfit_700Bold', fontSize: 11, letterSpacing: 1.2 },
  callName: { color: '#fffaf4', fontFamily: 'Fraunces_900Black', fontSize: 20 },
  audioStage: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  avatarCircle: { width: 100, height: 100, borderRadius: 50, alignItems: 'center', justifyContent: 'center' },
  remoteName: { fontFamily: 'Fraunces_900Black', fontSize: 26, marginTop: 22 },
  audioStatus: { fontFamily: 'Outfit_500Medium', fontSize: 14, marginTop: 8 },
  controls: { position: 'absolute', left: 20, right: 20, bottom: 48, flexDirection: 'row', justifyContent: 'center', gap: 16 },
  control: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center' },
  endControl: { backgroundColor: '#b64242', transform: [{ rotate: '135deg' }] },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 32, gap: 14 },
  errorTitle: { fontFamily: 'Fraunces_900Black', fontSize: 24 },
  errorBody: { fontFamily: 'Outfit_500Medium', fontSize: 15, lineHeight: 22, textAlign: 'center' },
  backButton: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 24, marginTop: 12 },
});