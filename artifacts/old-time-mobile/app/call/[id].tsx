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
  const { session, addCall } = useApp();
  const [call, setCall] = useState<ManagedCall | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [videoConnected, setVideoConnected] = useState(false);
  const [screenSharing, setScreenSharing] = useState(false);
  const [screenShareBusy, setScreenShareBusy] = useState(false);
  const [callCredentials, setCallCredentials] = useState<{ token: string; url: string } | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const connectStarted = useRef(false);
  const connectedCallId = useRef<number | null>(null);
  const recordedCallId = useRef<number | null>(null);
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
  const isVideoCall = call?.type === 'video';
  const isFinished = Boolean(call && ['declined', 'missed', 'ended'].includes(call.status));
  const controlsEnabled = connected && (call?.type !== 'video' || videoConnected);
  const screenShareAvailable = (Platform.OS === 'android' || Platform.OS === 'ios') && isVideoCall && connected;
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

  const recordFinishedCall = useCallback((finished: ManagedCall) => {
    if (!session?.id) return;
    if (recordedCallId.current === finished.id) return;
    recordedCallId.current = finished.id;

    const isOutgoing = finished.callerId === session.id;
    const direction =
      finished.status === 'missed'
        ? 'missed'
        : isOutgoing
          ? 'outgoing'
          : 'incoming';

    const seconds = finished.durationSeconds > 0 ? finished.durationSeconds : elapsed;
    const duration = seconds > 0 ? durationLabel(seconds) : undefined;

    addCall({
      name,
      type: finished.type,
      direction,
      duration,
    });
  }, [session?.id, name, elapsed, addCall]);

  // Persist finished calls into local Recent Calls once per call id.
  useEffect(() => {
    if (!call || !['declined', 'missed', 'ended'].includes(call.status)) return;
    recordFinishedCall(call);
  }, [call, recordFinishedCall]);

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
    if (isFinished) {
      recordFinishedCall(call);
      setCallCredentials(null);
      setVideoConnected(false);
      setScreenSharing(false);
      connectedCallId.current = null;
      await audioService.leave();
      router.back();
      return;
    }
    setBusy(true);
    try {
      const updated =
        call.status === 'ringing' && isCallee
          ? await declineManagedCall(session.authToken, call.id)
          : await endManagedCall(session.authToken, call.id);
      setCall(updated);
      recordFinishedCall(updated);
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
    const nextScreenSharing = !screenSharing;
    try {
      if (!videoSurface.current) throw new Error('Video is still connecting.');
      setScreenShareBusy(true);
      await videoSurface.current.setScreenShareEnabled(nextScreenSharing);
      if (!nextScreenSharing) setScreenSharing(false);
    } catch (nextError) {
      setScreenSharing(false);
      Alert.alert('Screen sharing unavailable', nextError instanceof Error ? nextError.message : 'Screen sharing permission was not granted.');
    } finally {
      setScreenShareBusy(false);
    }
  }

  if (!session) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (loading && !call && !error) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  const closeCall = () => {
    if (isFinished || !connected) {
      router.back();
      return;
    }
    Alert.alert('Leave call?', 'The call will end for everyone.', [
      { text: 'Stay', style: 'cancel' },
      { text: 'End call', style: 'destructive', onPress: () => void hangup() },
    ]);
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 18 }]}>
      <View style={styles.topBar}>
        <Pressable accessibilityLabel="Close call" onPress={closeCall} style={styles.topButton}>
          <Ionicons name="chevron-down" size={23} color={colors.foreground} />
        </Pressable>
        <View style={styles.topTitle}>
          <Text style={[styles.callTypeText, { color: colors.foreground }]}>{isVideoCall ? 'Video call' : 'Voice call'}</Text>
          <Text style={[styles.topMeta, { color: colors.mutedForeground }]}>{tone.detail}</Text>
        </View>
        {connected ? <View style={[styles.liveDot, { backgroundColor: tone.accent }]} /> : <View style={styles.topButton} />}
      </View>

      {isVideoCall && connected ? (
        <View style={styles.videoStageContainer}>
          {callCredentials ? (
            <CallVideoSurface
              ref={videoSurface}
              serverUrl={callCredentials.url}
              token={callCredentials.token}
              muted={muted}
              cameraEnabled={cameraEnabled}
              onError={setError}
              onConnectionChange={setVideoConnected}
              onScreenShareChange={setScreenSharing}
            />
          ) : (
            <View style={[styles.videoConnecting, { backgroundColor: colors.card }]}>
              <ActivityIndicator color={colors.primary} />
              <Text style={[styles.videoConnectingText, { color: colors.mutedForeground }]}>Connecting video…</Text>
            </View>
          )}
          <View style={styles.videoOverlay}>
            <View style={styles.videoStatusPill}>
              <View style={[styles.statusDot, { backgroundColor: tone.accent }]} />
              <Text style={styles.videoStatusText}>{screenSharing ? 'You are sharing your screen' : tone.detail}</Text>
            </View>
            {error ? <Text style={styles.videoError}>{error}</Text> : null}
          </View>
        </View>
      ) : (
        <View style={[styles.voiceContent, isFinished && styles.finishedContent]}>
          <Avatar name={name} size={isFinished ? 94 : 118} />
          <Text style={[styles.name, { color: colors.foreground }]}>{name}</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>{error ?? tone.title}</Text>
          <Text style={[styles.detail, { color: colors.mutedForeground }]}>
            {error ? 'Please try again.' : isFinished ? `Call duration  ${durationLabel(call?.durationSeconds ?? elapsed)}` : tone.detail}
          </Text>
          {connected && !isFinished ? (
            <View style={[styles.connectionPill, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={[styles.statusDot, { backgroundColor: tone.accent }]} />
              <Text style={[styles.connectionText, { color: colors.foreground }]}>Connected</Text>
            </View>
          ) : null}
        </View>
      )}

      {isFinished ? (
        <View style={[styles.summaryCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.summaryIcon, { backgroundColor: colors.secondary }]}>
            <Ionicons name={call?.status === 'missed' ? 'call-outline' : 'checkmark'} size={20} color={colors.foreground} />
          </View>
          <View style={styles.summaryCopy}>
            <Text style={[styles.summaryTitle, { color: colors.foreground }]}>{tone.title}</Text>
            <Text style={[styles.summaryDetail, { color: colors.mutedForeground }]}>{tone.detail}</Text>
          </View>
          <Pressable accessibilityLabel="Close call summary" onPress={() => router.back()} style={[styles.doneButton, { backgroundColor: colors.secondary }]}>
            <Ionicons name="chevron-forward" size={18} color={colors.foreground} />
          </Pressable>
        </View>
      ) : (
        <>
          {connected ? (
            <View style={styles.controlsRow}>
              <Pressable accessibilityRole="button" accessibilityLabel={muted ? 'Unmute microphone' : 'Mute microphone'} onPress={() => void toggleMute()} disabled={!controlsEnabled} style={[styles.controlButton, { opacity: controlsEnabled ? 1 : 0.45 }]}>
                <View style={[styles.controlIcon, { backgroundColor: muted ? colors.destructive : colors.card }]}>
                  <Ionicons name={muted ? 'mic-off' : 'mic'} size={21} color={muted ? colors.destructiveForeground : colors.foreground} />
                </View>
                <Text style={[styles.controlLabel, { color: colors.foreground }]}>{muted ? 'Unmute' : 'Mute'}</Text>
              </Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel={speaker ? 'Use earpiece' : 'Use speaker'} onPress={() => void toggleSpeaker()} disabled={!controlsEnabled} style={[styles.controlButton, { opacity: controlsEnabled ? 1 : 0.45 }]}>
                <View style={[styles.controlIcon, { backgroundColor: speaker ? colors.primary : colors.card }]}>
                  <Ionicons name={speaker ? 'volume-high' : 'volume-mute'} size={21} color={speaker ? '#FFFFFF' : colors.foreground} />
                </View>
                <Text style={[styles.controlLabel, { color: colors.foreground }]}>{speaker ? 'Speaker' : 'Earpiece'}</Text>
              </Pressable>
              {isVideoCall ? (
                <>
                  <Pressable accessibilityRole="button" accessibilityLabel={cameraEnabled ? 'Turn camera off' : 'Turn camera on'} onPress={() => void toggleCamera()} disabled={!controlsEnabled} style={[styles.controlButton, { opacity: controlsEnabled ? 1 : 0.45 }]}>
                    <View style={[styles.controlIcon, { backgroundColor: cameraEnabled ? colors.card : colors.destructive }]}>
                      <Ionicons name={cameraEnabled ? 'videocam' : 'videocam-off'} size={21} color={cameraEnabled ? colors.foreground : colors.destructiveForeground} />
                    </View>
                    <Text style={[styles.controlLabel, { color: colors.foreground }]}>{cameraEnabled ? 'Camera' : 'Camera off'}</Text>
                  </Pressable>
                  <Pressable accessibilityRole="button" accessibilityLabel="Switch camera" onPress={() => void swapCamera()} disabled={!controlsEnabled} style={[styles.controlButton, { opacity: controlsEnabled ? 1 : 0.45 }]}>
                    <View style={[styles.controlIcon, { backgroundColor: colors.card }]}>
                      <Ionicons name="camera-reverse" size={21} color={colors.foreground} />
                    </View>
                    <Text style={[styles.controlLabel, { color: colors.foreground }]}>Flip</Text>
                  </Pressable>
                  {screenShareAvailable ? (
                    <Pressable accessibilityRole="button" accessibilityLabel={screenSharing ? 'Stop sharing screen' : 'Share screen'} onPress={() => void startScreenShare()} disabled={!controlsEnabled || screenShareBusy} style={[styles.controlButton, { opacity: controlsEnabled ? 1 : 0.45 }]}>
                      <View style={[styles.controlIcon, { backgroundColor: screenSharing ? colors.primary : colors.card }]}>
                        {screenShareBusy ? <ActivityIndicator color={colors.foreground} size="small" /> : <Ionicons name={screenSharing ? 'stop-circle-outline' : 'desktop-outline'} size={21} color={screenSharing ? '#FFFFFF' : colors.foreground} />}
                      </View>
                      <Text style={[styles.controlLabel, { color: colors.foreground }]}>{screenSharing ? 'Stop share' : 'Share'}</Text>
                    </Pressable>
                  ) : null}
                </>
              ) : null}
            </View>
          ) : null}

          <View style={styles.bottomActions}>
            {call?.status === 'ringing' && isCallee ? (
              <Pressable disabled={busy} onPress={() => void accept()} style={[styles.answerButton, { backgroundColor: '#2DBE72' }]}>
                <Ionicons name="call" size={20} color="#FFFFFF" />
                <Text style={styles.answerText}>Answer</Text>
              </Pressable>
            ) : null}
            <Pressable disabled={busy || !call} onPress={() => void hangup()} style={[styles.endButton, { backgroundColor: colors.destructive }]}>
              <Ionicons name="call" size={20} color="#FFFFFF" style={{ transform: [{ rotate: '135deg' }] }} />
              <Text style={styles.endText}>End</Text>
            </Pressable>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingHorizontal: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 },
  topButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  topTitle: { alignItems: 'center', flex: 1 },
  callTypeText: { fontSize: 16, fontWeight: '700' },
  topMeta: { fontSize: 13, marginTop: 2 },
  liveDot: { width: 10, height: 10, borderRadius: 5 },
  voiceContent: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  finishedContent: { paddingBottom: 24 },
  name: { fontSize: 28, fontWeight: '700', marginTop: 16 },
  title: { fontSize: 18, fontWeight: '600', marginTop: 4 },
  detail: { fontSize: 14, textAlign: 'center', paddingHorizontal: 24 },
  connectionPill: { marginTop: 16, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  connectionText: { fontSize: 13, fontWeight: '600' },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  videoStageContainer: { flex: 1, borderRadius: 24, overflow: 'hidden', marginBottom: 16 },
  videoConnecting: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  videoConnectingText: { fontSize: 14 },
  videoOverlay: { position: 'absolute', top: 16, left: 16, right: 16, gap: 8 },
  videoStatusPill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.45)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  videoStatusText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  videoError: { color: '#fecaca', fontSize: 13 },
  summaryCard: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 16, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, marginTop: 'auto' },
  summaryIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  summaryCopy: { flex: 1 },
  summaryTitle: { fontSize: 16, fontWeight: '700' },
  summaryDetail: { fontSize: 13, marginTop: 2 },
  doneButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  controlsRow: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 18, marginBottom: 28 },
  controlButton: { width: 72, alignItems: 'center', gap: 8 },
  controlIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  controlLabel: { fontSize: 12, fontWeight: '600' },
  bottomActions: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  answerButton: { minWidth: 142, minHeight: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  answerText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  endButton: { minWidth: 142, minHeight: 56, borderRadius: 28, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  endText: { fontSize: 15, fontWeight: '800', color: '#FFFFFF' },
});
