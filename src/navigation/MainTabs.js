import React from 'react';
import { View, Text } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Zap, MessageCircle, Phone, Settings as SettingsIcon } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';
import ChatsScreen from '../screens/ChatsScreen';
import UpdatesScreen from '../screens/UpdatesScreen';
import CallsScreen from '../screens/CallsScreen';
import SettingsScreen from '../screens/SettingsScreen';

const Tab = createBottomTabNavigator();

export default function MainTabs() {
  const { theme } = useTheme();
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.greenBright,
        tabBarInactiveTintColor: theme.text,
        tabBarStyle: { backgroundColor: theme.header, borderTopColor: theme.divider },
        tabBarIcon: ({ color, focused }) => {
          const icons = { Updates: Zap, Chats: MessageCircle, Calls: Phone, Settings: SettingsIcon };
          const Icon = icons[route.name];
          return <Icon size={22} color={color} fill={focused ? color : 'none'} strokeWidth={focused ? 2.2 : 1.7} />;
        },
      })}
    >
      <Tab.Screen name="Updates" component={UpdatesScreen} />
      <Tab.Screen name="Chats" component={ChatsScreen} />
      <Tab.Screen name="Calls" component={CallsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}
