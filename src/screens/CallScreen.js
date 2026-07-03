import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Mic, MicOff, Video, VideoOff, SwitchCamera, PhoneOff, Volume2, ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import { useAuth } from '../context/AuthContext';
import { startCall, endCall } from '../services/calls';
import Avatar from '../components/Avatar';
import CallBtn from '../components/CallBtn';

// NOTE: This screen manages call *signaling* (who's calling whom, ringing/ended
// state) via the `calls` table. Real audio/video transport requires a WebRTC/SFU
// provider (e.g. LiveKit, Agora, Daily) — plug the SDK's connect/disconnect calls
// into the marked spots below.
export default function CallScreen({ navigation, route }) {
  const { theme } = useTheme();
  const { user } = useAuth();
  const { callType, otherUser, chatId } = route.params;
  const isVideo = callType === 'video';
  const [muted, setMuted] = useState(false);
  const [camOff, setCamOff] = useState(false);
  const [speaker, setSpeaker] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const callIdRef = useRef(null);

  useEffect(() => {
    let interval;
    (async () => {
      const call = await startCall(user.id, otherUser?.id, callType, chatId);
      callIdRef.current = call.id;
      // TODO: connect to your WebRTC provider here using call.id as the room name.
      interval = setInterval(() => setSeconds((s) => s + 1), 1000);
    })();
    return () => {
      clearInterval(interval);
      if (callIdRef.current) endCall(callIdRef.current);
      // TODO: disconnect from your WebRTC provider here.
    };
  }, []);

  const mm = String(Math.floor(seconds / 60)).padStart(2, '0');
  const ss = String(seconds % 60).padStart(2, '0');

  return (
    <View style={[styles.container, { backgroundColor: isVideo ? '#0a0d0c' : theme.bg }]}>
      <View style={styles.top}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5, marginBottom: 8 }}>
          <ShieldCheck size={13} color={isVideo ? '#fff' : theme.green} />
          <Text style={{ fontSize: 11, color: isVideo ? '#fff' : theme.green, opacity: 0.85 }}>Encrypted call</Text>
        </View>
        <Avatar name={otherUser?.display_name || '?'} color="#5B7C99" size={120} />
        <Text style={{ color: isVideo ? '#fff' : theme.text, fontSize: 22, fontWeight: '600', marginTop: 14 }}>
          {otherUser?.display_name || 'Calling…'}
        </Text>
        <Text style={{ color: isVideo ? '#ffffffaa' : theme.muted, fontSize: 14 }}>
          {isVideo ? `Video call · ${mm}:${ss}` : `Calling… ${mm}:${ss}`}
        </Text>
      </View>
      <View style={styles.controls}>
        <CallBtn icon={muted ? MicOff : Mic} active={muted} onPress={() => setMuted((m) => !m)} />
        {isVideo && <CallBtn icon={camOff ? VideoOff : Video} active={camOff} onPress={() => setCamOff((c) => !c)} />}
        {isVideo && <CallBtn icon={SwitchCamera} onPress={() => {}} />}
        {!isVideo && <CallBtn icon={Volume2} active={speaker} onPress={() => setSpeaker((s) => !s)} />}
        <CallBtn icon={PhoneOff} danger onPress={() => navigation.goBack()} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: 'space-between', paddingBottom: 44 },
  top: { alignItems: 'center', paddingTop: 60 },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 18 },
});
