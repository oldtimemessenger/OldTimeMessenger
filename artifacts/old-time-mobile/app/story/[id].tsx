import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ServerStoryViewer } from '@/components/server-story-viewer';
import { buildStoryViewerItems } from '@/lib/story-viewer-sequence';
import { userStoryViewerItemId } from '@/components/story-viewer-content';
import { getStory, type Story } from '@/lib/social-api';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';

export default function SharedStoryScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useApp();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [story, setStory] = useState<Story | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const storyId = Number(id);
    if (!session?.authToken || !Number.isInteger(storyId) || storyId < 1) {
      setLoading(false);
      setError('This Story link is invalid or you need to sign in first.');
      return;
    }
    let mounted = true;
    setLoading(true);
    void getStory(session.authToken, storyId)
      .then((result) => { if (mounted) setStory(result); })
      .catch((reason) => { if (mounted) setError(reason instanceof Error ? reason.message : 'This Story is no longer available.'); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [id, session?.authToken]);

  if (story) {
    return <ServerStoryViewer items={buildStoryViewerItems([story])} initialItemId={userStoryViewerItemId(story.id)} token={session?.authToken ?? ''} onClose={() => router.back()} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <Pressable onPress={() => router.back()} style={styles.backButton} accessibilityRole="button" accessibilityLabel="Close shared story">
        <Ionicons name="chevron-back" size={24} color={colors.foreground} />
      </Pressable>
      {loading ? <ActivityIndicator color={colors.primary} /> : <Text style={[styles.error, { color: colors.foreground }]}>{error ?? 'This Story is no longer available.'}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  backButton: { position: 'absolute', top: 16, left: 16, width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  error: { textAlign: 'center', fontSize: 16, lineHeight: 23 },
});