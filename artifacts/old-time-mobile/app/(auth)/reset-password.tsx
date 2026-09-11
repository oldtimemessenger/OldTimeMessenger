import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, StatusBar, StyleSheet, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollViewCompat } from '@/components/KeyboardAwareScrollViewCompat';
import { useColors } from '@/hooks/useColors';
import { assertSupabaseConfigured, getSafeAuthError, supabase } from '@/lib/auth';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ResetPasswordScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (password.length < 8) {
      Alert.alert('Choose a stronger password', 'Use at least 8 characters.');
      return;
    }
    if (password !== confirmation) {
      Alert.alert('Passwords do not match', 'Enter the same password in both fields.');
      return;
    }
    setLoading(true);
    try {
      assertSupabaseConfigured();
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      Alert.alert('Password updated', 'You can now sign in with your new password.', [
        { text: 'Continue', onPress: () => router.replace('/(auth)/sign-in' as never) },
      ]);
    } catch (error) {
      Alert.alert('Could not update password', getSafeAuthError(error, 'This reset link may have expired. Request a new one and try again.'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAwareScrollViewCompat
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={{ paddingTop: insets.top + 24, paddingBottom: insets.bottom + 28 }}
      bottomOffset={96}
      keyboardShouldPersistTaps="handled"
    >
      <StatusBar barStyle="dark-content" />
      <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
        <Ionicons name="shield-checkmark-outline" size={28} color={colors.primary} />
      </View>
      <Text style={[styles.kicker, { color: colors.primary }]}>New password</Text>
      <Text style={[styles.title, { color: colors.foreground }]}>Make it something only you know.</Text>
      <Text style={[styles.body, { color: colors.mutedForeground }]}>Choose a new password for your Old Time account.</Text>
      <Text style={[styles.label, { color: colors.foreground }]}>New password</Text>
      <TextInput
        secureTextEntry
        autoComplete="new-password"
        value={password}
        onChangeText={setPassword}
        placeholder="At least 8 characters"
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
      />
      <Text style={[styles.label, { color: colors.foreground }]}>Confirm password</Text>
      <TextInput
        secureTextEntry
        autoComplete="new-password"
        value={confirmation}
        onChangeText={setConfirmation}
        placeholder="Repeat your password"
        placeholderTextColor={colors.mutedForeground}
        style={[styles.input, { backgroundColor: colors.card, borderColor: colors.border, color: colors.foreground }]}
      />
      <Pressable
        onPress={() => void submit()}
        disabled={loading || !password || !confirmation}
        style={[styles.primaryButton, { backgroundColor: colors.action }, (loading || !password || !confirmation) && styles.disabled]}
      >
        <Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{loading ? 'Updating…' : 'Update password'}</Text>
      </Pressable>
    </KeyboardAwareScrollViewCompat>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, paddingHorizontal: 26 },
  icon: { width: 68, height: 68, borderRadius: 24, alignItems: 'center', justifyContent: 'center', marginBottom: 24 },
  kicker: { fontFamily: 'Outfit_700Bold', textTransform: 'uppercase', letterSpacing: 1.6, fontSize: 11, marginBottom: 10 },
  title: { fontFamily: 'Fraunces_700Bold', fontSize: 34, lineHeight: 40, letterSpacing: -0.8 },
  body: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 22, marginTop: 12, marginBottom: 16 },
  label: { fontFamily: 'Outfit_700Bold', fontSize: 14, marginBottom: 8, marginTop: 14 },
  input: { borderWidth: 1, borderRadius: 16, minHeight: 54, paddingHorizontal: 16, fontFamily: 'Outfit_400Regular', fontSize: 16 },
  primaryButton: { minHeight: 56, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
  primaryButtonText: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  disabled: { opacity: 0.5 },
});