import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRequestOtp, useVerifyOtp, type AuthenticatedUser } from '@workspace/api-client-react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, setSession } = useApp();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [busy, setBusy] = useState(false);
  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();

  React.useEffect(() => {
    if (session) router.replace('/(tabs)');
  }, [router, session]);

  if (session) {
    return null;
  }

  async function sendCode() {
    setBusy(true);
    try {
      const result = await requestOtp.mutateAsync({ data: { phone } });
      setChallengeId(result.challengeId);
    } catch {
      Alert.alert('Could not send code', 'Check the number and try again.');
    } finally {
      setBusy(false);
    }
  }

  async function verifyCode() {
    setBusy(true);
    try {
      const user = await verifyOtp.mutateAsync({ data: { phone, otp, challengeId } }) as AuthenticatedUser;
      setSession(user);
      router.replace('/(tabs)');
    } catch {
      Alert.alert('Incorrect code', 'That code is not quite right. Try again.');
    } finally {
      setBusy(false);
    }
  }

  return <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior="padding">
    <LinearGradient colors={['#63BFFB', '#3B8FD6']} style={[styles.hero, { paddingTop: insets.top + 40 }]}>
      <View style={styles.orbit} />
      <Image source={require('../assets/images/old-time-icon.png')} style={styles.logo} />
      <Text style={styles.brand}>Old Time<Text style={styles.brandDot}>.</Text></Text>
      <Text style={styles.tagline}>Private conversations. Real connections.</Text>
    </LinearGradient>
    <View style={[styles.form, { paddingBottom: insets.bottom + 24 }]}>
      <Text style={[styles.kicker, { color: colors.mutedForeground }]}>WELCOME BACK</Text>
      <Text style={[styles.heading, { color: colors.foreground }]}>Sign in to chat.</Text>
      {!challengeId ? <>
        <Text style={[styles.label, { color: colors.foreground }]}>Phone number</Text>
        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Ionicons name="call-outline" size={19} color={colors.primary} />
          <TextInput testID="input-phone" value={phone} onChangeText={(value) => setPhone(formatPhone(value))} keyboardType="phone-pad" placeholder="(555) 014-2024" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground }]} />
        </View>
        <Pressable testID="button-request-otp" disabled={busy || phone.replace(/\D/g, '').length < 7} onPress={sendCode} style={({ pressed }) => [styles.continueButton, { backgroundColor: colors.primary, opacity: busy || phone.replace(/\D/g, '').length < 7 ? 0.45 : pressed ? 0.75 : 1 }]}><Text style={styles.continueText}>{busy ? 'Sending code...' : 'Continue'}</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></Pressable>
      </> : <>
        <View style={[styles.codeCard, { backgroundColor: colors.secondary, borderColor: colors.primary }]}>
          <View style={styles.codeIcon}><Ionicons name="checkmark" size={16} color="#fff" /></View>
          <View style={styles.codeCopy}><Text style={[styles.codeTitle, { color: colors.foreground }]}>Code sent to {phone}</Text></View>
        </View>
        <Text style={[styles.label, { color: colors.foreground }]}>Enter your code</Text>
        <TextInput testID="input-otp" value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} autoFocus placeholder="000000" placeholderTextColor={colors.mutedForeground} style={[styles.otp, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
        <Pressable testID="button-verify-otp" disabled={busy || otp.length < 4} onPress={verifyCode} style={({ pressed }) => [styles.continueButton, { backgroundColor: colors.primary, opacity: busy || otp.length < 4 ? 0.45 : pressed ? 0.75 : 1 }]}><Text style={styles.continueText}>{busy ? 'Checking code...' : 'Open Old Time'}</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></Pressable>
        <Pressable onPress={() => { setChallengeId(''); setOtp(''); }} style={styles.change}><Text style={{ color: colors.mutedForeground }}>Use a different number</Text></Pressable>
      </>}
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { minHeight: 330, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', backgroundColor: '#3B8FD6' },
  orbit: { position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 30, borderColor: 'rgba(255,255,255,0.11)', right: -85, top: 30 },
  logo: { width: 104, height: 104, borderRadius: 52 },
  brand: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: -1.5, marginTop: 20 },
  brandDot: { color: '#EEFFDE' },
  tagline: { color: 'rgba(255,255,255,0.82)', fontSize: 14, marginTop: 5 },
  form: { flex: 1, paddingHorizontal: 24, paddingTop: 28 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  heading: { fontSize: 29, fontWeight: '800', letterSpacing: -0.8, marginTop: 8, marginBottom: 28 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  inputWrap: { borderWidth: 1, borderRadius: 10, minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 16 },
  continueButton: { minHeight: 54, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22 },
  continueText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  codeCard: { borderWidth: 1, borderRadius: 10, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 22, backgroundColor: '#EAF6FF' },
  codeIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15, backgroundColor: '#3B8FD6' },
  codeCopy: { flex: 1 },
  codeTitle: { fontWeight: '800', fontSize: 14 },
  otp: { borderWidth: 1, borderRadius: 10, minHeight: 64, textAlign: 'center', fontSize: 30, fontWeight: '800', letterSpacing: 12 },
  change: { alignItems: 'center', paddingVertical: 18 },
});