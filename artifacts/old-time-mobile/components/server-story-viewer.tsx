import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Dimensions, FlatList, KeyboardAvoidingView, PanResponder, Pressable, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui';
import { SponsoredStory, type StoryViewerItem } from '@/components/story-viewer-content';
import { VideoSurface } from '@/components/video-surface';
import { getStoryReplies, getStoryViewers, reactToStory, removeStoryReaction, replyToStory, socialMediaUrl, viewStory, type Story, type StoryReply, type SocialUser } from '@/lib/social-api';
import { typography } from '@/constants/typography';

type Props = {
  items: StoryViewerItem[];
  initialItemId: string;
  token: string;
  onClose: () => void;
};

const STORY_DURATION_MS = 6500;
const STORY_VIEW_EXPIRY_MS = 30_000;
const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');
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
  const [showReplies, setShowReplies] = useState(false);
  const [replies, setReplies] = useState<StoryReply[]>([]);
  const [repliesLoading, setRepliesLoading] = useState(false);
  const [viewers, setViewers] = useState<Array<SocialUser & { viewedAt: number }> | null>(null);
  const [viewersLoading, setViewersLoading] = useState(false);
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
    if (!story) return;
    try {
      if (reactionSent) await removeStoryReaction(token, story.id);
      else await reactToStory(token, story.id, '❤️');
      setReactionSent((active) => !active);
    } catch (error) {
      Alert.alert('Reaction not sent', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function sendReply() {
    const content = reply.trim();
    if (!story || !content || replying) return;
    setReplying(true);
    try {
      const created = await replyToStory(token, story.id, content);
      setReply('');
      setReplies((items) => [...items, created as StoryReply]);
      setShowReplies(true);
    } catch (error) {
      Alert.alert('Reply not sent', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setReplying(false);
    }
  }

  async function showViewers() {
    if (!story) return;
    setViewersLoading(true);
    try {
      const result = await getStoryViewers(token, story.id);
      setViewers(result.items);
    } catch (error) {
      Alert.alert('Viewers unavailable', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setViewersLoading(false);
    }
  }

  async function openReplies() {
    if (!story || repliesLoading) {
      setShowReplies(true);
      return;
    }
    setShowReplies(true);
    setRepliesLoading(true);
    try {
      const result = await getStoryReplies(token, story.id);
      setReplies(result.items);
    } catch (error) {
      Alert.alert('Comments unavailable', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setRepliesLoading(false);
    }
  }

  const previous = useCallback(() => {
    if (index > 0) setIndex((current) => current - 1);
    setProgress(0);
  }, [index]);

  useEffect(() => {
    if (!story) return;
    setReactionSent(story.viewer.reacted);
    setReplies([]);
    setViewers(null);
    void viewStory(token, story.id).catch((error) => {
      Alert.alert('Story view not recorded', error instanceof Error ? error.message : 'Please try again.');
    });
  }, [story?.id, story?.viewer.viewed, token]);

  useEffect(() => {
    if (!item || item.type === 'SPONSORED_STORY') return;
    const timeout = setTimeout(() => close(), STORY_VIEW_EXPIRY_MS);
    return () => clearTimeout(timeout);
  }, [close, item?.id, item?.type]);

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
        <View
          pointerEvents="none"
          style={[
            styles.content,
            story.media && !story.textPosition ? styles.contentBottom : styles.contentCenter,
            story.textPosition ? {
              transform: [
                { translateX: story.textPosition.x * WINDOW_WIDTH },
                { translateY: story.textPosition.y * WINDOW_HEIGHT },
              ],
            } : null,
          ]}
        >
          <Text style={[styles.storyText, story.media ? styles.mediaCaption : null]}>{story.content}</Text>
          {story.taggedUsers?.length ? <Text style={styles.taggedPeople}>Tagged: {story.taggedUsers.map((user) => `@${user.username}`).join(', ')}</Text> : null}
        </View>
      ) : null}
      {!story?.content && story?.taggedUsers?.length ? <Text pointerEvents="none" style={styles.taggedPeopleStandalone}>Tagged: {story.taggedUsers.map((user) => `@${user.username}`).join(', ')}</Text> : null}
      {story ? (
        <KeyboardAvoidingView behavior="padding" style={[styles.actions, { bottom: Math.max(12, insets.bottom + 10) }]}>
          <Pressable onPress={() => void sendReaction()} style={styles.actionButton} accessibilityRole="button" accessibilityLabel={reactionSent ? 'Story reaction sent' : 'React to story'}>
            <Ionicons name={reactionSent ? 'heart' : 'heart-outline'} size={21} color={reactionSent ? '#FF6B81' : '#FFFFFF'} />
          </Pressable>
          <TextInput
            value={reply}
            onChangeText={setReply}
            onSubmitEditing={() => void sendReply()}
            onFocus={() => void openReplies()}
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
          <Pressable onPress={() => void shareStory(story)} style={styles.actionButton} accessibilityRole="button" accessibilityLabel="Share story">
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
      {showReplies && story ? (
        <StoryRepliesSheet
          story={story}
          token={token}
          replies={replies}
          loading={repliesLoading}
          draft={reply}
          onDraftChange={setReply}
          onSend={() => void sendReply()}
          onClose={() => setShowReplies(false)}
        />
      ) : null}
      {viewers ? <StoryViewersSheet viewers={viewers} loading={viewersLoading} onClose={() => setViewers(null)} /> : null}
    </Animated.View>
  );
}

async function shareStory(story: Story) {
  try {
    await Share.share({
      message: `${story.author.name} shared a Story on Old Time.\n\nold-time-mobile://story/${story.id}`,
      url: `old-time-mobile://story/${story.id}`,
    });
  } catch (error) {
    Alert.alert('Story not shared', error instanceof Error ? error.message : 'Please try again.');
  }
}

function StoryRepliesSheet({
  story,
  token,
  replies,
  loading,
  draft,
  onDraftChange,
  onSend,
  onClose,
}: {
  story: Story;
  token: string;
  replies: StoryReply[];
  loading: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onSend: () => void;
  onClose: () => void;
}) {
  return (
    <View style={styles.sheetOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close story replies" />
      <KeyboardAvoidingView behavior="padding" style={styles.replySheet}>
        <View style={styles.sheetHeading}>
          <Text style={styles.sheetTitle}>Replies to @{story.author.username}</Text>
          <Pressable onPress={onClose} style={styles.sheetClose} accessibilityRole="button" accessibilityLabel="Close replies">
            <Ionicons name="close" size={22} color="#1C3550" />
          </Pressable>
        </View>
        {loading ? <Text style={styles.sheetEmpty}>Loading replies…</Text> : (
          <FlatList
            data={replies}
            keyExtractor={(item) => String(item.id)}
            contentContainerStyle={replies.length ? styles.replyList : styles.replyListEmpty}
            ListEmptyComponent={<Text style={styles.sheetEmpty}>No replies yet. Start the conversation.</Text>}
            renderItem={({ item }) => (
              <View style={styles.replyRow}>
                <Avatar name={item.author.name} size={32} color="#DCE7F2" />
                <View style={styles.replyBody}>
                  <Text style={styles.replyAuthor}>@{item.author.username}</Text>
                  <Text style={styles.replyText}>{item.content}</Text>
                </View>
              </View>
            )}
          />
        )}
        <View style={styles.replyComposer}>
          <TextInput
            value={draft}
            onChangeText={onDraftChange}
            placeholder="Reply to this Story…"
            placeholderTextColor="#748398"
            maxLength={1000}
            style={styles.replyComposerInput}
            accessibilityLabel="Story reply"
          />
          <Pressable onPress={onSend} disabled={!draft.trim()} style={[styles.replySend, { opacity: draft.trim() ? 1 : 0.45 }]} accessibilityRole="button" accessibilityLabel="Send story reply">
            <Ionicons name="send" size={18} color="#fff" />
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

function StoryViewersSheet({
  viewers,
  loading,
  onClose,
}: {
  viewers: Array<SocialUser & { viewedAt: number }>;
  loading: boolean;
  onClose: () => void;
}) {
  return (
    <View style={styles.sheetOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityRole="button" accessibilityLabel="Close story viewers" />
      <View style={styles.viewerSheet}>
        <View style={styles.sheetHeading}>
          <View>
            <Text style={styles.sheetTitle}>Story viewers</Text>
            <Text style={styles.sheetSubTitle}>Only you can see this list.</Text>
          </View>
          <Pressable onPress={onClose} style={styles.sheetClose} accessibilityRole="button" accessibilityLabel="Close viewers">
            <Ionicons name="close" size={22} color="#1C3550" />
          </Pressable>
        </View>
        {loading ? <Text style={styles.sheetEmpty}>Loading viewers…</Text> : viewers.length === 0 ? (
          <Text style={styles.sheetEmpty}>No one has viewed this Story yet.</Text>
        ) : (
          <FlatList
            data={viewers}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <View style={styles.viewerRow}>
                <Avatar name={item.name} size={38} color="#DCE7F2" />
                <View style={{ flex: 1 }}>
                  <Text style={styles.replyAuthor}>{item.name}</Text>
                  <Text style={styles.viewerUsername}>@{item.username}</Text>
                </View>
                <Text style={styles.viewerTime}>{relativeTime(item.viewedAt)} ago</Text>
              </View>
            )}
          />
        )}
      </View>
    </View>
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
  taggedPeople: { color: 'rgba(255,255,255,0.84)', fontSize: 12, textAlign: 'left', marginTop: 8 },
  taggedPeopleStandalone: { position: 'absolute', left: 28, right: 28, bottom: 120, color: 'rgba(255,255,255,0.84)', fontSize: 12, textAlign: 'center', zIndex: 20 },
  swipeHint: { position: 'absolute', alignSelf: 'center', alignItems: 'center' },
  swipeHandle: { width: 34, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.72)' },
  sheetOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)', zIndex: 80 },
  replySheet: { maxHeight: '72%', minHeight: 300, backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 16 },
  viewerSheet: { maxHeight: '62%', minHeight: 240, backgroundColor: '#FFFFFF', borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 16 },
  sheetHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { color: '#1C3550', fontSize: 17, fontWeight: '800' },
  sheetSubTitle: { color: '#748398', fontSize: 12, marginTop: 3 },
  sheetClose: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', backgroundColor: '#EDF3F8' },
  sheetEmpty: { color: '#748398', textAlign: 'center', paddingVertical: 28, fontSize: 14 },
  replyList: { gap: 14, paddingBottom: 12 },
  replyListEmpty: { flexGrow: 1, justifyContent: 'center' },
  replyRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 9 },
  replyBody: { flex: 1, paddingTop: 1 },
  replyAuthor: { color: '#1C3550', fontSize: 13, fontWeight: '800' },
  replyText: { color: '#1C3550', fontSize: 14, lineHeight: 19, marginTop: 3 },
  replyComposer: { flexDirection: 'row', alignItems: 'center', gap: 8, borderTopWidth: 1, borderTopColor: '#E1E8EF', paddingTop: 10 },
  replyComposerInput: { flex: 1, minHeight: 42, maxHeight: 100, borderWidth: 1, borderColor: '#C9D5E0', borderRadius: 21, paddingHorizontal: 14, color: '#1C3550', fontSize: 14 },
  replySend: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2674A8' },
  viewerRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  viewerUsername: { color: '#748398', fontSize: 11, marginTop: 2 },
  viewerTime: { color: '#748398', fontSize: 11 },
  expired: { flex: 1, backgroundColor: '#1C3550', alignItems: 'center', justifyContent: 'center', gap: 12 },
  expiredTitle: { ...typography.sectionTitle, color: '#FFFFFF', fontSize: 18 },
  expiredButton: { borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', minHeight: 42, borderRadius: 21, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  expiredButtonText: { ...typography.button, color: '#FFFFFF' },
});
