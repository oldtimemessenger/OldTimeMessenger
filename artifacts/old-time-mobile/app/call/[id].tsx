import { Ionicons } from '@expo/vector-icons';
import { acceptCall, declineCall, endCall, getCall, getCallLiveKitToken, type Call } from '@workspace/api-client-react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar } from '@/components/ui';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';
import { audioService } from '@/lib/audio-service';

export default function CallScreen() {
  const { id } = useLocalSearchParams<{ id: string }>(); const callId = Number(id); const router = useRouter(); const colors = useColors(); const { session } = useApp();
  const [call, setCall] = useState<Call | null>(null); const [error, setError] = useState<string | null>(null); const [muted, setMuted] = useState(false); const [speaker, setSpeaker] = useState(false); const [elapsed, setElapsed] = useState(0); const [busy, setBusy] = useState(false);
  const connectingRef = useRef(false);
  const refresh = useCallback(async () => { if (!Number.isInteger(callId)) return; try { setCall(await getCall(callId)); } catch (e) { setError(e instanceof Error ? e.message : 'Call unavailable.'); } }, [callId]);
  useEffect(() => { void refresh(); const timer = setInterval(() => void refresh(), 2500); return () => clearInterval(timer); }, [refresh]);
  useEffect(() => { if (call?.acceptedAt) { const tick = () => setElapsed(Math.max(0, Math.floor(Date.now() / 1000 - call.acceptedAt!))); tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer); } }, [call?.acceptedAt]);
  useEffect(() => () => { void audioService.leave(); }, []);
  const isCallee = call?.calleeId === session?.id; const name = isCallee ? 'Incoming Old Time call' : 'Calling Old Time member';
  async function connect() { if (connectingRef.current) return; connectingRef.current = true; try { const token = await getCallLiveKitToken(callId); await audioService.join(callId, 'speaker', { ...token, canPublish: true }); } finally { connectingRef.current = false; } }
  async function accept() { setBusy(true); try { const next = await acceptCall(callId); setCall(next); await connect(); } catch (e) { setError(e instanceof Error ? e.message : 'Could not join call.'); } finally { setBusy(false); } }
  async function hangup() { setBusy(true); try { if (call?.status === 'ringing' && isCallee) await declineCall(callId); else await endCall(callId); await audioService.leave(); router.back(); } catch (e) { Alert.alert('Call not ended', e instanceof Error ? e.message : 'Please try again.'); } finally { setBusy(false); } }
  useEffect(() => { if (call?.status === 'accepted') void connect().catch((e) => setError(e instanceof Error ? e.message : 'Audio connection failed.')); }, [call?.status]);
  useEffect(() => {
    if (call && ['declined', 'missed', 'ended'].includes(call.status)) {
      void audioService.leave();
    }
  }, [call?.status]);
  if (!call && !error) return <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>;
  const connected = call?.status === 'accepted';
  return <View style={[styles.root, { backgroundColor: colors.background }]}><View style={styles.center}><Avatar name={name} size={96} color={colors.primary} /><Text style={[styles.name, { color: colors.foreground }]}>{name}</Text><Text style={[styles.status, { color: colors.mutedForeground }]}>{error ?? (connected ? `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}` : call?.status === 'ringing' ? (isCallee ? 'Incoming call' : 'Ringing…') : `Call ${call?.status ?? ''}`)}</Text></View>
    {connected ? <View style={styles.controls}><Pressable onPress={() => { const next = !muted; setMuted(next); void audioService.setMuted(next); }} style={[styles.control, { backgroundColor: colors.card }]}><Ionicons name={muted ? 'mic-off' : 'mic'} size={24} color={colors.foreground} /><Text style={{ color: colors.foreground }}>{muted ? 'Unmute' : 'Mute'}</Text></Pressable>{Platform.OS !== 'web' ? <Pressable onPress={() => { const next = !speaker; setSpeaker(next); void audioService.setSpeaker?.(next).catch(() => setError('Audio output could not be changed on this device.')); }} style={[styles.control, { backgroundColor: colors.card }]}><Ionicons name="volume-high" size={24} color={colors.foreground} /><Text style={{ color: colors.foreground }}>{speaker ? 'Speaker' : 'Earpiece'}</Text></Pressable> : null}</View> : null}
    <View style={styles.bottom}>{call?.status === 'ringing' && isCallee ? <Pressable disabled={busy} onPress={() => void accept()} style={[styles.answer, { backgroundColor: colors.primary }]}><Text style={{ color: colors.primaryForeground }}>Accept</Text></Pressable> : null}<Pressable disabled={busy || !call} onPress={() => void hangup()} style={[styles.end, { backgroundColor: colors.destructive }]}><Ionicons name="call" size={24} color={colors.destructiveForeground} /><Text style={{ color: colors.destructiveForeground }}>{isCallee && call?.status === 'ringing' ? 'Decline' : 'End'}</Text></Pressable></View>
  </View>;
}
const styles = StyleSheet.create({ root: { flex: 1, padding: 28 }, center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 }, name: { fontSize: 23, fontWeight: '700', marginTop: 12 }, status: { fontSize: 15 }, controls: { flexDirection: 'row', justifyContent: 'center', gap: 16 }, control: { width: 96, height: 78, alignItems: 'center', justifyContent: 'center', gap: 6, borderRadius: 18 }, bottom: { flexDirection: 'row', justifyContent: 'center', gap: 18, paddingBottom: 35 }, answer: { minWidth: 110, padding: 17, borderRadius: 28, alignItems: 'center' }, end: { minWidth: 110, padding: 17, borderRadius: 28, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 8 } });