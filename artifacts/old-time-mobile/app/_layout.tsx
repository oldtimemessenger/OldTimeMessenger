import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import { AppProvider } from '@/context/app-state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import { useApp } from '@/context/app-state';
import { setPresence } from '@/lib/social-api';
import { apiBaseUrl } from '@/lib/api-base-url';
import { RevenueCatProvider } from '@/lib/revenuecat';
import { AdMobInitializer } from '@/components/admob-initializer';
import { addNotificationTapListener, registerDeviceForPush, unregisterDeviceForPush } from '@/lib/push-notifications';
import { io } from 'socket.io-client';
import { Platform } from 'react-native';
import '@/lib/livekit-globals';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

setBaseUrl(apiBaseUrl() || null);
setAuthTokenGetter(async () => {
  const raw = await AsyncStorage.getItem('old-time-mobile-state');
  if (!raw) return null;
  try {
    return JSON.parse(raw).session?.authToken ?? null;
  } catch {
    return null;
  }
});

function RootLayoutNav() {
  return (
    <Stack screenOptions={{ headerShown: false, headerBackTitle: 'Back' }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="chat/[id]" />
      <Stack.Screen name="call/[id]" />
      <Stack.Screen name="wallet" />
      <Stack.Screen name="current-event/[id]" />
      <Stack.Screen name="camera" options={{ presentation: 'modal' }} />
      <Stack.Screen name="story/[id]" options={{ presentation: 'modal' }} />
    </Stack>
  );
}

function PresenceHeartbeat() {
  const { session } = useApp();

  useEffect(() => {
    if (!session?.authToken) return;
    let currentState: AppStateStatus = AppState.currentState;
    const sync = (online: boolean) => {
      void setPresence(session.authToken, session.id, online).catch(() => {
        // Presence is best-effort and should never interrupt navigation.
      });
    };
    sync(currentState === 'active');
    const interval = setInterval(() => {
      if (currentState === 'active') sync(true);
    }, 45_000);
    const subscription = AppState.addEventListener('change', (nextState) => {
      currentState = nextState;
      sync(nextState === 'active');
    });
    return () => {
      clearInterval(interval);
      subscription.remove();
      sync(false);
    };
  }, [session?.authToken, session?.id]);

  return null;
}

function PushNotificationManager() {
  const { session, settings } = useApp();

  useEffect(() => {
    if (!session?.authToken) return;
    let cancelled = false;
    if (!settings.notifications) {
      void unregisterDeviceForPush(session.authToken).catch((error: unknown) => {
        if (!cancelled) console.warn('Push unregistration failed; this device may continue receiving notifications until the next retry.', error);
      });
      return () => { cancelled = true; };
    }
    void registerDeviceForPush(session.authToken).then((token) => {
      if (!token && !cancelled) {
        console.warn('Push registration did not return a device token; notifications remain enabled and registration will retry later.');
      }
    }).catch((error: unknown) => {
      if (!cancelled) console.warn('Push registration failed; notifications remain enabled and registration will retry later.', error);
    });
    return () => { cancelled = true; };
  // Register only when the signed-in identity or notification preference changes.
  }, [session?.authToken, settings.notifications]);

  useEffect(() => addNotificationTapListener(({ chatId, callId }) => {
    if (callId) router.push({ pathname: '/call/[id]', params: { id: String(callId) } } as any);
    else if (chatId) router.push({ pathname: '/chat/[id]', params: { id: String(chatId) } });
  }), []);

  return null;
}

function CallRealtimeManager() {
  const { session } = useApp();
  useEffect(() => {
    if (!session?.authToken || Platform.OS === 'web') return;
    const socket = io(apiBaseUrl(), { auth: { token: session.authToken }, transports: ['websocket'] });
    const openCall = (payload: { id?: number; callId?: number; status?: string }) => {
      const callId = payload.callId ?? payload.id;
      // A ringing call needs immediate attention. Accepted/ended changes are
      // reflected by the active call screen's server refresh.
      if (payload.status === 'ringing' && Number.isInteger(callId) && callId! > 0) router.push({ pathname: '/call/[id]', params: { id: String(callId) } } as any);
    };
    socket.on('call-updated', openCall);
    return () => { socket.off('call-updated', openCall); socket.disconnect(); };
  }, [session?.authToken]);
  return null;
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <RevenueCatProvider>
            <AdMobInitializer />
            <PresenceHeartbeat />
            <PushNotificationManager />
            <CallRealtimeManager />
            <ErrorBoundary>
              <GestureHandlerRootView style={{ flex: 1 }}>
                <KeyboardProvider>
                  <RootLayoutNav />
                </KeyboardProvider>
              </GestureHandlerRootView>
            </ErrorBoundary>
          </RevenueCatProvider>
        </AppProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
