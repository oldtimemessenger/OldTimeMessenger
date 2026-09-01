import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import {
  ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  FlatList, Dimensions, Platform, Share
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { Image } from 'expo-image';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar, EmptyState, IconButton, Screen, SectionLabel } from '@/components/ui';
import { useApp, type StatusItem, type UpdatePost } from '@/context/app-state';
import { INTEREST_OPTIONS, rankForYou } from '@/lib/for-you';
import { useColors } from '@/hooks/useColors';
import { VideoSurface } from '@/components/video-surface';
import { useCreateChat, useRequestUploadUrl } from '@workspace/api-client-react';
import {
  createStory,
  createSocialPost,
  getSocialFeed,
  getSocialNotifications,
  getSharingExclusions,
  getStories,
  getUserCard,
  markSocialNotificationRead,
  setFollowing,
  setPostRelation,
  setSharingExcluded,
  socialMediaUrl,
  viewStory,
  type SocialNotification,
  type SocialPost,
  type Story,
  type UserCard,
} from '@/lib/social-api';

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

const postColors = ['#3B8FD6', '#5F91B8', '#447AA4', '#6388A6', '#3E6D91', '#6A94B2'];
const creatorTags = ['comedy', 'music', 'food', 'fitness', 'travel', 'technology', 'art', 'sports'];
type FeedTab = 'for-you' | 'following' | 'interests';

function timeAgo(createdAt: number) {
  const hours = Math.floor((Date.now() - createdAt) / 3600000);
  if (hours < 1) return 'Just now';
  return `${hours}h ago`;
}

type StatusUserGroup = {
  author: string;
  items: StatusItem[];
  seen: boolean;
};

export default function UpdatesScreen() {
  const colors = useColors();
  const router = useRouter();
  const { mediaUri, mediaType } = useLocalSearchParams<{
    mediaUri?: string;
    mediaType?: 'photo' | 'video';
  }>();
  const { statuses, posts, interests, interestWeights, followedCreators, hiddenPostIds, markStatusViewed, togglePostLike, togglePostSaved, addPostComment, recordPostInteraction, toggleInterest, toggleFollow, hidePost: persistHiddenPost, session, settings, updateSettings } = useApp();
  const createChat = useCreateChat();
  const requestUploadUrl = useRequestUploadUrl();

  const [viewMode, setViewMode] = useState<'landing' | 'feed' | 'status'>('landing');
  const [tab, setTab] = useState<FeedTab>('for-you');
  const [feedIndex, setFeedIndex] = useState(0);
  const [storyGroupOpen, setStoryGroupOpen] = useState<StatusUserGroup | null>(null);
  const [compose, setCompose] = useState<'status' | 'post' | null>(null);
  const [commentPost, setCommentPost] = useState<UpdatePost | null>(null);
  const [profileOpen, setProfileOpen] = useState<string | null>(null);
  const [capturedStatusMedia, setCapturedStatusMedia] = useState<{
    uri: string;
    type: 'photo' | 'video';
  } | null>(null);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [socialStories, setSocialStories] = useState<Story[]>([]);
  const [socialLoading, setSocialLoading] = useState(true);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [ownCard, setOwnCard] = useState<UserCard | null>(null);
  const [serverStoryOpen, setServerStoryOpen] = useState<Story | null>(null);

  const loadSocial = useCallback(async () => {
    if (!session?.authToken) return;
    setSocialLoading(true);
    setSocialError(null);
    try {
      const [feed, storyPage, card, notificationPage, exclusions] = await Promise.all([
        getSocialFeed(session.authToken, 'for-you'),
        getStories(session.authToken),
        getUserCard(session.authToken, session.id),
        getSocialNotifications(session.authToken),
        getSharingExclusions(session.authToken),
      ]);
      setSocialPosts(feed.items);
      setSocialStories(storyPage.items);
      setOwnCard(card);
      setNotifications(notificationPage.items);
      updateSettings({ excludedPeople: exclusions.items.map((item) => ({ id: item.id, name: item.name })) });
    } catch (error) {
      setSocialError(error instanceof Error ? error.message : 'Social updates are unavailable right now.');
    } finally {
      setSocialLoading(false);
    }
  }, [session?.authToken, session?.id]);

  useEffect(() => {
    void loadSocial();
  }, [loadSocial]);

  async function openNotifications() {
    if (!session?.authToken) return;
    setShowNotifications(true);
    setNotificationsLoading(true);
    try {
      setNotifications((await getSocialNotifications(session.authToken)).items);
    } catch {
      setNotifications([]);
    } finally {
      setNotificationsLoading(false);
    }
  }

  const unreadNotifications = notifications.filter((item) => !item.readAt).length;

  useEffect(() => {
    if (!mediaUri) return;
    setCapturedStatusMedia({
      uri: mediaUri,
      type: mediaType === 'video' ? 'video' : 'photo',
    });
    setCompose('status');
    router.setParams({ mediaUri: undefined, mediaType: undefined });
  }, [mediaUri]);

  const now = Date.now();
  const activeStatuses = statuses.filter(s => now - s.createdAt < 86400000);
  const statusGroups = useMemo(() => {
    const groups: Record<string, StatusUserGroup> = {};
    activeStatuses.forEach(s => {
      if (!groups[s.author]) {
        groups[s.author] = { author: s.author, items: [], seen: true };
      }
      groups[s.author].items.push(s);
      if (!s.viewed) groups[s.author].seen = false;
    });

    Object.values(groups).forEach(g => g.items.sort((a, b) => a.createdAt - b.createdAt));

    return Object.values(groups).sort((a, b) => {
      if (a.author === 'You') return -1;
      if (b.author === 'You') return 1;
      if (a.seen !== b.seen) return a.seen ? 1 : -1;
      return b.items[b.items.length -1].createdAt - a.items[a.items.length -1].createdAt;
    });
  }, [activeStatuses]);

  const myGroup = statusGroups.find(g => g.author === 'You');
  const otherGroups = statusGroups.filter(g => g.author !== 'You');

  const forYouPosts = useMemo(() => rankForYou(posts.filter((post) => !hiddenPostIds.includes(post.id)), interests, interestWeights), [posts, interests, interestWeights, hiddenPostIds]);
  const followingPosts = useMemo(() => posts.filter((post) => followedCreators.includes(post.handle) && !hiddenPostIds.includes(post.id)), [posts, followedCreators, hiddenPostIds]);
  const visiblePosts = tab === 'following' ? followingPosts : forYouPosts;

  function hidePost(post: UpdatePost) {
    persistHiddenPost(post.id);
    recordPostInteraction(post.id, 'hide');
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="updates-screen">
      <Screen title="Updates" right={
        <View style={styles.socialHeaderActions}>
          <Pressable onPress={() => session && setProfileUserId(session.id)} style={styles.headerAvatarButton} accessibilityRole="button" accessibilityLabel="Open profile">
            <Avatar name={ownCard?.name ?? session?.name ?? 'You'} size={34} color={colors.primary} />
            {unreadNotifications > 0 ? <View style={[styles.headerUnreadDot, { backgroundColor: colors.destructive }]} /> : null}
          </Pressable>
          <IconButton name="add" label="Create update" onPress={() => setCompose('status')} />
        </View>
      }>
         <FlatList
           testID="landing-grid"
           data={tab === 'interests' ? [] : visiblePosts}
           numColumns={3}
           keyExtractor={item => item.id}
           columnWrapperStyle={{ gap: 2 }}
           ItemSeparatorComponent={() => <View style={{ height: 2 }} />}
           contentContainerStyle={{ paddingHorizontal: 2, paddingBottom: 100 }}
           showsVerticalScrollIndicator={false}
            ListHeaderComponent={<>
               <SocialHubPanel
                 posts={socialPosts}
                 stories={socialStories}
                 card={ownCard}
                 loading={socialLoading}
                 error={socialError}
                 colors={colors}
                 token={session?.authToken ?? ''}
                 onRetry={() => void loadSocial()}
                 onOpenProfile={setProfileUserId}
                 onOpenStory={(story) => setServerStoryOpen(story)}
                 onCreate={() => setCompose('status')}
                 onChanged={(post) => setSocialPosts((items) => items.map((item) => item.id === post.id ? post : item))}
               />

              <View style={[styles.feedTabs, { borderBottomColor: colors.border }]}>
                {(['for-you', 'following', 'interests'] as FeedTab[]).map(item => (
                  <Pressable key={item} testID={`tab-${item}`} onPress={() => setTab(item)} style={[styles.feedTab, tab === item && { borderBottomColor: colors.primary }]}>
                    <Text style={[styles.feedTabText, { color: tab === item ? colors.primary : colors.mutedForeground }]}>{item === 'for-you' ? 'For You' : item === 'following' ? 'Following' : 'Interests'}</Text>
                  </Pressable>
                ))}
              </View>

              {tab === 'interests' && <InterestPanel interests={interests} interestWeights={interestWeights} onToggle={toggleInterest} onBack={() => setTab('for-you')} colors={colors} />}

              {tab !== 'interests' && visiblePosts.length === 0 && (
                <EmptyState icon="people-outline" title={tab === 'following' ? 'Follow a creator' : 'Choose some interests'} description={tab === 'following' ? 'Follow creators from a story to build your Following feed.' : 'Choose topics so For You knows what to prioritize.'} action={<Pressable onPress={() => setTab(tab === 'following' ? 'for-you' : 'interests')}><Text style={{ color: colors.primary, fontWeight: '700' }}>{tab === 'following' ? 'Open For You' : 'Set interests'}</Text></Pressable>} />
              )}
           </>}
           renderItem={({ item, index }) => (
             <Pressable testID={`grid-item-${item.id}`} onPress={() => { setFeedIndex(index); setViewMode('feed'); }} style={{ width: (WINDOW_WIDTH - 8) / 3, aspectRatio: 3/4, backgroundColor: item.color, justifyContent: 'flex-end', padding: 8 }}>
               {(item as any).uri ? (
                 <Image source={{ uri: (item as any).uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
               ) : null}
               <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.15)' }]} />
               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                  <Ionicons name="play-outline" size={12} color="#fff" />
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '700' }}>{item.likes}</Text>
               </View>
             </Pressable>
           )}
         />
      </Screen>

      <Modal visible={viewMode === 'feed'} transparent animationType="slide" onRequestClose={() => setViewMode('landing')}>
        {viewMode === 'feed' ? (
         <FeedPager
            posts={visiblePosts}
            initialIndex={feedIndex}
            onClose={() => setViewMode('landing')}
            colors={colors}
            onLike={(id: string) => { togglePostLike(id); recordPostInteraction(id, 'like'); }}
            onSave={(id: string) => { togglePostSaved(id); recordPostInteraction(id, 'save'); }}
            onComment={(post: UpdatePost) => { recordPostInteraction(post.id, 'comment'); setCommentPost(post); }}
            onShare={(id: string) => {
              const post = posts.find((item) => item.id === id);
              if (!post) return;
              recordPostInteraction(id, 'share');
              void Share.share({ message: `${post.author} on Old Time:\n\n${post.caption}` });
            }}
            onOpenProfile={(handle: string) => setProfileOpen(handle)}
            onFollow={(handle: string) => toggleFollow(handle)}
            followedCreators={followedCreators}
            onHide={(post: UpdatePost) => hidePost(post)}
            onOpen={(id: string) => recordPostInteraction(id, 'open')}
         />
        ) : null}
      </Modal>

      <Modal visible={viewMode === 'status'} transparent animationType="fade" onRequestClose={() => setViewMode('landing')}>
        {storyGroupOpen && (
          <StatusViewer
             initialGroup={storyGroupOpen}
             allGroups={statusGroups}
             onClose={() => { setStoryGroupOpen(null); setViewMode('landing'); }}
             colors={colors}
             onMarkViewed={(id: string) => markStatusViewed(id, 'You')}
          />
        )}
      </Modal>

      <Modal visible={compose !== null} transparent animationType="slide" onRequestClose={() => setCompose(null)}>
        {compose && (
          <ComposeModal
             type={compose}
              initialMediaUri={capturedStatusMedia?.uri}
              initialMediaType={capturedStatusMedia?.type}
               defaultAudience={settings.statusAudience}
             onClose={() => setCompose(null)}
             colors={colors}
              onPublish={async (data: any) => {
                if (!session?.authToken) throw new Error('Sign in again to share an update.');
                let media: Story['media'] = null;
                if (data.uri) {
                  const file = new File(data.uri);
                  const mimeType = data.type === 'video' ? 'video/mp4' : 'image/jpeg';
                  const upload = await requestUploadUrl.mutateAsync({
                    data: { name: `status-${Date.now()}.${data.type === 'video' ? 'mp4' : 'jpg'}`, size: Math.max(1, file.size || 1), contentType: mimeType },
                  });
                  const uploadUrl = upload.uploadURL.startsWith('/') ? `https://${process.env.EXPO_PUBLIC_DOMAIN}${upload.uploadURL}` : upload.uploadURL;
                  const uploaded = await expoFetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': mimeType, Authorization: `Bearer ${session.authToken}` }, body: file });
                  if (!uploaded.ok) throw new Error('The media upload did not finish.');
                  media = { type: data.type === 'video' ? 'video' : 'image', objectPath: upload.objectPath, mimeType };
                }
                if (compose === 'status') {
                  const story = await createStory(session.authToken, { content: data.caption, visibility: data.audience, media });
                  setSocialStories((items) => [story, ...items]);
                } else {
                  const post = await createSocialPost(session.authToken, {
                    content: data.caption,
                    kind: media?.type === 'video' ? 'video' : media?.type === 'image' ? 'photo' : 'text',
                    media: media ? [media] : undefined,
                    visibility: data.audience,
                  });
                  setSocialPosts((items) => [post, ...items]);
                }
                setCapturedStatusMedia(null);
             }}
          />
        )}
      </Modal>

      <Modal visible={commentPost !== null} transparent animationType="slide" onRequestClose={() => setCommentPost(null)}>
        {commentPost ? (
          <CommentSheet post={commentPost} onClose={() => setCommentPost(null)} colors={colors} onAdd={(text: string) => { addPostComment(commentPost.id, text); }} />
        ) : null}
      </Modal>

      <Modal visible={profileOpen !== null} transparent animationType="slide" onRequestClose={() => setProfileOpen(null)}>
        {profileOpen ? (
          <ProfileSheet handle={profileOpen} onClose={() => setProfileOpen(null)} colors={colors} followed={followedCreators.includes(profileOpen)} onFollow={() => toggleFollow(profileOpen)} />
        ) : null}
      </Modal>

      <Modal visible={profileUserId !== null} transparent animationType="slide" onRequestClose={() => setProfileUserId(null)}>
        {profileUserId !== null ? (
          <SocialProfileSheet
            userId={profileUserId}
            own={profileUserId === session?.id}
            token={session?.authToken ?? ''}
            colors={colors}
            router={router}
            onClose={() => setProfileUserId(null)}
            onMessage={(userId) => {
              if (!session) return;
              createChat.mutate({ data: { userIds: [session.id, userId] } }, {
                onSuccess: (chat) => { setProfileUserId(null); router.push(`/chat/${chat.id}`); },
                onError: (error) => Alert.alert('Message unavailable', error instanceof Error ? error.message : 'This conversation cannot be started.'),
              });
            }}
            onExclude={(person) => {
              if (!session?.authToken) return;
              const active = !settings.excludedPeople.some((item) => item.id === person.id);
              void setSharingExcluded(session.authToken, person.id, active).then(() => {
                updateSettings({
                  excludedPeople: active
                    ? [...settings.excludedPeople, person]
                    : settings.excludedPeople.filter((item) => item.id !== person.id),
                });
              }).catch((error) => Alert.alert('Sharing list not updated', error instanceof Error ? error.message : 'Please try again.'));
            }}
            onInbox={() => {
              setProfileUserId(null);
              void openNotifications();
            }}
          />
        ) : null}
      </Modal>

      <Modal visible={showNotifications} transparent animationType="slide" onRequestClose={() => setShowNotifications(false)}>
        <NotificationsSheet
          notifications={notifications}
          loading={notificationsLoading}
          colors={colors}
          token={session?.authToken ?? ''}
          onClose={() => setShowNotifications(false)}
          onRead={(notification) => {
            if (notification.readAt || !session?.authToken) return;
            void markSocialNotificationRead(session.authToken, notification.id);
            setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, readAt: Date.now() } : item));
          }}
        />
      </Modal>

      <Modal visible={serverStoryOpen !== null} transparent animationType="fade" onRequestClose={() => setServerStoryOpen(null)}>
        {serverStoryOpen ? <ServerStoryViewer story={serverStoryOpen} token={session?.authToken ?? ''} colors={colors} onClose={() => setServerStoryOpen(null)} /> : null}
      </Modal>

    </View>
  );
}

function StatusRail({ myGroup, otherGroups, colors, onCreate, onOpenGroup }: { myGroup?: StatusUserGroup; otherGroups: StatusUserGroup[]; colors: any; onCreate: () => void; onOpenGroup: (g: StatusUserGroup) => void }) {
  return (
    <View style={{ paddingVertical: 12 }} testID="status-rail">
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, gap: 14 }}>
        <Pressable onPress={myGroup ? () => onOpenGroup(myGroup) : onCreate} style={{ alignItems: 'center', width: 68 }} testID="my-status">
           <View style={{ width: 64, height: 64, borderRadius: 32, padding: 2, borderWidth: 2, borderColor: myGroup ? (myGroup.seen ? colors.border : colors.primary) : 'transparent' }}>
             <Avatar name="You" size={56} color={myGroup ? myGroup.items[0].color : colors.muted} />
             <View style={{ position: 'absolute', bottom: -2, right: -2, backgroundColor: colors.primary, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.background }}>
               <Ionicons name="add" size={16} color="#fff" />
             </View>
           </View>
           <Text style={{ fontSize: 11, marginTop: 6, color: colors.foreground, fontWeight: '500' }}>Your status</Text>
        </Pressable>

        {otherGroups.map(group => (
           <Pressable key={group.author} onPress={() => onOpenGroup(group)} style={{ alignItems: 'center', width: 68 }} testID={`status-group-${group.author}`}>
             <View style={{ width: 64, height: 64, borderRadius: 32, padding: 2, borderWidth: 2, borderColor: group.seen ? colors.border : colors.primary }}>
               <Avatar name={group.author} size={56} color={group.items[0].color} />
             </View>
             <Text style={{ fontSize: 11, marginTop: 6, color: colors.foreground, fontWeight: '500' }} numberOfLines={1}>{group.author}</Text>
           </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

function FeedPager({ posts, initialIndex, onClose, colors, onLike, onSave, onComment, onShare, onFollow, followedCreators, onHide, onOpen, onOpenProfile }: any) {
  const insets = useSafeAreaInsets();
  const [currentIndex, setCurrentIndex] = useState(initialIndex);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const firstVisible = viewableItems.find((entry: any) => entry?.item?.id);
    if (firstVisible) {
      setCurrentIndex(firstVisible.index ?? 0);
      onOpen(firstVisible.item.id);
    }
  }).current;

  return (
    <View style={{ flex: 1, backgroundColor: '#000' }} testID="feed-pager">
      <Pressable onPress={onClose} style={{ position: 'absolute', top: Math.max(insets.top, 20) + 10, left: 16, zIndex: 50, padding: 8 }}>
        <Ionicons name="chevron-back" size={30} color="#fff" style={{ textShadowColor: 'rgba(0,0,0,0.5)', textShadowRadius: 10 }} />
      </Pressable>

      <FlatList
        data={posts}
        keyExtractor={(item: any) => item.id}
        pagingEnabled
        snapToInterval={WINDOW_HEIGHT}
        snapToAlignment="start"
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        initialScrollIndex={initialIndex}
        getItemLayout={(data, index) => ({ length: WINDOW_HEIGHT, offset: WINDOW_HEIGHT * index, index })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item, index }) => (
           <FeedPost
             post={item}
             active={index === currentIndex}
             colors={colors}
             onLike={() => onLike(item.id)}
             onSave={() => onSave(item.id)}
             onComment={() => onComment(item)}
             onShare={() => onShare(item.id)}
             onFollow={() => onFollow(item.handle)}
             followed={followedCreators.includes(item.handle)}
             onHide={() => { onHide(item); onClose(); }}
             onOpenProfile={() => { onOpenProfile(item.handle); onClose(); }}
           />
        )}
      />
    </View>
  );
}

function FeedPost({ post, active, followed, onLike, onSave, onComment, onShare, onFollow, onHide, onOpenProfile, colors }: any) {
  const [muted, setMuted] = useState(true);
  const [showHeart, setShowHeart] = useState(false);

  function doubleTap() {
    if (!post.liked) onLike();
    setShowHeart(true);
    setTimeout(() => setShowHeart(false), 700);
  }

  return (
    <View style={{ width: WINDOW_WIDTH, height: WINDOW_HEIGHT, backgroundColor: post.color }}>
      <Pressable style={StyleSheet.absoluteFill} onPress={doubleTap} />

      {post.uri && (post as UpdatePost & { type?: string }).type === 'video' ? (
        <VideoSurface source={post.uri} style={StyleSheet.absoluteFill} muted paused />
      ) : post.uri ? (
        <Image source={{ uri: post.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: post.color, justifyContent: 'center', alignItems: 'center' }]}>
           <View style={{ position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(255,255,255,0.08)', right: -100, top: -50 }} />
        </View>
      )}

      {showHeart && (
         <View style={[StyleSheet.absoluteFill, { alignItems: 'center', justifyContent: 'center', pointerEvents: 'none', zIndex: 20 }]}>
           <Ionicons name="heart" size={120} color="#fff" style={{ opacity: 0.8 }} />
         </View>
      )}

      <Pressable onPress={() => setMuted(!muted)} style={{ position: 'absolute', top: 60, right: 16, backgroundColor: 'rgba(0,0,0,0.3)', width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
        <Ionicons name={muted ? "volume-mute" : "volume-medium"} size={20} color="#fff" />
      </Pressable>

      <View style={{ position: 'absolute', right: 12, bottom: 120, alignItems: 'center', gap: 20 }}>
         <View style={{ alignItems: 'center' }}>
            <View style={{ width: 48, height: 48, borderRadius: 24, borderWidth: 2, borderColor: '#fff', overflow: 'hidden' }}>
              <Avatar name={post.author} size={44} color={post.color} />
            </View>
            {!followed && (
               <Pressable onPress={onFollow} style={{ position: 'absolute', bottom: -10, backgroundColor: colors.primary, borderRadius: 12, width: 24, height: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: '#fff' }}>
                 <Ionicons name="add" size={16} color="#fff" />
               </Pressable>
            )}
         </View>

         <Pressable onPress={onLike} style={{ alignItems: 'center' }}>
           <Ionicons name={post.liked ? "heart" : "heart-outline"} size={36} color={post.liked ? "#FFD54A" : "#fff"} />
           <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 4 }}>{post.likes}</Text>
         </Pressable>

         <Pressable onPress={onComment} style={{ alignItems: 'center' }}>
           <Ionicons name="chatbubble-ellipses-outline" size={34} color="#fff" />
           <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 4 }}>{post.comments.length}</Text>
         </Pressable>

         <Pressable onPress={onSave} style={{ alignItems: 'center' }}>
           <Ionicons name={post.saved ? "bookmark" : "bookmark-outline"} size={32} color={post.saved ? "#FFD54A" : "#fff"} />
           <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 4 }}>Save</Text>
         </Pressable>

         <Pressable onPress={onShare} style={{ alignItems: 'center' }}>
           <Ionicons name="arrow-redo-outline" size={34} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />
           <Text style={{ color: '#fff', fontSize: 12, fontWeight: '600', marginTop: 4 }}>Share</Text>
         </Pressable>

         <Pressable onPress={onHide} style={{ alignItems: 'center', marginTop: 10 }}>
           <Ionicons name="ellipsis-horizontal" size={24} color="#fff" />
         </Pressable>
      </View>

      <View style={{ position: 'absolute', left: 16, right: 80, bottom: 40 }}>
         <Pressable onPress={onOpenProfile}>
           <Text style={{ color: '#fff', fontSize: 16, fontWeight: 'bold', marginBottom: 8 }}>@{post.handle}</Text>
         </Pressable>
         <Text style={{ color: '#fff', fontSize: 15, lineHeight: 22, marginBottom: 8 }}>{post.caption}</Text>
         <Text style={{ color: '#FFD54A', fontSize: 14, fontWeight: '600', marginBottom: 12 }}>#{post.tag}</Text>
         <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
           <Ionicons name="musical-note" size={14} color="#fff" />
           <Text style={{ color: '#fff', fontSize: 13, opacity: 0.9 }}>{post.author} · Original sound</Text>
         </View>
      </View>
    </View>
  );
}

function StatusViewer({ initialGroup, allGroups, onClose, colors, onMarkViewed }: any) {
  const insets = useSafeAreaInsets();
  const [groupIndex, setGroupIndex] = useState(() => allGroups.findIndex((g: any) => g.author === initialGroup.author));
  const [itemIndex, setItemIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);

  const group = allGroups[groupIndex] || allGroups[0];
  const item = group?.items[itemIndex];

  useEffect(() => {
    if (item && !item.viewed) {
      onMarkViewed(item.id);
    }
  }, [item?.id, item?.viewed, onMarkViewed]);

  const DURATION = 5000;

  useEffect(() => {
    if (paused || !group) return;
    let start = Date.now() - progress * DURATION;
    let frame: number;
    function tick() {
      const now = Date.now();
      const p = (now - start) / DURATION;
      if (p >= 1) {
         handleNext();
      } else {
         setProgress(p);
         frame = requestAnimationFrame(tick);
      }
    }
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [groupIndex, itemIndex, paused, progress, group]);

  function handleNext() {
    if (!group) return;
    if (itemIndex < group.items.length - 1) {
      setItemIndex(i => i + 1);
      setProgress(0);
    } else if (groupIndex < allGroups.length - 1) {
      setGroupIndex((i: number) => i + 1);
      setItemIndex(0);
      setProgress(0);
    } else {
      onClose();
    }
  }

  function handlePrev() {
    if (!group) return;
    if (itemIndex > 0) {
      setItemIndex(i => i - 1);
      setProgress(0);
    } else if (groupIndex > 0) {
      setGroupIndex((i: number) => i - 1);
      setItemIndex(allGroups[groupIndex - 1].items.length - 1);
      setProgress(0);
    } else {
      setProgress(0);
    }
  }

  if (!group || !item) return null;

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: item.color }} testID="status-viewer">
       {item.uri && item.type === 'video' ? (
         <VideoSurface source={item.uri} style={StyleSheet.absoluteFill} muted={muted} paused={paused} />
       ) : item.uri ? (
         <Image source={{ uri: item.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
       ) : null}
       <View style={[StyleSheet.absoluteFill, { backgroundColor: 'rgba(0,0,0,0.1)' }]} />

       <View style={{ flexDirection: 'row', gap: 4, position: 'absolute', top: Math.max(insets.top, 20) + 10, left: 16, right: 16, zIndex: 10 }}>
         {group.items.map((_: any, idx: number) => (
           <View key={idx} style={{ flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: 2, overflow: 'hidden' }}>
             <View style={{ height: '100%', backgroundColor: '#fff', width: idx < itemIndex ? '100%' : idx === itemIndex ? `${progress * 100}%` : '0%' }} />
           </View>
         ))}
       </View>

       <View style={{ flexDirection: 'row', alignItems: 'center', position: 'absolute', top: Math.max(insets.top, 20) + 24, left: 16, right: 16, zIndex: 10, gap: 10 }}>
         <Avatar name={group.author} size={36} color="rgba(255,255,255,0.2)" />
         <View style={{ flex: 1 }}>
           <Text style={{ color: '#fff', fontWeight: 'bold', fontSize: 14 }}>{group.author}</Text>
           <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12 }}>{timeAgo(item.createdAt)}</Text>
         </View>
         {group.author === 'You' && (
           <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginRight: 8, backgroundColor: 'rgba(0,0,0,0.3)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 12 }}>
             <Ionicons name="eye" size={14} color="#fff" />
             <Text style={{ color: '#fff', fontSize: 12 }}>{item.viewers?.length || 0}</Text>
           </View>
         )}
         <Pressable onPress={() => setPaused(!paused)} style={{ padding: 4 }}>
           <Ionicons name={paused ? "play" : "pause"} size={22} color="#fff" />
         </Pressable>
         {item.type === 'video' ? (
           <Pressable onPress={() => setMuted((value) => !value)} style={{ padding: 4 }}>
             <Ionicons name={muted ? "volume-mute" : "volume-medium"} size={22} color="#fff" />
           </Pressable>
         ) : null}
         <Pressable onPress={onClose} style={{ padding: 4 }}>
           <Ionicons name="close" size={26} color="#fff" />
         </Pressable>
       </View>

       <Pressable style={{ position: 'absolute', left: 0, top: 100, bottom: 100, width: '30%', zIndex: 5 }} onPress={handlePrev} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} />
       <Pressable style={{ position: 'absolute', right: 0, top: 100, bottom: 100, width: '70%', zIndex: 5 }} onPress={handleNext} onLongPress={() => setPaused(true)} onPressOut={() => setPaused(false)} />

       {!item.uri || item.type === 'text' ? (
         <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, pointerEvents: 'none' }}>
           <Text style={{ color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 10 }}>{item.caption}</Text>
         </View>
       ) : (
         <View style={{ flex: 1, pointerEvents: 'none', justifyContent: 'flex-end', padding: 20, paddingBottom: 100 }}>
           {item.caption ? <Text style={{ color: '#fff', fontSize: 18, fontWeight: '700', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 10 }}>{item.caption}</Text> : null}
         </View>
       )}

    </KeyboardAvoidingView>
  );
}

function ComposeModal({ type, onClose, onPublish, colors, initialMediaUri, initialMediaType, defaultAudience }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const [selectedColor, setSelectedColor] = useState(postColors[0]);
  const [tag, setTag] = useState(creatorTags[0]);
   const [audience, setAudience] = useState<SharingAudience>(defaultAudience === 'public' ? 'friends' : (defaultAudience ?? 'friends'));
  const [mediaUri, setMediaUri] = useState<string | null>(initialMediaUri ?? null);
  const [selectedMediaType, setSelectedMediaType] = useState<'photo' | 'video'>(
    initialMediaType === 'video' ? 'video' : 'photo',
  );
   const [publishing, setPublishing] = useState(false);

  async function pickMedia() {
    const ImagePicker = await import('expo-image-picker');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: true,
      quality: 0.8,
    });
    if (!result.canceled && result.assets.length > 0) {
      setMediaUri(result.assets[0].uri);
      setSelectedMediaType(result.assets[0].type === 'video' ? 'video' : 'photo');
    }
  }

   async function handlePublish() {
    if (!draft.trim() && !mediaUri) return;
     setPublishing(true);
     try {
       if (type === 'status') {
          await onPublish({ caption: draft.trim(), color: selectedColor, type: mediaUri ? selectedMediaType : 'text', uri: mediaUri, audience });
       } else {
          await onPublish({ caption: draft.trim(), tag, color: selectedColor, type: mediaUri ? selectedMediaType : 'text', uri: mediaUri, audience });
       }
       onClose();
     } catch (error) {
       Alert.alert('Update not shared', error instanceof Error ? error.message : 'Please check your connection and try again.');
     } finally {
       setPublishing(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, backgroundColor: selectedColor }} testID="compose-modal">
      {mediaUri && (
        <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: mediaUri ? 'rgba(0,0,0,0.4)' : 'transparent' }]} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Math.max(insets.top, 20) + 10 }}>
        <IconButton name="close" color="#fff" onPress={onClose} />
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '800' }}>{type === 'status' ? 'New status' : 'New post'}</Text>
        <Pressable disabled={publishing} onPress={() => void handlePublish()} style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, opacity: publishing ? 0.65 : 1 }}>
          <Text style={{ color: '#000', fontWeight: '800', fontSize: 14 }}>{publishing ? 'Sharing…' : 'Post'}</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
         <TextInput
           autoFocus
           value={draft}
           onChangeText={setDraft}
           placeholder={type === 'status' ? 'Type a status...' : 'Write a caption...'}
           placeholderTextColor="rgba(255,255,255,0.7)"
           multiline
           style={{ color: '#fff', fontSize: 28, fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 10 }}
         />
      </View>

      <View style={{ paddingBottom: Math.max(insets.bottom, 20) + 20, paddingHorizontal: 16, gap: 20 }}>
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.85)', textAlign: 'center', fontSize: 12, fontWeight: '800', marginBottom: 8 }}>WHO CAN SEE THIS?</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
              {((type === 'status'
                ? ['public', 'friends', 'followers', 'close_friends', 'private']
                : ['public', 'friends', 'followers', 'private']
              ) as SharingAudience[]).map((item) => (
                <Pressable key={item} onPress={() => setAudience(item)} style={{ backgroundColor: audience === item ? '#fff' : 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}>
                  <Text style={{ color: audience === item ? '#000' : '#fff', fontWeight: '700', fontSize: 13 }}>{audienceLabel(item)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {audience === 'public' ? <Text style={{ color: '#fff', textAlign: 'center', fontSize: 11, marginTop: 7 }}>Public was selected explicitly. Anyone on Old Time may see this.</Text> : null}
          </View>

         {type === 'post' && (
           <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
             {creatorTags.map(item => (
               <Pressable key={item} onPress={() => setTag(item)} style={{ backgroundColor: tag === item ? '#fff' : 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
                 <Text style={{ color: tag === item ? '#000' : '#fff', fontWeight: '700', fontSize: 13 }}>#{item}</Text>
               </Pressable>
             ))}
           </ScrollView>
         )}

         <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
             <Pressable onPress={() => { onClose(); router.push({ pathname: '/camera', params: { returnTo: 'status' } }); }} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
              <Ionicons name="camera" size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={pickMedia} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <Ionicons name="image" size={22} color="#fff" />
            </Pressable>
            {postColors.map(c => (
              <Pressable key={c} onPress={() => setSelectedColor(c)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: 3, borderColor: selectedColor === c ? '#fff' : 'transparent' }} />
            ))}
         </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function CommentSheet({ post, onClose, colors, onAdd }: any) {
  const [text, setText] = useState('');
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: WINDOW_HEIGHT * 0.7 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '700' }}>{post?.comments.length || 0} comments</Text>
          <IconButton name="close" onPress={onClose} size={24} />
        </View>
        <ScrollView style={{ maxHeight: 300 }}>
           {post?.comments.map((c: string, i: number) => (
             <View key={i} style={{ paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.border }}>
               <Text style={{ color: colors.foreground, fontSize: 15 }}>{c}</Text>
             </View>
           ))}
           {!post?.comments.length && (
             <EmptyState icon="chatbubbles-outline" title="No comments" description="Be the first to comment!" />
           )}
        </ScrollView>
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12, gap: 10 }}>
           <TextInput
             value={text}
             onChangeText={setText}
             placeholder="Add a comment..."
             placeholderTextColor={colors.mutedForeground}
             style={{ flex: 1, height: 44, borderRadius: 22, backgroundColor: colors.secondary, paddingHorizontal: 16, color: colors.foreground }}
             onSubmitEditing={() => { if(text.trim()) { onAdd(text.trim()); setText(''); } }}
           />
           <Pressable onPress={() => { if(text.trim()) { onAdd(text.trim()); setText(''); } }}>
             <Ionicons name="send" size={24} color={colors.primary} />
           </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

type SharingAudience = 'public' | 'friends' | 'followers' | 'close_friends' | 'private';

function audienceLabel(audience: string) {
  if (audience === 'close_friends') return 'Close friends';
  if (audience === 'private') return 'Only you';
  return audience.charAt(0).toUpperCase() + audience.slice(1);
}

function SocialHubPanel({
  posts,
  stories,
  card,
  loading,
  error,
  colors,
  token,
  onRetry,
  onOpenProfile,
  onOpenStory,
  onCreate,
  onChanged,
}: {
  posts: SocialPost[];
  stories: Story[];
  card: UserCard | null;
  loading: boolean;
  error: string | null;
  colors: any;
  token: string;
  onRetry: () => void;
  onOpenProfile: (id: number) => void;
  onOpenStory: (story: Story) => void;
  onCreate: () => void;
  onChanged: (post: SocialPost) => void;
}) {
  const ownStory = stories.find((story) => story.viewer.isOwner);
  const otherStories = stories.filter((story) => !story.viewer.isOwner);
  return (
    <View style={styles.socialHub}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.socialStoryRail}>
        <Pressable onPress={ownStory ? () => onOpenStory(ownStory) : onCreate} style={styles.socialStoryItem} accessibilityRole="button" accessibilityLabel={ownStory ? 'View your story' : 'Add your story'}>
          <View style={[styles.socialStoryRing, { borderColor: ownStory ? colors.primary : colors.border }]}>
            <Avatar name={card?.name ?? 'You'} size={44} color={colors.muted} />
            <View style={[styles.socialStoryAdd, { backgroundColor: colors.primary, borderColor: colors.background }]}><Ionicons name="add" size={13} color="#fff" /></View>
          </View>
          <Text style={[styles.socialStoryName, { color: colors.foreground }]} numberOfLines={1}>Your story</Text>
        </Pressable>
          {otherStories.slice(0, 10).map((story) => (
            <Pressable key={story.id} onPress={() => onOpenStory(story)} style={styles.socialStoryItem} accessibilityRole="button" accessibilityLabel={`View ${story.author.name}'s story`}>
              <View style={[styles.socialStoryRing, { borderColor: colors.primary }]}>
                <Avatar name={story.author.name} size={44} color={colors.secondary} />
              </View>
              <Text style={[styles.socialStoryName, { color: colors.foreground }]} numberOfLines={1}>{story.author.name}</Text>
            </Pressable>
          ))}
      </ScrollView>

      {loading ? (
        <View style={[styles.socialState, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <Pressable onPress={onRetry} style={[styles.socialState, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button">
          <Ionicons name="cloud-offline-outline" size={20} color={colors.destructive} />
          <Text style={{ color: colors.foreground, flex: 1 }}>{error}</Text>
          <Text style={{ color: colors.primary, fontWeight: '800' }}>Retry</Text>
        </Pressable>
      ) : posts.length > 0 ? (
        <View style={styles.socialPostList}>
          {posts.slice(0, 3).map((post) => (
            <SocialPostCard key={post.id} post={post} colors={colors} token={token} onOpenProfile={() => onOpenProfile(post.author.id)} onChanged={onChanged} />
          ))}
        </View>
      ) : (
        <View />
      )}
    </View>
  );
}

function SocialPostCard({ post, colors, token, onOpenProfile, onChanged }: { post: SocialPost; colors: any; token: string; onOpenProfile: () => void; onChanged: (post: SocialPost) => void }) {
  const [busy, setBusy] = useState(false);
  const media = post.media[0];
  async function toggle(relation: 'like' | 'save') {
    if (busy) return;
    const active = relation === 'like' ? !post.viewer.liked : !post.viewer.saved;
    const next: SocialPost = {
      ...post,
      counts: { ...post.counts, [relation === 'like' ? 'likes' : 'saves']: Math.max(0, post.counts[relation === 'like' ? 'likes' : 'saves'] + (active ? 1 : -1)) },
      viewer: { ...post.viewer, [relation === 'like' ? 'liked' : 'saved']: active },
    };
    onChanged(next);
    setBusy(true);
    try {
      await setPostRelation(token, post.id, relation, active);
    } catch {
      onChanged(post);
      Alert.alert('Action not saved', 'Please try again.');
    } finally {
      setBusy(false);
    }
  }
  return (
    <View style={[styles.socialPostCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.socialPostHeader}>
        <Pressable onPress={onOpenProfile} style={styles.socialAuthor} accessibilityRole="button" accessibilityLabel={`Open ${post.author.name}'s profile`}>
          <Avatar name={post.author.name} size={38} color={colors.primary} />
          <View>
            <Text style={[styles.socialAuthorName, { color: colors.foreground }]}>{post.author.name}</Text>
            <Text style={[styles.socialAuthorMeta, { color: colors.mutedForeground }]}>@{post.author.username} · {audienceLabel(post.visibility)}</Text>
          </View>
        </Pressable>
        <Ionicons name="ellipsis-horizontal" size={19} color={colors.mutedForeground} />
      </View>
      {post.content ? <Text style={[styles.socialPostContent, { color: colors.foreground }]}>{post.content}</Text> : null}
      {media?.type === 'image' ? <Image source={{ uri: socialMediaUrl(media.objectPath), headers: { Authorization: `Bearer ${token}` } }} style={styles.socialPostMedia} contentFit="cover" /> : null}
      {media?.type === 'video' ? <VideoSurface source={{ uri: socialMediaUrl(media.objectPath), headers: { Authorization: `Bearer ${token}` } }} style={styles.socialPostMedia} controls /> : null}
      {post.linkUrl ? (
        <Pressable onPress={() => void Linking.openURL(post.linkUrl!)} style={[styles.socialLinkCard, { backgroundColor: colors.secondary }]}>
          <Ionicons name="link-outline" size={18} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.socialLinkTitle, { color: colors.foreground }]} numberOfLines={1}>{post.linkTitle ?? post.linkUrl}</Text>
            <Text style={[styles.socialLinkUrl, { color: colors.mutedForeground }]} numberOfLines={1}>{post.linkUrl}</Text>
          </View>
          <Ionicons name="open-outline" size={16} color={colors.primary} />
        </Pressable>
      ) : null}
      <View style={[styles.socialPostActions, { borderTopColor: colors.border }]}>
        <Pressable onPress={() => void toggle('like')} style={styles.socialAction} accessibilityRole="button" accessibilityLabel={post.viewer.liked ? 'Unlike post' : 'Like post'}>
          <Ionicons name={post.viewer.liked ? 'heart' : 'heart-outline'} size={19} color={post.viewer.liked ? colors.destructive : colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{post.counts.likes}</Text>
        </Pressable>
        <View style={styles.socialAction}><Ionicons name="chatbubble-outline" size={18} color={colors.mutedForeground} /><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{post.counts.comments}</Text></View>
        <Pressable onPress={() => void toggle('save')} style={styles.socialAction} accessibilityRole="button" accessibilityLabel={post.viewer.saved ? 'Unsave post' : 'Save post'}>
          <Ionicons name={post.viewer.saved ? 'bookmark' : 'bookmark-outline'} size={18} color={post.viewer.saved ? colors.primary : colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{post.counts.saves}</Text>
        </Pressable>
        <Text style={[styles.socialPostTime, { color: colors.mutedForeground }]}>{relativeSocialTime(post.createdAt)}</Text>
      </View>
    </View>
  );
}

function relativeSocialTime(timestamp: number) {
  const minutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  return hours < 24 ? `${hours}h ago` : `${Math.floor(hours / 24)}d ago`;
}

function SocialProfileSheet({ userId, own, token, colors, router, onClose, onMessage, onExclude, onInbox }: { userId: number; own: boolean; token: string; colors: any; router: any; onClose: () => void; onMessage: (userId: number) => void; onExclude: (person: { id: number; name: string }) => void; onInbox: () => void }) {
  const [card, setCard] = useState<UserCard | null>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowingState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void getUserCard(token, userId).then((next) => {
      if (!mounted) return;
      setCard(next);
      setFollowingState(next.following);
    }).catch((requestError) => {
      if (mounted) setError(requestError instanceof Error ? requestError.message : 'This profile is unavailable.');
    }).finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [token, userId]);
  async function toggleFollow() {
    if (!card) return;
    const next = !following;
    setFollowingState(next);
    try {
      await setFollowing(token, userId, next);
      setCard({ ...card, following: next, followerCount: Math.max(0, card.followerCount + (next ? 1 : -1)) });
    } catch {
      setFollowingState(!next);
      Alert.alert('Follow not saved', 'Please try again.');
    }
  }
  return (
    <KeyboardAvoidingView behavior="padding" style={styles.sheetOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.socialProfileSheet, { backgroundColor: colors.card }]}>
        <View style={styles.sheetTop}><View /><IconButton name="close" onPress={onClose} size={24} /></View>
        {loading ? <ActivityIndicator color={colors.primary} style={{ margin: 34 }} /> : error ? <Text style={{ color: colors.mutedForeground, padding: 26, textAlign: 'center' }}>{error}</Text> : card ? (
          <>
            <Avatar name={card.name} size={86} color={colors.primary} />
            <Text style={[styles.socialProfileName, { color: colors.foreground }]}>{own ? 'You' : card.name}</Text>
            <Text style={[styles.socialProfileHandle, { color: colors.mutedForeground }]}>@{card.username}</Text>
            <View style={styles.socialProfileStats}>
              <View><Text style={[styles.profileStatValue, { color: colors.foreground }]}>{card.followerCount}</Text><Text style={[styles.profileStatLabel, { color: colors.mutedForeground }]}>Followers</Text></View>
              <View><Text style={[styles.profileStatValue, { color: colors.foreground }]}>{card.followingCount}</Text><Text style={[styles.profileStatLabel, { color: colors.mutedForeground }]}>Following</Text></View>
            </View>
            <View style={styles.socialProfileActions}>
              {own ? <Pressable onPress={onInbox} style={[styles.profileIconAction, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Open inbox"><Ionicons name="mail-outline" size={19} color={colors.primary} /><Text style={{ color: colors.foreground, fontWeight: '800' }}>Inbox</Text></Pressable> : null}
              {!own ? <Pressable onPress={() => void toggleFollow()} style={[styles.profileAction, { backgroundColor: following ? colors.secondary : colors.primary }]}><Ionicons name={following ? 'checkmark' : 'person-add-outline'} size={17} color={following ? colors.foreground : '#fff'} /><Text style={{ color: following ? colors.foreground : '#fff', fontWeight: '800' }}>{following ? 'Following' : 'Follow'}</Text></Pressable> : null}
              {!own && card.canMessage ? <Pressable onPress={() => onMessage(userId)} style={[styles.profileIconAction, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel={`Message ${card.name}`}><Ionicons name="mail-outline" size={19} color={colors.primary} /><Text style={{ color: colors.foreground, fontWeight: '800' }}>Message</Text></Pressable> : null}
            </View>
            {!own ? <Pressable onPress={() => { onExclude({ id: card.id, name: card.name }); Alert.alert('Sharing list updated', `${card.name} was added or removed from your excluded audience list.`); }} style={styles.excludeAction}><Ionicons name="eye-off-outline" size={17} color={colors.mutedForeground} /><Text style={{ color: colors.mutedForeground }}>Toggle excluded from sharing</Text></Pressable> : null}
            <Pressable onPress={onClose} style={[styles.profileDone, { borderColor: colors.border }]}><Text style={{ color: colors.primary, fontWeight: '800' }}>Done</Text></Pressable>
          </>
        ) : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function NotificationsSheet({ notifications, loading, colors, token, onClose, onRead }: { notifications: SocialNotification[]; loading: boolean; colors: any; token: string; onClose: () => void; onRead: (notification: SocialNotification) => void }) {
  return (
    <KeyboardAvoidingView behavior="padding" style={styles.sheetOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.notificationsSheet, { backgroundColor: colors.card }]}>
        <View style={styles.sheetTop}><View><Text style={[styles.sheetEyebrow, { color: colors.mutedForeground }]}>YOUR CIRCLE</Text><Text style={[styles.notificationsTitle, { color: colors.foreground }]}>Notifications</Text></View><IconButton name="close" onPress={onClose} size={24} /></View>
        {loading ? <ActivityIndicator color={colors.primary} style={{ margin: 36 }} /> : <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
          {notifications.length === 0 ? <View style={styles.notificationEmpty}><Ionicons name="notifications-off-outline" size={28} color={colors.primary} /><Text style={[styles.notificationEmptyTitle, { color: colors.foreground }]}>All caught up</Text><Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>Reactions and replies from your circle will land here.</Text></View> : notifications.map((item) => (
            <Pressable key={item.id} onPress={() => onRead(item)} style={[styles.notificationRow, { borderBottomColor: colors.border, backgroundColor: item.readAt ? 'transparent' : colors.secondary }]}>
              <Avatar name={item.actor.name} size={40} color={colors.primary} />
              <View style={{ flex: 1 }}><Text style={[styles.notificationText, { color: colors.foreground }]}><Text style={{ fontWeight: '800' }}>{item.actor.name}</Text>{` ${notificationCopy(item.type)}`}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>{relativeSocialTime(item.createdAt)}</Text></View>
              {!item.readAt ? <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} /> : null}
            </Pressable>
          ))}
        </ScrollView>}
      </View>
    </KeyboardAvoidingView>
  );
}

function notificationCopy(type: string) {
  if (type.includes('reply')) return 'replied to your story';
  if (type.includes('reaction')) return 'reacted to your story';
  return 'interacted with your update';
}

function ServerStoryViewer({ story, token, colors, onClose }: { story: Story; token: string; colors: any; onClose: () => void }) {
  useEffect(() => {
    if (!story.viewer.viewed) void viewStory(token, story.id);
  }, [story.id, story.viewer.viewed, token]);
  return (
    <View style={[styles.serverStoryViewer, { backgroundColor: colors.primary }]}>
      {story.media?.type === 'image' ? <Image source={{ uri: socialMediaUrl(story.media.objectPath), headers: { Authorization: `Bearer ${token}` } }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      {story.media?.type === 'video' ? <VideoSurface source={{ uri: socialMediaUrl(story.media.objectPath), headers: { Authorization: `Bearer ${token}` } }} style={StyleSheet.absoluteFill} /> : null}
      <View style={styles.serverStoryShade} />
      <View style={styles.serverStoryTop}>
        <Avatar name={story.author.name} size={38} color="rgba(255,255,255,0.28)" />
        <View style={{ flex: 1 }}><Text style={styles.serverStoryAuthor}>{story.author.name}</Text><Text style={styles.serverStoryMeta}>{audienceLabel(story.visibility)} · {relativeSocialTime(story.createdAt)}</Text></View>
        <IconButton name="close" color="#fff" onPress={onClose} />
      </View>
      <View style={styles.serverStoryContent}>
        <Text style={styles.serverStoryText}>{story.content}</Text>
      </View>
    </View>
  );
}

function InterestPanel({ interests, interestWeights, onToggle, onBack, colors }: any) {
  const [locationEnabled, setLocationEnabled] = useState(false);
  useEffect(() => {
    Location.getForegroundPermissionsAsync().then((permission) => setLocationEnabled(permission.granted)).catch(() => setLocationEnabled(false));
  }, []);

  async function handleToggle(interest: string) {
    if (interest !== 'nearby' || interests.includes(interest)) {
      onToggle(interest);
      return;
    }
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Location permission needed', 'Allow location access to personalize stories around you. You can still use every other interest without it.');
      return;
    }
    setLocationEnabled(true);
    onToggle(interest);
  }

  return (
    <ScrollView contentContainerStyle={styles.interestContent} showsVerticalScrollIndicator={false}>
      <View style={styles.interestHeading}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.interestTitle, { color: colors.foreground }]}>Interests</Text>
          <Text style={[styles.interestSubtitle, { color: colors.mutedForeground }]}>Choose what Old Time should prioritize in For You.</Text>
        </View>
        <Ionicons name="options-outline" size={25} color={colors.primary} />
      </View>
      <View style={styles.interestGrid}>{INTEREST_OPTIONS.map((interest) => {
        const selected = interests.includes(interest.id);
        const description = interest.id === 'nearby' && !locationEnabled ? 'Enable location for nearby stories when permission is not granted' : interest.description;
        return (
          <Pressable key={interest.id} onPress={() => void handleToggle(interest.id)} style={[styles.interestChip, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}>
            <View style={[styles.check, { backgroundColor: selected ? '#fff' : colors.muted }]}>{selected ? <Ionicons name="checkmark" size={13} color={colors.primary} /> : null}</View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.interestLabel, { color: selected ? '#fff' : colors.foreground }]}>{interest.label}</Text>
              <Text style={[styles.interestDescription, { color: selected ? 'rgba(255,255,255,0.8)' : colors.mutedForeground }]}>{description}</Text>
            </View>
            {interest.id === 'nearby' ? <Ionicons name="location-outline" size={17} color={selected ? '#fff' : colors.primary} /> : null}
          </Pressable>
        );
      })}</View>
      <View style={[styles.learningCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.learningHeader}>
          <Ionicons name="analytics-outline" size={19} color={colors.primary} />
          <Text style={[styles.learningTitle, { color: colors.foreground }]}>Learning from your activity</Text>
        </View>
        <Text style={[styles.learningText, { color: colors.mutedForeground }]}>Likes, saves, comments, shares, opens, and hides shape your For You ranking on this device.</Text>
        {Object.keys(interestWeights).length ? (
          <View style={styles.weightRow}>
            {Object.entries(interestWeights).sort(([, a], [, b]) => (b as number) - (a as number)).slice(0, 4).map(([key, value]) => (
              <View key={key} style={[styles.weightPill, { backgroundColor: colors.secondary }]}>
                <Text style={{ color: colors.foreground, fontSize: 12 }}>{key} {(value as number) > 0 ? `+${value}` : String(value)}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text style={[styles.noSignals, { color: colors.mutedForeground }]}>Your activity signals will appear here as you use Updates.</Text>
        )}
      </View>
      <Pressable onPress={onBack} style={[styles.backButton, { borderColor: colors.primary }]}>
        <Ionicons name="arrow-back" size={17} color={colors.primary} />
        <Text style={{ color: colors.primary, fontWeight: '700' }}>Back to For You</Text>
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  socialHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  headerAvatarButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerUnreadDot: { position: 'absolute', top: 3, right: 3, width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  createPill: { minHeight: 36, borderRadius: 20, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  createPillText: { color: '#fff', fontSize: 13, fontWeight: '900' },
  bellButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  notificationBadge: { position: 'absolute', top: 4, right: 3, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
  notificationBadgeText: { color: '#fff', fontSize: 9, fontWeight: '900' },
  socialHub: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 8 },
  socialHubHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  socialHubTitle: { fontSize: 21, fontWeight: '900', letterSpacing: -0.4 },
  socialHubSubtitle: { fontSize: 12, marginTop: 2 },
  mapPill: { minHeight: 38, borderRadius: 20, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapPillText: { fontSize: 13, fontWeight: '800' },
  socialIdentity: { minHeight: 74, borderWidth: 1, borderRadius: 24, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  socialIdentityName: { fontSize: 15, fontWeight: '900' },
  socialIdentityHandle: { fontSize: 11, marginTop: 3, lineHeight: 15 },
  statStack: { alignItems: 'center', minWidth: 46 },
  statValue: { fontSize: 15, fontWeight: '900' },
  statLabel: { fontSize: 9, marginTop: 2 },
  socialStoryRail: { gap: 14, paddingVertical: 14, paddingHorizontal: 2 },
  socialStoryItem: { width: 62, alignItems: 'center' },
  socialStoryRing: { width: 52, height: 52, borderRadius: 26, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  socialStoryAdd: { position: 'absolute', right: -4, bottom: -3, width: 19, height: 19, borderRadius: 10, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  socialStoryName: { fontSize: 10, fontWeight: '800', width: 62, textAlign: 'center', marginTop: 4 },
  socialStoryAudience: { fontSize: 8, marginTop: 1 },
  socialState: { minHeight: 68, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', gap: 10, alignItems: 'center' },
  socialPostList: { marginTop: 14, gap: 10 },
  socialSectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  socialSectionTitle: { fontSize: 16, fontWeight: '900' },
  socialSectionHint: { fontSize: 11, fontWeight: '700' },
  socialPostCard: { borderWidth: 1, borderRadius: 24, overflow: 'hidden', padding: 12 },
  socialPostHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  socialAuthor: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  socialAuthorName: { fontSize: 14, fontWeight: '900' },
  socialAuthorMeta: { fontSize: 10, marginTop: 2 },
  socialPostContent: { fontSize: 14, lineHeight: 20, marginTop: 11 },
  socialPostMedia: { width: '100%', height: 210, borderRadius: 12, marginTop: 11 },
  socialLinkCard: { borderRadius: 11, padding: 10, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  socialLinkTitle: { fontSize: 12, fontWeight: '800' },
  socialLinkUrl: { fontSize: 10, marginTop: 2 },
  socialPostActions: { flexDirection: 'row', alignItems: 'center', gap: 18, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 11 },
  socialAction: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5 },
  socialPostTime: { fontSize: 10, marginLeft: 'auto' },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  socialProfileSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, minHeight: 440, alignItems: 'center' },
  notificationsSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, minHeight: WINDOW_HEIGHT * 0.64, maxHeight: WINDOW_HEIGHT * 0.82, padding: 20 },
  sheetTop: { width: '100%', minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetEyebrow: { fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  socialProfileName: { fontSize: 23, fontWeight: '900', marginTop: 13 },
  socialProfileHandle: { fontSize: 14, marginTop: 3 },
  socialProfileStats: { flexDirection: 'row', gap: 46, marginTop: 22, marginBottom: 22 },
  profileStatValue: { textAlign: 'center', fontSize: 19, fontWeight: '900' },
  profileStatLabel: { fontSize: 11, marginTop: 2 },
  socialProfileActions: { flexDirection: 'row', gap: 9, width: '100%', justifyContent: 'center' },
  profileAction: { minHeight: 44, borderRadius: 22, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  profileIconAction: { minHeight: 44, borderRadius: 22, paddingHorizontal: 17, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  excludeAction: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  profileDone: { width: '100%', minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  notificationsTitle: { fontSize: 24, fontWeight: '900', marginTop: 2 },
  notificationRow: { minHeight: 68, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', gap: 10 },
  notificationText: { fontSize: 13, lineHeight: 18 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notificationEmpty: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 55, gap: 9 },
  notificationEmptyTitle: { fontSize: 17, fontWeight: '900' },
  serverStoryViewer: { flex: 1, justifyContent: 'space-between' },
  serverStoryShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.32)' },
  serverStoryTop: { paddingTop: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
  serverStoryAuthor: { color: '#fff', fontSize: 14, fontWeight: '900' },
  serverStoryMeta: { color: 'rgba(255,255,255,0.78)', fontSize: 11, marginTop: 2 },
  serverStoryContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 30, paddingBottom: 70 },
  serverStoryText: { color: '#fff', fontSize: 28, lineHeight: 36, textAlign: 'center', fontWeight: '900', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 8 },
  feedTabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  feedTab: { flex: 1, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 2 },
  feedTabText: { fontWeight: '700', fontSize: 14 },
  interestContent: { paddingBottom: 100 },
  interestHeading: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  interestTitle: { fontSize: 23, fontWeight: '800' },
  interestSubtitle: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  interestGrid: { gap: 8 },
  interestChip: { borderWidth: 1, borderRadius: 11, minHeight: 62, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  interestLabel: { fontSize: 14, fontWeight: '700' },
  interestDescription: { fontSize: 11, marginTop: 3 },
  learningCard: { borderWidth: 1, borderRadius: 11, padding: 14, marginTop: 18 },
  learningHeader: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  learningTitle: { fontSize: 14, fontWeight: '800' },
  learningText: { fontSize: 12, lineHeight: 17, marginTop: 7 },
  weightRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 11 },
  weightPill: { paddingHorizontal: 9, paddingVertical: 6, borderRadius: 14 },
  noSignals: { fontSize: 11, marginTop: 10 },
  pipelineCard: { borderWidth: 1, borderRadius: 11, padding: 14, marginTop: 12 },
  pipelineTitle: { fontSize: 14, fontWeight: '800', marginBottom: 8 },
  pipelineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  pipelineNumber: { width: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pipelineStep: { fontSize: 12, flex: 1 },
  pipelineStatus: { fontSize: 10, fontWeight: '700' },
  pipelineFootnote: { fontSize: 11, lineHeight: 16, marginTop: 8 },
  backButton: { minHeight: 44, borderWidth: 1, borderRadius: 10, marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
});

function ProfileSheet({ handle, onClose, colors, followed, onFollow }: any) {
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, minHeight: 250, alignItems: 'center' }}>
        <View style={{ width: '100%', flexDirection: 'row', justifyContent: 'flex-end' }}>
          <IconButton name="close" onPress={onClose} size={24} />
        </View>
        <View style={{ alignItems: 'center', marginTop: -10 }}>
          <Avatar name={handle} size={80} color={colors.primary} />
          <Text style={{ color: colors.foreground, fontSize: 20, fontWeight: 'bold', marginTop: 12 }}>@{handle}</Text>
          <Text style={{ color: colors.mutedForeground, fontSize: 14, marginTop: 4 }}>Creator on Old Time</Text>
          <Pressable onPress={onFollow} style={{ marginTop: 20, backgroundColor: followed ? colors.secondary : colors.primary, paddingHorizontal: 24, paddingVertical: 10, borderRadius: 20 }}>
            <Text style={{ color: followed ? colors.foreground : '#fff', fontWeight: 'bold' }}>{followed ? 'Following' : 'Follow'}</Text>
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}
