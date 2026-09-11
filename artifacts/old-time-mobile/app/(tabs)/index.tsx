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
      <View style={styles.storyRailHeader}>
        <Text style={[styles.storyRailTitle, { color: colors.homeForeground }]}>Stories</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.storyList}>
        <Pressable accessibilityRole="button" accessibilityLabel="Create a story" onPress={onCreate} style={({ pressed }) => [styles.storyCard, styles.yourStoryCard, { backgroundColor: colors.card, borderColor: colors.homeBorder, opacity: pressed ? 0.78 : 1 }]}>
          {profile?.avatar ? <Avatar source={profile.avatar} size={48} accent={profile.accent} /> : <View style={[styles.yourStoryAvatar, { backgroundColor: colors.homeForeground }]}><Ionicons name="person" size={18} color={colors.homeBackground} /></View>}
          <View style={[styles.storyPlus, { backgroundColor: colors.homeForeground }]}><Ionicons name="add" size={12} color={colors.homeBackground} /></View>
          <View style={styles.yourStoryCopy}><Text style={[styles.storyName, { color: colors.homeForeground }]}>Your story</Text></View>
        </Pressable>
        {stories.map((story, index) => {
          const avatar = story.author.avatarObjectPath ? { uri: resolveRemoteMediaUrl(story.author.avatarObjectPath) } : undefined;
          const mediaUri = story.media?.objectPath ? resolveRemoteMediaUrl(story.media.objectPath) : undefined;
          return (
            <Pressable key={story.id} accessibilityRole="button" accessibilityLabel={`Watch ${story.author.name}'s story`} onPress={() => onOpen(index)} style={({ pressed }) => [styles.storyCard, { backgroundColor: colors.card, borderColor: colors.homeBorder, opacity: pressed ? 0.82 : 1 }]}>
              {mediaUri && story.media?.type === 'video' ? <StoryVideo uri={mediaUri} /> : mediaUri ? <Image source={{ uri: mediaUri }} style={styles.storyMedia} resizeMode="cover" /> : <View style={[styles.storyTextMedia, { backgroundColor: colors.card }]}><Text style={[styles.storyTextMark, { color: colors.homeForeground }]}>“</Text><Text numberOfLines={4} style={[styles.storyTextContent, { color: colors.homeForeground }]}>{story.content || 'A moment from Old Time'}</Text></View>}
              <LinearGradient colors={['transparent', 'rgba(0,0,0,0.72)']} style={styles.storyShade} />
              <View style={styles.storyTopRow}><View style={styles.storyAvatarRing}>{avatar ? <Avatar source={avatar} size={34} /> : <View style={[styles.storyFallbackAvatar, { backgroundColor: colors.homeForeground }]}><Ionicons name="person" size={16} color={colors.homeBackground} /></View>}</View><View style={styles.storyLiveDot} /></View>
              <View style={styles.storyBottomCopy}><Text numberOfLines={1} style={styles.storyName}>{story.author.name}</Text>{story.content && story.media ? <Text numberOfLines={2} style={styles.storyCaption}>{story.content}</Text> : null}</View>
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
      <View style={[styles.viewer, { backgroundColor: colors.homeForeground }]}>
        {mediaUri && story.media?.type === 'video' ? <StoryVideo uri={mediaUri} style={styles.viewerMedia} /> : mediaUri ? <Image source={{ uri: mediaUri }} style={styles.viewerMedia} resizeMode="contain" /> : <View style={[styles.viewerText, { backgroundColor: colors.card }]}><Text style={[styles.viewerQuote, { color: colors.homeForeground }]}>{story.content || 'A moment from Old Time'}</Text></View>}
        <LinearGradient colors={['rgba(0,0,0,0.58)', 'transparent', 'rgba(0,0,0,0.68)']} locations={[0, 0.3, 1]} style={StyleSheet.absoluteFillObject} pointerEvents="none" />
        <View style={[styles.viewerHeader, { paddingTop: insets.top + 12 }]}>
          <View style={styles.viewerProgress}>{stories.map((item) => <View key={item.id} style={[styles.viewerProgressTrack, { backgroundColor: item.id === story.id ? colors.homeBackground : 'rgba(255,255,255,0.38)' }]} />)}</View>
          <View style={styles.viewerIdentity}>{avatar ? <Avatar source={avatar} size={36} /> : <View style={[styles.storyFallbackAvatar, { backgroundColor: colors.homeBackground }]}><Ionicons name="person" size={16} color={colors.homeForeground} /></View>}<Text style={styles.viewerName}>{story.author.name}</Text><Pressable accessibilityRole="button" accessibilityLabel="Close story" onPress={onClose} style={styles.viewerClose}><Ionicons name="close" size={25} color={colors.homeBackground} /></Pressable></View>
        </View>
        <View style={styles.viewerTapZones}><Pressable accessibilityRole="button" accessibilityLabel="Previous story" onPress={() => setIndex((current) => Math.max(0, current - 1))} style={styles.viewerTapZone} /><Pressable accessibilityRole="button" accessibilityLabel="Next story" onPress={() => index >= stories.length - 1 ? onClose() : setIndex((current) => current + 1)} style={styles.viewerTapZone} /></View>
        {story.content ? <View style={[styles.viewerCaption, { bottom: insets.bottom + 24 }]}><Text style={styles.viewerCaptionText}>{story.content}</Text></View> : null}
      </View>
    </Modal>
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
    { key: 'forYou', label: 'For you' },
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
    <View style={[styles.screen, { backgroundColor: colors.homeBackground }]}>
      <View style={[styles.topBar, { paddingTop: insets.top + 6, backgroundColor: colors.homeBackground }]}>
        <View style={styles.topLeading}>
          <Pressable accessibilityRole="button" accessibilityLabel="Open Shop" onPress={() => router.push('/shop' as never)} style={[styles.shopButton, { borderColor: colors.homeBorder }]}>
            <Ionicons name="bag-handle-outline" size={15} color={colors.homeForeground} />
            <Text style={[styles.shopButtonText, { color: colors.homeForeground }]}>Shop</Text>
          </Pressable>
          <IconButton icon="map-outline" onPress={() => router.push('/routes' as never)} accessibilityLabel="Open Routes" color={colors.homeForeground} size={21} />
          <IconButton icon="albums-outline" onPress={() => router.push('/(tabs)/create')} accessibilityLabel="Open album" color={colors.homeForeground} size={23} />
        </View>
        <View style={styles.topActions}>
          <IconButton icon="search-outline" onPress={() => router.push('/(tabs)/discover')} accessibilityLabel="Search" color={colors.homeForeground} />
          <IconButton icon="mail-outline" onPress={() => router.push('/(tabs)/inbox')} accessibilityLabel="Messages" color={colors.homeForeground} />
           <IconButton icon="notifications-outline" onPress={() => router.push('/notifications')} accessibilityLabel="Notifications" color={colors.homeForeground} />
          <Pressable accessibilityRole="button" accessibilityLabel="Open profile" onPress={() => router.push('/(tabs)/profile')} style={styles.profileButton}>
            {profile?.avatar ? <Avatar source={profile.avatar} size={36} /> : <View style={[styles.profileFallback, { backgroundColor: colors.homeForeground }]}><Ionicons name="person" size={18} color={colors.homeBackground} /></View>}
          </Pressable>
        </View>
      </View>
        <View style={[styles.feedSwitch, { borderBottomColor: colors.homeBorder }]}>
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
                 <Text style={[styles.feedSwitchText, { color: selected ? colors.homeForeground : colors.homeMutedForeground }]}>{option.label}</Text>
                 <View style={[styles.switchLine, { backgroundColor: selected ? colors.homeForeground : 'transparent', width: selected ? 28 : 0 }]} />
              </Pressable>
            );
          })}
        </View>
      <View style={styles.contentArea}>
        {feed === 'map' ? <MapExperience /> : <FlatList
          data={visiblePosts}
          keyExtractor={(item) => item.id}
           renderItem={({ item }) => <PostCard post={item} onComments={() => setSelectedPostId(item.id)} onShare={() => void sharePost(item)} onReport={() => reportPostFromFeed(item)} />}
           contentContainerStyle={[styles.feedContent, { paddingBottom: TAB_BAR_CONTENT_CLEARANCE }]}
           ListHeaderComponent={feed === 'forYou' ? <StoryRail stories={stories} profile={profile} onCreate={() => router.push('/(tabs)/create')} onOpen={setSelectedStoryIndex} /> : null}
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.primary} />}
           ListEmptyComponent={<View style={styles.emptyFeed}><Ionicons name="videocam-outline" size={38} color={colors.homeMutedForeground} /><Text style={[styles.emptyFeedTitle, { color: colors.homeMutedForeground }]}>No updates right now</Text></View>}
        />}
      </View>
      {selectedPost ? <CommentsModal post={selectedPost} onClose={() => setSelectedPostId(null)} /> : null}
      {selectedStoryIndex !== null ? <StoryViewer stories={stories} initialIndex={selectedStoryIndex} onClose={() => setSelectedStoryIndex(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  contentArea: { flex: 1 },
  topBar: { paddingHorizontal: 18, paddingBottom: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topLeading: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  shopButton: { height: 30, borderRadius: 15, borderWidth: 1, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 4 },
  shopButtonText: { fontFamily: 'Outfit_700Bold', fontSize: 12 },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  profileButton: { minWidth: 42, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  profileFallback: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  feedSwitch: { flexDirection: 'row', paddingHorizontal: 16, borderBottomWidth: StyleSheet.hairlineWidth },
  feedTab: { flex: 1, alignItems: 'center' },
  feedSwitchText: { fontFamily: 'Outfit_700Bold', fontSize: 16, paddingVertical: 14 },
  switchLine: { height: 3, borderRadius: 3 },
  feedContent: { paddingHorizontal: 16, paddingTop: 18 },
  storyRail: { marginBottom: 18 },
  storyRailHeader: { flexDirection: 'row', alignItems: 'baseline', marginBottom: 10 },
  storyRailTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 20 },
  storyList: { gap: 10, paddingRight: 4 },
  storyCard: { width: 94, height: 158, borderRadius: 14, borderWidth: 1, overflow: 'hidden', position: 'relative' },
  yourStoryCard: { alignItems: 'center', justifyContent: 'center', paddingTop: 10 },
  yourStoryAvatar: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  storyPlus: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', position: 'absolute', top: 55, right: 18, borderWidth: 2, borderColor: '#ffffff' },
  yourStoryCopy: { alignItems: 'center', marginTop: 14 },
  storyMedia: { width: '100%', height: '100%' },
  storyTextMedia: { flex: 1, padding: 16, justifyContent: 'center' },
  storyTextMark: { fontFamily: 'Fraunces_900Black', fontSize: 54, lineHeight: 48 },
  storyTextContent: { fontFamily: 'Fraunces_700Bold', fontSize: 17, lineHeight: 23 },
  storyShade: { ...StyleSheet.absoluteFillObject },
  storyTopRow: { position: 'absolute', left: 8, right: 8, top: 8, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  storyAvatarRing: { width: 34, height: 34, borderRadius: 17, borderWidth: 2, borderColor: '#ffffff', alignItems: 'center', justifyContent: 'center' },
  storyFallbackAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  storyLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#ffffff' },
  storyBottomCopy: { position: 'absolute', left: 9, right: 9, bottom: 9 },
  storyName: { fontFamily: 'Outfit_700Bold', fontSize: 12, color: '#ffffff' },
  storyCaption: { fontFamily: 'Outfit_500Medium', fontSize: 10, lineHeight: 13, color: '#ffffff', marginTop: 2 },
  viewer: { flex: 1, position: 'relative', justifyContent: 'center' },
  viewerMedia: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  viewerText: { margin: 24, minHeight: 360, borderRadius: 26, padding: 28, justifyContent: 'center' },
  viewerQuote: { fontFamily: 'Fraunces_700Bold', fontSize: 30, lineHeight: 39 },
  viewerHeader: { position: 'absolute', left: 14, right: 14, top: 0 },
  viewerProgress: { flexDirection: 'row', gap: 4, marginBottom: 12 },
  viewerProgressTrack: { flex: 1, height: 3, borderRadius: 2 },
  viewerIdentity: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  viewerName: { color: '#ffffff', fontFamily: 'Outfit_700Bold', fontSize: 15, flex: 1 },
  viewerClose: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  viewerTapZones: { ...StyleSheet.absoluteFillObject, flexDirection: 'row' },
  viewerTapZone: { flex: 1 },
  viewerCaption: { position: 'absolute', left: 22, right: 22 },
  viewerCaptionText: { color: '#ffffff', fontFamily: 'Outfit_600SemiBold', fontSize: 16, lineHeight: 23, textAlign: 'center' },
  emptyFeed: { alignItems: 'center', paddingTop: 80, paddingHorizontal: 24 },
  emptyFeedTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 18, marginTop: 16 },
});