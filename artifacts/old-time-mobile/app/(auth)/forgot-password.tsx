import { Ionicons } from '@expo/vector-icons';
import { Link, useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { getAuthRedirectUri, getSafeAuthError, assertSupabaseConfigured, supabase } from '@/lib/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ForgotPasswordScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState('');
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setLoading(true);
    try {
      assertSupabaseConfigured();
      const { error } = await supabase.auth.resetPasswordForEmail(emailAddress.trim(), {
        redirectTo: getAuthRedirectUri('recovery'),
      });
      if (error) throw error;
      setSent(true);
    } catch (error) {
      Alert.alert('Could not send reset link', getSafeAuthError(error, 'Please check your email and try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }}
      bottomOffset={72}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar barStyle="dark-content" />
      <Pressable accessibilityRole="button" accessibilityLabel="Back to sign in" onPress={() => router.back()} style={styles.back}>
        <Ionicons name="arrow-back" size={22} color={colors.foreground} />
      </Pressable>
      <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
        <Ionicons name="lock-open-outline" size={28} color={colors.primary} />
      </View>
      <Text style={[styles.kicker, { color: colors.primary }]}>Account recovery</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>{sent ? 'Check your inbox.' : 'Forgot your password?'}</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>
        {sent ? 'We sent a secure reset link. Open it on this device to choose a new password.' : 'Enter the email you use for Old Time and we’ll send you a secure reset link.'}
      </Text>
      {!sent ? (
        <>
          <View style={[styles.inputWrap, { borderColor: colors.border }]}>
            <Ionicons name="mail-outline" size={20} color={colors.primary} />
            <TextInput
              autoCapitalize="none"
              autoComplete="email"
              keyboardType="email-address"
              value={emailAddress}
              onChangeText={setEmailAddress}
              placeholder="Email address"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground }]}
            />
          </View>
          <Pressable
            onPress={() => void submit()}
            disabled={loading || !emailAddress.trim()}
            style={[styles.primaryButton, { backgroundColor: colors.action }, (loading || !emailAddress.trim()) && styles.disabled]}
          >
            <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{loading ? 'Sending…' : 'Send reset link'}</Text>
          </Pressable>
        </>
      ) : (
        <Pressable onPress={() => router.replace('/(auth)/sign-in' as never)} style={[styles.primaryButton, { backgroundColor: colors.action }]}>
          <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Back to sign in</Text>
        </Pressable>
      )}
      <Link href={'/(auth)/sign-in' as never} asChild>
        <Pressable style={styles.footerLink}><Text style={[styles.footerLinkText, { color: colors.primary }]}>Return to sign in</Text></Pressable>
      </Link>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 26 },
  back: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center', marginBottom: 48 },
  icon: { width: 68, height: 68, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  kicker: { fontFamily: 'Outfit_700Bold', textTransform: 'uppercase', letterSpacing: 1.6, fontSize: 11, marginBottom: 10 },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  body: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 22, marginTop: 12, marginBottom: 28, maxWidth: 360 },
  inputWrap: { height: 54, borderWidth: 1, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16 },
  input: { flex: 1, minHeight: 52, paddingHorizontal: 12, fontFamily: 'Outfit_400Regular', fontSize: 16 },
  primaryButton: { minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 18 },
  primaryButtonText: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  disabled: { opacity: 0.5 },
  footerLink: { alignItems: 'center', paddingVertical: 18 },
  footerLinkText: { fontFamily: 'Outfit_600SemiBold', fontSize: 14 },
});