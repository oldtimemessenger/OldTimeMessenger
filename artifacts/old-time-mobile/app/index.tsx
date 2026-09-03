import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { AccessibilityInfo, Alert, Animated, Easing, Image, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { type AuthenticatedUser, type BirthdayRequiredResponse } from '@workspace/api-client-react';
import { LinearGradient } from 'expo-linear-gradient';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';
import { completeBirthday, updateUserProfile } from '@/lib/social-api';
import { FirebaseAuthPanel } from '@/components/firebase-auth-panel';

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

export default function AuthScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session, setSession } = useApp();
  const [busy, setBusy] = useState(false);
  const [birthday, setBirthday] = useState('');
  const [birthdayChallenge, setBirthdayChallenge] = useState<BirthdayRequiredResponse | null>(null);
  const [creatingAccount, setCreatingAccount] = useState(false);
  const [pendingProfile, setPendingProfile] = useState<{ name: string; username: string } | null>(null);
  const [profileSetupUser, setProfileSetupUser] = useState<AuthenticatedUser | null>(null);
  const [setupName, setSetupName] = useState('');
  const [setupUsername, setSetupUsername] = useState('');
  const [showWelcome, setShowWelcome] = useState(true);
  const [reduceMotion, setReduceMotion] = useState(false);
  const introProgress = useRef(new Animated.Value(0)).current;
  const ambientProgress = useRef(new Animated.Value(0)).current;
  const exitProgress = useRef(new Animated.Value(0)).current;
  const authProgress = useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (!session) return;
    router.replace('/(tabs)');
  }, [router, session]);

  useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((enabled) => {
      if (mounted) setReduceMotion(enabled);
    });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      mounted = false;
      subscription.remove();
    };
  }, []);

  useEffect(() => {
    if (reduceMotion) {
      introProgress.setValue(1);
      ambientProgress.setValue(0.5);
      return;
    }
    const entrance = Animated.spring(introProgress, {
      toValue: 1,
      damping: 16,
      stiffness: 105,
      mass: 0.75,
      useNativeDriver: Platform.OS !== 'web',
    });
    const ambient = Animated.loop(
      Animated.sequence([
        Animated.timing(ambientProgress, { toValue: 1, duration: 4200, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
        Animated.timing(ambientProgress, { toValue: 0, duration: 4200, easing: Easing.inOut(Easing.ease), useNativeDriver: Platform.OS !== 'web' }),
      ]),
    );
    entrance.start();
    ambient.start();
    return () => {
      entrance.stop();
      ambient.stop();
    };
  }, [ambientProgress, introProgress, reduceMotion]);

  useEffect(() => {
    if (showWelcome) return;
    if (reduceMotion) {
      authProgress.setValue(1);
      return;
    }
    const entrance = Animated.spring(authProgress, {
      toValue: 1,
      damping: 19,
      stiffness: 120,
      mass: 0.8,
      useNativeDriver: Platform.OS !== 'web',
    });
    entrance.start();
    return () => entrance.stop();
  }, [authProgress, reduceMotion, showWelcome]);

  const birthdayUser = birthdayChallenge;

  if (session && !birthdayUser) {
    return null;
  }

  function handleVerifiedUser(user: AuthenticatedUser | BirthdayRequiredResponse, newProfile?: { name: string; username: string }) {
    if (newProfile) {
      setPendingProfile(newProfile);
      setSetupName(newProfile.name);
      setSetupUsername(newProfile.username);
    }
    if ('requiresBirthday' in user) {
      setBirthday('');
      setBirthdayChallenge(user);
      return;
    }
    if (newProfile) {
      setProfileSetupUser(user);
      return;
    }
    setSession(user);
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
      if (pendingProfile) {
        setProfileSetupUser(updated);
      } else {
        setSession(updated);
      }
    } catch (error) {
      Alert.alert('Birthday not saved', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  }

  async function finishProfileSetup() {
    if (!profileSetupUser) return;
    const name = setupName.trim();
    const username = setupUsername.trim().toLowerCase().replace(/^@/, '');
    if (!name || !/^[a-z0-9_]{3,24}$/.test(username)) return;
    setBusy(true);
    try {
      const updated = await updateUserProfile(profileSetupUser.authToken, profileSetupUser.id, { name, username });
      setPendingProfile(null);
      setProfileSetupUser(null);
      setSession({ ...profileSetupUser, ...updated });
    } catch (error) {
      Alert.alert('Choose another username', error instanceof Error ? error.message : 'Please try another username.');
    } finally {
      setBusy(false);
    }
  }

  function startApp() {
    if (reduceMotion) {
      setShowWelcome(false);
      return;
    }
    Animated.timing(exitProgress, {
      toValue: 1,
      duration: 340,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    }).start(({ finished }) => {
      if (finished) setShowWelcome(false);
    });
  }

  if (showWelcome && !birthdayUser) {
    const logoTranslateY = introProgress.interpolate({ inputRange: [0, 1], outputRange: [30, 0] });
    const logoScale = introProgress.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.72, 1.04, 1] });
    const copyTranslateY = introProgress.interpolate({ inputRange: [0, 1], outputRange: [22, 0] });
    const copyOpacity = introProgress.interpolate({ inputRange: [0, 0.42, 1], outputRange: [0, 0, 1] });
    const buttonTranslateY = introProgress.interpolate({ inputRange: [0, 1], outputRange: [28, 0] });
    const buttonOpacity = introProgress.interpolate({ inputRange: [0, 0.62, 1], outputRange: [0, 0, 1] });
    const exitOpacity = exitProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0] });
    const exitScale = exitProgress.interpolate({ inputRange: [0, 1], outputRange: [1, 0.97] });
    const blueDrift = ambientProgress.interpolate({ inputRange: [0, 1], outputRange: [-18, 22] });
    const orangeDrift = ambientProgress.interpolate({ inputRange: [0, 1], outputRange: [18, -16] });
    const ringRotate = ambientProgress.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '7deg'] });
    const haloScale = ambientProgress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.96, 1.04, 0.96] });
    const haloOpacity = ambientProgress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.42, 0.8, 0.42] });
    const buttonScale = ambientProgress.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.99, 1.015, 0.99] });

    return (
      <View style={[styles.launchRoot, { backgroundColor: colors.launchNavy }]}>
        <Animated.View style={[styles.launchAnimated, { opacity: exitOpacity, transform: [{ scale: exitScale }] }]}>
          <LinearGradient
            colors={[colors.launchSky, colors.launchPurple, colors.launchNavy]}
            locations={[0, 0.48, 1]}
            style={styles.launchGradient}
          >
            <Animated.View style={[styles.launchGlow, styles.launchGlowBlue, { backgroundColor: colors.brandBlue, transform: [{ translateX: blueDrift }] }]} />
            <Animated.View style={[styles.launchGlow, styles.launchGlowOrange, { backgroundColor: colors.brandOrange, transform: [{ translateX: orangeDrift }] }]} />
            <Animated.View style={[styles.launchRing, { borderColor: 'rgba(255,255,255,0.13)', transform: [{ rotate: ringRotate }] }]} />
            <View style={[styles.launchSafeArea, { paddingTop: insets.top + 18, paddingBottom: insets.bottom + 22 }]}>
              <View style={styles.launchCenter}>
                <Animated.View style={{ opacity: introProgress, transform: [{ translateY: logoTranslateY }, { scale: logoScale }] }}>
                  <Animated.View style={[styles.logoPulse, { opacity: haloOpacity, transform: [{ scale: haloScale }], borderColor: 'rgba(255,255,255,0.25)' }]} />
                  <View style={styles.logoHalo}>
                    <View style={styles.logoHaloInner}>
                      <Image source={require('../assets/images/old-time-icon.png')} style={styles.launchLogo} />
                    </View>
                  </View>
                </Animated.View>
                <Animated.View style={[styles.launchCopy, { opacity: copyOpacity, transform: [{ translateY: copyTranslateY }] }]}>
                  <Text style={styles.launchBrand}>Old Time<Text style={[styles.launchBrandDot, { color: colors.brandOrange }]}>.</Text></Text>
                  <Text style={styles.launchTagline}>Private conversations. Real connections.</Text>
                  <Text style={styles.launchSubline}>A calmer way to stay close.</Text>
                </Animated.View>
              </View>

              <Animated.View style={[styles.launchAction, { opacity: buttonOpacity, transform: [{ translateY: buttonTranslateY }] }]}>
                <Pressable onPress={startApp} accessibilityRole="button" accessibilityLabel="Get started" style={({ pressed }) => [styles.getStartedButton, { backgroundColor: colors.launchButton, transform: [{ scale: pressed ? 0.98 : buttonScale }] }]}>
                  <Text style={styles.getStartedText}>Get started</Text>
                  <View style={styles.getStartedArrow}><Ionicons name="arrow-forward" size={18} color={colors.launchButton} /></View>
                </Pressable>
                <Text style={styles.launchFooter}>Your people. Your space. Your time.</Text>
              </Animated.View>
            </View>
          </LinearGradient>
        </Animated.View>
      </View>
    );
  }

  const authOpacity = authProgress.interpolate({ inputRange: [0, 0.3, 1], outputRange: [0, 0.7, 1] });
  const authTranslateY = authProgress.interpolate({ inputRange: [0, 1], outputRange: [24, 0] });

  return <Animated.View style={[styles.root, { opacity: authOpacity, transform: [{ translateY: authTranslateY }] }]}>
    <KeyboardAvoidingView style={[styles.root, { backgroundColor: colors.background }]} behavior="padding">
      <LinearGradient colors={[colors.launchOrange, colors.launchPurple]} style={[styles.hero, { paddingTop: insets.top + 40 }]}>
        <View style={styles.orbit} />
        <Image source={require('../assets/images/old-time-icon.png')} style={styles.logo} />
        <Text style={styles.brand}>Old Time<Text style={[styles.brandDot, { color: colors.launchOrange }]}>.</Text></Text>
        <Text style={styles.tagline}>Private conversations. Real connections.</Text>
      </LinearGradient>
      <View style={[styles.form, { paddingBottom: insets.bottom + 24 }]}>
        {profileSetupUser ? <>
          <Text style={[styles.kicker, { color: colors.mutedForeground }]}>MAKE IT YOURS</Text>
          <Text style={[styles.heading, { color: colors.foreground }]}>Choose how people find you.</Text>
          <Text style={[styles.birthdayHint, { color: colors.mutedForeground }]}>You can change these later in Settings.</Text>
          <Text style={[styles.label, { color: colors.foreground }]}>Name</Text>
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Ionicons name="person-outline" size={19} color={colors.primary} />
            <TextInput testID="input-setup-name" value={setupName} onChangeText={setSetupName} placeholder="Your name" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground }]} maxLength={80} />
          </View>
          <Text style={[styles.label, styles.setupLabel, { color: colors.foreground }]}>Username</Text>
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={{ color: colors.primary, fontSize: 18, fontWeight: '800' }}>@</Text>
            <TextInput testID="input-setup-username" value={setupUsername} onChangeText={(value) => setSetupUsername(value.toLowerCase().replace(/[^a-z0-9_@]/g, ''))} autoCapitalize="none" autoCorrect={false} placeholder="username" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground }]} maxLength={25} />
          </View>
          <Pressable testID="button-finish-profile" disabled={busy || !setupName.trim() || !/^[a-z0-9_]{3,24}$/.test(setupUsername.replace(/^@/, ''))} onPress={() => void finishProfileSetup()} style={({ pressed }) => [styles.continueButton, { backgroundColor: colors.launchButton, opacity: busy || !setupName.trim() || !/^[a-z0-9_]{3,24}$/.test(setupUsername.replace(/^@/, '')) ? 0.45 : pressed ? 0.75 : 1 }]}><Text style={styles.continueText}>{busy ? 'Creating your account...' : 'Join Old Time'}</Text><Ionicons name="arrow-forward" size={18} color="#fff" /></Pressable>
        </> : birthdayUser ? <>
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
          <Text style={[styles.kicker, { color: colors.mutedForeground }]}>{creatingAccount ? 'HELLO, WELCOME' : 'GOOD TO SEE YOU'}</Text>
          <Text style={[styles.heading, { color: colors.foreground }]}>{creatingAccount ? 'Create your Old Time.' : 'Sign in and pick up where you left off.'}</Text>
          <FirebaseAuthPanel onAuthenticated={handleVerifiedUser} onModeChange={setCreatingAccount} />
        </>}
      </View>
    </KeyboardAvoidingView>
  </Animated.View>;
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  launchRoot: { flex: 1 },
  launchAnimated: { flex: 1 },
  launchGradient: { flex: 1, overflow: 'hidden' },
  launchSafeArea: { flex: 1, paddingHorizontal: 24, justifyContent: 'space-between' },
  launchCenter: { alignItems: 'center', justifyContent: 'center', flex: 1 },
  logoPulse: { position: 'absolute', width: 208, height: 208, borderRadius: 104, borderWidth: 1 },
  logoHalo: { width: 188, height: 188, borderRadius: 94, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.10)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.18)', shadowColor: '#102A75', shadowOpacity: 0.3, shadowRadius: 30, shadowOffset: { width: 0, height: 14 }, elevation: 12 },
  logoHaloInner: { width: 148, height: 148, borderRadius: 74, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(20,39,111,0.72)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.22)' },
  launchLogo: { width: 128, height: 128, borderRadius: 64 },
  launchCopy: { alignItems: 'center', marginTop: 30 },
  launchBrand: { color: '#FFFFFF', fontSize: 43, lineHeight: 49, fontWeight: '800', letterSpacing: -2 },
  launchBrandDot: {},
  launchTagline: { color: 'rgba(255,255,255,0.90)', fontSize: 15, fontWeight: '500', marginTop: 9, letterSpacing: 0.1 },
  launchSubline: { color: 'rgba(255,255,255,0.62)', fontSize: 13, marginTop: 7 },
  launchAction: { alignItems: 'center' },
  getStartedButton: { minHeight: 58, width: '100%', borderRadius: 29, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 13, shadowColor: '#111A55', shadowOpacity: 0.28, shadowRadius: 18, shadowOffset: { width: 0, height: 9 }, elevation: 8 },
  getStartedText: { color: '#FFFFFF', fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  getStartedArrow: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.92)' },
  launchFooter: { color: 'rgba(255,255,255,0.62)', fontSize: 12, marginTop: 14 },
  launchGlow: { position: 'absolute', borderRadius: 999, opacity: 0.22 },
  launchGlowBlue: { width: 280, height: 280, left: -145, top: '32%' },
  launchGlowOrange: { width: 250, height: 250, right: -125, top: '8%' },
  launchRing: { position: 'absolute', width: 470, height: 470, borderRadius: 235, borderWidth: 36, right: -220, top: '12%', opacity: 0.8 },
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
  setupLabel: { marginTop: 18 },
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