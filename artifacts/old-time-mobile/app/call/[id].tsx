import { Ionicons } from '@expo/vector-icons';
import { getGetInboxQueryKey, useGetInbox } from '@workspace/api-client-react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { io } from 'socket.io-client';
import { Avatar } from '@/components/ui';
import { CallVideoSurface, type CallVideoSurfaceHandle } from '@/components/call-video-surface';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';
import { apiBaseUrl } from '@/lib/api-base-url';
import { audioService } from '@/lib/audio-service';
import {
  acceptManagedCall,
  declineManagedCall,
  endManagedCall,
  getManagedCall,
  getManagedCallToken,
  type ManagedCall,
} from '@/lib/chat-api';

type CallStatusTone = { title: string; detail: string; accent: string };

function durationLabel(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${String(Math.floor(safeSeconds / 60)).padStart(2, '0')}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function toneForCall(call: ManagedCall | null, isCallee: boolean, elapsed: number): CallStatusTone {
  if (!call) return { title: 'Connecting…', detail: 'Checking call status', accent: '#34C77E' };
  if (call.status === 'accepted') return { title: call.type === 'video' ? 'Video call' : 'Voice call', detail: durationLabel(elapsed), accent: '#34C77E' };
  if (call.status === 'ringing') {
    return {
      title: isCallee ? `Incoming ${call.type} call` : `${call.type === 'video' ? 'Video' : 'Voice'} call`,
      detail: isCallee ? 'Swipe up to answer or decline below' : 'Ringing…',
      accent: '#34C77E',
    };
  }
  if (call.status === 'declined') return { title: 'Call declined', detail: 'The call was declined.', accent: '#F97316' };
  if (call.status === 'missed') return { title: 'Missed call', detail: 'Nobody answered in time.', accent: '#EF4444' };
  return { title: 'Call ended', detail: 'Call finished.', accent: '#94A3B8' };
}

export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const callId = Number(id);
  const router = useRouter();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session } = useApp();
  const [call, setCall] = useState<ManagedCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [videoConnected, setVideoConnected] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [callCredentials, setCallCredentials] = useState<{ token: string; url: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const connectStarted = useRef(false);
  const connectedCallId = useRef<number | null>(null);
  const videoSurface = useRef<CallVideoSurfaceHandle>(null);
  const inbox = useGetInbox(session?.id ?? 0, { query: { enabled: Boolean(session?.id), queryKey: getGetInboxQueryKey(session?.id ?? 0) } });

  const otherUserId = call
    ? (call.callerId === session?.id ? call.calleeId : call.callerId)
    : null;
  const contact = useMemo(
    () => inbox.data?.find((item) => item.contact.id === otherUserId)?.contact,
    [inbox.data, otherUserId],
  );
  const name = contact?.name ?? 'Old Time';
  const isCallee = call?.calleeId === session?.id;
  const connected = call?.status === 'accepted';
  const controlsEnabled = connected && (call?.type !== 'video' || videoConnected);
  const screenShareAvailable = (Platform.OS === 'android' || Platform.OS === 'ios') && call?.type === 'video';
  const tone = toneForCall(call, Boolean(isCallee), elapsed);

  const refresh = useCallback(async () => {
    if (!session?.authToken || !Number.isInteger(callId) || callId <= 0) return;
    try {
      setCall(await getManagedCall(session.authToken, callId));
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Call unavailable.');
    } finally {
      setLoading(false);
    }
  }, [callId, session?.authToken]);

  const connectAudio = useCallback(async () => {
    if (!session?.authToken || !call || call.status !== 'accepted' || connectStarted.current || connectedCallId.current === call.id) return;
    connectStarted.current = true;
    try {
      const token = await getManagedCallToken(session.authToken, call.id);
      if (call.type === 'video') {
        setCallCredentials(token);
        connectedCallId.current = call.id;
        return;
      }
      await audioService.join(call.id, 'speaker', { ...token, canPublish: true });
      connectedCallId.current = call.id;
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Call couldn’t connect.');
    } finally {
      connectStarted.current = false;
    }
  }, [call, session?.authToken]);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 2500);
    return () => clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!session?.authToken || !callId) return;
    const socket = io(apiBaseUrl(), { auth: { token: session.authToken }, transports: ['websocket'] });
    const handleUpdate = (payload?: ManagedCall | { callId?: number; status?: ManagedCall['status'] }) => {
      const nextId = typeof payload === 'object' && payload ? ('id' in payload ? payload.id : payload.callId) : null;
      if (nextId !== callId) return;
      void refresh();
    };
    socket.on('call-updated', handleUpdate);
    return () => {
      socket.off('call-updated', handleUpdate);
      socket.disconnect();
    };
  }, [callId, refresh, session?.authToken]);

  useEffect(() => {
    if (!call?.acceptedAt) return;
    const tick = () => setElapsed(Math.max(0, Math.floor(Date.now() / 1000 - call.acceptedAt! / 1000)));
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [call?.acceptedAt]);

  useEffect(() => {
    if (call?.status === 'accepted') void connectAudio();
    if (call && ['declined', 'missed', 'ended'].includes(call.status)) {
      connectedCallId.current = null;
      setCallCredentials(null);
      setVideoConnected(false);
      setScreenSharing(false);
      void audioService.leave();
    }
  }, [call, connectAudio]);

  useEffect(() => () => { void audioService.leave(); }, []);

  async function accept() {
    if (!session?.authToken || !call) return;
    setBusy(true);
    try {
      const updated = await acceptManagedCall(session.authToken, call.id);
      setCall(updated);
      setError(null);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Call couldn’t connect.');
    } finally {
      setBusy(false);
    }
  }

  async function hangup() {
    if (!session?.authToken || !call) return;
    setBusy(true);
    try {
      if (call.status === 'ringing' && isCallee) await declineManagedCall(session.authToken, call.id);
      else await endManagedCall(session.authToken, call.id);
      setCallCredentials(null);
      setVideoConnected(false);
      setScreenSharing(false);
      connectedCallId.current = null;
      await audioService.leave();
      router.back();
    } catch (nextError) {
      Alert.alert('Call not ended', nextError instanceof Error ? nextError.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function toggleMute() {
    const nextMuted = !muted;
    try {
      if (call?.type === 'video') await videoSurface.current?.setMuted(nextMuted);
      else await audioService.setMuted(nextMuted);
      setMuted(nextMuted);
    } catch {
      Alert.alert('Microphone unavailable', 'Microphone state could not be changed.');
    }
  }

  async function toggleSpeaker() {
    const nextSpeaker = !speaker;
    try {
      if (call?.type === 'video') await videoSurface.current?.setSpeaker(nextSpeaker);
      else if (audioService.setSpeaker) await audioService.setSpeaker(nextSpeaker);
      else throw new Error('Audio output selection is unavailable.');
      setSpeaker(nextSpeaker);
    } catch {
      Alert.alert('Audio route unavailable', 'Speaker output could not be changed on this device.');
    }
  }

  async function toggleCamera() {
    const nextCameraEnabled = !cameraEnabled;
    try {
      await videoSurface.current?.setCameraEnabled(nextCameraEnabled);
      setCameraEnabled(nextCameraEnabled);
    } catch {
      Alert.alert('Camera unavailable', 'Camera state could not be changed.');
    }
  }

  async function swapCamera() {
    try {
      await videoSurface.current?.switchCamera();
    } catch (nextError) {
      Alert.alert('Camera switch unavailable', nextError instanceof Error ? nextError.message : 'The camera could not be switched.');
    }
  }

  async function startScreenShare() {
    if (!screenShareAvailable) return;
    try {
      if (!videoSurface.current) throw new Error('Video is still connecting.');
      const nextScreenSharing = !screenSharing;
      await videoSurface.current.setScreenShareEnabled(nextScreenSharing);
      setScreenSharing(nextScreenSharing);
    } catch (nextError) {
      Alert.alert('Screen sharing unavailable', nextError instanceof Error ? nextError.message : 'Screen sharing permission was not granted.');
    }
  }
  if (!session) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (loading && !call && !error) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 18 }]}>
      <View style={styles.topBar}>
        <Pressable onPress={() => void hangup()} style={[styles.topButton, { backgroundColor: colors.card }]}>
          <Ionicons name="chevron-down" size={22} color={colors.foreground} />
        </Pressable>
        <View style={[styles.callTypeChip, { backgroundColor: colors.card }]}>
          <View style={[styles.statusDot, { backgroundColor: tone.accent }]} />
          <Text style={[styles.callTypeText, { color: colors.foreground }]}>{call?.type === 'video' ? 'Video call' : 'Voice call'}</Text>
        </View>
        {screenShareAvailable ? (
          <Pressable accessibilityLabel="Share screen" onPress={() => void startScreenShare()} disabled={!controlsEnabled} style={[styles.topButton, { backgroundColor: colors.card, opacity: controlsEnabled ? 1 : 0.5 }]}>
            <Ionicons name={screenSharing ? 'stop-circle-outline' : 'desktop-outline'} size={18} color={colors.foreground} />
          </Pressable>
        ) : <View style={styles.topButton} />}
      </View>

      <View style={styles.hero}>
        <Avatar name={name} size={112} />
        <Text style={[styles.name, { color: colors.foreground }]}>{name}</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>{error ?? tone.title}</Text>
        <Text style={[styles.detail, { color: colors.mutedForeground }]}>{error ? 'Please try again.' : tone.detail}</Text>
      </View>

      {call?.type === 'video' && callCredentials ? (
        <CallVideoSurface
            ref={videoSurface}
          serverUrl={callCredentials.url}
          token={callCredentials.token}
          muted={muted}
          cameraEnabled={cameraEnabled}
          onError={setError}
            onConnectionChange={setVideoConnected}
        />
      ) : (
        <View style={[styles.previewCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.previewBadge, { backgroundColor: colors.secondary }]}>
            <Ionicons name={call?.type === 'video' ? 'videocam' : 'person'} size={18} color={colors.foreground} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.previewTitle, { color: colors.foreground }]}>
              {call?.type === 'video' ? 'Connecting video' : 'Audio connected'}
            </Text>
            <Text style={[styles.previewMeta, { color: colors.mutedForeground }]}>
              {call?.type === 'video' ? 'Starting camera and microphone.' : tone.detail}
            </Text>
          </View>
        </View>
      )}

      <View style={styles.controlsGrid}>
        <Pressable onPress={() => void toggleMute()} disabled={!controlsEnabled} style={[styles.controlButton, { backgroundColor: colors.card, opacity: controlsEnabled ? 1 : 0.5 }]}>
          <Ionicons name={muted ? 'mic-off' : 'mic'} size={22} color={colors.foreground} />
          <Text style={[styles.controlLabel, { color: colors.foreground }]}>{muted ? 'Unmute' : 'Mute'}</Text>
        </Pressable>
        <Pressable onPress={() => void toggleSpeaker()} disabled={!controlsEnabled} style={[styles.controlButton, { backgroundColor: colors.card, opacity: controlsEnabled ? 1 : 0.5 }]}>
          <Ionicons name={speaker ? 'volume-high' : 'volume-mute'} size={22} color={colors.foreground} />
          <Text style={[styles.controlLabel, { color: colors.foreground }]}>{speaker ? 'Speaker' : 'Earpiece'}</Text>
        </Pressable>
        <Pressable onPress={() => void toggleCamera()} disabled={!controlsEnabled || call?.type !== 'video'} style={[styles.controlButton, { backgroundColor: colors.card, opacity: controlsEnabled && call?.type === 'video' ? 1 : 0.5 }]}>
          <Ionicons name={cameraEnabled ? 'videocam' : 'videocam-off'} size={22} color={colors.foreground} />
          <Text style={[styles.controlLabel, { color: colors.foreground }]}>{cameraEnabled ? 'Camera' : 'Camera off'}</Text>
        </Pressable>
        <Pressable onPress={() => void swapCamera()} disabled={!controlsEnabled || call?.type !== 'video'} style={[styles.controlButton, { backgroundColor: colors.card, opacity: controlsEnabled && call?.type === 'video' ? 1 : 0.5 }]}>
          <Ionicons name="camera-reverse" size={22} color={colors.foreground} />
          <Text style={[styles.controlLabel, { color: colors.foreground }]}>Switch</Text>
        </Pressable>
        {screenShareAvailable ? (
          <Pressable onPress={() => void startScreenShare()} disabled={!controlsEnabled} style={[styles.controlButton, { backgroundColor: colors.card, opacity: controlsEnabled ? 1 : 0.5 }]}>
            <Ionicons name={screenSharing ? 'stop-circle-outline' : 'desktop-outline'} size={22} color={colors.foreground} />
            <Text style={[styles.controlLabel, { color: colors.foreground }]}>{screenSharing ? 'Stop sharing' : 'Share screen'}</Text>
          </Pressable>
        ) : (
          <View style={[styles.screenShareNotice, { backgroundColor: colors.card }]}>
            <Text style={[styles.controlLabel, { color: colors.mutedForeground }]}>Screen sharing is available during video calls.</Text>
          </View>
        )}
      </View>

      <View style={styles.bottomActions}>
        {call?.status === 'ringing' && isCallee ? (
          <Pressable disabled={busy} onPress={() => void accept()} style={[styles.answerButton, { backgroundColor: '#34C77E' }]}>
            <Ionicons name="call" size={20} color="#fff" />
            <Text style={styles.answerText}>Answer</Text>
          </Pressable>
        ) : null}
        <Pressable disabled={busy || !call} onPress={() => void hangup()} style={[styles.endButton, { backgroundColor: colors.destructive }]}>
          <Ionicons name="call" size={20} color={colors.destructiveForeground} />
          <Text style={[styles.endText, { color: colors.destructiveForeground }]}>{isCallee && call?.status === 'ringing' ? 'Decline' : 'End'}</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  callTypeChip: { minHeight: 42, borderRadius: 21, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  callTypeText: { fontSize: 13, fontWeight: '800' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 8 },
  name: { fontSize: 30, fontWeight: '800', marginTop: 18 },
  title: { fontSize: 18, fontWeight: '700' },
  detail: { fontSize: 14, textAlign: 'center' },
  previewCard: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 24, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 22 },
  previewBadge: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  previewTitle: { fontSize: 15, fontWeight: '800' },
  previewMeta: { fontSize: 12.5, marginTop: 2 },
  controlsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'space-between', marginBottom: 28 },
  controlButton: { width: '31%', minHeight: 92, borderRadius: 22, alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 8 },
  screenShareNotice: { width: '31%', minHeight: 92, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 10 },
  controlLabel: { fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  bottomActions: { flexDirection: 'row', justifyContent: 'center', gap: 14 },
  answerButton: { minWidth: 132, minHeight: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  answerText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  endButton: { minWidth: 132, minHeight: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  endText: { fontSize: 15, fontWeight: '800' },
});
