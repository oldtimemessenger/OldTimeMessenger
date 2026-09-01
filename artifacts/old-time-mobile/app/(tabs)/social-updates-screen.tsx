import { Ionicons } from '@expo/vector-icons';
import { useCreateChat, useRequestUploadUrl } from '@workspace/api-client-react';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  Share,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, EmptyState, IconButton, Screen } from '@/components/ui';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';
import {
  createPostComment,
  createSocialPost,
  deletePostComment,
  getPostComments,
  getSocialFeed,
  getUserCard,
  reportSocialContent,
  searchSocial,
  setCommentLike,
  setFollowing,
  setPostRelation,
  setUserBlocked,
  setUserMuted,
  socialMediaUrl,
  createStory,
  getStories,
  getStoryViewers,
  reactToStory,
  replyToStory,
  viewStory,
  type Story,
  type SearchResults,
  type SocialComment,
  type SocialPost,
  type UserCard,
} from '@/lib/social-api';
import { VideoSurface } from '@/components/video-surface';

type FeedMode = 'for-you' | 'following';

function relativeTime(timestamp: number) {
  const seconds = Math.max(1, Math.floor((Date.now() - timestamp) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function errorText(error: unknown) {
  return error instanceof Error ? error.message : 'Something went wrong.';
}

export default function SocialUpdatesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { session } = useApp();
  const createChat = useCreateChat();
  const [mode, setMode] = useState<FeedMode>('for-you');
  const [posts, setPosts] = useState<SocialPost[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composeOpen, setComposeOpen] = useState(false);
  const [commentPost, setCommentPost] = useState<SocialPost | null>(null);
  const [cardUserId, setCardUserId] = useState<number | null>(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [stories, setStories] = useState<Story[]>([]);
  const [storyOpen, setStoryOpen] = useState<Story | null>(null);
  const [storyComposeOpen, setStoryComposeOpen] = useState(false);

  const token = session?.authToken ?? '';

  const loadFeed = useCallback(
    async (reset: boolean) => {
      if (!token) return;
      reset ? setRefreshing(true) : setLoadingMore(true);
      setError(null);
      try {
        const page = await getSocialFeed(token, mode, reset ? null : nextCursor);
        setPosts((current) => (reset ? page.items : [...current, ...page.items]));
        setNextCursor(page.nextCursor);
      } catch (requestError) {
        setError(errorText(requestError));
      } finally {
        reset ? setRefreshing(false) : setLoadingMore(false);
        setLoading(false);
      }
    },
    [mode, nextCursor, token],
  );

  useEffect(() => {
    setLoading(true);
    setPosts([]);
    setNextCursor(null);
    if (token) void getSocialFeed(token, mode).then((page) => {
      setPosts(page.items);
      setNextCursor(page.nextCursor);
      setError(null);
    }).catch((requestError) => setError(errorText(requestError))).finally(() => setLoading(false));
  }, [mode, token]);
  useEffect(() => {
    if (!token) return;
    void getStories(token).then((page) => setStories(page.items)).catch(() => setStories([]));
  }, [token]);
  useEffect(() => {
    if (storyOpen && token && !storyOpen.viewer.isOwner) void viewStory(token, storyOpen.id);
  }, [storyOpen, token]);

  function updatePost(postId: number, update: (post: SocialPost) => SocialPost) {
    setPosts((current) => current.map((post) => (post.id === postId ? update(post) : post)));
    setCommentPost((current) => current?.id === postId ? update(current) : current);
  }

  async function toggleRelation(post: SocialPost, relation: 'like' | 'repost' | 'save') {
    if (!token) return;
    const field = relation === 'like' ? 'liked' : relation === 'repost' ? 'reposted' : 'saved';
    const countField = relation === 'like' ? 'likes' : relation === 'repost' ? 'reposts' : 'saves';
    const active = !post.viewer[field];
    updatePost(post.id, (current) => ({
      ...current,
      viewer: { ...current.viewer, [field]: active },
      counts: {
        ...current.counts,
        [countField]: Math.max(0, current.counts[countField] + (active ? 1 : -1)),
      },
    }));
    try {
      await setPostRelation(token, post.id, relation, active);
    } catch (requestError) {
      updatePost(post.id, (current) => ({
        ...current,
        viewer: { ...current.viewer, [field]: !active },
        counts: {
          ...current.counts,
          [countField]: Math.max(0, current.counts[countField] + (active ? -1 : 1)),
        },
      }));
      Alert.alert('Action not saved', errorText(requestError));
    }
  }

  async function toggleFollow(post: SocialPost) {
    if (!token || post.author.id === session?.id) return;
    const following = !post.viewer.followingAuthor;
    setPosts((current) => current.map((item) =>
      item.author.id === post.author.id
        ? { ...item, viewer: { ...item.viewer, followingAuthor: following } }
        : item,
    ));
    try {
      await setFollowing(token, post.author.id, following);
      if (mode === 'following' && !following) {
        setPosts((current) => current.filter((item) => item.author.id !== post.author.id));
      }
    } catch (requestError) {
      setPosts((current) => current.map((item) =>
        item.author.id === post.author.id
          ? { ...item, viewer: { ...item.viewer, followingAuthor: !following } }
          : item,
      ));
      Alert.alert('Follow not saved', errorText(requestError));
    }
  }

  async function publish(input: {
    content: string; visibility: SocialPost['visibility']; kind: SocialPost['kind'];
    media?: SocialPost['media']; linkUrl?: string | null; linkTitle?: string | null; linkDescription?: string | null;
  }) {
    if (!token) return;
    const created = await createSocialPost(token, input);
    setPosts((current) => [created, ...current]);
  }

  function reportPost(post: SocialPost) {
    Alert.alert('Report post', 'Choose a reason.', [
      { text: 'Cancel', style: 'cancel' },
      ...([
        ['Spam', 'spam'],
        ['Harassment', 'harassment'],
        ['Hate', 'hate'],
        ['Violence', 'violence'],
        ['Misinformation', 'misinformation'],
        ['Copyright', 'copyright'],
      ] as const).map(([label, reason]) => ({
        text: label,
        onPress: () => void reportSocialContent(token, {
          targetType: 'post',
          targetId: post.id,
          reason,
        }).then(() => Alert.alert('Report received', 'Thank you. The post was sent for review.')).catch((requestError) => Alert.alert('Could not report', errorText(requestError))),
      })),
    ]);
  }

  function morePost(post: SocialPost) {
    Alert.alert('Post options', undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Hide from this feed',
        onPress: () => setPosts((current) => current.filter((item) => item.id !== post.id)),
      },
      {
        text: 'Mute this user',
        onPress: () => void setUserMuted(token, post.author.id, true)
          .then(() => setPosts((current) => current.filter((item) => item.author.id !== post.author.id)))
          .catch((requestError) => Alert.alert('Could not mute', errorText(requestError))),
      },
      { text: 'Report', onPress: () => reportPost(post) },
    ]);
  }

  const header = (
    <>
      <View style={[styles.tabs, { borderBottomColor: colors.border }]}>
        {(['for-you', 'following'] as FeedMode[]).map((item) => (
          <Pressable
            key={item}
            onPress={() => setMode(item)}
            style={[styles.tab, mode === item && { borderBottomColor: colors.primary }]}
          >
            <Text style={[styles.tabText, { color: mode === item ? colors.foreground : colors.mutedForeground }]}>
              {item === 'for-you' ? 'For You' : 'Following'}
            </Text>
          </Pressable>
        ))}
      </View>
      <StoryRail stories={stories} colors={colors} onCreate={() => setStoryComposeOpen(true)} onOpen={setStoryOpen} />
      {error ? (
        <Pressable onPress={() => void loadFeed(true)} style={[styles.errorBar, { backgroundColor: colors.muted }]}>
          <Ionicons name="cloud-offline-outline" size={18} color={colors.destructive} />
          <Text style={{ color: colors.foreground, flex: 1 }}>{error}</Text>
          <Text style={{ color: colors.primary, fontWeight: '700' }}>Retry</Text>
        </Pressable>
      ) : null}
    </>
  );

  return (
    <Screen
      title="Updates"
      right={(
        <View style={styles.headerActions}>
          <IconButton name="search-outline" label="Search Updates" onPress={() => setSearchOpen(true)} />
          <IconButton name="create-outline" label="Create post" onPress={() => setComposeOpen(true)} />
        </View>
      )}
    >
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={colors.primary} /></View>
      ) : (
        <FlatList
          data={posts}
          keyExtractor={(item) => String(item.id)}
          ListHeaderComponent={header}
          renderItem={({ item }) => (
            <PostCard
              post={item}
              token={token}
              isOwn={item.author.id === session?.id}
              colors={colors}
              onOpenUser={() => setCardUserId(item.author.id)}
              onFollow={() => void toggleFollow(item)}
              onLike={() => void toggleRelation(item, 'like')}
              onComment={() => setCommentPost(item)}
              onRepost={() => void toggleRelation(item, 'repost')}
              onSave={() => void toggleRelation(item, 'save')}
              onMore={() => morePost(item)}
            />
          )}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void loadFeed(true)} tintColor={colors.primary} />}
          onEndReached={() => {
            if (nextCursor && !loadingMore) void loadFeed(false);
          }}
          onEndReachedThreshold={0.4}
          ListFooterComponent={loadingMore ? <ActivityIndicator style={{ padding: 20 }} color={colors.primary} /> : <View style={{ height: 110 }} />}
          ListEmptyComponent={(
            <EmptyState
              icon={mode === 'following' ? 'people-outline' : 'newspaper-outline'}
              title={mode === 'following' ? 'Your Following feed is quiet' : 'No posts yet'}
              description={mode === 'following' ? 'Follow people from their compact user card to see posts here.' : 'Start the first conversation with a new post.'}
              action={<Pressable onPress={() => setComposeOpen(true)}><Text style={{ color: colors.primary, fontWeight: '700' }}>Create post</Text></Pressable>}
            />
          )}
        />
      )}

      <ComposeSheet visible={composeOpen} token={token} colors={colors} onClose={() => setComposeOpen(false)} onPublish={publish} />
      <StoryComposeSheet visible={storyComposeOpen} token={token} colors={colors} onClose={() => setStoryComposeOpen(false)} onPublish={async (content, visibility, media) => {
        const created = await createStory(token, { content, visibility, media });
        setStories((current) => [created, ...current]);
      }} />
      <StoryViewer story={storyOpen} token={token} colors={colors} onClose={() => setStoryOpen(null)} />
      <CommentsSheet
        post={commentPost}
        token={token}
        viewerId={session?.id ?? 0}
        colors={colors}
        onClose={() => setCommentPost(null)}
        onCountChange={(delta) => commentPost && updatePost(commentPost.id, (post) => ({
          ...post,
          counts: { ...post.counts, comments: Math.max(0, post.counts.comments + delta) },
        }))}
        onOpenUser={(id) => setCardUserId(id)}
      />
      <UserCardSheet
        userId={cardUserId}
        token={token}
        viewerId={session?.id ?? 0}
        colors={colors}
        onClose={() => setCardUserId(null)}
        onFollowChange={(userId, following) => setPosts((current) => current.map((post) =>
          post.author.id === userId ? { ...post, viewer: { ...post.viewer, followingAuthor: following } } : post,
        ))}
        onMessage={(userId) => {
          if (!session) return;
          createChat.mutate({ data: { userIds: [session.id, userId] } }, {
            onSuccess: (chat) => {
              setCardUserId(null);
              router.push(`/chat/${chat.id}`);
            },
            onError: (requestError) => Alert.alert('Could not open chat', errorText(requestError)),
          });
        }}
        onBlocked={(userId) => setPosts((current) => current.filter((post) => post.author.id !== userId))}
      />
      <SearchSheet
        visible={searchOpen}
        token={token}
        colors={colors}
        onClose={() => setSearchOpen(false)}
        onOpenUser={(id) => {
          setSearchOpen(false);
          setCardUserId(id);
        }}
        onOpenPost={(post) => {
          setSearchOpen(false);
          setCommentPost(post);
        }}
      />
    </Screen>
  );
}

function StoryRail({ stories, colors, onCreate, onOpen }: { stories: Story[]; colors: any; onCreate: () => void; onOpen: (story: Story) => void }) {
  return <FlatList horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ padding: 12, gap: 12 }}
    data={[null, ...stories]} keyExtractor={(item, index) => item ? String(item.id) : `add-${index}`}
    renderItem={({ item }) => item ? <Pressable onPress={() => onOpen(item)} style={{ width: 66, alignItems: 'center' }}>
      <View style={{ width: 58, height: 58, borderRadius: 29, borderWidth: 2, borderColor: item.viewer.viewed ? colors.border : colors.primary, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.muted }}><Avatar name={item.author.name} size={50} /></View>
      <Text numberOfLines={1} style={{ color: colors.foreground, fontSize: 11, marginTop: 4 }}>{item.author.name}</Text>
    </Pressable> : <Pressable onPress={onCreate} style={{ width: 66, alignItems: 'center' }}><View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: colors.muted, alignItems: 'center', justifyContent: 'center' }}><Ionicons name="add" size={28} color={colors.primary} /></View><Text style={{ color: colors.foreground, fontSize: 11, marginTop: 4 }}>Your story</Text></Pressable>} />;
}

function StoryComposeSheet({ visible, token, colors, onClose, onPublish }: { visible: boolean; token: string; colors: any; onClose: () => void; onPublish: (content: string, visibility: Story['visibility'], media?: Story['media']) => Promise<void> }) {
  const requestUploadUrl = useRequestUploadUrl();
  const [content, setContent] = useState(''); const [visibility, setVisibility] = useState<Story['visibility']>('friends'); const [saving, setSaving] = useState(false);
  const [asset, setAsset] = useState<{ uri: string; name: string; mimeType: string; size: number; type: 'image' | 'video'; width?: number; height?: number; duration?: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  async function selectMedia() {
    if (saving) return;
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.9, selectionLimit: 1 });
      if (result.canceled) return;
      const picked = result.assets[0];
      setAsset({ uri: picked.uri, name: picked.fileName ?? `story-${Date.now()}.${picked.type === 'video' ? 'mp4' : 'jpg'}`, mimeType: picked.mimeType ?? (picked.type === 'video' ? 'video/mp4' : 'image/jpeg'), size: picked.fileSize ?? 1, type: picked.type === 'video' ? 'video' : 'image', width: picked.width, height: picked.height, duration: picked.duration ?? undefined });
    } catch (cause) { setError(errorText(cause)); }
  }
  async function publish() {
    if ((!content.trim() && !asset) || saving) return;
    setSaving(true); setError(null);
    try {
      let media: Story['media'] | undefined;
      if (asset) {
        const localFile = new File(asset.uri);
        const upload = await requestUploadUrl.mutateAsync({ data: { name: asset.name, size: Math.max(1, asset.size || localFile.size || 1), contentType: asset.mimeType } });
        const domain = process.env.EXPO_PUBLIC_DOMAIN;
        const uploadUrl = upload.uploadURL.startsWith('/') && domain ? `https://${domain}${upload.uploadURL}` : upload.uploadURL;
        const response = await expoFetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': asset.mimeType, Authorization: `Bearer ${token}` }, body: localFile });
        if (!response.ok) throw new Error(`Upload failed (${response.status}).`);
        media = { type: asset.type, objectPath: upload.objectPath, mimeType: asset.mimeType, width: asset.width, height: asset.height, duration: asset.duration };
      }
      await onPublish(content.trim(), visibility, media);
      setContent(''); setAsset(null); onClose();
    } catch (cause) { setError(errorText(cause)); } finally { setSaving(false); }
  }
  return <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}><View style={[styles.modalPage, { backgroundColor: colors.background, padding: 20 }]}><View style={styles.modalHeader}><IconButton name="close" onPress={onClose} /><Text style={[styles.modalTitle, { color: colors.foreground }]}>New story</Text><Pressable disabled={(!content.trim() && !asset) || saving} onPress={() => void publish()}><Text style={{ color: colors.primary, fontWeight: '700', opacity: (!content.trim() && !asset) || saving ? 0.4 : 1 }}>{saving ? (asset ? 'Uploading…' : 'Sharing…') : 'Share'}</Text></Pressable></View><TextInput autoFocus multiline maxLength={2000} value={content} onChangeText={setContent} placeholder="Share a moment" placeholderTextColor={colors.mutedForeground} style={[styles.composer, { color: colors.foreground }]} /><Pressable disabled={saving} onPress={() => void selectMedia()} style={{ paddingVertical: 12 }}><Text style={{ color: colors.primary, fontWeight: '700' }}>{asset ? 'Change photo or video' : 'Add photo or video'}</Text></Pressable>{asset ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>{asset.type === 'image' ? <Image source={{ uri: asset.uri }} style={{ width: 54, height: 54, borderRadius: 8 }} contentFit="cover" /> : <Ionicons name="videocam-outline" size={30} color={colors.primary} />}<Text style={{ color: colors.foreground, flex: 1 }} numberOfLines={1}>{asset.name}</Text><IconButton name="close-circle" label="Remove attachment" onPress={() => setAsset(null)} /></View> : null}{error ? <Text style={{ color: colors.destructive, marginBottom: 10 }}>{error}</Text> : null}<View style={styles.audienceRow}>{(['friends', 'followers', 'public', 'close_friends', 'private'] as Story['visibility'][]).map((value) => <Pressable key={value} disabled={saving} onPress={() => setVisibility(value)} style={[styles.audience, { backgroundColor: visibility === value ? colors.primary : colors.muted }]}><Text style={{ color: visibility === value ? '#fff' : colors.foreground, fontSize: 11 }}>{value.replace('_', ' ')}</Text></Pressable>)}</View></View></Modal>;
}

function StoryViewer({ story, token, colors, onClose }: { story: Story | null; token: string; colors: any; onClose: () => void }) {
  const [reply, setReply] = useState('');
  if (!story) return null;
  const storyId = story.id;
  async function sendReply() { if (!reply.trim()) return; try { await replyToStory(token, storyId, reply.trim()); setReply(''); } catch (error) { Alert.alert('Could not reply', errorText(error)); } }
  const media = story.media;
  return <Modal visible transparent animationType="fade" onRequestClose={onClose}>
    <View style={{ flex: 1, backgroundColor: '#111', padding: 20, justifyContent: 'space-between' }}>
      <View><View style={{ height: 3, backgroundColor: colors.primary, borderRadius: 2, marginBottom: 16 }} /><View style={{ flexDirection: 'row', justifyContent: 'space-between' }}><Text style={{ color: '#fff', fontWeight: '700' }}>{story.author.name}</Text><IconButton name="close" color="#fff" onPress={onClose} /></View></View>
      <Pressable onPress={onClose} style={{ flex: 1, justifyContent: 'center' }}>
        {media?.type === 'image' ? <Image source={{ uri: socialMediaUrl(media.objectPath), headers: { Authorization: `Bearer ${token}` } }} style={{ height: 380, borderRadius: 16 }} contentFit="contain" /> : media?.type === 'video' ? <VideoSurface source={{ uri: socialMediaUrl(media.objectPath), headers: { Authorization: `Bearer ${token}` } }} style={{ height: 380, borderRadius: 16 }} /> : <Text style={{ color: '#fff', fontSize: 24, textAlign: 'center' }}>{story.content}</Text>}
      </Pressable>
      <View>{story.viewer.isOwner ? <Pressable onPress={() => void getStoryViewers(token, storyId).then(({ items }) => Alert.alert('Viewed by', items.length ? items.map((item) => item.name).join('\n') : 'No viewers yet')).catch((error) => Alert.alert('Could not load viewers', errorText(error)))}><Text style={{ color: '#fff', marginBottom: 10 }}>{story.counts.views} views</Text></Pressable> : null}<TextInput value={reply} onChangeText={setReply} placeholder="Send a reply" placeholderTextColor="#aaa" style={{ color: '#fff', borderColor: '#777', borderWidth: 1, borderRadius: 20, padding: 12 }} onSubmitEditing={() => void sendReply()} /><Pressable onPress={() => void reactToStory(token, storyId, '❤️')} style={{ alignSelf: 'center', padding: 10 }}><Text style={{ color: '#fff', fontSize: 24 }}>♥</Text></Pressable></View>
    </View>
  </Modal>;
}

function PostCard({ post, token, isOwn, colors, onOpenUser, onFollow, onLike, onComment, onRepost, onSave, onMore }: {
  post: SocialPost;
  token: string;
  isOwn: boolean;
  colors: any;
  onOpenUser: () => void;
  onFollow: () => void;
  onLike: () => void;
  onComment: () => void;
  onRepost: () => void;
  onSave: () => void;
  onMore: () => void;
}) {
  const media = post.media[0];
  const imageUrl = media?.type === 'image' ? socialMediaUrl(media.objectPath) : post.linkImageUrl;
  return (
    <View style={[styles.post, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
      <View style={styles.postHeader}>
        <Pressable onPress={onOpenUser}><Avatar name={post.author.name} size={42} /></Pressable>
        <Pressable onPress={onOpenUser} style={{ flex: 1 }}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.foreground }]} numberOfLines={1}>{post.author.name}</Text>
            <Text style={[styles.handle, { color: colors.mutedForeground }]} numberOfLines={1}>@{post.author.username}</Text>
            <Text style={[styles.handle, { color: colors.mutedForeground }]}>· {relativeTime(post.createdAt)}</Text>
          </View>
          <Text style={[styles.visibility, { color: colors.mutedForeground }]}>
            {post.visibility === 'public' ? 'Everyone' : post.visibility[0].toUpperCase() + post.visibility.slice(1)}
          </Text>
        </Pressable>
        {!isOwn && !post.viewer.followingAuthor ? (
          <Pressable onPress={onFollow} style={[styles.followSmall, { borderColor: colors.primary }]}>
            <Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Follow</Text>
          </Pressable>
        ) : null}
        <IconButton name="ellipsis-horizontal" label="Post options" onPress={onMore} size={20} />
      </View>
      {post.news ? (
        <View style={[styles.newsLabel, { backgroundColor: colors.muted }]}>
          <Ionicons name="newspaper-outline" size={15} color={colors.primary} />
          <Text style={{ color: colors.foreground, fontWeight: '700' }}>{post.news.source}</Text>
          {post.news.publishedAt ? <Text style={{ color: colors.mutedForeground }}>{relativeTime(post.news.publishedAt)}</Text> : null}
        </View>
      ) : null}
      {post.content ? <Text style={[styles.postText, { color: colors.foreground }]}>{post.content}</Text> : null}
      {media?.type === 'video' ? (
        <VideoSurface source={{ uri: socialMediaUrl(media.objectPath), headers: { Authorization: `Bearer ${token}` } }} style={styles.media} muted paused />
      ) : imageUrl ? (
        <Image
          source={{ uri: imageUrl, headers: media ? { Authorization: `Bearer ${token}` } : undefined }}
          style={styles.media}
          contentFit="cover"
        />
      ) : null}
      {post.linkUrl ? (
        <Pressable onPress={() => void Linking.openURL(post.news?.url ?? post.linkUrl!)} style={[styles.linkCard, { borderColor: colors.border }]}>
          <Text style={[styles.linkTitle, { color: colors.foreground }]} numberOfLines={2}>{post.linkTitle ?? post.linkUrl}</Text>
          {post.linkDescription ? <Text style={{ color: colors.mutedForeground, marginTop: 4 }} numberOfLines={3}>{post.linkDescription}</Text> : null}
          <Text style={{ color: colors.primary, fontWeight: '700', marginTop: 8 }}>{post.news ? 'Read full story' : 'Open link'} →</Text>
        </Pressable>
      ) : null}
      <View style={styles.actions}>
        <Action icon={post.viewer.liked ? 'heart' : 'heart-outline'} color={post.viewer.liked ? '#D74A62' : colors.mutedForeground} count={post.counts.likes} label="Like" onPress={onLike} />
        <Action icon="chatbubble-outline" color={colors.mutedForeground} count={post.counts.comments} label="Comment" onPress={onComment} />
        <Action icon={post.viewer.reposted ? 'repeat' : 'repeat-outline'} color={post.viewer.reposted ? '#2E9B72' : colors.mutedForeground} count={post.counts.reposts} label="Repost" onPress={onRepost} />
        <Action icon="share-outline" color={colors.mutedForeground} label="Share" onPress={() => void Share.share({ message: `${post.author.name} on Old Time\n\n${post.content}${post.linkUrl ? `\n${post.linkUrl}` : ''}` })} />
        <Action icon={post.viewer.saved ? 'bookmark' : 'bookmark-outline'} color={post.viewer.saved ? colors.primary : colors.mutedForeground} label="Save" onPress={onSave} />
      </View>
    </View>
  );
}

function Action({ icon, color, count, label, onPress }: { icon: keyof typeof Ionicons.glyphMap; color: string; count?: number; label: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={styles.action}>
      <Ionicons name={icon} size={20} color={color} />
      {typeof count === 'number' ? <Text style={{ color, fontSize: 12 }}>{count}</Text> : null}
    </Pressable>
  );
}

function ComposeSheet({ visible, token, colors, onClose, onPublish }: { visible: boolean; token: string; colors: any; onClose: () => void; onPublish: (input: { content: string; visibility: SocialPost['visibility']; kind: SocialPost['kind']; media?: SocialPost['media']; linkUrl?: string | null; linkTitle?: string | null; linkDescription?: string | null }) => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const requestUploadUrl = useRequestUploadUrl();
  const [text, setText] = useState('');
  const [visibility, setVisibility] = useState<SocialPost['visibility']>('friends');
  const [submitting, setSubmitting] = useState(false);
  const [asset, setAsset] = useState<{ uri: string; name: string; mimeType: string; size: number; type: 'image' | 'video'; width?: number; height?: number; duration?: number } | null>(null);
  const [linkUrl, setLinkUrl] = useState('');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [showLink, setShowLink] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasContent = Boolean(text.trim() || asset || linkUrl.trim());
  async function chooseMedia() {
    if (submitting) return;
    setError(null);
    try {
      const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images', 'videos'], quality: 0.9, selectionLimit: 1 });
      if (result.canceled) return;
      const picked = result.assets[0];
      setAsset({ uri: picked.uri, name: picked.fileName ?? `post-${Date.now()}.${picked.type === 'video' ? 'mp4' : 'jpg'}`, mimeType: picked.mimeType ?? (picked.type === 'video' ? 'video/mp4' : 'image/jpeg'), size: picked.fileSize ?? 1, type: picked.type === 'video' ? 'video' : 'image', width: picked.width, height: picked.height, duration: picked.duration ?? undefined });
    } catch (cause) { setError(errorText(cause)); }
  }
  async function submit() {
    if (!hasContent || submitting) return;
    let normalizedLink: string | null = null;
    if (linkUrl.trim()) {
      try {
        const url = new URL(linkUrl.trim());
        if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Only HTTP and HTTPS links are supported.');
        normalizedLink = url.toString();
      } catch (cause) { setError(errorText(cause) === 'Invalid URL' ? 'Enter a valid link URL.' : errorText(cause)); return; }
    }
    setSubmitting(true);
    setError(null);
    try {
      let media: SocialPost['media'] | undefined;
      if (asset) {
        const file = new File(asset.uri);
        const upload = await requestUploadUrl.mutateAsync({ data: { name: asset.name, size: Math.max(1, asset.size || file.size || 1), contentType: asset.mimeType } });
        const uploadUrl = upload.uploadURL.startsWith('/') && process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}${upload.uploadURL}` : upload.uploadURL;
        const response = await expoFetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': asset.mimeType, Authorization: `Bearer ${token}` }, body: file });
        if (!response.ok) throw new Error(`Upload failed (${response.status}).`);
        media = [{ type: asset.type, objectPath: upload.objectPath, mimeType: asset.mimeType, width: asset.width, height: asset.height, duration: asset.duration }];
      }
      await onPublish({ content: text.trim(), visibility, kind: media?.[0]?.type === 'video' ? 'video' : media ? 'photo' : normalizedLink ? 'link' : 'text', media, linkUrl: normalizedLink, linkTitle: linkTitle.trim() || null, linkDescription: linkDescription.trim() || null });
      setText('');
      setAsset(null); setLinkUrl(''); setLinkTitle(''); setLinkDescription(''); setShowLink(false);
      onClose();
    } catch (requestError) {
      setError(errorText(requestError));
    } finally {
      setSubmitting(false);
    }
  }
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={[styles.modalPage, { backgroundColor: colors.background, paddingTop: Math.max(insets.top, 18) }]}>
        <View style={styles.modalHeader}>
          <IconButton name="close" label="Close composer" onPress={onClose} />
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>New post</Text>
           <Pressable disabled={!hasContent || submitting} onPress={() => void submit()} style={[styles.postButton, { backgroundColor: colors.primary, opacity: !hasContent || submitting ? 0.45 : 1 }]}>
             <Text style={styles.postButtonText}>{submitting ? (asset ? 'Uploading…' : 'Posting…') : 'Post'}</Text>
          </Pressable>
        </View>
        <TextInput
          autoFocus
          value={text}
          onChangeText={setText}
          placeholder="What’s happening?"
          placeholderTextColor={colors.mutedForeground}
          multiline
          maxLength={2000}
          style={[styles.composer, { color: colors.foreground }]}
        />
         <View style={{ flexDirection: 'row', gap: 16, paddingHorizontal: 18, paddingBottom: 8 }}>
           <Pressable disabled={submitting} onPress={() => void chooseMedia()}><Text style={{ color: colors.primary, fontWeight: '700' }}>{asset ? 'Change photo or video' : 'Add photo or video'}</Text></Pressable>
           <Pressable disabled={submitting} onPress={() => setShowLink((current) => !current)}><Text style={{ color: colors.primary, fontWeight: '700' }}>{showLink ? 'Hide link' : 'Add link'}</Text></Pressable>
         </View>
         {asset ? <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 18, paddingBottom: 10 }}>{asset.type === 'image' ? <Image source={{ uri: asset.uri }} style={{ width: 52, height: 52, borderRadius: 8 }} contentFit="cover" /> : <Ionicons name="videocam-outline" size={30} color={colors.primary} />}<Text style={{ color: colors.foreground, flex: 1 }} numberOfLines={1}>{asset.name}</Text><IconButton name="close-circle" label="Remove media" onPress={() => setAsset(null)} /></View> : null}
         {showLink || linkUrl ? <View style={{ paddingHorizontal: 18, gap: 8, paddingBottom: 10 }}><TextInput value={linkUrl} onChangeText={setLinkUrl} autoCapitalize="none" keyboardType="url" placeholder="https://example.com" placeholderTextColor={colors.mutedForeground} style={[styles.linkInput, { color: colors.foreground, borderColor: colors.border }]} /><TextInput value={linkTitle} onChangeText={setLinkTitle} placeholder="Link title (optional)" placeholderTextColor={colors.mutedForeground} style={[styles.linkInput, { color: colors.foreground, borderColor: colors.border }]} /><TextInput value={linkDescription} onChangeText={setLinkDescription} placeholder="Description (optional)" placeholderTextColor={colors.mutedForeground} multiline style={[styles.linkInput, { color: colors.foreground, borderColor: colors.border }]} />{linkUrl ? <Pressable onPress={() => { setLinkUrl(''); setLinkTitle(''); setLinkDescription(''); setShowLink(false); }}><Text style={{ color: colors.destructive, fontWeight: '700' }}>Remove link</Text></Pressable> : null}</View> : null}
         {error ? <Text style={{ color: colors.destructive, paddingHorizontal: 18, paddingBottom: 8 }}>{error}</Text> : null}
        <Text style={[styles.audienceTitle, { color: colors.mutedForeground }]}>Who can see this?</Text>
        <View style={styles.audienceRow}>
          {([
            ['friends', 'Friends'],
            ['followers', 'Followers'],
            ['public', 'Everyone'],
            ['private', 'Only me'],
          ] as const).map(([value, label]) => (
            <Pressable key={value} onPress={() => setVisibility(value)} style={[styles.audience, { backgroundColor: visibility === value ? colors.primary : colors.muted }]}>
              <Text style={{ color: visibility === value ? '#fff' : colors.foreground, fontWeight: '700', fontSize: 12 }}>{label}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 14 }}>Media options appear only after a protected upload has completed.</Text>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function CommentsSheet({ post, token, viewerId, colors, onClose, onCountChange, onOpenUser }: { post: SocialPost | null; token: string; viewerId: number; colors: any; onClose: () => void; onCountChange: (delta: number) => void; onOpenUser: (id: number) => void }) {
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<SocialComment | null>(null);
  useEffect(() => {
    if (!post || !token) return;
    setLoading(true);
    void getPostComments(token, post.id).then(setComments).catch((requestError) => Alert.alert('Could not load comments', errorText(requestError))).finally(() => setLoading(false));
  }, [post?.id, token]);

  async function submit() {
    if (!post || !text.trim()) return;
    try {
      await createPostComment(token, post.id, text.trim(), replyTo?.id);
      setText('');
      setReplyTo(null);
      setComments(await getPostComments(token, post.id));
      onCountChange(1);
    } catch (requestError) {
      Alert.alert('Could not comment', errorText(requestError));
    }
  }

  return (
    <Modal visible={Boolean(post)} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior="padding" style={styles.sheetShade}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={styles.modalHeader}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>{post?.counts.comments ?? 0} comments</Text>
            <IconButton name="close" onPress={onClose} />
          </View>
          {loading ? <ActivityIndicator color={colors.primary} /> : (
            <FlatList
              data={comments}
              keyExtractor={(item) => String(item.id)}
              style={{ maxHeight: 430 }}
              renderItem={({ item }) => (
                <View style={[styles.comment, { marginLeft: item.parentId ? 28 : 0, borderBottomColor: colors.border }]}>
                  <Pressable onPress={() => onOpenUser(item.author.id)}><Avatar name={item.author.name} size={34} /></Pressable>
                  <View style={{ flex: 1 }}>
                    <Pressable onPress={() => onOpenUser(item.author.id)}>
                      <Text style={{ color: colors.foreground, fontWeight: '700' }}>{item.author.name} <Text style={{ color: colors.mutedForeground, fontWeight: '400' }}>@{item.author.username} · {relativeTime(item.createdAt)}</Text></Text>
                    </Pressable>
                    <Text style={{ color: colors.foreground, lineHeight: 20, marginTop: 3 }}>{item.content}</Text>
                    <View style={styles.commentActions}>
                      <Pressable onPress={() => setReplyTo(item)}><Text style={{ color: colors.primary, fontWeight: '700', fontSize: 12 }}>Reply</Text></Pressable>
                      <Pressable onPress={() => {
                        const active = !item.liked;
                        setComments((current) => current.map((comment) => comment.id === item.id ? { ...comment, liked: active } : comment));
                        void setCommentLike(token, item.id, active).catch(() => setComments((current) => current.map((comment) => comment.id === item.id ? { ...comment, liked: !active } : comment)));
                      }}><Ionicons name={item.liked ? 'heart' : 'heart-outline'} size={15} color={item.liked ? '#D74A62' : colors.mutedForeground} /></Pressable>
                      {item.authorId === viewerId ? (
                        <Pressable onPress={() => void deletePostComment(token, item.id).then(() => {
                          setComments((current) => current.filter((comment) => comment.id !== item.id));
                          onCountChange(-1);
                        }).catch((requestError) => Alert.alert('Could not delete', errorText(requestError)))}>
                          <Text style={{ color: colors.destructive, fontWeight: '700', fontSize: 12 }}>Delete</Text>
                        </Pressable>
                      ) : null}
                    </View>
                  </View>
                </View>
              )}
              ListEmptyComponent={<EmptyState icon="chatbubbles-outline" title="No comments" description="Start the conversation." />}
            />
          )}
          {replyTo ? <Pressable onPress={() => setReplyTo(null)}><Text style={{ color: colors.mutedForeground, marginBottom: 6 }}>Replying to @{replyTo.author.username} · Cancel</Text></Pressable> : null}
          <View style={styles.commentComposer}>
            <TextInput value={text} onChangeText={setText} placeholder={replyTo ? `Reply to @${replyTo.author.username}` : 'Add a comment'} placeholderTextColor={colors.mutedForeground} style={[styles.commentInput, { backgroundColor: colors.muted, color: colors.foreground }]} onSubmitEditing={() => void submit()} />
            <IconButton name="send" label="Send comment" color={colors.primary} onPress={() => void submit()} />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

function UserCardSheet({ userId, token, viewerId, colors, onClose, onFollowChange, onMessage, onBlocked }: { userId: number | null; token: string; viewerId: number; colors: any; onClose: () => void; onFollowChange: (id: number, following: boolean) => void; onMessage: (id: number) => void; onBlocked: (id: number) => void }) {
  const [card, setCard] = useState<UserCard | null>(null);
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!userId || !token) return;
    setLoading(true);
    setCard(null);
    void getUserCard(token, userId).then(setCard).catch((requestError) => Alert.alert('Could not open user', errorText(requestError))).finally(() => setLoading(false));
  }, [token, userId]);
  async function follow() {
    if (!card) return;
    const following = !card.following;
    try {
      await setFollowing(token, card.id, following);
      setCard({ ...card, following, followerCount: Math.max(0, card.followerCount + (following ? 1 : -1)) });
      onFollowChange(card.id, following);
    } catch (requestError) {
      Alert.alert('Could not update follow', errorText(requestError));
    }
  }
  return (
    <Modal visible={Boolean(userId)} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.cardShade}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.userCard, { backgroundColor: colors.card }]}>
          <View style={styles.cardClose}><IconButton name="close" onPress={onClose} /></View>
          {loading ? <ActivityIndicator color={colors.primary} /> : card ? (
            <>
              <Avatar name={card.name} size={72} />
              <Text style={[styles.cardName, { color: colors.foreground }]}>{card.name}</Text>
              <Text style={{ color: colors.mutedForeground }}>@{card.username}</Text>
              <View style={styles.counts}>
                <View><Text style={[styles.countNumber, { color: colors.foreground }]}>{card.followerCount}</Text><Text style={{ color: colors.mutedForeground }}>Followers</Text></View>
                <View><Text style={[styles.countNumber, { color: colors.foreground }]}>{card.followingCount}</Text><Text style={{ color: colors.mutedForeground }}>Following</Text></View>
              </View>
              {card.id !== viewerId ? (
                <>
                  <View style={styles.cardActions}>
                    <Pressable onPress={() => void follow()} style={[styles.cardPrimary, { backgroundColor: colors.primary }]}><Text style={styles.postButtonText}>{card.following ? 'Following' : 'Follow'}</Text></Pressable>
                    <Pressable onPress={() => onMessage(card.id)} style={[styles.cardSecondary, { borderColor: colors.border }]}><Text style={{ color: colors.foreground, fontWeight: '700' }}>Message</Text></Pressable>
                  </View>
                  <View style={styles.cardUtility}>
                    <Pressable onPress={() => void setUserMuted(token, card.id, !card.muted).then(() => setCard({ ...card, muted: !card.muted })).catch((requestError) => Alert.alert('Could not update mute', errorText(requestError)))}><Text style={{ color: colors.mutedForeground }}>{card.muted ? 'Unmute' : 'Mute'}</Text></Pressable>
                    <Pressable onPress={() => Alert.alert('Block user?', 'They will no longer be able to follow or interact with you.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Block', style: 'destructive', onPress: () => void setUserBlocked(token, card.id, true).then(() => { onBlocked(card.id); onClose(); }).catch((requestError) => Alert.alert('Could not block', errorText(requestError))) }])}><Text style={{ color: colors.destructive }}>Block</Text></Pressable>
                  </View>
                </>
              ) : null}
            </>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function SearchSheet({ visible, token, colors, onClose, onOpenUser, onOpenPost }: { visible: boolean; token: string; colors: any; onClose: () => void; onOpenUser: (id: number) => void; onOpenPost: (post: SocialPost) => void }) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<SearchResults>({ users: [], posts: [] });
  const [loading, setLoading] = useState(false);
  useEffect(() => {
    if (!visible || query.trim().length < 2) {
      setResults({ users: [], posts: [] });
      return;
    }
    const timer = setTimeout(() => {
      setLoading(true);
      void searchSocial(token, query.trim()).then(setResults).catch((requestError) => Alert.alert('Search unavailable', errorText(requestError))).finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(timer);
  }, [query, token, visible]);
  const rows = useMemo(() => [
    ...results.users.map((user) => ({ type: 'user' as const, id: `user-${user.id}`, user })),
    ...results.posts.map((post) => ({ type: 'post' as const, id: `post-${post.id}`, post })),
  ], [results]);
  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <View style={[styles.modalPage, { backgroundColor: colors.background }]}>
        <View style={styles.modalHeader}><Text style={[styles.modalTitle, { color: colors.foreground }]}>Search Updates</Text><IconButton name="close" onPress={onClose} /></View>
        <View style={[styles.searchBox, { backgroundColor: colors.muted }]}>
          <Ionicons name="search" size={18} color={colors.mutedForeground} />
          <TextInput autoFocus value={query} onChangeText={setQuery} placeholder="People or posts" placeholderTextColor={colors.mutedForeground} style={{ color: colors.foreground, flex: 1 }} />
          {loading ? <ActivityIndicator size="small" color={colors.primary} /> : null}
        </View>
        <FlatList
          data={rows}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => item.type === 'user' ? (
            <Pressable onPress={() => onOpenUser(item.user.id)} style={[styles.searchRow, { borderBottomColor: colors.border }]}>
              <Avatar name={item.user.name} size={42} />
              <View><Text style={{ color: colors.foreground, fontWeight: '700' }}>{item.user.name}</Text><Text style={{ color: colors.mutedForeground }}>@{item.user.username}</Text></View>
            </Pressable>
          ) : (
            <Pressable onPress={() => onOpenPost(item.post)} style={[styles.searchRow, { borderBottomColor: colors.border }]}>
              <Avatar name={item.post.author.name} size={42} />
              <View style={{ flex: 1 }}><Text style={{ color: colors.foreground, fontWeight: '700' }}>{item.post.author.name}</Text><Text style={{ color: colors.foreground, marginTop: 3 }} numberOfLines={2}>{item.post.content}</Text></View>
            </Pressable>
          )}
          ListEmptyComponent={query.length >= 2 && !loading ? <EmptyState icon="search-outline" title="No results" description="Try another name or keyword." /> : null}
        />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 12, borderBottomWidth: 2, borderBottomColor: 'transparent' },
  tabText: { fontSize: 14, fontWeight: '700' },
  errorBar: { margin: 12, padding: 12, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8 },
  post: { padding: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  postHeader: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  name: { fontSize: 15, fontWeight: '800', maxWidth: '48%' },
  handle: { fontSize: 12 },
  visibility: { fontSize: 11, marginTop: 2 },
  followSmall: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1 },
  postText: { fontSize: 16, lineHeight: 23, marginTop: 12 },
  media: { width: '100%', aspectRatio: 4 / 5, borderRadius: 12, marginTop: 12, backgroundColor: '#111' },
  linkCard: { marginTop: 12, padding: 13, borderRadius: 10, borderWidth: 1 },
  linkTitle: { fontSize: 15, fontWeight: '800' },
  newsLabel: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, paddingVertical: 6, borderRadius: 8, marginTop: 12 },
  actions: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 14, paddingHorizontal: 4 },
  action: { minWidth: 44, minHeight: 38, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  modalPage: { flex: 1, padding: 18 },
  modalHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 },
  modalTitle: { fontSize: 19, fontWeight: '800' },
  composer: { minHeight: 180, fontSize: 22, lineHeight: 30, textAlignVertical: 'top', paddingTop: 18 },
  postButton: { minWidth: 72, paddingHorizontal: 15, paddingVertical: 9, borderRadius: 18, alignItems: 'center' },
  postButtonText: { color: '#fff', fontWeight: '800' },
  audienceTitle: { fontSize: 12, fontWeight: '700', marginTop: 20, marginBottom: 8 },
  audienceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  audience: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 17 },
  linkInput: { minHeight: 42, borderWidth: StyleSheet.hairlineWidth, borderRadius: 9, paddingHorizontal: 11, paddingVertical: 8, fontSize: 14 },
  sheetShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.36)' },
  sheet: { maxHeight: '80%', minHeight: '45%', borderTopLeftRadius: 18, borderTopRightRadius: 18, padding: 18 },
  comment: { flexDirection: 'row', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  commentActions: { flexDirection: 'row', alignItems: 'center', gap: 18, marginTop: 8 },
  commentComposer: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 10 },
  commentInput: { flex: 1, minHeight: 42, borderRadius: 21, paddingHorizontal: 15 },
  cardShade: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20, backgroundColor: 'rgba(0,0,0,0.32)' },
  userCard: { width: '100%', maxWidth: 360, borderRadius: 20, padding: 24, alignItems: 'center' },
  cardClose: { position: 'absolute', top: 8, right: 8 },
  cardName: { fontSize: 21, fontWeight: '800', marginTop: 12 },
  counts: { flexDirection: 'row', gap: 42, marginVertical: 22 },
  countNumber: { fontSize: 18, fontWeight: '800', textAlign: 'center' },
  cardActions: { width: '100%', flexDirection: 'row', gap: 10 },
  cardPrimary: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center' },
  cardSecondary: { flex: 1, paddingVertical: 11, borderRadius: 10, alignItems: 'center', borderWidth: 1 },
  cardUtility: { width: '100%', flexDirection: 'row', justifyContent: 'center', gap: 30, marginTop: 18 },
  searchBox: { minHeight: 44, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, marginVertical: 12 },
  searchRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
});