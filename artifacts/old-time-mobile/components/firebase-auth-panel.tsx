import { Ionicons } from '@expo/vector-icons';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as Google from 'expo-auth-session/providers/google';
import * as WebBrowser from 'expo-web-browser';
import * as Crypto from 'expo-crypto';
import {
  GoogleAuthProvider,
  OAuthProvider,
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
import { auth, firebaseApiKey } from '@/firebaseConfig';
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
  const candidate = error as { code?: unknown; message?: unknown } | null;
  const code = typeof candidate?.code === 'string' ? candidate.code : '';
  const message = typeof candidate?.message === 'string' ? candidate.message : '';
  const reason = code || message;
  if (reason.includes('EMAIL_EXISTS') || reason.includes('auth/email-already-in-use')) return 'An account already exists for this email.';
  if (reason.includes('INVALID_LOGIN_CREDENTIALS') || reason.includes('auth/invalid-credential') || reason.includes('auth/wrong-password') || reason.includes('auth/user-not-found')) return 'The email or password is incorrect.';
  if (reason.includes('INVALID_EMAIL') || reason.includes('auth/invalid-email')) return 'Enter a valid email address.';
  if (reason.includes('WEAK_PASSWORD') || reason.includes('auth/weak-password')) return 'Use a password with at least 6 characters.';
  if (reason.includes('OPERATION_NOT_ALLOWED') || reason.includes('auth/operation-not-allowed')) return 'Email sign-in is not enabled for this Old Time build.';
  if (reason.includes('TOO_MANY_ATTEMPTS') || reason.includes('auth/too-many-requests')) return 'Too many attempts. Wait a moment and try again.';
  if (reason.includes('NETWORK') || reason.includes('network-request-failed')) return 'Could not connect to Firebase. Check your connection and try again.';
  if (reason.includes('auth/popup-closed-by-user')) return 'Google Sign-In was cancelled.';
  return message || 'Sign-in is temporarily unavailable. Please try again.';
}

function readableExchangeError(error: unknown): string {
  const candidate = error as { message?: unknown; data?: unknown } | null;
  const apiError = candidate?.data as { error?: unknown } | null;
  const serverMessage = typeof apiError?.error === 'string' ? apiError.error : '';
  const message = `${serverMessage} ${typeof candidate?.message === 'string' ? candidate.message : ''}`.toLowerCase();
  if (message.includes('network') || message.includes('fetch') || message.includes('timeout')) {
    return 'Your sign-in was verified, but we could not reach Old Time. Check your connection and try again.';
  }
  if (serverMessage) return serverMessage;
  return 'Your sign-in was verified, but Old Time could not finish signing you in. Please try again.';
}

function isAppleSignInCancellation(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'code' in error
    && error.code === 'ERR_REQUEST_CANCELED';
}

type FirebaseEmailAuthMode = 'signUp' | 'signInWithPassword';

type FirebaseEmailAuthResponse = {
  idToken: string;
  refreshToken: string;
  expiresIn: string;
  localId: string;
  email: string;
};

async function authenticateEmailWithFirebase(
  mode: FirebaseEmailAuthMode,
  email: string,
  password: string,
): Promise<FirebaseEmailAuthResponse> {
  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:${mode}?key=${firebaseApiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, returnSecureToken: true }),
    },
  );
  const body = await response.json().catch(() => null) as
    | FirebaseEmailAuthResponse
    | { error?: { message?: string } }
    | null;
  if (!response.ok || !body || !('idToken' in body) || typeof body.idToken !== 'string') {
    const error = new Error(
      body && 'error' in body && body.error?.message
        ? body.error.message
        : `Firebase email authentication failed (${response.status}).`,
    ) as Error & { code?: string };
    error.code = body && 'error' in body ? body.error?.message : undefined;
    throw error;
  }
  return body;
}

export function FirebaseAuthPanel({ onAuthenticated, onModeChange }: Props) {
  const colors = useColors();
  const [name, setName] = useState('');
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [createAccount, setCreateAccount] = useState(false);
  const [busy, setBusy] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
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

  const finishFirebaseTokenSignIn = useCallback(async (idToken: string, newProfile?: { name: string; username: string }) => {
    const result = await exchangeFirebaseToken.mutateAsync({ data: { idToken } });
    onAuthenticated(result, newProfile);
  }, [exchangeFirebaseToken, onAuthenticated]);

  const finishFirebaseSignIn = useCallback(async (user: User, newProfile?: { name: string; username: string }) => {
    const idToken = await user.getIdToken(true);
    await finishFirebaseTokenSignIn(idToken, newProfile);
  }, [finishFirebaseTokenSignIn]);

  const handleExchangeFailure = useCallback((error: unknown, user: User, newProfile?: { name: string; username: string }) => {
    Alert.alert(
      'Finish signing in',
      readableExchangeError(error),
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Try again',
          onPress: () => void finishFirebaseSignIn(user, newProfile).catch((retryError) => {
            Alert.alert('Finish signing in', readableExchangeError(retryError));
          }),
        },
      ],
    );
  }, [finishFirebaseSignIn]);

  useEffect(() => {
    const idToken = googleResponse?.type === 'success' ? googleResponse.params.id_token : null;
    if (!idToken || processedGoogleToken.current === idToken) return;
    processedGoogleToken.current = idToken;
    setBusy(true);
    const credential = GoogleAuthProvider.credential(idToken);
    void signInWithCredential(auth, credential)
      .then(({ user }) => finishFirebaseSignIn(user).catch((error) => handleExchangeFailure(error, user)))
      .catch(async (error) => {
        await signOut(auth).catch(() => undefined);
        Alert.alert('Google Sign-In unavailable', readableFirebaseError(error));
      })
      .finally(() => setBusy(false));
  }, [finishFirebaseSignIn, googleResponse, handleExchangeFailure]);

  useEffect(() => {
    let mounted = true;
    if (Platform.OS !== 'ios') return undefined;

    void AppleAuthentication.isAvailableAsync()
      .then((available) => {
        if (mounted) setAppleAvailable(available);
      })
      .catch(() => {
        if (mounted) setAppleAvailable(false);
      });

    return () => {
      mounted = false;
    };
  }, []);

  async function signInWithApple() {
    if (busy) return;

    setBusy(true);
    try {
      const rawNonce = Crypto.randomUUID();
      const hashedNonce = await Crypto.digestStringAsync(
        Crypto.CryptoDigestAlgorithm.SHA256,
        rawNonce,
      );
      const appleCredential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
        nonce: hashedNonce,
      });

      if (!appleCredential.identityToken) {
        throw new Error('Apple did not return an identity token.');
      }

      const provider = new OAuthProvider('apple.com');
      const firebaseCredential = provider.credential({
        idToken: appleCredential.identityToken,
        rawNonce,
      });
      const { user } = await signInWithCredential(auth, firebaseCredential);
      try {
        await finishFirebaseSignIn(user);
      } catch (error) {
        handleExchangeFailure(error, user);
      }
    } catch (error) {
      if (isAppleSignInCancellation(error)) return;
      await signOut(auth).catch(() => undefined);
      Alert.alert('Apple Sign-In unavailable', readableFirebaseError(error));
    } finally {
      setBusy(false);
    }
  }

  async function submitEmail() {
    const cleanName = name.trim();
    const cleanUsername = username.trim().toLowerCase().replace(/^@/, '');
    if (!email.trim() || password.length < 6) return;
    if (createAccount && (!cleanName || !/^[a-z0-9_]{3,24}$/.test(cleanUsername))) return;
    setBusy(true);
    try {
      const normalizedEmail = email.trim().toLowerCase();
      const firebaseResult = await authenticateEmailWithFirebase(
        createAccount ? 'signUp' : 'signInWithPassword',
        normalizedEmail,
        password,
      );
      const newProfile = createAccount ? { name: cleanName, username: cleanUsername } : undefined;
      try {
        await finishFirebaseTokenSignIn(firebaseResult.idToken, newProfile);
        // Keep Firebase's client session in sync for account deletion and provider
        // refreshes. The REST token exchange above remains the source of truth for
        // completing mobile sign-in, so this must not block the user.
        void signInWithEmailAndPassword(auth, normalizedEmail, password).catch(() => undefined);
      } catch (error) {
        Alert.alert('Finish signing in', readableExchangeError(error));
      }
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
      {appleAvailable ? (
        <AppleAuthentication.AppleAuthenticationButton
          testID="button-apple-sign-in"
          buttonType={AppleAuthentication.AppleAuthenticationButtonType.CONTINUE}
          buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.BLACK}
          cornerRadius={10}
          onPress={() => void signInWithApple()}
          style={[styles.appleButton, { opacity: busy ? 0.5 : 1 }]}
        />
      ) : null}
      <Pressable
        testID="button-google-sign-in"
        disabled={!googleRequest || !googleAvailable || busy}
        onPress={() => void promptGoogle()}
        style={({ pressed }) => [
          styles.secondaryButton,
          appleAvailable && styles.stackedSocialButton,
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
  appleButton: { width: '100%', height: 54 },
  stackedSocialButton: { marginTop: 12 },
  secondaryText: { fontSize: 15, fontWeight: '700' },
  linkButton: { alignItems: 'center', paddingVertical: 14 },
  divider: { flexDirection: 'row', alignItems: 'center', gap: 12, marginVertical: 8 },
  dividerLine: { height: 1, flex: 1 },
  dividerText: { fontSize: 11, fontWeight: '700' },
  platformHint: { textAlign: 'center', fontSize: 12, marginTop: 8 },
});