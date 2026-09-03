import { Ionicons } from '@expo/vector-icons';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithCredential,
  signInWithEmailAndPassword,
  signOut,
  type User,
} from 'firebase/auth';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  useFirebaseSignIn,
  type AuthenticatedUser,
  type BirthdayRequiredResponse,
} from '@workspace/api-client-react';
import { auth } from '@/firebaseConfig';
import { useColors } from '@/hooks/useColors';

WebBrowser.maybeCompleteAuthSession();

type AuthResult = AuthenticatedUser | BirthdayRequiredResponse;

type Props = {
  onAuthenticated: (result: AuthResult, newProfile?: { name: string; username: string }) => void;
  onModeChange?: (creatingAccount: boolean) => void;
};

const GOOGLE_IOS_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID ?? '';
const GOOGLE_REVERSED_CLIENT_ID = process.env.EXPO_PUBLIC_GOOGLE_REVERSED_CLIENT_ID ?? '';

function readableFirebaseError(error: unknown): string {
  if (!(error instanceof Error)) return 'Please try again.';
  const message = error.message;
  if (message.includes('auth/email-already-in-use')) return 'An account already exists for this email.';
  if (message.includes('auth/invalid-credential')) return 'The email or password is incorrect.';
  if (message.includes('auth/invalid-email')) return 'Enter a valid email address.';
  if (message.includes('auth/weak-password')) return 'Use a password with at least 6 characters.';
  if (message.includes('auth/popup-closed-by-user')) return 'Google Sign-In was cancelled.';
  return 'Sign-in is temporarily unavailable. Please try again.';
}

export function FirebaseAuthPanel({ onAuthenticated, onModeChange }: Props) {
  const colors = useColors();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [createAccount, setCreateAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const processedGoogleToken = useRef<string | null>(null);
  const exchangeFirebaseToken = useFirebaseSignIn();
  const [googleRequest, googleResponse, promptGoogle] = Google.useIdTokenAuthRequest(
    {
      clientId: GOOGLE_IOS_CLIENT_ID,
      iosClientId: GOOGLE_IOS_CLIENT_ID,
      selectAccount: true,
    },
    {
      scheme: GOOGLE_REVERSED_CLIENT_ID,
      path: 'oauthredirect',
    },
  );

  const finishFirebaseSignIn = useCallback(async (user: User, newProfile?: { name: string; username: string }) => {
    const idToken = await user.getIdToken(true);
    const result = await exchangeFirebaseToken.mutateAsync({ data: { idToken } });
    onAuthenticated(result, newProfile);
  }, [exchangeFirebaseToken, onAuthenticated]);

  useEffect(() => {
    const idToken = googleResponse?.type === 'success' ? googleResponse.params.id_token : null;
    if (!idToken || processedGoogleToken.current === idToken) return;
    processedGoogleToken.current = idToken;
    setBusy(true);
    const credential = GoogleAuthProvider.credential(idToken);
    void signInWithCredential(auth, credential)
      .then(({ user }) => finishFirebaseSignIn(user))
      .catch(async (error) => {
        await signOut(auth).catch(() => undefined);
        Alert.alert('Google Sign-In unavailable', readableFirebaseError(error));
      })
      .finally(() => setBusy(false));
  }, [finishFirebaseSignIn, googleResponse]);

  async function submitEmail() {
    const cleanName = name.trim();
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!email.trim() || password.length < 6) return;
    if (createAccount && (!cleanName || !/^[a-z0-9_]{3,24}$/.test(cleanUsername))) return;
    setBusy(true);
    try {
      const credential = createAccount
        ? await createUserWithEmailAndPassword(auth, email.trim(), password)
        : await signInWithEmailAndPassword(auth, email.trim(), password);
      await finishFirebaseSignIn(
        credential.user,
        createAccount ? { name: cleanName, username: cleanUsername } : undefined,
      );
    } catch (error) {
      await signOut(auth).catch(() => undefined);
      Alert.alert(createAccount ? 'Could not create account' : 'Could not sign in', readableFirebaseError(error));
    } finally {
      setBusy(false);
    }
  }

  const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
  const canSubmit = email.trim().length > 3
    && password.length >= 6
    && (!createAccount || (name.trim().length > 0 && /^[a-z0-9_]{3,24}$/.test(cleanUsername)))
    && !busy;
  const googleAvailable = Platform.OS === 'ios' && Boolean(GOOGLE_IOS_CLIENT_ID && GOOGLE_REVERSED_CLIENT_ID);

  return (
    <View>
      {createAccount ? (
        <>
          <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Ionicons name="person-outline" size={19} color={colors.primary} />
            <TextInput
              testID="input-name"
              value={name}
              onChangeText={setName}
              autoCapitalize="words"
              textContentType="name"
              placeholder="Name"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground }]}
              maxLength={80}
            />
          </View>
          <View style={[styles.inputWrap, styles.stackedInput, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <Text style={[styles.atSign, { color: colors.primary }]}>@</Text>
            <TextInput
              testID="input-username"
              value={username}
              onChangeText={(value) => setUsername(value.toLowerCase().replace(/[^a-z0-9_@]/g, ''))}
              autoCapitalize="none"
              autoCorrect={false}
              textContentType="username"
              placeholder="username"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { color: colors.foreground }]}
              maxLength={25}
            />
          </View>
          {username.length > 0 && !/^[a-z0-9_]{3,24}$/.test(cleanUsername) ? (
            <Text style={[styles.fieldHint, { color: colors.mutedForeground }]}>Use 3–24 letters, numbers, or underscores.</Text>
          ) : null}
        </>
      ) : null}
      <View style={[styles.inputWrap, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Ionicons name="mail-outline" size={19} color={colors.primary} />
        <TextInput
          testID="input-email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="Email address"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { color: colors.foreground }]}
        />
      </View>
      <View style={[styles.inputWrap, styles.stackedInput, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <Ionicons name="lock-closed-outline" size={19} color={colors.primary} />
        <TextInput
          testID="input-password"
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          autoCorrect={false}
          secureTextEntry
          textContentType={createAccount ? 'newPassword' : 'password'}
          placeholder="Password"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.input, { color: colors.foreground }]}
        />
      </View>
      <Pressable
        testID={createAccount ? 'button-email-sign-up' : 'button-email-sign-in'}
        disabled={!canSubmit}
        onPress={() => void submitEmail()}
        style={({ pressed }) => [
          styles.primaryButton,
          { backgroundColor: colors.launchButton, opacity: !canSubmit ? 0.45 : pressed ? 0.75 : 1 },
        ]}
      >
        <Text style={styles.primaryText}>{busy ? 'Please wait...' : createAccount ? 'Create account' : 'Sign in'}</Text>
        <Ionicons name="arrow-forward" size={18} color="#fff" />
      </Pressable>
      <Pressable
        testID="button-toggle-email-mode"
        disabled={busy}
        onPress={() => setCreateAccount((current) => {
          const next = !current;
          onModeChange?.(next);
          return next;
        })}
        style={styles.linkButton}
      >
        <Text style={{ color: colors.primary }}>
          {createAccount ? 'Already have an account? Sign in' : 'New to Old Time? Create an account'}
        </Text>
      </Pressable>
      <View style={styles.divider}>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
        <Text style={[styles.dividerText, { color: colors.mutedForeground }]}>OR</Text>
        <View style={[styles.dividerLine, { backgroundColor: colors.border }]} />
      </View>
      <Pressable
        testID="button-google-sign-in"
        disabled={!googleRequest || !googleAvailable || busy}
        onPress={() => void promptGoogle()}
        style={({ pressed }) => [
          styles.secondaryButton,
          { borderColor: colors.border, backgroundColor: colors.card, opacity: !googleAvailable ? 0.5 : pressed ? 0.75 : 1 },
        ]}
      >
        <Ionicons name="logo-google" size={19} color={colors.foreground} />
        <Text style={[styles.secondaryText, { color: colors.foreground }]}>Continue with Google</Text>
      </Pressable>
      {!googleAvailable ? (
        <Text style={[styles.platformHint, { color: colors.mutedForeground }]}>
          Google Sign-In is available in the iOS app build.
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  inputWrap: { borderWidth: 1, borderRadius: 10, minHeight: 54, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14 },
  stackedInput: { marginTop: 12 },
  input: { flex: 1, fontSize: 16 },
  atSign: { fontSize: 18, fontWeight: '800' },
  fieldHint: { fontSize: 12, marginTop: 7, marginLeft: 3 },
  primaryButton: { minHeight: 54, borderRadius: 10, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 22 },
  primaryText: { color: '#fff', fontWeight: '800', fontSize: 15 },
  secondaryButton: { minHeight: 54, borderRadius: 10, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  secondaryText: { fontSize: 15, fontWeight: '700' },
  linkButton: { alignItems: 'center', paddingVertical: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  dividerLine: { height: 1, flex: 1 },
  dividerText: { fontSize: 11, fontWeight: '700' },
  platformHint: { textAlign: 'center', fontSize: 12, marginTop: 8 },
});