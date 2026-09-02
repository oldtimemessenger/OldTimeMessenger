import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, KeyboardAvoidingView, PanResponder, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui';
import { SponsoredStory, type StoryViewerItem } from '@/components/story-viewer-content';
import { VideoSurface } from '@/components/video-surface';
import { getStoryViewers, reactToStory, replyToStory, socialMediaUrl, viewStory, type Story } from '@/lib/social-api';
import { typography } from '@/constants/typography';

type Props = {
  items: StoryViewerItem[];
  initialItemId: string;
  token: string;
  onClose: () => void;
};

const STORY_DURATION_MS = 6500;
const STORY_BACKGROUNDS = [
  ['#F58529', '#DD2A7B', '#8134AF'],
  ['#833AB4', '#FD1D1D', '#FCAF45'],
  ['#4F5BD5', '#962FBF', '#D62976'],
  ['#FF6B6B', '#C44569', '#574B90'],
  ['#00C6FF', '#0072FF', '#6A11CB'],
] as const;

export function ServerStoryViewer({ items, initialItemId, token, onClose }: Props) {
  const insets = useSafeAreaInsets();
  const activeItems = useMemo(() => items.filter((candidate) => {
    if (candidate.type === 'SPONSORED_STORY') return !candidate.expiresAt || candidate.expiresAt > Date.now();
    return candidate.story.expiresAt > Date.now();
  }), [items]);
  const initialIndex = Math.max(0, activeItems.findIndex((item) => item.id === initialItemId));
  const [index, setIndex] = useState(initialIndex);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);
  const [reactionSent, setReactionSent] = useState(false);
  const [reply, setReply] = useState('');
  const [replying, setReplying] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;
  const item = activeItems[index];
  const story: Story | null = item?.type === 'USER_STORY' ? item.story : null;
  const media = story?.media ?? null;

  const close = useCallback(() => {
    Animated.timing(translateY, { toValue: 160, duration: 160, useNativeDriver: true }).start(onClose);
  }, [onClose, translateY]);

  const next = useCallback(() => {
    if (index < activeItems.length - 1) {
      setIndex((current) => current + 1);
      setProgress(0);
    } else {
      close();
    }
  }, [activeItems.length, close, index]);

  async function sendReaction() {
    if (!story || reactionSent) return;
    try {
      await reactToStory(token, story.id, 'like');
      setReactionSent(true);
    } catch (error) {
      Alert.alert('Reaction not sent', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function sendReply() {
    const content = reply.trim();
    if (!story || !content || replying) return;
    setReplying(true);
    try {
      await replyToStory(token, story.id, content);
      setReply('');
      Alert.alert('Reply sent', 'Your reply was sent to the Story author.');
    } catch (error) {
      Alert.alert('Reply not sent', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setReplying(false);
    }
  }

  async function showViewers() {
    if (!story) return;
    try {
      const result = await getStoryViewers(token, story.id);
      Alert.alert('Story viewers', result.items.length ? result.items.map((viewer) => viewer.name).join('\n') : 'No viewers yet.');
    } catch (error) {
      Alert.alert('Viewers unavailable', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  const previous = useCallback(() => {
    if (index > 0) setIndex((current) => current - 1);
    setProgress(0);
  }, [index]);

  useEffect(() => {
    if (!story || story.viewer.viewed) return;
    void viewStory(token, story.id).catch(() => {
      // Viewing remains available if the best-effort read receipt races expiry or deletion.
    });
  }, [story?.id, story?.viewer.viewed, token]);

  useEffect(() => {
    if (paused || !item) return;
    const interval = setInterval(() => {
      setProgress((current) => {
        const nextProgress = current + 50 / STORY_DURATION_MS;
        if (nextProgress >= 1) {
          setTimeout(next, 0);
          return 0;
        }
        return nextProgress;
      });
    }, 50);
    return () => clearInterval(interval);
  }, [item?.id, next, paused]);

  const panResponder = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => gesture.dy > 14 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderGrant: () => setPaused(true),
    onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 110 || gesture.vy > 1.1) {
        close();
      } else {
        Animated.spring(translateY, { toValue: 0, useNativeDriver: true, damping: 18, stiffness: 190 }).start();
        setPaused(false);
      }
    },
    onPanResponderTerminate: () => {
      Animated.spring(translateY, { toValue: 0, useNativeDriver: true }).start();
      setPaused(false);
    },
  }), [close, translateY]);

  if (!item) {
    return (
      <View style={styles.expired}>
        <Ionicons name="time-outline" size={32} color="#FFFFFF" />
        <Text style={styles.expiredTitle}>This Story has expired</Text>
        <Pressable onPress={onClose} style={styles.expiredButton}><Text style={styles.expiredButtonText}>Close</Text></Pressable>
      </View>
    );
  }

  return (
    <Animated.View
      testID="server-story-viewer"
      style={[styles.viewer, { transform: [{ translateY }] }]}
      {...panResponder.panHandlers}
    >
      <LinearGradient
        colors={STORY_BACKGROUNDS[(story?.id ?? index) % STORY_BACKGROUNDS.length]}
        start={{ x: 0, y: 1 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {media?.type === 'image' ? (
        <Image source={{ uri: socialMediaUrl(media.objectPath), headers: { Authorization: `Bearer ${token}` } }} style={StyleSheet.absoluteFill} contentFit={media.fit ?? 'contain'} />
      ) : null}
      {media?.type === 'video' ? (
        <VideoSurface source={{ uri: socialMediaUrl(media.objectPath), headers: { Authorization: `Bearer ${token}` } }} style={StyleSheet.absoluteFill} muted={muted} paused={paused} contentFit={media.fit ?? 'contain'} />
      ) : null}
      <View style={styles.shade} />

      <View style={[styles.progressRow, { top: insets.top + 8 }]}>
        {activeItems.map((progressItem, itemIndex) => (
          <View key={progressItem.id} style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: itemIndex < index ? '100%' : itemIndex === index ? `${progress * 100}%` : '0%' }]} />
          </View>
        ))}
      </View>

      <View style={[styles.header, { top: insets.top + 20 }]}>
        {story ? <Avatar name={story.author.name} size={38} color="rgba(255,255,255,0.28)" /> : <View style={styles.sponsoredIcon}><Ionicons name="megaphone" size={20} color="#FFFFFF" /></View>}
        <View style={styles.identity}>
          <Text style={styles.author}>{story?.author.name ?? 'Sponsored'}</Text>
          <View style={styles.contextRow}>
            <Text style={styles.meta}>{story ? `@${story.author.username} · ${relativeTime(story.createdAt)}` : 'Advertisement'}</Text>
            {story?.location ? <><View style={styles.dot} /><Ionicons name="location" size={11} color="rgba(255,255,255,0.82)" /><Text style={styles.meta}>Map Story</Text></> : null}
          </View>
        </View>
        {media?.type === 'video' ? <Pressable onPress={() => setMuted((value) => !value)} style={styles.iconButton}><Ionicons name={muted ? 'volume-mute' : 'volume-medium'} size={20} color="#FFFFFF" /></Pressable> : null}
        <Pressable onPress={onClose} style={styles.iconButton}><Ionicons name="close" size={25} color="#FFFFFF" /></Pressable>
      </View>

      <Pressable style={styles.leftTap} onPress={previous} onPressIn={() => setPaused(true)} onPressOut={() => setPaused(false)} />
      <Pressable style={styles.rightTap} onPress={next} onPressIn={() => setPaused(true)} onPressOut={() => setPaused(false)} />

      {item.type === 'SPONSORED_STORY' ? <SponsoredStory {...item} /> : null}
      {story?.content ? (
        <View pointerEvents="none" style={[styles.content, story.media ? styles.contentBottom : styles.contentCenter]}>
          <Text style={[styles.storyText, story.media ? styles.mediaCaption : null]}>{story.content}</Text>
        </View>
      ) : null}
      {story ? (
        <KeyboardAvoidingView behavior="padding" style={[styles.actions, { bottom: Math.max(12, insets.bottom + 10) }]}>
          <Pressable onPress={() => void sendReaction()} style={styles.actionButton} accessibilityRole="button" accessibilityLabel={reactionSent ? 'Story reaction sent' : 'React to story'}>
            <Ionicons name={reactionSent ? 'heart' : 'heart-outline'} size={21} color={reactionSent ? '#FF6B81' : '#FFFFFF'} />
          </Pressable>
          <TextInput
            value={reply}
            onChangeText={setReply}
            onSubmitEditing={() => void sendReply()}
            placeholder="Reply to Story…"
            placeholderTextColor="rgba(255,255,255,0.72)"
            returnKeyType="send"
            maxLength={500}
            style={styles.replyInput}
            accessibilityLabel="Reply to story"
          />
          <Pressable onPress={() => void sendReply()} disabled={!reply.trim() || replying} style={[styles.actionButton, { opacity: !reply.trim() || replying ? 0.45 : 1 }]} accessibilityRole="button" accessibilityLabel="Send story reply">
            <Ionicons name="send" size={20} color="#FFFFFF" />
          </Pressable>
          <Pressable onPress={() => void Share.share({ message: `${story.author.name} shared a Story on Old Time.` })} style={styles.actionButton} accessibilityRole="button" accessibilityLabel="Share story">
            <Ionicons name="share-outline" size={21} color="#FFFFFF" />
          </Pressable>
          {story.viewer.isOwner ? (
            <Pressable onPress={() => void showViewers()} style={styles.actionButton} accessibilityRole="button" accessibilityLabel="View story viewers">
              <Ionicons name="people-outline" size={21} color="#FFFFFF" />
            </Pressable>
          ) : null}
        </KeyboardAvoidingView>
      ) : null}
      <View pointerEvents="none" style={[styles.swipeHint, { bottom: story ? Math.max(72, insets.bottom + 64) : Math.max(14, insets.bottom + 6) }]}>
        <View style={styles.swipeHandle} />
      </View>
    </Animated.View>
  );
}

function relativeTime(timestamp: number) {
  const minutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h` : `${Math.floor(hours / 24)}d`;
}

const styles = StyleSheet.create({
  viewer: { flex: 1, backgroundColor: '#1C3550', overflow: 'hidden' },
  shade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  progressRow: { position: 'absolute', left: 12, right: 12, flexDirection: 'row', gap: 4, zIndex: 20 },
  progressTrack: { flex: 1, height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.32)' },
  progressFill: { height: '100%', backgroundColor: '#FFFFFF' },
  header: { position: 'absolute', left: 15, right: 12, zIndex: 20, flexDirection: 'row', alignItems: 'center', gap: 9 },
  sponsoredIcon: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  identity: { flex: 1 },
  author: { ...typography.username, color: '#FFFFFF', fontSize: 14, lineHeight: 18 },
  contextRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  meta: { ...typography.timestamp, color: 'rgba(255,255,255,0.82)', fontSize: 11, lineHeight: 15 },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.68)', marginHorizontal: 6 },
  iconButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  leftTap: { position: 'absolute', left: 0, top: 92, bottom: 65, width: '32%', zIndex: 10 },
  rightTap: { position: 'absolute', right: 0, top: 92, bottom: 65, width: '68%', zIndex: 10 },
  actions: { position: 'absolute', left: 14, right: 14, flexDirection: 'row', alignItems: 'center', gap: 8, zIndex: 30 },
  actionButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center' },
  replyInput: { flex: 1, height: 40, borderWidth: 1, borderColor: 'rgba(255,255,255,0.62)', borderRadius: 20, paddingHorizontal: 14, color: '#FFFFFF', fontSize: 14, backgroundColor: 'rgba(0,0,0,0.18)' },
  content: { ...StyleSheet.absoluteFillObject, paddingHorizontal: 28 },
  contentCenter: { alignItems: 'center', justifyContent: 'center' },
  contentBottom: { justifyContent: 'flex-end', paddingBottom: 88 },
  storyText: { ...typography.storyTitle, color: '#FFFFFF', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.38)', textShadowRadius: 8 },
  mediaCaption: { fontSize: 18, lineHeight: 24, textAlign: 'left' },
  swipeHint: { position: 'absolute', alignSelf: 'center', alignItems: 'center' },
  swipeHandle: { width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.72)' },
  expired: { flex: 1, backgroundColor: '#1C3550', alignItems: 'center', justifyContent: 'center', gap: 12 },
  expiredTitle: { ...typography.sectionTitle, color: '#FFFFFF', fontSize: 18 },
  expiredButton: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', minHeight: 42, borderRadius: 21, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  expiredButtonText: { ...typography.button, color: '#FFFFFF' },
});