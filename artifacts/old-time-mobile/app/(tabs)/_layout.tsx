import React from 'react';
import { LayoutAnimation, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type TabName = 'index' | 'discover' | 'create' | 'inbox' | 'profile';
type FloatingTabBarProps = Parameters<NonNullable<React.ComponentProps<typeof Tabs>['tabBar']>>[0];

const tabMeta: Record<TabName, { label: string; icon: keyof typeof Ionicons.glyphMap; activeIcon: keyof typeof Ionicons.glyphMap }> = {
  index: { label: 'Album', icon: 'albums-outline', activeIcon: 'albums' },
  discover: { label: 'Community', icon: 'people-outline', activeIcon: 'people' },
  create: { label: 'Create', icon: 'add-circle-outline', activeIcon: 'add-circle' },
  inbox: { label: 'Chat', icon: 'chatbubbles-outline', activeIcon: 'chatbubbles' },
  profile: { label: 'Profile', icon: 'person-outline', activeIcon: 'person' },
};

function FloatingTabBar({ state, descriptors, navigation }: FloatingTabBarProps) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  if (state.routes[state.index]?.name === 'create') return null;
  const bottomInset = Platform.OS === 'web' ? 34 : insets.bottom;
  const routes = state.routes.filter((route) => tabMeta[route.name as TabName]);
  const mainRoutes = routes.filter((route) => route.name !== 'profile');
  const profileRoute = routes.find((route) => route.name === 'profile');

  const selectRoute = (routeName: string) => {
    const event = navigation.emit({ type: 'tabPress', target: routeName, canPreventDefault: true });
    if (!event.defaultPrevented) navigation.navigate(routeName);
  };

  const renderTab = (route: (typeof routes)[number], detached = false) => {
    const name = route.name as TabName;
    const meta = tabMeta[name];
    const isFocused = state.routes[state.index]?.key === route.key;
    const options = descriptors[route.key]?.options;
    const accessibilityLabel = options?.tabBarAccessibilityLabel ?? meta.label;
    const testID = options?.tabBarButtonTestID;

    return (
      <Pressable
        key={route.key}
        accessibilityRole="tab"
        accessibilityState={isFocused ? { selected: true } : {}}
        accessibilityLabel={accessibilityLabel}
        testID={testID}
        onPress={() => {
          LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
          selectRoute(route.name);
        }}
        style={({ pressed }) => [
          detached ? styles.detachedButton : styles.tabButton,
          pressed && styles.pressed,
          detached && { backgroundColor: colors.card, borderColor: colors.border },
          !detached && isFocused && { backgroundColor: colors.secondary },
        ]}
      >
        <Ionicons
          name={isFocused ? meta.activeIcon : meta.icon}
           size={detached ? 25 : 22}
           color={isFocused ? colors.foreground : colors.mutedForeground}
        />
      </Pressable>
    );
  };

  return (
    <View style={[styles.tabBar, { paddingBottom: bottomInset + 8 }]}>
      <View style={styles.navigationRow}>
        <View style={[styles.mainCapsule, { backgroundColor: colors.card, borderColor: colors.border }]}>
          {mainRoutes.map((route) => renderTab(route))}
        </View>
        {profileRoute ? renderTab(profileRoute, true) : null}
      </View>
    </View>
  );
}

export default function TabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{
        headerShown: false,
        tabBarStyle: styles.hiddenTabBar,
      }}
    >
      <Tabs.Screen name="index" options={{ title: tabMeta.index.label }} />
      <Tabs.Screen name="discover" options={{ title: tabMeta.discover.label }} />
      <Tabs.Screen name="create" options={{ title: tabMeta.create.label }} />
      <Tabs.Screen name="inbox" options={{ title: tabMeta.inbox.label }} />
      <Tabs.Screen name="profile" options={{ title: tabMeta.profile.label }} />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  hiddenTabBar: {
    position: 'absolute',
    height: 100,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    elevation: 0,
  },
  tabBar: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 14,
    paddingTop: 6,
    backgroundColor: 'transparent',
  },
  navigationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  mainCapsule: {
    flex: 1,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    padding: 5,
    flexDirection: 'row',
    alignItems: 'stretch',
    shadowColor: '#111111',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  tabButton: {
    flex: 1,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 0,
  },
  detachedButton: {
    width: 58,
    height: 58,
    borderRadius: 29,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#111111',
    shadowOpacity: 0.1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 5 },
    elevation: 5,
  },
  pressed: {
    opacity: 0.72,
  },
});
