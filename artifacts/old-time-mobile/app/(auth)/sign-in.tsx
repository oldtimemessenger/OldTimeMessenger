import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import { Link, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Image, Platform, Pressable, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { assertSupabaseConfigured, getSafeAuthError, OAUTH_PROVIDERS, signInWithOAuth, supabase, type OAuthProvider } from '@/lib/auth';

WebBrowser.maybeCompleteAuthSession();

const launchLogo = require('../../assets/images/old-time-feather-logo.png');
const AUTH_VISITED_KEY = 'old-time:has-signed-in';

export default function SignInScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [hasSignedInBefore, setHasSignedInBefore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [ssoLoading, setSsoLoading] = useState(false);
  const hasOAuthProviders = OAUTH_PROVIDERS.apple || OAUTH_PROVIDERS.google;

  useEffect(() => {
    void AsyncStorage.getItem(AUTH_VISITED_KEY).then((value) => setHasSignedInBefore(value === 'true'));
    if (Platform.OS === 'android') {
      void WebBrowser.warmUpAsync();
      return () => void WebBrowser.coolDownAsync();
    }
  }, []);

  const submit = async () => {
    setLoading(true);
    try {
      assertSupabaseConfigured();
      const { error } = await supabase.auth.signInWithPassword({
        email: emailAddress.trim(),
        password,
      });
      if (error) throw error;
      await AsyncStorage.setItem(AUTH_VISITED_KEY, 'true');
      router.replace('/');
    } catch (error) {
      Alert.alert('Could not sign in', getSafeAuthError(error, 'Please check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  };

  const continueWithProvider = useCallback(async (provider: OAuthProvider, providerName: string) => {
    setSsoLoading(true);
    try {
      assertSupabaseConfigured();
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
      contentContainerStyle={styles.scrollContent}
      keyboardDismissMode="interactive"
    >
      <StatusBar barStyle="dark-content" />
      <View style={styles.hero}>
        <LinearGradient
          colors={[colors.authGradientStart, colors.authGradientMiddle, colors.authGradientEnd]}
          locations={[0, 0.5, 1]}
          style={StyleSheet.absoluteFill}
        />
        <View style={[styles.heroOrb, styles.heroOrbOuter, { borderColor: 'rgba(255,255,255,0.15)' }]} />
        <View style={[styles.heroOrb, styles.heroOrbInner, { borderColor: 'rgba(255,255,255,0.1)' }]} />
        <View style={[styles.heroContent, { paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 67 : 0) + 67 }]}>
          <View style={[styles.logoHalo, { backgroundColor: colors.authNavy }]}>
            <Image source={launchLogo} style={styles.launchLogo} />
          </View>
          <Text style={styles.brand}>Old Time<Text style={styles.brandDot}>.</Text></Text>
          <Text style={styles.tagline}>Private conversations. Real connections.</Text>
        </View>
      </View>

      <View style={[styles.form, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 20) + 4 }]}>
        <Text style={[styles.kicker, { color: colors.mutedForeground }]}>{hasSignedInBefore ? 'Good to see you' : 'Welcome to Old Time'}</Text>
        <Text style={[styles.title, { color: colors.authInk }]}>{hasSignedInBefore ? 'Sign in and pick up where you left off.' : 'Sign in and start something real.'}</Text>

        <View style={[styles.inputWrap, { borderColor: colors.authBorder }]}>
          <Ionicons name="mail-outline" size={20} color={colors.authNavy} />
          <TextInput
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            value={emailAddress}
            onChangeText={setEmailAddress}
            placeholder="Email address"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.authInk }]}
          />
        </View>
        <View style={[styles.inputWrap, { borderColor: colors.authBorder }]}>
          <Ionicons name="lock-closed-outline" size={20} color={colors.authNavy} />
          <TextInput
            secureTextEntry
            autoComplete="password"
            value={password}
            onChangeText={setPassword}
            placeholder="Password"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.input, { color: colors.authInk }]}
          />
        </View>
        <Pressable
          onPress={() => void submit()}
          disabled={!emailAddress || !password || loading}
          style={[styles.primaryButton, { backgroundColor: colors.authButton }, (!emailAddress || !password || loading) && styles.disabledButton]}
        >
          <Text style={[styles.primaryButtonText, { color: colors.authButtonText }]}>{loading ? 'Signing in…' : 'Sign in'}</Text>
          <Ionicons name="arrow-forward" size={18} color={colors.authButtonText} />
        </Pressable>

        <Link href={'/(auth)/forgot-password' as never} asChild>
          <Pressable style={styles.forgotLink}>
            <Text style={[styles.forgotLinkText, { color: colors.authNavy }]}>Forgot password?</Text>
          </Pressable>
        </Link>

        <Link href={'/(auth)/sign-up' as never} asChild>
          <Pressable style={styles.createLink}>
            <Text style={[styles.createLinkText, { color: colors.authNavy }]}>New to Old Time? Create an account</Text>
          </Pressable>
        </Link>

        {hasOAuthProviders ? <>
          <View style={styles.dividerRow}>
            <View style={[styles.divider, { backgroundColor: colors.authBorder }]} />
            <Text style={[styles.orText, { color: colors.mutedForeground }]}>OR</Text>
            <View style={[styles.divider, { backgroundColor: colors.authBorder }]} />
          </View>

          {OAUTH_PROVIDERS.apple ? <Pressable
            onPress={() => void continueWithProvider('apple', 'Apple')}
            disabled={ssoLoading}
            style={[styles.providerButton, styles.appleButton, ssoLoading && styles.disabledButton]}
          >
            <Ionicons name="logo-apple" size={21} color="#ffffff" />
            <Text style={styles.appleButtonText}>Continue with Apple</Text>
          </Pressable> : null}
          {OAUTH_PROVIDERS.google ? <Pressable
            onPress={() => void continueWithProvider('google', 'Google')}
            disabled={ssoLoading}
            style={[styles.providerButton, { borderColor: colors.authBorder }, ssoLoading && styles.disabledButton]}
          >
            <Ionicons name="logo-google" size={20} color={colors.authInk} />
            <Text style={[styles.googleButtonText, { color: colors.authInk }]}>Continue with Google</Text>
          </Pressable> : null}
        </> : <View style={[styles.socialUnavailable, { borderColor: colors.authBorder, backgroundColor: colors.secondary }]}>
          <Text style={[styles.socialUnavailableText, { color: colors.mutedForeground }]}>
            Email sign-in is available in this preview.
          </Text>
        </View>}
      </View>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  scrollContent: { flexGrow: 1 },
  hero: { height: 334, overflow: 'hidden' },
  heroContent: { flex: 1, alignItems: 'center' },
  heroOrb: { position: 'absolute', borderRadius: 180 },
  heroOrbOuter: { width: 300, height: 300, right: -62, top: -54, borderWidth: 24 },
  heroOrbInner: { width: 212, height: 212, right: -20, top: 14, borderWidth: 1 },
  logoHalo: { width: 112, height: 112, borderRadius: 56, alignItems: 'center', justifyContent: 'center', shadowColor: '#142d75', shadowOpacity: 0.3, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 10 },
  launchLogo: { width: 100, height: 100, borderRadius: 50 },
  brand: { color: '#FFFFFF', fontFamily: 'Fraunces_900Black', fontSize: 36, lineHeight: 42, letterSpacing: -1.2, marginTop: 20 },
  brandDot: { color: '#D71920' },
  tagline: { color: 'rgba(255,255,255,0.88)', fontFamily: 'Outfit_500Medium', fontSize: 15, marginTop: 6 },
  form: { paddingHorizontal: 26, paddingTop: 24, backgroundColor: '#FFFFFF' },
  kicker: { fontFamily: 'Outfit_700Bold', textTransform: 'uppercase', letterSpacing: 2, fontSize: 11, marginBottom: 8 },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 30, lineHeight: 36, letterSpacing: -0.8, maxWidth: 370, marginBottom: 22 },
  inputWrap: { height: 54, borderWidth: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, marginBottom: 12 },
  input: { flex: 1, minHeight: 52, paddingHorizontal: 12, fontFamily: 'Outfit_400Regular', fontSize: 16 },
  error: { fontSize: 12, marginTop: -3, marginBottom: 7 },
  primaryButton: { minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8, marginTop: 8 },
  primaryButtonText: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  disabledButton: { opacity: 0.68 },
  createLink: { alignItems: 'center', paddingVertical: 14 },
  createLinkText: { fontFamily: 'Outfit_600SemiBold', fontSize: 15 },
  forgotLink: { alignItems: 'center', paddingVertical: 4 },
  forgotLinkText: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
  dividerRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 12 },
  divider: { height: 1, flex: 1 },
  orText: { fontFamily: 'Outfit_700Bold', fontSize: 12 },
  providerButton: { minHeight: 54, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, marginBottom: 12 },
  appleButton: { backgroundColor: '#1A1614', borderColor: '#1A1614' },
  appleButtonText: { color: '#FFFFFF', fontFamily: 'Outfit_600SemiBold', fontSize: 16 },
  googleButtonText: { fontFamily: 'Outfit_600SemiBold', fontSize: 16 },
  socialUnavailable: { minHeight: 48, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, marginTop: 10 },
  socialUnavailableText: { fontFamily: 'Outfit_500Medium', fontSize: 13, textAlign: 'center' },
});