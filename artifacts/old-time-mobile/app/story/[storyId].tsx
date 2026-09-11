import { Ionicons } from '@expo/vector-icons';
import { getStory, viewStory, type Story } from '@workspace/api-client-react';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/OldTimeUi';
import { useColors } from '@/hooks/useColors';
import { resolveRemoteMediaUrl } from '@/lib/api';

function StoryVideo({ uri }: { uri: string }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = false;
    instance.play();
  });
  return <VideoView player={player} style={styles.media} contentFit="contain" nativeControls={false} />;
}

export default function StoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { storyId } = useLocalSearchParams<{ storyId?: string }>();
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const id = Number(storyId);
    if (!Number.isInteger(id) || id <= 0) {
      setFailed(true);
      setLoading(false);
      return;
    }
    let cancelled = false;
    void getStory(id)
      .then((result) => {
        if (!cancelled) {
          setStory(result);
          void viewStory(id).catch(() => undefined);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [storyId]);

  const mediaUri = story?.media?.objectPath ? resolveRemoteMediaUrl(story.media.objectPath) : undefined;
  const avatar = story?.author.avatarObjectPath ? { uri: resolveRemoteMediaUrl(story.author.avatarObjectPath) } : undefined;

  return (
    <View style={[styles.screen, { backgroundColor: colors.homeForeground }]}>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable accessibilityRole="button" accessibilityLabel="Close story" onPress={() => router.back()} style={styles.closeButton}>
          <Ionicons name="close" size={26} color={colors.homeBackground} />
        </Pressable>
      </View>
      {loading ? <ActivityIndicator color={colors.homeBackground} size="large" /> : failed || !story ? (
        <View style={styles.empty}>
          <Ionicons name="time-outline" size={40} color={colors.homeBackground} />
          <Text style={styles.emptyTitle}>This story is no longer available.</Text>
          <Pressable accessibilityRole="button" onPress={() => router.back()} style={[styles.backButton, { backgroundColor: colors.homeBackground }]}><Text style={{ color: colors.homeForeground, fontFamily: 'Outfit_700Bold' }}>Go back</Text></Pressable>
        </View>
      ) : (
        <>
          {mediaUri && story.media?.type === 'video' ? <StoryVideo uri={mediaUri} /> : mediaUri ? <Image source={{ uri: mediaUri }} style={styles.media} resizeMode="contain" /> : <View style={[styles.textStory, { backgroundColor: colors.card }]}><Text style={[styles.quote, { color: colors.foreground }]}>{story.content || 'A moment from Old Time'}</Text></View>}
          <View style={[styles.identity, { top: insets.top + 14 }]}>
            {avatar ? <Avatar source={avatar} size={38} /> : <View style={[styles.fallbackAvatar, { backgroundColor: colors.homeBackground }]}><Ionicons name="person" size={17} color={colors.homeForeground} /></View>}
            <Text style={styles.author}>{story.author.name}</Text>
          </View>
          {story.content && story.media ? <Text style={[styles.caption, { bottom: insets.bottom + 28 }]}>{story.content}</Text> : null}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, justifyContent: 'center' },
  header: { position: 'absolute', zIndex: 2, top: 0, right: 12 },
  closeButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  media: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  textStory: { margin: 22, minHeight: 360, borderRadius: 28, padding: 30, justifyContent: 'center' },
  quote: { fontFamily: 'Fraunces_700Bold', fontSize: 30, lineHeight: 39 },
  identity: { position: 'absolute', left: 16, flexDirection: 'row', alignItems: 'center', gap: 10 },
  fallbackAvatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  author: { color: '#FFFFFF', fontFamily: 'Outfit_700Bold', fontSize: 16 },
  caption: { position: 'absolute', left: 22, right: 22, color: '#FFFFFF', fontFamily: 'Outfit_600SemiBold', fontSize: 16, lineHeight: 23, textAlign: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 28 },
  emptyTitle: { color: '#FFFFFF', fontFamily: 'Fraunces_700Bold', fontSize: 22, textAlign: 'center', marginTop: 16 },
  backButton: { minHeight: 46, paddingHorizontal: 24, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginTop: 24 },
});