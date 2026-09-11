import React, { useEffect, useRef } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ActivityIndicator, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import {
  NunitoSans_400Regular,
  NunitoSans_500Medium,
  NunitoSans_600SemiBold,
  NunitoSans_700Bold,
  NunitoSans_800ExtraBold,
  useFonts,
} from '@expo-google-fonts/nunito-sans';
import { Stack, useRouter, useSegments } from 'expo-router';
import { reloadAppAsync } from 'expo';
import * as SplashScreen from 'expo-splash-screen';
import { OldTimeProvider } from '@/context/OldTimeContext';
import { AUTH_BYPASS_ENABLED, SupabaseAuthProvider, useAuth } from '@/lib/auth';
import { acceptCall, declineCall, getCallLiveKitToken, listCalls } from '@workspace/api-client-react';
import { useOldTime } from '@/context/OldTimeContext';
import { Alert } from 'react-native';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

function AuthLoadingScreen() {
  const [timedOut, setTimedOut] = React.useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setTimedOut(true), 10_000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <View style={styles.authLoading}>
      <Text style={styles.authLoadingWordmark}>old time</Text>
      <Text style={styles.authLoadingTitle}>{timedOut ? 'Sign-in is taking too long.' : 'Getting Old Time ready…'}</Text>
      <Text style={styles.authLoadingBody}>
        {timedOut ? 'Check your connection, then try loading Old Time again.' : 'Connecting you to your private space.'}
      </Text>
      {timedOut
        ? <Pressable accessibilityRole="button" accessibilityLabel="Retry loading Old Time" onPress={() => void reloadAppAsync()} style={styles.authLoadingButton}><Text style={styles.authLoadingButtonText}>Try again</Text></Pressable>
        : <ActivityIndicator accessibilityLabel="Loading Old Time" color="#D71920" size="small" />}
    </View>
  );
}

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: 'Back' }}>
      <Stack.Screen name="(auth)" options={{ headerShown: false, presentation: 'modal' }} />
      <Stack.Screen name="auth/callback" options={{ headerShown: false }} />
      <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      <Stack.Screen name="settings" options={{ headerShown: false }} />
      <Stack.Screen name="edit-profile" options={{ headerShown: false }} />
      <Stack.Screen name="faq" options={{ headerShown: false }} />
      <Stack.Screen name="wallet" options={{ headerShown: false }} />
      <Stack.Screen name="payment-settings" options={{ headerShown: false }} />
      <Stack.Screen name="withdraw" options={{ headerShown: false }} />
      <Stack.Screen name="routes" options={{ headerShown: false }} />
      <Stack.Screen name="notifications" options={{ headerShown: false }} />
      <Stack.Screen name="story/[storyId]" options={{ headerShown: false }} />
      <Stack.Screen name="call" options={{ headerShown: false }} />
      <Stack.Screen name="access" options={{ headerShown: false }} />
      <Stack.Screen name="access-room" options={{ headerShown: false }} />
      <Stack.Screen name="hub/[hubId]" options={{ headerShown: false }} />
    </Stack>
  );
}

function AuthGate() {
  const { isLoaded, isSignedIn } = useAuth();
  const router = useRouter();
  const segments = useSegments();
  const canEnterApp = isSignedIn || AUTH_BYPASS_ENABLED;
  const firstSegment = segments[0] as string | undefined;
  const isAuthCallback = firstSegment === 'auth' && segments[1] === 'callback';
  const isPublicRoute =
    !firstSegment ||
    firstSegment === 'index' ||
    firstSegment === '(auth)' ||
    isAuthCallback ||
    firstSegment === '+not-found';
  const shouldEnterApp = canEnterApp && !isAuthCallback && (firstSegment === 'index' || firstSegment === '(auth)' || !firstSegment);
  const shouldEnterAuth = !canEnterApp && !isPublicRoute;

  useEffect(() => {
    if (!isLoaded) return;
    if (shouldEnterApp) {
      router.replace('/(tabs)' as never);
    } else if (shouldEnterAuth) {
      router.replace('/(auth)/sign-in' as never);
    }
  }, [isLoaded, router, shouldEnterApp, shouldEnterAuth]);

  if (!isLoaded || shouldEnterApp || shouldEnterAuth) {
    return <AuthLoadingScreen />;
  }

  return <RootLayoutNav />;
}

function IncomingCallWatcher() {
  const router = useRouter();
  const { isSignedIn } = useAuth();
  const { currentUserId } = useOldTime();
  const shownCallIds = useRef(new Set<number>());

  useEffect(() => {
    if (!isSignedIn) return;
    let cancelled = false;
    const check = async () => {
      try {
        if (!currentUserId) return;
        const callList = await listCalls();
        const incoming = callList.items.filter((call) => call.status === 'ringing' && String(call.calleeId) === currentUserId);
        if (cancelled) return;
        const activeIds = new Set(incoming.map((call) => call.id));
        for (const id of shownCallIds.current) {
          if (!activeIds.has(id)) shownCallIds.current.delete(id);
        }
        const next = incoming.find((call) => !shownCallIds.current.has(call.id));
        if (!next) return;
        shownCallIds.current.add(next.id);
        const incomingCall = next as typeof next & { type?: 'voice' | 'video'; otherUser?: { name?: string } | null };
        const callType = incomingCall.type === 'video' ? 'video' : 'audio';
        Alert.alert(
          callType === 'video' ? 'Incoming video call' : 'Incoming call',
          `${incomingCall.otherUser?.name ?? 'Someone'} is calling you.`,
          [
            { text: 'Decline', style: 'cancel', onPress: () => void declineCall(next.id).catch(() => undefined) },
            {
              text: 'Answer',
              onPress: () => {
                void acceptCall(next.id).then(async (accepted) => {
                  const token = await getCallLiveKitToken(accepted.id);
                  router.push({ pathname: '/call', params: { callId: String(accepted.id), token: token.token, serverUrl: token.url, kind: callType, remoteName: incomingCall.otherUser?.name ?? 'Old Time friend', returnPath: 'inbox' } });
                }).catch((error) => Alert.alert('Could not answer call', error instanceof Error ? error.message : 'Please try again.'));
              },
            },
          ],
        );
      } catch {
        // A signed-out or briefly disconnected client will retry on the next poll.
      }
    };
    void check();
    const timer = setInterval(() => void check(), 5000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [currentUserId, isSignedIn, router]);

  return null;
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    NunitoSans_400Regular,
    NunitoSans_500Medium,
    NunitoSans_600SemiBold,
    NunitoSans_700Bold,
    NunitoSans_800ExtraBold,
    // Keep existing style names working while the app uses one
    // consistent Nunito Sans family.
    Outfit_400Regular: NunitoSans_400Regular,
    Outfit_500Medium: NunitoSans_500Medium,
    Outfit_600SemiBold: NunitoSans_600SemiBold,
    Outfit_700Bold: NunitoSans_700Bold,
    Outfit_800ExtraBold: NunitoSans_800ExtraBold,
    Fraunces_400Regular: NunitoSans_400Regular,
    Fraunces_600SemiBold: NunitoSans_600SemiBold,
    Fraunces_700Bold: NunitoSans_700Bold,
    Fraunces_900Black: NunitoSans_800ExtraBold,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, fontError]);

  const canRenderApp = Platform.OS === 'web' || fontsLoaded || fontError;
  if (!canRenderApp) {
    return (
      <SafeAreaProvider>
        <AuthLoadingScreen />
      </SafeAreaProvider>
    );
  }

  return (
    <SupabaseAuthProvider>
      <SafeAreaProvider>
        <ErrorBoundary>
          <QueryClientProvider client={queryClient}>
            <OldTimeProvider>
              <IncomingCallWatcher />
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <AuthGate />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </OldTimeProvider>
          </QueryClientProvider>
        </ErrorBoundary>
      </SafeAreaProvider>
    </SupabaseAuthProvider>
  );
}

const styles = StyleSheet.create({
  authLoading: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28, backgroundColor: '#FFFFFF' },
  authLoadingWordmark: { color: '#000000', fontSize: 27, fontFamily: 'NunitoSans_800ExtraBold', letterSpacing: -1, marginBottom: 22 },
  authLoadingTitle: { color: '#000000', fontSize: 22, fontFamily: 'NunitoSans_700Bold', textAlign: 'center' },
  authLoadingBody: { color: '#000000', fontSize: 15, fontFamily: 'NunitoSans_400Regular', lineHeight: 22, marginTop: 8, textAlign: 'center', maxWidth: 290, marginBottom: 24 },
  authLoadingButton: { minWidth: 142, minHeight: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#D71920', paddingHorizontal: 20 },
  authLoadingButtonText: { color: '#FFFFFF', fontSize: 16, fontFamily: 'NunitoSans_700Bold' },
});
