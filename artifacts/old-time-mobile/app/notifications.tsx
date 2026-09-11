import { Ionicons } from '@expo/vector-icons';
import { getSocialNotifications, markSocialNotificationRead } from '@workspace/api-client-react';
import { Stack, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, IconButton } from '@/components/OldTimeUi';
import { useColors } from '@/hooks/useColors';
import { resolveRemoteMediaUrl } from '@/lib/api';

type SocialNotification = {
  id: number;
  type: string;
  storyId: number | null;
  replyId: number | null;
  createdAt: number;
  readAt: number | null;
  actor: {
    id: number;
    name: string;
    username: string;
    bio: string;
    avatarObjectPath?: string | null;
  } | null;
};

function notificationCopy(notification: SocialNotification) {
  switch (notification.type) {
    case 'story_mention': return 'mentioned you in a story.';
    case 'story_reaction': return 'reacted to your story.';
    case 'story_reply': return 'replied to your story.';
    case 'message': return 'sent you a message.';
    case 'follow': return 'started following you.';
    default: return 'shared an update with you.';
  }
}

function notificationIcon(type: string): keyof typeof Ionicons.glyphMap {
  if (type === 'message') return 'chatbubble-ellipses-outline';
  if (type === 'follow') return 'person-add-outline';
  if (type.startsWith('story_')) return type === 'story_mention' ? 'at-outline' : 'heart-outline';
  return 'notifications-outline';
}

function notificationTime(createdAt: number) {
  return new Date(createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' });
}

export default function NotificationsScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const result = await getSocialNotifications();
      setNotifications(result.items as SocialNotification[]);
    } catch {
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const openNotification = async (notification: SocialNotification) => {
    setNotifications((current) => current.map((item) => item.id === notification.id ? { ...item, readAt: Date.now() } : item));
    if (!notification.readAt) {
      void markSocialNotificationRead(notification.id).catch(() => undefined);
    }
    if (notification.storyId) {
      router.push({ pathname: '/story/[storyId]', params: { storyId: String(notification.storyId) } });
    } else if (notification.type === 'message') {
      router.push('/(tabs)/inbox');
    } else {
      router.push('/(tabs)/discover');
    }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: colors.border }]}>
        <IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Back" />
        <Text style={[styles.title, { color: colors.foreground }]}>Notifications</Text>
        <View style={styles.headerSpacer} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
      >
        {loading ? <ActivityIndicator color={colors.foreground} style={styles.loader} /> : notifications.length ? notifications.map((notification) => {
          const avatar = notification.actor?.avatarObjectPath ? { uri: resolveRemoteMediaUrl(notification.actor.avatarObjectPath) } : undefined;
          return (
            <Pressable
              key={notification.id}
              accessibilityRole="button"
              accessibilityLabel={`${notification.actor?.name ?? 'Someone'} ${notificationCopy(notification)}`}
              onPress={() => void openNotification(notification)}
              style={({ pressed }) => [styles.row, { backgroundColor: notification.readAt ? colors.background : colors.secondary, borderBottomColor: colors.border, opacity: pressed ? 0.72 : 1 }]}
            >
              <Avatar source={avatar} name={notification.actor?.name} size={46} />
              <View style={styles.copy}>
                <Text style={[styles.message, { color: colors.foreground }]}><Text style={styles.actor}>{notification.actor?.name ?? 'Someone'}</Text> {notificationCopy(notification)}</Text>
                <Text style={[styles.time, { color: colors.mutedForeground }]}>{notificationTime(notification.createdAt)}</Text>
              </View>
              <Ionicons name={notificationIcon(notification.type)} size={20} color={colors.foreground} />
            </Pressable>
          );
        }) : (
          <View style={styles.empty}>
            <Ionicons name="notifications-off-outline" size={36} color={colors.foreground} />
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>Nothing new yet.</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>Likes, replies, follows, and messages will show up here.</Text>
          </View>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingBottom: 12 },
  title: { flex: 1, textAlign: 'center', fontFamily: 'Fraunces_900Black', fontSize: 20 },
  headerSpacer: { width: 44 },
  content: { paddingHorizontal: 20 },
  loader: { marginTop: 48 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 18, paddingHorizontal: 8, borderBottomWidth: StyleSheet.hairlineWidth },
  copy: { flex: 1 },
  message: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 21 },
  actor: { fontFamily: 'Outfit_700Bold' },
  time: { fontFamily: 'Outfit_500Medium', fontSize: 12, marginTop: 6 },
  empty: { alignItems: 'center', paddingHorizontal: 32, paddingTop: 80 },
  emptyTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 22, marginTop: 18 },
  emptyBody: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
});