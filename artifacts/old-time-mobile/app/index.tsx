import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Image, KeyboardAvoidingView, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRequestOtp, useVerifyOtp, type AuthenticatedUser, type BirthdayRequiredResponse } from '@workspace/api-client-react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';
import { completeBirthday } from '@/lib/social-api';

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
}

function formatBirthday(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length < 3) return digits;
  if (digits.length < 5) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function birthdayToIso(value: string): string | null {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const [, month, day, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day) || date.getTime() > Date.now()) return null;
  return `${year}-${month}-${day}`;
}

const TEST_PHONE = '+11234567890';
const TEST_CODE = '123456';

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, setSession } = useApp();
  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [busy, setBusy] = useState(false);
  const [birthday, setBirthday] = useState('');
  const [birthdayChallenge, setBirthdayChallenge] = useState<BirthdayRequiredResponse | null>(null);
  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();

  React.useEffect(() => {
    if (!session) return;
    router.replace('/(tabs)');
  }, [router, session]);

  const birthdayUser = birthdayChallenge;

  if (session && !birthdayUser) {
    return null;
  }

  function handleVerifiedUser(user: AuthenticatedUser | BirthdayRequiredResponse) {
    if ('requiresBirthday' in user) {
      setBirthday('');
      setBirthdayChallenge(user);
      return;
    }
    setSession(user);
    router.replace('/(tabs)');
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
      const user = await verifyOtp.mutateAsync({ data: { phone, otp, challengeId } });
      handleVerifiedUser(user);
    } catch (error) {
      Alert.alert('Sign-in unavailable', error instanceof Error ? error.message : 'That code is not quite right. Try again.');
    } finally {
      setBusy(false);
    }
  }

  async function useDemoAccess() {
    setBusy(true);
    try {
      const challenge = await requestOtp.mutateAsync({ data: { phone: TEST_PHONE } });
      const user = await verifyOtp.mutateAsync({
        data: { phone: TEST_PHONE, otp: TEST_CODE, challengeId: challenge.challengeId },
      });
      handleVerifiedUser(user);
    } catch (error) {
      Alert.alert('Demo access unavailable', error instanceof Error ? error.message : 'The local API is still starting. Try again in a moment.');
    } finally {
      setBusy(false);
    }
  }

  async function saveBirthday() {
    if (!birthdayUser) return;
    const isoBirthday = birthdayToIso(birthday);
    if (!isoBirthday) {
      Alert.alert('Check your birthday', 'Enter a real birthday in MM/DD/YYYY format.');
      return;
    }
    setBusy(true);
    try {
      const updated = await completeBirthday(birthdayUser.challengeId, isoBirthday);
      setBirthdayChallenge(null);
      setSession(updated);
      router.replace('/(tabs)');
    } catch (error) {
      Alert.alert('Birthday not saved', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior="padding">
    <LinearGradient colors={[colors.launchOrange, colors.launchPurple]} style={[styles.hero, { paddingTop: insets.top + 40 }]}>
      <View style={styles.orbit} />
      <Image source={require('../assets/images/old-time-icon.png')} style={styles.logo} />
      <Text style={styles.brand}>Old Time<Text style={[styles.brandDot, { color: colors.launchOrange }]}>.</Text></Text>
      <Text style={styles.tagline}>Private conversations. Real connections.</Text>
    </LinearGradient>
    <View style={[styles.form, { paddingBottom: insets.bottom + 24 }]}>
      {birthdayUser ? <>
        <Text style={[styles.kicker, { color: colors.mutedForeground }]}>ONE LAST STEP</Text>
        <Text style={[styles.heading, { color: colors.foreground }]}>Add your birthday.</Text>
        <Text style={[styles.birthdayHint, { color: colors.mutedForeground }]}>Your birthday helps keep your account age-appropriate. It stays private and is never shown on your profile.</Text>
        <Text style={[styles.label, { color: colors.foreground }]}>Birthday</Text>
        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Ionicons name="calendar-outline" size={19} color={colors.primary} />
          <TextInput testID="input-birthday" value={birthday} onChangeText={(value) => setBirthday(formatBirthday(value))} keyboardType="number-pad" placeholder="MM/DD/YYYY" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground }]} maxLength={10} />
        </View>
        <Pressable testID="button-save-birthday" disabled={busy || !birthdayToIso(birthday)} onPress={() => void saveBirthday()} style={({ pressed }) => [styles.continueButton, { backgroundColor: colors.launchButton, opacity: busy || !birthdayToIso(birthday) ? 0.45 : pressed ? 0.75 : 1 }]}><Text style={styles.continueText}>{busy ? 'Saving...' : 'Continue'}</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></Pressable>
      </> : <>
        <Text style={[styles.kicker, { color: colors.mutedForeground }]}>WELCOME BACK</Text>
        <Text style={[styles.heading, { color: colors.foreground }]}>Sign in to chat.</Text>
      {!challengeId ? <>
        <Text style={[styles.label, { color: colors.foreground }]}>Phone number</Text>
        <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Ionicons name="call-outline" size={19} color={colors.primary} />
          <TextInput testID="input-phone" value={phone} onChangeText={(value) => setPhone(formatPhone(value))} keyboardType="phone-pad" placeholder="(555) 014-2024" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground }]} />
        </View>
        <Pressable testID="button-request-otp" disabled={busy || phone.replace(/\D/g, '').length < 7} onPress={sendCode} style={({ pressed }) => [styles.continueButton, { backgroundColor: colors.launchButton, opacity: busy || phone.replace(/\D/g, '').length < 7 ? 0.45 : pressed ? 0.75 : 1 }]}><Text style={styles.continueText}>{busy ? 'Sending code...' : 'Continue'}</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></Pressable>
        {__DEV__ ? <Pressable testID="button-demo-access" onPress={() => void useDemoAccess()} disabled={busy} style={({ pressed }) => [styles.demoAccess, { backgroundColor: colors.secondary, borderColor: colors.brandPurple, opacity: busy ? 0.5 : pressed ? 0.7 : 1 }]}>
          <Ionicons name="flash-outline" size={16} color={colors.brandPurple} />
          <View style={styles.demoCopy}>
            <Text style={[styles.demoTitle, { color: colors.foreground }]}>Use demo access</Text>
            <Text style={[styles.demoHint, { color: colors.mutedForeground }]}>1234567890 · any 6-digit code</Text>
          </View>
        </Pressable> : null}
      </> : <>
        <View style={[styles.codeCard, { backgroundColor: colors.secondary, borderColor: colors.primary }]}>
          <View style={styles.codeIcon}><Ionicons name="checkmark" size={16} color="#fff" /></View>
          <View style={styles.codeCopy}><Text style={[styles.codeTitle, { color: colors.foreground }]}>Code sent to {phone}</Text></View>
        </View>
        <Text style={[styles.label, { color: colors.foreground }]}>Enter your code</Text>
        <TextInput testID="input-otp" value={otp} onChangeText={(value) => setOtp(value.replace(/\D/g, '').slice(0, 6))} keyboardType="number-pad" maxLength={6} autoFocus placeholder="000000" placeholderTextColor={colors.mutedForeground} style={[styles.otp, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
        <Pressable testID="button-verify-otp" disabled={busy || otp.length < 4} onPress={verifyCode} style={({ pressed }) => [styles.continueButton, { backgroundColor: colors.launchButton, opacity: busy || otp.length < 4 ? 0.45 : pressed ? 0.75 : 1 }]}><Text style={styles.continueText}>{busy ? 'Checking code...' : 'Open Old Time'}</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></Pressable>
        <Pressable onPress={() => { setChallengeId(''); setOtp(''); }} style={styles.change}><Text style={{ color: colors.mutedForeground }}>Use a different number</Text></Pressable>
      </>}
      </>}
    </View>
  </KeyboardAvoidingView>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  hero: { minHeight: 330, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  orbit: { position: 'absolute', width: 260, height: 260, borderRadius: 130, borderWidth: 30, borderColor: 'rgba(255,255,255,0.11)', right: -85, top: 30 },
  logo: { width: 104, height: 104, borderRadius: 52 },
  brand: { color: '#fff', fontSize: 32, fontWeight: '800', letterSpacing: -1.5, marginTop: 20 },
  brandDot: {},
  tagline: { color: 'rgba(255,255,255,0.82)', fontSize: 14, marginTop: 5 },
  form: { flex: 1, paddingHorizontal: 24, paddingTop: 28 },
  kicker: { fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  heading: { fontSize: 29, fontWeight: '800', letterSpacing: -0.8, marginTop: 8, marginBottom: 28 },
  birthdayHint: { fontSize: 14, lineHeight: 20, marginTop: -14, marginBottom: 26 },
  label: { fontSize: 14, fontWeight: '700', marginBottom: 8 },
  inputWrap: { borderWidth: 1, borderRadius: 10, minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  input: { flex: 1, fontSize: 16 },
  continueButton: { minHeight: 54, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22 },
  continueText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  demoAccess: { minHeight: 54, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginTop: 12 },
  demoCopy: { flex: 1 },
  demoTitle: { fontSize: 14, fontWeight: '800' },
  demoHint: { fontSize: 12, marginTop: 2 },
  codeCard: { borderWidth: 1, borderRadius: 10, padding: 14, flexDirection: 'row', gap: 10, alignItems: 'center', marginBottom: 22, backgroundColor: '#EAF6FF' },
  codeIcon: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center', borderRadius: 15 },
  codeCopy: { flex: 1 },
  codeTitle: { fontWeight: '800', fontSize: 14 },
  otp: { borderWidth: 1, borderRadius: 10, minHeight: 64, textAlign: 'center', fontSize: 30, fontWeight: '800', letterSpacing: 12 },
  change: { alignItems: 'center', paddingVertical: 18 },
});