import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Link, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { EmailCodeInput } from '@/components/EmailCodeInput';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  getSafeAuthError,
  OAUTH_PROVIDERS,
  sendEmailCode,
  signInWithOAuth,
  verifyEmailCode,
  type OAuthProvider,
} from '@/lib/auth';

WebBrowser.maybeCompleteAuthSession();

const AUTH_VISITED_KEY = 'old-time:has-signed-in';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function SignInScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [emailAddress, setEmailAddress] = useState('');
  const [code, setCode] = useState('');
  const [codeSent, setCodeSent] = useState(false);
  const [secondsRemaining, setSecondsRemaining] = useState(0);
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const hasOAuthProviders = OAUTH_PROVIDERS.apple || OAUTH_PROVIDERS.google;

  useEffect(() => {
    if (secondsRemaining <= 0) return;
    const timer = setInterval(() => setSecondsRemaining((current) => Math.max(0, current - 1)), 1000);
    return () => clearInterval(timer);
  }, [secondsRemaining]);

  const sendCode = async () => {
    const email = emailAddress.trim();
    if (!isValidEmail(email)) {
      Alert.alert('Enter your email', 'Use a valid email address to receive your six-digit code.');
      return;
    }
    setLoading(true);
    try {
      const { error } = await sendEmailCode(email, false);
      if (error) throw error;
      setCode('');
      setCodeSent(true);
      setSecondsRemaining(60);
    } catch (error) {
      Alert.alert('Could not send your code', getSafeAuthError(error, 'Please check your email and try again.'));
    } finally {
      setLoading(false);
    }
  };

  const verifyCode = async () => {
    if (code.length !== 6) {
      Alert.alert('Enter your six-digit code', 'Type all six numbers from the email we sent you.');
      return;
    }
    setLoading(true);
    try {
      const { data, error } = await verifyEmailCode(emailAddress, code);
      if (error) throw error;
      if (!data.session) throw new Error('The sign-in session could not be created.');
      await AsyncStorage.setItem(AUTH_VISITED_KEY, 'true');
      router.replace('/');
    } catch (error) {
      Alert.alert('That code did not work', getSafeAuthError(error, 'Request a new code and try again.'));
    } finally {
      setLoading(false);
    }
  };

  const resendCode = async () => {
    if (secondsRemaining > 0) return;
    setLoading(true);
    try {
      const { error } = await sendEmailCode(emailAddress, false);
      if (error) throw error;
      setCode('');
      setSecondsRemaining(60);
    } catch (error) {
      Alert.alert('Could not resend your code', getSafeAuthError(error, 'Please wait a moment and try again.'));
    } finally {
      setLoading(false);
    }
  };

  const continueWithProvider = useCallback(async (provider: OAuthProvider, providerName: string) => {
    setSsoLoading(true);
    try {
      const outcome = await signInWithOAuth(provider);
      if (outcome === 'redirecting') return;
      await AsyncStorage.setItem(AUTH_VISITED_KEY, 'true');
      router.replace('/');
    } catch (error) {
      Alert.alert(`${providerName} sign-in unavailable`, getSafeAuthError(error, 'Try email instead.'));
    } finally {
      setSsoLoading(false);
    }
  }, [router]);

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 28, paddingBottom: Math.max(insets.bottom, 24) + 24 }}
      bottomOffset={76}
      keyboardDismissMode="interactive"
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar barStyle="dark-content" />
      {codeSent ? (
        <>
          <Pressable accessibilityRole="button" accessibilityLabel="Back to email" onPress={() => setCodeSent(false)} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.eyebrow, { color: colors.action }]}>Secure sign in</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Enter your code</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>
            We sent a six-digit code to{'\n'}<Text style={{ color: colors.foreground, fontFamily: 'NunitoSans_700Bold' }}>{emailAddress.trim()}</Text>
          </Text>
          <EmailCodeInput value={code} onChange={setCode} autoFocus />
          <Pressable
            onPress={() => void verifyCode()}
            disabled={loading || code.length !== 6}
            style={[styles.primaryButton, { backgroundColor: colors.action }, (loading || code.length !== 6) && styles.disabled]}
          >
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{loading ? 'Checking…' : 'Continue'}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
          </Pressable>
          <Pressable onPress={() => void resendCode()} disabled={loading || secondsRemaining > 0} style={styles.resend}>
            <Text style={[styles.resendText, { color: secondsRemaining > 0 ? colors.mutedForeground : colors.action }]}>
              {secondsRemaining > 0 ? `Resend code in ${secondsRemaining}s` : 'Resend code'}
            </Text>
          </Pressable>
          <Pressable onPress={() => setCodeSent(false)} style={styles.changeEmail}>
            <Text style={[styles.changeEmailText, { color: colors.mutedForeground }]}>Use a different email</Text>
          </Pressable>
        </>
      ) : (
        <>
          <Text style={[styles.eyebrow, { color: colors.action }]}>Welcome back</Text>
          <Text style={[styles.title, { color: colors.foreground }]}>Sign in to Old Time</Text>
          <Text style={[styles.body, { color: colors.mutedForeground }]}>Enter your email and we’ll send a one-time code. No password to remember.</Text>
          <Text style={[styles.label, { color: colors.foreground }]}>Email address</Text>
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Ionicons name="mail-outline" size={20} color={colors.action} />
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={emailAddress}
              onChangeText={setEmailAddress}
              onSubmitEditing={() => void sendCode()}
              placeholder="you@example.com"
              placeholderTextColor={colors.mutedForeground}
              returnKeyType="go"
              style={[styles.input, { color: colors.foreground }]}
            />
          </View>
          <Pressable onPress={() => void sendCode()} disabled={loading || !emailAddress.trim()} style={[styles.primaryButton, { backgroundColor: colors.action }, (loading || !emailAddress.trim()) && styles.disabled]}>
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{loading ? 'Sending code…' : 'Send me a code'}</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.primaryForeground} />
          </Pressable>
          <Link href={'/(auth)/sign-up' as never} asChild>
            <Pressable style={styles.createLink}>
              <Text style={[styles.createLinkText, { color: colors.foreground }]}>New to Old Time? <Text style={{ color: colors.action }}>Create an account</Text></Text>
            </Pressable>
          </Link>
          {hasOAuthProviders ? (
            <>
              <View style={styles.dividerRow}>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
                <Text style={[styles.orText, { color: colors.mutedForeground }]}>OR</Text>
                <View style={[styles.divider, { backgroundColor: colors.border }]} />
              </View>
              {OAUTH_PROVIDERS.apple ? (
                <Pressable onPress={() => void continueWithProvider('apple', 'Apple')} disabled={ssoLoading} style={[styles.providerButton, { borderColor: colors.border }, ssoLoading && styles.disabled]}>
                  <Ionicons name="logo-apple" size={20} color={colors.foreground} />
                  <Text style={[styles.providerText, { color: colors.foreground }]}>Continue with Apple</Text>
                </Pressable>
              ) : null}
              {OAUTH_PROVIDERS.google ? (
                <Pressable onPress={() => void continueWithProvider('google', 'Google')} disabled={ssoLoading} style={[styles.providerButton, { borderColor: colors.border }, ssoLoading && styles.disabled]}>
                  <Ionicons name="logo-google" size={20} color={colors.foreground} />
                  <Text style={[styles.providerText, { color: colors.foreground }]}>Continue with Google</Text>
                </Pressable>
              ) : null}
            </>
          ) : null}
          <Text style={[styles.terms, { color: colors.mutedForeground }]}>By continuing, you agree to Old Time’s Terms and Privacy Policy.</Text>
        </>
      )}
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 26 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 42 },
  eyebrow: { fontFamily: 'NunitoSans_800ExtraBold', textTransform: 'uppercase', letterSpacing: 1.5, fontSize: 11, marginBottom: 10 },
  title: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 32, lineHeight: 38, letterSpacing: -0.8 },
  body: { fontFamily: 'NunitoSans_400Regular', fontSize: 16, lineHeight: 23, marginTop: 12, marginBottom: 28, maxWidth: 360 },
  label: { fontFamily: 'NunitoSans_700Bold', fontSize: 14, marginBottom: 8 },
  inputWrap: { height: 56, borderWidth: 1, borderRadius: 14, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  input: { flex: 1, minHeight: 54, paddingHorizontal: 12, fontFamily: 'NunitoSans_400Regular', fontSize: 16 },
  primaryButton: { minHeight: 56, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 18 },
  primaryButtonText: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 16 },
  disabled: { opacity: 0.5 },
  createLink: { alignItems: 'center', paddingVertical: 18 },
  createLinkText: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 15 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 12 },
  divider: { height: 1, flex: 1 },
  orText: { fontFamily: 'NunitoSans_800ExtraBold', fontSize: 11, letterSpacing: 1 },
  providerButton: { minHeight: 54, borderRadius: 14, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, marginBottom: 10 },
  providerText: { fontFamily: 'NunitoSans_700Bold', fontSize: 16 },
  terms: { fontFamily: 'NunitoSans_400Regular', fontSize: 12, lineHeight: 17, textAlign: 'center', marginTop: 18 },
  resend: { alignItems: 'center', paddingVertical: 18 },
  resendText: { fontFamily: 'NunitoSans_700Bold', fontSize: 15 },
  changeEmail: { alignItems: 'center', paddingVertical: 4 },
  changeEmailText: { fontFamily: 'NunitoSans_600SemiBold', fontSize: 14 },
});