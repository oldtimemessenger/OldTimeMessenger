import { Ionicons } from '@expo/vector-icons';
import { Room, RoomEvent, Track, type Track as LiveKitTrack } from 'livekit-client';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { endCall } from '@workspace/api-client-react';
import { useColors } from '@/hooks/useColors';

function WebMediaView({ track, style }: { track: LiveKitTrack | null; style?: object }) {
  const containerRef = useRef<React.ElementRef<typeof View> | null>(null);

  useEffect(() => {
    if (!track || !containerRef.current) return;
    const container = containerRef.current as unknown as { appendChild: (node: HTMLElement) => void };
    const mediaElement = track.attach() as HTMLVideoElement;
    mediaElement.autoplay = true;
    mediaElement.playsInline = true;
    mediaElement.style.width = '100%';
    mediaElement.style.height = '100%';
    mediaElement.style.objectFit = 'cover';
    container.appendChild(mediaElement);
    return () => {
      track.detach(mediaElement);
      mediaElement.remove();
    };
  }, [track]);

  return <View ref={containerRef} style={style} />;
}

export default function CallScreen() {
  const colors = useColors();
  const router = useRouter();
  const params = useLocalSearchParams<{ token: string; serverUrl: string; callId: string; kind: string; remoteName?: string; returnPath?: string }>();
  const kind = params.kind === 'audio' ? 'audio' : 'video';
  const [room, setRoom] = useState<Room | null>(null);
  const [remoteCamera, setRemoteCamera] = useState<LiveKitTrack | null>(null);
  const [remoteScreen, setRemoteScreen] = useState<LiveKitTrack | null>(null);
  const [remoteAudio, setRemoteAudio] = useState<LiveKitTrack | null>(null);
  const [localCamera, setLocalCamera] = useState<LiveKitTrack | null>(null);
  const [microphoneOn, setMicrophoneOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshTracks = useCallback((activeRoom: Room) => {
    const localCameraPublication = activeRoom.localParticipant.getTrackPublication(Track.Source.Camera);
    const localScreenPublication = activeRoom.localParticipant.getTrackPublication(Track.Source.ScreenShare);
    const remoteParticipant = activeRoom.remoteParticipants.values().next().value;
    const remotePublications = remoteParticipant ? Array.from(remoteParticipant.trackPublications.values()) : [];
    setLocalCamera(localCameraPublication?.track ?? null);
    setMicrophoneOn(Boolean(activeRoom.localParticipant.getTrackPublication(Track.Source.Microphone)?.isEnabled));
    setCameraOn(Boolean(localCameraPublication?.isEnabled));
    setScreenSharing(Boolean(localScreenPublication?.isEnabled));
    setRemoteCamera(remotePublications.find((publication) => publication.source === Track.Source.Camera)?.track ?? null);
    setRemoteScreen(remotePublications.find((publication) => publication.source === Track.Source.ScreenShare)?.track ?? null);
    setRemoteAudio(remotePublications.find((publication) => publication.source === Track.Source.Microphone)?.track ?? null);
  }, []);

  useEffect(() => {
    if (!params.token || !params.serverUrl || !params.callId) {
      setConnecting(false);
      setError('This call invitation is missing or expired.');
      return;
    }

    const activeRoom = new Room();
    setRoom(activeRoom);
    const update = () => refreshTracks(activeRoom);
    activeRoom
      .on(RoomEvent.TrackSubscribed, update)
      .on(RoomEvent.TrackUnsubscribed, update)
      .on(RoomEvent.LocalTrackPublished, update)
      .on(RoomEvent.LocalTrackUnpublished, update)
      .on(RoomEvent.ParticipantConnected, update)
      .on(RoomEvent.ParticipantDisconnected, update);

    void activeRoom.connect(params.serverUrl, params.token)
      .then(async () => {
        await activeRoom.localParticipant.setMicrophoneEnabled(true);
        if (kind === 'video') await activeRoom.localParticipant.setCameraEnabled(true);
        update();
        setConnecting(false);
      })
      .catch((connectError) => {
        setError(connectError instanceof Error ? connectError.message : 'Could not connect to the call.');
        setConnecting(false);
      });

    return () => {
      activeRoom.removeAllListeners();
      void activeRoom.disconnect();
    };
  }, [kind, params.callId, params.serverUrl, params.token, refreshTracks]);

  const leave = async () => {
    try {
      if (params.callId && Number.isInteger(Number(params.callId))) await endCall(Number(params.callId));
    } catch {
      // The browser room still closes locally if the network has already dropped.
    }
    router.replace((params.returnPath === 'inbox' ? '/(tabs)/inbox' : '/(tabs)/discover') as never);
  };

  const toggle = async (action: () => Promise<unknown>, onSuccess: () => void) => {
    try {
      await action();
      onSuccess();
      if (room) refreshTracks(room);
    } catch (toggleError) {
      Alert.alert('Call control unavailable', toggleError instanceof Error ? toggleError.message : 'Please try again.');
    }
  };

  if (connecting) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /><Text style={[styles.errorBody, { color: colors.mutedForeground }]}>Connecting to the call…</Text></View>;
  }

  if (error || !room) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><Text style={[styles.errorTitle, { color: colors.foreground }]}>Call unavailable</Text><Text style={[styles.errorBody, { color: colors.mutedForeground }]}>{error ?? 'This call could not be started.'}</Text><Pressable onPress={() => router.replace((params.returnPath === 'inbox' ? '/(tabs)/inbox' : '/(tabs)/discover') as never)} style={[styles.backButton, { backgroundColor: colors.primary }]}><Text style={{ color: colors.primaryForeground, fontWeight: '800' }}>Go back</Text></Pressable></View>;
  }

  const mainVideo = remoteScreen ?? remoteCamera;
  return (
    <View style={[styles.room, { backgroundColor: colors.background }]}>
      {kind === 'video' && mainVideo ? <WebMediaView track={mainVideo} style={styles.remoteVideo} /> : <View style={[styles.audioStage, { backgroundColor: colors.secondary }]}><View style={[styles.avatarCircle, { backgroundColor: colors.primary }]}><Ionicons name="person" size={38} color={colors.primaryForeground} /></View><Text style={[styles.remoteName, { color: colors.foreground }]}>{params.remoteName ?? 'Old Time friend'}</Text><Text style={[styles.audioStatus, { color: colors.mutedForeground }]}>Connected by voice</Text></View>}
      {remoteAudio ? <WebMediaView track={remoteAudio} style={styles.hiddenMedia} /> : null}
      {kind === 'video' && localCamera ? <WebMediaView track={localCamera} style={styles.localVideo} /> : null}
      <View style={styles.callTopBar}><Text style={styles.callBadge}>{kind === 'video' ? 'VIDEO CALL' : 'AUDIO CALL'}</Text><Text style={styles.callName}>{params.remoteName ?? 'Old Time friend'}</Text></View>
      <View style={styles.controls}>
        <Pressable accessibilityRole="button" accessibilityLabel={microphoneOn ? 'Mute microphone' : 'Unmute microphone'} onPress={() => void toggle(() => room.localParticipant.setMicrophoneEnabled(!microphoneOn), () => setMicrophoneOn(!microphoneOn))} style={[styles.control, { backgroundColor: colors.card }]}><Ionicons name={microphoneOn ? 'mic' : 'mic-off'} size={22} color={colors.foreground} /></Pressable>
        {kind === 'video' ? <Pressable accessibilityRole="button" accessibilityLabel={cameraOn ? 'Turn camera off' : 'Turn camera on'} onPress={() => void toggle(() => room.localParticipant.setCameraEnabled(!cameraOn), () => setCameraOn(!cameraOn))} style={[styles.control, { backgroundColor: colors.card }]}><Ionicons name={cameraOn ? 'videocam' : 'videocam-off'} size={22} color={colors.foreground} /></Pressable> : null}
        {kind === 'video' ? <Pressable accessibilityRole="button" accessibilityLabel={screenSharing ? 'Stop screen sharing' : 'Share screen'} onPress={() => void toggle(() => room.localParticipant.setScreenShareEnabled(!screenSharing), () => setScreenSharing(!screenSharing))} style={[styles.control, { backgroundColor: colors.card }]}><Ionicons name={screenSharing ? 'stop-circle' : 'phone-portrait-outline'} size={22} color={colors.foreground} /></Pressable> : null}
        <Pressable accessibilityRole="button" accessibilityLabel="End call" onPress={() => void leave()} style={[styles.control, styles.endControl]}><Ionicons name="call" size={22} color="#fffaf4" /></Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  room: { flex: 1 },
  remoteVideo: { ...StyleSheet.absoluteFillObject },
  localVideo: { position: 'absolute', top: 64, right: 20, width: 120, height: 180, borderRadius: 24, overflow: 'hidden' },
  hiddenMedia: { position: 'absolute', width: 1, height: 1, opacity: 0 },
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