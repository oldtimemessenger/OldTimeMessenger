import React, { useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { KeyboardProvider } from 'react-native-keyboard-controller';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { setAuthTokenGetter, setBaseUrl } from '@workspace/api-client-react';
import { AppProvider } from '@/context/app-state';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { AppState, type AppStateStatus } from 'react-native';
import { useApp } from '@/context/app-state';
import { setPresence } from '@/lib/social-api';

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

setBaseUrl(process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : null);
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
      <Stack.Screen name="camera" options={{ presentation: 'modal' }} />
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

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync();
  }, []);

  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppProvider>
          <PresenceHeartbeat />
          <ErrorBoundary>
            <GestureHandlerRootView style={{ flex: 1 }}>
              <KeyboardProvider>
                <RootLayoutNav />
              </KeyboardProvider>
            </GestureHandlerRootView>
          </ErrorBoundary>
        </AppProvider>
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
