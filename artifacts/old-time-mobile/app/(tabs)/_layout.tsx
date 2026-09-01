import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/app-state';
import { BlurView } from 'expo-blur';

export default function TabLayout() {
  const colors = useColors();
  const { hydrated, session } = useApp();
  if (!hydrated) return null;
  if (!session) return <Redirect href="/" />;
  return <Tabs screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background }, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.mutedForeground, tabBarBackground: () => <BlurView intensity={80} tint="light" style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.82)' }} />, tabBarStyle: { position: 'absolute', backgroundColor: 'transparent', borderTopColor: colors.border, height: 78, paddingBottom: 17, paddingTop: 7 }, tabBarLabelStyle: { fontSize: 10, fontWeight: '700' } }}>
    <Tabs.Screen name="index" options={{ title: 'Chats', tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="updates" options={{ title: 'Updates', tabBarIcon: ({ color, size }) => <Ionicons name="radio-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: ({ color, size }) => <Ionicons name="location-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="calls" options={{ title: 'Calls', tabBarIcon: ({ color, size }) => <Ionicons name="call-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="updates-screen" options={{ href: null }} />
  </Tabs>;
}
