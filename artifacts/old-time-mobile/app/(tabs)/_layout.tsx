import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Redirect, Tabs } from 'expo-router';
import { BlurView } from 'expo-blur';
import { ActivityIndicator, Pressable, StyleSheet, Text, useColorScheme, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import { useColors } from '@/hooks/useColors';
import { useApp } from '@/context/app-state';
import { typography } from '@/constants/typography';
import { t } from '@/lib/i18n';

const tabDefinitions = {
  updates: { label: 'Updates', icon: 'play-circle-outline', activeIcon: 'play-circle' },
  pace: { label: 'Pace', icon: 'footsteps-outline', activeIcon: 'footsteps' },
  map: { label: 'Map', icon: 'location-outline', activeIcon: 'location' },
  index: { label: 'Chat', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles' },
  calls: { label: 'Calls', icon: 'call-outline', activeIcon: 'call' },
  settings: { label: 'Settings', icon: 'settings-outline', activeIcon: 'settings' },
} as const satisfies Record<string, { label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }>;

function FloatingTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const colors = useColors();
  const { settings } = useApp();
  const insets = useSafeAreaInsets();
  const colorScheme = useColorScheme();
  const routes = state.routes.filter((route) => route.name in tabDefinitions);

  return (
    <View pointerEvents="box-none" style={[styles.dock, { paddingBottom: Math.max(insets.bottom, 8) }]}>
      <BlurView
        intensity={78}
        tint={colorScheme === 'dark' ? 'dark' : 'light'}
        style={[styles.pill, { backgroundColor: colors.card, borderColor: colors.border }]}
      >
        {routes.map((route) => {
           const definition = tabDefinitions[route.name as keyof typeof tabDefinitions];
           const labelKey = route.name === 'index' ? 'chat' : route.name;
          const focused = state.index === state.routes.findIndex((item) => item.key === route.key);
          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name, route.params);
          };
          const onLongPress = () => navigation.emit({ type: 'tabLongPress', target: route.key });

          return (
            <Pressable
              key={route.key}
              accessibilityRole="tab"
              accessibilityState={focused ? { selected: true } : {}}
                accessibilityLabel={descriptors[route.key]?.options.tabBarAccessibilityLabel ?? t(settings.language, labelKey as 'updates' | 'pace' | 'map' | 'chat' | 'calls' | 'settings')}
              onPress={onPress}
              onLongPress={onLongPress}
              style={({ pressed }) => [styles.tabPressable, { opacity: pressed ? 0.66 : 1 }]}
            >
              <View style={[styles.tabButton, focused && { backgroundColor: `${colors.primary}1A` }]}>
                <Ionicons
                  name={focused ? definition.activeIcon : definition.icon}
                  size={focused ? 22 : 21}
                  color={focused ? colors.primary : colors.mutedForeground}
                />
                  <Text style={[styles.tabLabel, { color: focused ? colors.primary : colors.mutedForeground }]}>{t(settings.language, labelKey as 'updates' | 'pace' | 'map' | 'chat' | 'calls' | 'settings')}</Text>
              </View>
            </Pressable>
          );
        })}
      </BlurView>
    </View>
  );
}

export default function TabLayout() {
  const colors = useColors();
  const { hydrated, session } = useApp();
  if (!hydrated) {
    return (
      <View style={[styles.startup, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color={colors.primary} />
        <Text style={[styles.startupTitle, { color: colors.foreground }]}>Opening Old Time…</Text>
        <Text style={[styles.startupText, { color: colors.mutedForeground }]}>Restoring your session.</Text>
      </View>
    );
  }
  if (!session) return <Redirect href="/" />;
  return <Tabs tabBar={(props) => <FloatingTabBar {...props} />} screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: colors.background } }}>
    <Tabs.Screen name="updates" options={{ title: 'Updates', tabBarIcon: ({ color, size }) => <Ionicons name="play-circle-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="pace" options={{ title: 'Pace', tabBarIcon: ({ color, size }) => <Ionicons name="footsteps-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="map" options={{ title: 'Map', tabBarIcon: ({ color, size }) => <Ionicons name="location-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="index" options={{ title: 'Chat', tabBarIcon: ({ color, size }) => <Ionicons name="chatbubble-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="calls" options={{ title: 'Calls', tabBarIcon: ({ color, size }) => <Ionicons name="call-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: ({ color, size }) => <Ionicons name="settings-outline" color={color} size={size} /> }} />
    <Tabs.Screen name="updates-screen" options={{ href: null }} />
  </Tabs>;
}

const styles = StyleSheet.create({
  startup: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  startupTitle: { fontSize: 18, fontWeight: '800', marginTop: 16 },
  startupText: { fontSize: 14, marginTop: 6 },
  dock: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    paddingHorizontal: 14,
  },
  pill: {
    width: '100%',
    maxWidth: 520,
    minHeight: 66,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 5,
    borderRadius: 34,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    shadowColor: '#18212B',
    shadowOpacity: 0.14,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 8 },
    elevation: 8,
  },
  tabPressable: {
    flex: 1,
    minHeight: 56,
    alignItems: 'stretch',
    justifyContent: 'center',
  },
  tabButton: {
    minHeight: 54,
    borderRadius: 27,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    paddingHorizontal: 2,
  },
  tabLabel: {
    ...typography.timestamp,
    fontSize: 10,
    lineHeight: 13,
    fontWeight: '600',
  },
});
