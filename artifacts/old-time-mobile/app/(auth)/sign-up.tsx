import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Wordmark } from '@/components/OldTimeUi';
import { useColors } from '@/hooks/useColors';
import { assertSupabaseConfigured, getAuthRedirectUri, getSafeAuthError, supabase } from '@/lib/auth';

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export default function SignUpScreen() {
  const colors = useColors();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState('');
  const [password, setPassword] = useState('');
  const [verificationSent, setVerificationSent] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const passwordReady = password.length >= 8;
  const emailReady = isValidEmail(emailAddress);
  const title = verificationSent ? 'Check your email.' : 'Make room for the moments that matter.';
  const body = verificationSent
    ? `We sent a confirmation link to ${emailAddress.trim()}. Open it to finish creating your account.`
    : 'Create an account to follow people, share photos, and keep a private line open with friends.';
  const passwordHint = useMemo(() => {
    if (!password) return 'Use at least 8 characters.';
    if (!passwordReady) return `${8 - password.length} more characters needed.`;
    return 'Strong enough to keep your account protected.';
  }, [password, passwordReady]);

  const submit = async () => {
    if (!emailReady) {
      Alert.alert('Check your email', 'Enter a valid email address to continue.');
      return;
    }
    if (!passwordReady) {
      Alert.alert('Choose a stronger password', 'Use at least 8 characters.');
      return;
    }
    setLoading(true);
    try {
      assertSupabaseConfigured();
      const { data, error } = await supabase.auth.signUp({
        email: emailAddress.trim(),
        password,
        options: {
          emailRedirectTo: getAuthRedirectUri(),
        },
      });
      if (error) throw error;
      if (data.session) {
        router.replace('/');
        return;
      }
      setVerificationSent(true);
    } catch (error) {
      Alert.alert('Could not create account', getSafeAuthError(error, 'Please check your connection and try again.'));
    } finally {
      setLoading(false);
    }
  };

  const continueAfterConfirmation = async () => {
    setLoading(true);
    try {
      assertSupabaseConfigured();
      const { data, error } = await supabase.auth.getSession();
      if (error) throw error;
      if (data.session) {
        router.replace('/');
        return;
      }
      Alert.alert('Open the confirmation link', 'Use the link in your email first, then return here.');
    } catch (error) {
      Alert.alert('Could not check your confirmation', getSafeAuthError(error, 'Please try again.'));
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setResending(true);
    try {
      assertSupabaseConfigured();
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: emailAddress.trim(),
      });
      if (error) throw error;
      Alert.alert('Confirmation email sent', 'Open the newest link in your inbox to finish creating your account.');
    } catch (error) {
      Alert.alert('Could not send a new code', getSafeAuthError(error, 'Please wait a moment and try again.'));
    } finally {
      setResending(false);
    }
  };

  return (
    <KeyboardAvoidingView style={[styles.screen, { backgroundColor: colors.background }]} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.inner}>
        <Wordmark />
        <Text style={[styles.kicker, { color: colors.primary }]}>{verificationSent ? 'Verify your email' : 'Join Old Time'}</Text>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{body}</Text>
        {!verificationSent ? <>
          <Text style={[styles.label, { color: colors.foreground }]}>Email address</Text>
          <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="mail-outline" size={20} color={colors.primary} />
            <TextInput autoCapitalize="none" autoComplete="email" keyboardType="email-address" value={emailAddress} onChangeText={setEmailAddress} placeholder="you@example.com" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground }]} />
          </View>
          <Text style={[styles.label, { color: colors.foreground }]}>Password</Text>
          <View style={[styles.inputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
            <TextInput secureTextEntry={!showPassword} autoComplete="new-password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground }]} />
            <Pressable accessibilityRole="button" accessibilityLabel={showPassword ? 'Hide password' : 'Show password'} onPress={() => setShowPassword((current) => !current)} hitSlop={10}>
              <Ionicons name={showPassword ? 'eye-off-outline' : 'eye-outline'} size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
          <Text style={[styles.hint, { color: passwordReady ? colors.primary : colors.mutedForeground }]}>{passwordHint}</Text>
        </> : <>
          <Pressable disabled={resending || loading} onPress={() => void resend()} style={styles.resend}>
            <Text style={{ color: colors.primary, fontFamily: 'Outfit_700Bold' }}>{resending ? 'Sending confirmation email…' : 'Resend confirmation email'}</Text>
          </Pressable>
        </>}
        {!verificationSent ? <Pressable onPress={() => void submit()} disabled={loading || !emailAddress || !password} style={[styles.primaryButton, { backgroundColor: colors.action }, (loading || !emailAddress || !password) && { opacity: 0.5 }]}><Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{loading ? 'Creating account…' : 'Create account'}</Text></Pressable> : null}
        {verificationSent ? <Pressable onPress={() => void continueAfterConfirmation()} disabled={loading} style={[styles.primaryButton, { backgroundColor: colors.action }, loading && { opacity: 0.5 }]}><Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{loading ? 'Checking…' : 'I confirmed my email'}</Text></Pressable> : null}
        {verificationSent ? <Pressable onPress={() => setVerificationSent(false)} style={styles.changeEmail}><Text style={[styles.changeEmailText, { color: colors.mutedForeground }]}>Use a different email</Text></Pressable> : null}
        <View style={styles.footer}><Text style={{ color: colors.mutedForeground, fontFamily: 'Outfit_500Medium' }}>Already have an account? </Text><Link href={'/(auth)/sign-in' as never} style={{ color: colors.primary, fontFamily: 'Outfit_700Bold' }}>Sign in</Link></View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  inner: { flex: 1, paddingHorizontal: 24, paddingTop: 76 },
  kicker: { fontFamily: 'Outfit_700Bold', textTransform: 'uppercase', letterSpacing: 1.3, fontSize: 11, marginTop: 60, marginBottom: 12 },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 34, lineHeight: 40, letterSpacing: -0.8, maxWidth: 340 },
  body: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 22, marginTop: 12, marginBottom: 30, maxWidth: 340 },
  label: { fontFamily: 'Outfit_700Bold', fontSize: 14, marginBottom: 8, marginTop: 16 },
  inputWrap: { borderWidth: 1, borderRadius: 16, minHeight: 54, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center' },
  input: { flex: 1, minHeight: 52, paddingHorizontal: 12, fontFamily: 'Outfit_400Regular', fontSize: 16 },
  hint: { fontFamily: 'Outfit_400Regular', fontSize: 13, marginTop: 8 },
  primaryButton: { minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 28 },
  primaryButtonText: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  resend: { alignItems: 'center', paddingVertical: 18 },
  changeEmail: { alignItems: 'center', paddingVertical: 6 },
  changeEmailText: { fontFamily: 'Outfit_500Medium', fontSize: 14 },
  footer: { flexDirection: 'row', justifyContent: 'center', marginTop: 18, fontFamily: 'Outfit_500Medium', fontSize: 14 },
});