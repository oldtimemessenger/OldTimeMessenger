import { Ionicons } from '@expo/vector-icons';
import { getStories, type Story } from '@workspace/api-client-react';
import { LinearGradient } from 'expo-linear-gradient';
import { useVideoPlayer, VideoView } from 'expo-video';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Image, Modal, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';
import { Avatar, IconButton } from '@/components/OldTimeUi';
import { Post, useOldTime } from '@/context/OldTimeContext';
import { CommentsModal, PostCard } from '@/components/PostCard';
import { TAB_BAR_CONTENT_CLEARANCE } from '@/constants/layout';
import MapExperience from '@/components/MapExperience';
import { resolveRemoteMediaUrl } from '@/lib/api';

function StoryVideo({ uri, style }: { uri: string; style?: object }) {
  const player = useVideoPlayer(uri, (instance) => {
    instance.loop = true;
    instance.muted = true;
    instance.play();
  });
  return <VideoView player={player} style={[styles.storyMedia, style]} contentFit="cover" nativeControls={false} />;
}

function StoryRail({ stories, profile, onCreate, onOpen }: { stories: Story[]; profile: ReturnType<typeof useOldTime>['profile']; onCreate: () => void; onOpen: (index: number) => void }) {
  const colors = useColors();
  return (
    <View style={styles.storyRail}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyList}>
        <Pressable accessibilityRole="button" accessibilityLabel="Create a story" onPress={onCreate} style={({ pressed }) => [styles.storyCard, styles.yourStoryCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.78 : 1 }]}>
          {profile?.avatar ? (
            <Image source={profile.avatar} style={StyleSheet.absoluteFillObject} resizeMode="cover" />
          ) : (
            <View style={[StyleSheet.absoluteFillObject, { backgroundColor: colors.secondary, alignItems: 'center', justifyContent: 'center' }]}>
              <Ionicons name="person" size={32} color={colors.mutedForeground} />
            </View>
          )}
          <View style={styles.storyShadeDark} />
          <View style={[styles.storyPlus, { backgroundColor: colors.action }]}><Ionicons name="add" size={16} color="#ffffff" /></View>
          <View style={styles.yourStoryCopy}><Text style={styles.storyName}>Your story</Text></View>
        </Pressable>
        {stories.map((story, index) => {
          const avatar = story.author.avatarObjectPath ? { uri: resolveRemoteMediaUrl(story.author.avatarObjectPath) } : undefined;
          const mediaUri = story.media?.objectPath ? resolveRemoteMediaUrl(story.media.objectPath) : undefined;
          return (
            <Pressable key={story.id} accessibilityRole="button" accessibilityLabel={`Watch ${story.author.name}'s story`} onPress={() => onOpen(index)} style={({ pressed }) => [styles.storyCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.82 : 1 }]}>
              {mediaUri && story.media?.type === 'video' ? (
                <StoryVideo uri={mediaUri} />
              ) : mediaUri ? (
                <Image source={{ uri: mediaUri }} style={styles.storyMedia} resizeMode="cover" />
              ) : (
                <View style={[styles.storyTextMedia, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.storyTextMark, { color: colors.mutedForeground }]}>“</Text>
                  <Text numberOfLines={4} style={[styles.storyTextContent, { color: colors.foreground }]}>{story.content || 'A moment from Old Time'}</Text>
                </View>
              )}
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={styles.storyShade} />
              <View style={styles.storyTopRow}>
                <View style={[styles.storyAvatarRing, { borderColor: colors.action }]}>
                  {avatar ? <Avatar source={avatar} size={30} /> : <View style={[styles.storyFallbackAvatar, { backgroundColor: colors.secondary }]}><Ionicons name="person" size={14} color={colors.mutedForeground} /></View>}
                </View>
              </View>
              <View style={styles.storyBottomCopy}>
                <Text numberOfLines={1} style={styles.storyName}>{story.author.name}</Text>
              </View>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

function StoryViewer({ stories, initialIndex, onClose }: { stories: Story[]; initialIndex: number; onClose: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [index, setIndex] = useState(initialIndex);
  const story = stories[index];
  if (!story) return null;
  const mediaUri = story.media?.objectPath ? resolveRemoteMediaUrl(story.media.objectPath) : undefined;
  const avatar = story.author.avatarObjectPath ? { uri: resolveRemoteMediaUrl(story.author.avatarObjectPath) } : undefined;
  
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.viewer, { backgroundColor: colors.foreground }]}>
        {mediaUri && story.media?.type === 'video' ? (
          <StoryVideo uri={mediaUri} style={styles.viewerMedia} />
        ) : mediaUri ? (
          <Image source={{ uri: mediaUri }} style={styles.viewerMedia} resizeMode="contain" />
        ) : (
          <View style={[styles.viewerText, { backgroundColor: colors.card }]}>
            <Text style={[styles.viewerQuote, { color: colors.foreground }]}>{story.content || 'A moment from Old Time'}</Text>
          </View>
        )}
        <LinearGradient colors={['rgba(0,0,0,0.6)', 'transparent', 'rgba(0,0,0,0.8)']} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
        
        <View style={[styles.viewerHeader, { paddingTop: insets.top + 12 }]}>
          <View style={styles.viewerProgress}>
            {stories.map((item) => <View key={item.id} style={[styles.viewerProgressTrack, { backgroundColor: item.id === story.id ? '#fff' : 'rgba(255,255,255,0.3)' }]} />)}
          </View>
          <View style={styles.viewerIdentity}>
            {avatar ? <Avatar source={avatar} size={36} /> : <View style={[styles.storyFallbackAvatar, { backgroundColor: colors.background }]}><Ionicons name="person" size={16} color={colors.foreground} /></View>}
            <Text style={styles.viewerName}>{story.author.name}</Text>
            <Pressable accessibilityRole="button" accessibilityLabel="Close story" onPress={onClose} style={styles.viewerClose}>
              <Ionicons name="close" size={28} color="#fff" />
            </Pressable>
          </View>
        </View>
        
        <View style={styles.viewerTapZones}>
          <Pressable accessibilityRole="button" accessibilityLabel="Previous story" onPress={() => setIndex((current) => Math.max(0, current - 1))} style={styles.viewerTapZone} />
          <Pressable accessibilityRole="button" accessibilityLabel="Next story" onPress={() => index >= stories.length - 1 ? onClose() : setIndex((current) => current + 1)} style={styles.viewerTapZone} />
        </View>
        
        {story.content ? (
          <View style={[styles.viewerCaption, { bottom: insets.bottom + 24 }]}>
            <Text style={styles.viewerCaptionText}>{story.content}</Text>
          </View>
        ) : null}
      </View>
    </Modal>
  );
}

const QUICK_ACTIONS = [
  { id: 'create', icon: 'add-circle-outline', label: 'Create', route: '/(tabs)/create' },
  { id: 'search', icon: 'search-outline', label: 'Search', route: '/(tabs)/discover' },
  { id: 'shop', icon: 'bag-handle-outline', label: 'Shop', route: '/shop' },
  { id: 'routes', icon: 'map-outline', label: 'Routes', route: '/routes' },
];

function QuickActionsRail() {
  const router = useRouter();
  const colors = useColors();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.quickActionRail}>
      {QUICK_ACTIONS.map((a) => (
        <Pressable key={a.id} style={[styles.quickActionChip, { backgroundColor: colors.secondary }]} onPress={() => router.push(a.route as never)}>
          <Ionicons name={a.icon as any} size={18} color={colors.foreground} />
          <Text style={[styles.quickActionText, { color: colors.foreground }]}>{a.label}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

export default function HomeScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { posts, users, profile, refreshFromServer, reportPost } = useOldTime();
  const router = useRouter();
  const [feed, setFeed] = useState<'forYou' | 'following' | 'map'>('forYou');
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [stories, setStories] = useState<Story[]>([]);
  const [selectedStoryIndex, setSelectedStoryIndex] = useState<number | null>(null);
  
  const followingIds = useMemo(() => users.filter((user) => user.isFollowing).map((user) => user.id), [users]);
  const visiblePosts = feed === 'forYou' ? posts : feed === 'following' ? posts.filter((post) => followingIds.includes(post.authorId)) : [];
  
  const feedOptions = [
    { key: 'forYou', label: 'For You' },
    { key: 'following', label: 'Following' },
    { key: 'map', label: 'Map' },
  ] as const;
  
  const selectedPost = posts.find((post) => post.id === selectedPostId);

  useEffect(() => {
    if (!profile?.id) return;
    void getStories().then((result) => setStories(result.items)).catch(() => setStories([]));
  }, [profile?.id]);
  
  const refresh = async () => {
    setRefreshing(true);
    try {
      await refreshFromServer();
      if (profile?.id) {
        const result = await getStories();
        setStories(result.items);
      }
    } finally {
      setRefreshing(false);
    }
  };
  
  const sharePost = async (post: Post) => {
    const message = post.mediaType === 'quote'
      ? `“${post.caption}”\n— @${post.handle} on Old Time`
      : `${post.caption ? `${post.caption}\n` : ''}Shared by @${post.handle} on Old Time`;
    try {
      await Share.share({ message });
    } catch {
      Alert.alert('Could not share', 'Please try again.');
    }
  };
  
  const reportPostFromFeed = (post: Post) => {
    Alert.alert('Report this post?', 'Choose a reason to send this to the Old Time moderation queue.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Spam', onPress: () => void reportPost(post.id, 'spam') },
      { text: 'Harassment', onPress: () => void reportPost(post.id, 'harassment') },
      { text: 'Other', onPress: () => void reportPost(post.id, 'other') },
    ]);
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 6, backgroundColor: colors.background }]}>
        <View style={styles.topLeft}>
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push('/(tabs)/profile')} style={styles.profileButton}>
            {profile?.avatar ? <Avatar source={profile.avatar} size={36} /> : <View style={[styles.profileFallback, { backgroundColor: colors.secondary }]}><Ionicons name="person" size={18} color={colors.mutedForeground} /></View>}
          </Pressable>
        </View>

        <View style={styles.feedSwitch}>
          {feedOptions.map((option) => {
            const selected = feed === option.key;
            return (
              <Pressable
                key={option.key}
                accessibilityRole="tab"
                accessibilityState={{ selected }}
                onPress={() => setFeed(option.key)}
                style={styles.feedTab}
              >
                 <Text style={[styles.feedSwitchText, { 
                   color: selected ? colors.foreground : colors.mutedForeground,
                   opacity: selected ? 1 : 0.6
                 }]}>{option.label}</Text>
                 {selected && <View style={[styles.switchLine, { backgroundColor: colors.action }]} />}
              </Pressable>
            );
          })}
        </View>

        <View style={styles.topRight}>
          <IconButton icon="notifications-outline" onPress={() => router.push('/notifications')} accessibilityLabel="Notifications" color={colors.foreground} size={24} />
          <IconButton icon="mail-outline" onPress={() => router.push('/(tabs)/inbox')} accessibilityLabel="Messages" color={colors.foreground} size={24} />
        </View>
      </View>
      
      <View style={styles.contentArea}>
        {feed === 'map' ? <MapExperience /> : (
          <FlatList
            data={visiblePosts}
            keyExtractor={(item) => item.id}
            renderItem={({ item }) => <PostCard post={item} onComments={() => setSelectedPostId(item.id)} onShare={() => void sharePost(item)} onReport={() => reportPostFromFeed(item)} />}
            contentContainerStyle={[styles.feedContent, { paddingBottom: TAB_BAR_CONTENT_CLEARANCE }]}
            ListHeaderComponent={
              feed === 'forYou' ? (
                <>
                  <QuickActionsRail />
                  <StoryRail stories={stories} profile={profile} onCreate={() => router.push('/(tabs)/create')} onOpen={setSelectedStoryIndex} />
                </>
              ) : null
            }
            showsVerticalScrollIndicator={false}
            refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
            ListEmptyComponent={
              <View style={styles.emptyFeed}>
                <Ionicons name="videocam-outline" size={48} color={colors.mutedForeground} />
                <Text style={[styles.emptyFeedTitle, { color: colors.mutedForeground }]}>No updates right now</Text>
              </View>
            }
          />
        )}
      </View>
      
      {selectedPost ? <CommentsModal post={selectedPost} onClose={() => setSelectedPostId(null)} /> : null}
      {selectedStoryIndex !== null ? <StoryViewer stories={stories} initialIndex={selectedStoryIndex} onClose={() => setSelectedStoryIndex(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  contentArea: { flex: 1 },
  topBar: { paddingHorizontal: 16, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topLeft: { flex: 1, alignItems: 'flex-start' },
  topRight: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 6 },
  profileButton: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  profileFallback: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  
  feedSwitch: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', flex: 2 },
  feedTab: { paddingHorizontal: 12, paddingVertical: 8, alignItems: 'center', position: 'relative' },
  feedSwitchText: { fontFamily: 'NunitoSans_700Bold', fontSize: 16 },
  switchLine: { position: 'absolute', bottom: -2, width: 20, height: 3, borderRadius: 2 },
  
  feedContent: { paddingHorizontal: 0, paddingTop: 12 }, // Edge to edge posts
  
  quickActionRail: { paddingHorizontal: 16, gap: 10, paddingBottom: 20 },
  quickActionChip: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 10, borderRadius: 24, gap: 6 },
  quickActionText: { fontFamily: 'NunitoSans_700Bold', fontSize: 14 },
  
  storyRail: { marginBottom: 24 },
  storyList: { gap: 12, paddingHorizontal: 16 },
  storyCard: { width: 104, height: 160, borderRadius: 18, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  yourStoryCard: { alignItems: 'center', justifyContent: 'center' },
  storyShadeDark: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.3)' },
  storyPlus: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', position: 'absolute', top: '50%', marginTop: -14, borderWidth: 2, borderColor: '#ffffff' },
  yourStoryCopy: { position: 'absolute', bottom: 12, alignItems: 'center', width: '100%' },
  storyMedia: { width: '100%', height: '100%' },
  storyTextMedia: { flex: 1, padding: 12, justifyContent: 'center' },
  storyTextMark: { fontFamily: 'NunitoSans_900Black', fontSize: 42, position: 'absolute', top: 8, left: 8, opacity: 0.2 },
  storyTextContent: { fontFamily: 'NunitoSans_700Bold', fontSize: 15, lineHeight: 20 },
  storyShade: { ...StyleSheet.absoluteFillObject },
  storyTopRow: { position: 'absolute', left: 8, top: 8 },
  storyAvatarRing: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, alignItems: 'center', justifyContent: 'center', backgroundColor: '#fff' },
  storyFallbackAvatar: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  storyBottomCopy: { position: 'absolute', left: 10, right: 10, bottom: 10 },
  storyName: { fontFamily: 'NunitoSans_700Bold', fontSize: 13, color: '#ffffff' },
  
  viewer: { flex: 1, position: 'relative', justifyContent: 'center' },
  viewerMedia: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  viewerText: { margin: 24, minHeight: 360, borderRadius: 26, padding: 28, justifyContent: 'center' },
  viewerQuote: { fontFamily: 'NunitoSans_900Black', fontSize: 32, lineHeight: 40 },
  viewerHeader: { position: 'absolute', left: 14, right: 14, top: 0 },
  viewerProgress: { flexDirection: 'row', gap: 4, marginBottom: 16 },
  viewerProgressTrack: { flex: 1, height: 3, borderRadius: 2 },
  viewerIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  viewerName: { color: '#ffffff', fontFamily: 'NunitoSans_700Bold', fontSize: 16, flex: 1 },
  viewerClose: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  viewerTapZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  viewerTapZone: { flex: 1 },
  viewerCaption: { position: 'absolute', left: 24, right: 24 },
  viewerCaptionText: { color: '#ffffff', fontFamily: 'NunitoSans_600SemiBold', fontSize: 16, lineHeight: 24, textAlign: 'center' },
  
  emptyFeed: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },
  emptyFeedTitle: { fontFamily: 'NunitoSans_700Bold', fontSize: 18, marginTop: 16 },
});
