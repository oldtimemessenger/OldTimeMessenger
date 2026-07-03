import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../theme/ThemeContext';

import SplashScreen from '../screens/auth/SplashScreen';
import WelcomeScreen from '../screens/auth/WelcomeScreen';
import PhoneLoginScreen from '../screens/auth/PhoneLoginScreen';
import OtpScreen from '../screens/auth/OtpScreen';
import ProfileSetupScreen from '../screens/auth/ProfileSetupScreen';
import CountryPickerModal from '../screens/auth/CountryPickerModal';

import MainTabs from './MainTabs';
import ChatViewScreen from '../screens/ChatViewScreen';
import NewChatScreen from '../screens/NewChatScreen';
import ChatSearchScreen from '../screens/ChatSearchScreen';
import CallScreen from '../screens/CallScreen';
import NewCallScreen from '../screens/NewCallScreen';
import CameraScreen from '../screens/CameraScreen';
import LocationScreen from '../screens/LocationScreen';
import StatusViewerScreen from '../screens/StatusViewerScreen';
import NewNoteScreen from '../screens/NewNoteScreen';
import ScheduleMeetingScreen from '../screens/ScheduleMeetingScreen';
import UpdateSearchScreen from '../screens/UpdateSearchScreen';
import ProfileScreen from '../screens/ProfileScreen';

import QrScreen from '../screens/settings/QrScreen';
import NotificationsScreen from '../screens/settings/NotificationsScreen';
import NotificationColorScreen from '../screens/settings/NotificationColorScreen';
import PrivacyScreen from '../screens/settings/PrivacyScreen';
import AudienceSettingsScreen from '../screens/settings/AudienceSettingsScreen';
import InterestsScreen from '../screens/settings/InterestsScreen';
import SecurityScreen from '../screens/settings/SecurityScreen';
import StorageScreen from '../screens/settings/StorageScreen';
import AppearanceScreen from '../screens/settings/AppearanceScreen';
import WallpaperScreen from '../screens/settings/WallpaperScreen';
import DevicesScreen from '../screens/settings/DevicesScreen';
import LanguageScreen from '../screens/settings/LanguageScreen';
import HelpScreen from '../screens/settings/HelpScreen';
import SupportChatScreen from '../screens/settings/SupportChatScreen';

const Stack = createNativeStackNavigator();

function AuthStack({ initialRouteName }) {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }} initialRouteName={initialRouteName}>
      <Stack.Screen name="Splash" component={SplashScreen} />
      <Stack.Screen name="Welcome" component={WelcomeScreen} />
      <Stack.Screen name="PhoneLogin" component={PhoneLoginScreen} />
      <Stack.Screen name="Otp" component={OtpScreen} />
      <Stack.Screen name="ProfileSetup" component={ProfileSetupScreen} />
      <Stack.Screen name="CountryPicker" component={CountryPickerModal} presentation="modal" />
    </Stack.Navigator>
  );
}

function MainStack() {
  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      <Stack.Screen name="MainTabs" component={MainTabs} />
      <Stack.Screen name="ChatView" component={ChatViewScreen} />
      <Stack.Screen name="NewChat" component={NewChatScreen} presentation="modal" />
      <Stack.Screen name="ChatSearch" component={ChatSearchScreen} presentation="modal" />
      <Stack.Screen name="Call" component={CallScreen} presentation="fullScreenModal" />
      <Stack.Screen name="NewCall" component={NewCallScreen} presentation="modal" />
      <Stack.Screen name="Camera" component={CameraScreen} presentation="fullScreenModal" />
      <Stack.Screen name="Location" component={LocationScreen} />
      <Stack.Screen name="StatusViewer" component={StatusViewerScreen} presentation="fullScreenModal" />
      <Stack.Screen name="NewNote" component={NewNoteScreen} presentation="modal" />
      <Stack.Screen name="ScheduleMeeting" component={ScheduleMeetingScreen} presentation="modal" />
      <Stack.Screen name="UpdateSearch" component={UpdateSearchScreen} presentation="modal" />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Qr" component={QrScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      <Stack.Screen name="NotificationColor" component={NotificationColorScreen} />
      <Stack.Screen name="Privacy" component={PrivacyScreen} />
      <Stack.Screen name="AudienceSettings" component={AudienceSettingsScreen} />
      <Stack.Screen name="Interests" component={InterestsScreen} />
      <Stack.Screen name="Security" component={SecurityScreen} />
      <Stack.Screen name="Storage" component={StorageScreen} />
      <Stack.Screen name="Appearance" component={AppearanceScreen} />
      <Stack.Screen name="Wallpaper" component={WallpaperScreen} />
      <Stack.Screen name="Devices" component={DevicesScreen} />
      <Stack.Screen name="Language" component={LanguageScreen} />
      <Stack.Screen name="Help" component={HelpScreen} />
      <Stack.Screen name="Support" component={SupportChatScreen} />
    </Stack.Navigator>
  );
}

export default function AppNavigator() {
  const { user, profile, loading } = useAuth();
  const { theme } = useTheme();

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: theme.bg, justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator color={theme.greenBright} size="large" />
      </View>
    );
  }

  const navTheme = theme.mode === 'dark'
    ? { ...DarkTheme, colors: { ...DarkTheme.colors, background: theme.bg, card: theme.header, text: theme.text, border: theme.divider, primary: theme.greenBright } }
    : { ...DefaultTheme, colors: { ...DefaultTheme.colors, background: theme.bg, card: theme.header, text: theme.text, border: theme.divider, primary: theme.greenBright } };

  const isFullyOnboarded = !!user && !!profile;
  // If we already have a verified session but no profile row yet, skip
  // straight to profile setup instead of replaying Splash/Welcome/OTP.
  const authInitialRoute = user && !profile ? 'ProfileSetup' : 'Splash';

  return (
    <NavigationContainer theme={navTheme}>
      {isFullyOnboarded ? <MainStack /> : <AuthStack initialRouteName={authInitialRoute} />}
    </NavigationContainer>
  );
}
