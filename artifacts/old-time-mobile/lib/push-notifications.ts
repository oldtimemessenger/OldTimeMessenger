import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { registerPushToken, unregisterPushToken } from '@workspace/api-client-react';

const TOKEN_KEY = 'old-time-expo-push-token';
const PROJECT_ID = Constants.expoConfig?.extra?.eas?.projectId;

if (Platform.OS !== 'web') {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

function nativePlatform(): 'ios' | 'android' | null {
  if (!Device.isDevice || (Platform.OS !== 'ios' && Platform.OS !== 'android')) return null;
  return Platform.OS;
}

export async function registerDeviceForPush(authToken: string): Promise<string | null> {
  const platform = nativePlatform();
  if (!platform || !PROJECT_ID) return null;
  if (platform === 'android') {
    await Notifications.setNotificationChannelAsync('messages', {
      name: 'Messages',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
  const permissions = await Notifications.getPermissionsAsync();
  const finalStatus = permissions.granted
    ? permissions.status
    : (await Notifications.requestPermissionsAsync()).status;
  if (finalStatus !== 'granted') return null;

  const token = (await Notifications.getExpoPushTokenAsync({ projectId: PROJECT_ID })).data;
  await registerPushToken(
    { token, platform },
    { headers: { Authorization: `Bearer ${authToken}` } },
  );
  await AsyncStorage.setItem(TOKEN_KEY, token);
  return token;
}

export async function unregisterDeviceForPush(authToken: string): Promise<void> {
  const token = await AsyncStorage.getItem(TOKEN_KEY);
  if (!token) return;
  await unregisterPushToken(
    { token },
    { headers: { Authorization: `Bearer ${authToken}` } },
  );
  await AsyncStorage.removeItem(TOKEN_KEY);
}

export function addNotificationTapListener(open: (target: { chatId?: number; callId?: number }) => void): () => void {
  if (Platform.OS === 'web') return () => {};

  const openFromResponse = (response: Notifications.NotificationResponse | null) => {
    const chatId = response?.notification.request.content.data?.chatId;
    const id = typeof chatId === 'number' ? chatId : Number(chatId);
    const callId = response?.notification.request.content.data?.callId;
    const call = typeof callId === 'number' ? callId : Number(callId);
    if (Number.isInteger(call) && call > 0) open({ callId: call });
    else if (Number.isInteger(id) && id > 0) open({ chatId: id });
  };
  openFromResponse(Notifications.getLastNotificationResponse());
  const subscription = Notifications.addNotificationResponseReceivedListener(openFromResponse);
  return () => subscription.remove();
}