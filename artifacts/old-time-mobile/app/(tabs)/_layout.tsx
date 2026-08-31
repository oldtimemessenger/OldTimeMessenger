import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/app-state';

export default function TabLayout() {
  const colors = useColors();
  const { hydrated, session } = useApp();
  if (!hydrated) return null;
  if (!session) return <Redirect href="/" />;
  return <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: colors.primary, tabBarInactiveTintColor: colors.mutedForeground, tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.border, height: 78, paddingBottom: 17, paddingTop: 7 }, tabBarLabelStyle: { fontSize: 10, fontWeight: '600' } }}>
    <Tabs.Screen name="index" options={{ title: 'Chats', tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="updates" options={{ title: 'Updates', tabBarIcon: ({ color, size }) => <Ionicons name="radio-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: ({ color, size }) => <Ionicons name="location-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="calls" options={{ title: 'Calls', tabBarIcon: ({ color, size }) => <Ionicons name="call-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="updates-screen" options={{ href: null }} />
  </Tabs>;
}
