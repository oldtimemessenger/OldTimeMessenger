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
import { LinearGradient } from 'expo-linear-gradient';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Avatar, EmptyState, IconButton, Screen, SectionLabel, StoryAvatar } from '@/components/ui';
import { useApp, type StatusItem, type UpdatePost } from '@/context/app-state';
import { INTEREST_OPTIONS, rankForYou } from '@/lib/for-you';
import { useColors } from '@/hooks/useColors';
import { apiBaseUrl } from '@/lib/api-base-url';
import { VideoSurface } from '@/components/video-surface';
import { ServerStoryViewer } from '@/components/server-story-viewer';
import { userStoryViewerItem, userStoryViewerItemId } from '@/components/story-viewer-content';
import { useRequestUploadUrl } from '@workspace/api-client-react';
import {
  createStory,
  acceptMessageRequest,
  createMessageRequest,
  declineMessageRequest,
  createSocialPost,
  getSocialFeed,
  getSocialNotifications,
  getMessageRequests,
  getSharingExclusions,
  getStories,
  getUserCard,
  getUserPosts,
  getPostComments,
  createPostComment,
  reportSocialContent,
  markSocialNotificationRead,
  searchSocial,
  setFollowing,
  setUserBlocked,
  setPostRelation,
  setSharingExcluded,
  socialMediaUrl,
  viewStory,
  type SocialNotification,
  type SocialComment,
  type MessageRequest,
  type SocialPost,
  type SocialUser,
  type Story,
  type UserCard,
} from '@/lib/social-api';

const { width: WINDOW_WIDTH, height: WINDOW_HEIGHT } = Dimensions.get('window');

const postColors = ['#3B8FD6', '#5F91B8', '#447AA4', '#6388A6', '#3E6D91', '#6A94B2'];
const storyGradients = [
  ['#F58529', '#DD2A7B', '#8134AF'],
  ['#833AB4', '#FD1D1D', '#FCAF45'],
  ['#4F5BD5', '#962FBF', '#D62976'],
  ['#FF6B6B', '#C44569', '#574B90'],
  ['#00C6FF', '#0072FF', '#6A11CB'],
] as const;
const creatorTags = ['comedy', 'music', 'food', 'fitness', 'travel', 'technology', 'art', 'sports'];
type FeedTab = 'for-you' | 'following' | 'interests';
const FEED_LANGUAGE_OPTIONS = [
  { id: 'English', label: 'English', nativeLabel: 'English' },
  { id: 'French', label: 'French', nativeLabel: 'Français' },
  { id: 'Haitian Creole', label: 'Haitian Creole', nativeLabel: 'Kreyòl Ayisyen' },
  { id: 'Spanish', label: 'Spanish', nativeLabel: 'Español' },
  { id: 'Portuguese', label: 'Portuguese', nativeLabel: 'Português' },
  { id: 'Arabic', label: 'Arabic', nativeLabel: 'العربية' },
] as const;

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
  const { mediaUri, mediaType, mediaFit, composeType } = useLocalSearchParams<{
    mediaUri?: string;
    mediaType?: 'photo' | 'video';
    mediaFit?: 'contain' | 'cover';
    composeType?: 'status' | 'post';
  }>();
  const { statuses, posts, interests, interestWeights, followedCreators, hiddenPostIds, markStatusViewed, togglePostLike, togglePostSaved, addPostComment, recordPostInteraction, recordInterestFeedback, toggleInterest, toggleFollow, hidePost: persistHiddenPost, session, settings, updateSettings } = useApp();
  const requestUploadUrl = useRequestUploadUrl();

  const [viewMode, setViewMode] = useState<'landing' | 'feed' | 'status'>('landing');
  const [tab, setTab] = useState<FeedTab>('for-you');
  const [feedIndex, setFeedIndex] = useState(0);
  const [storyGroupOpen, setStoryGroupOpen] = useState<StatusUserGroup | null>(null);
  const [compose, setCompose] = useState<'status' | 'post' | null>(null);
  const [commentPost, setCommentPost] = useState<UpdatePost | null>(null);
  const [socialCommentPost, setSocialCommentPost] = useState<SocialPost | null>(null);
  const [capturedStatusMedia, setCapturedStatusMedia] = useState<{
    uri: string;
    type: 'photo' | 'video';
    fit?: 'contain' | 'cover';
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
  const [showMessageRequests, setShowMessageRequests] = useState(false);
  const [messageRequests, setMessageRequests] = useState<MessageRequest[]>([]);
  const [messageRequestsLoading, setMessageRequestsLoading] = useState(false);
  const [showPeopleSearch, setShowPeopleSearch] = useState(false);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [peopleResults, setPeopleResults] = useState<SocialUser[]>([]);
  const [peopleSearchLoading, setPeopleSearchLoading] = useState(false);
  const [peopleSearchError, setPeopleSearchError] = useState<string | null>(null);
  const [interestPrompt, setInterestPrompt] = useState<{ topic: string; title: string } | null>(null);
  const promptedContent = useRef(new Set<string>());

  const loadSocial = useCallback(async (mode: 'for-you' | 'following' = 'for-you') => {
    if (!session?.authToken) return;
    setSocialLoading(true);
    setSocialError(null);
    try {
      const [feed, storyPage, card, notificationPage, exclusions] = await Promise.all([
        getSocialFeed(session.authToken, mode),
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

  useEffect(() => {
    const firstPost = socialPosts[0];
    if (socialLoading || !firstPost) return;
    const key = `social-${firstPost.id}`;
    if (promptedContent.current.has(key) || Math.random() > 0.32) return;
    promptedContent.current.add(key);
    setInterestPrompt({ topic: inferSocialTopic(firstPost), title: firstPost.author.name });
  }, [socialLoading, socialPosts]);

  useEffect(() => {
    if (!showPeopleSearch || !session?.authToken) return;
    const query = peopleQuery.trim();
    if (query.length < 2) {
      setPeopleResults([]);
      setPeopleSearchError(null);
      setPeopleSearchLoading(false);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      setPeopleSearchLoading(true);
      setPeopleSearchError(null);
      void searchSocial(session.authToken, query)
        .then((result) => {
          if (!cancelled) setPeopleResults(result.users);
        })
        .catch((error) => {
          if (!cancelled) setPeopleSearchError(error instanceof Error ? error.message : 'People search is unavailable.');
        })
        .finally(() => {
          if (!cancelled) setPeopleSearchLoading(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [peopleQuery, session?.authToken, showPeopleSearch]);

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

  async function openMessageRequests() {
    if (!session?.authToken) return;
    setShowMessageRequests(true);
    setMessageRequestsLoading(true);
    try {
      setMessageRequests((await getMessageRequests(session.authToken)).items);
    } catch {
      setMessageRequests([]);
    } finally {
      setMessageRequestsLoading(false);
    }
  }

  const unreadNotifications = notifications.filter((item) => !item.readAt).length;
  const firstOtherStory = socialStories.find((story) => !story.viewer.isOwner);

  function openStatusShortcut() {
    if (firstOtherStory) {
      setServerStoryOpen(firstOtherStory);
      return;
    }
    const firstLocalGroup = otherGroups[0];
    if (firstLocalGroup) {
      setStoryGroupOpen(firstLocalGroup);
      setViewMode('status');
      return;
    }
    setCompose('status');
  }

  useEffect(() => {
    if (!mediaUri) return;
    setCapturedStatusMedia({
      uri: mediaUri,
      type: mediaType === 'video' ? 'video' : 'photo',
      fit: mediaFit,
    });
    setCompose(composeType ?? 'status');
    router.setParams({ mediaUri: undefined, mediaType: undefined, mediaFit: undefined, composeType: undefined });
  }, [mediaUri, composeType]);

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

  function selectFeedTab(nextTab: FeedTab) {
    setTab(nextTab);
    if (nextTab !== 'interests') void loadSocial(nextTab);
  }

  function maybeAskInterest(post: UpdatePost) {
    if (promptedContent.current.has(post.id) || Math.random() > 0.28) return;
    promptedContent.current.add(post.id);
    setInterestPrompt({ topic: post.tag.toLowerCase(), title: post.tag });
  }

  function chooseFeedLanguage(language: string) {
    const current = settings.feedLanguages;
    updateSettings({ feedLanguages: current.includes(language) ? current.filter((item) => item !== language) : [...current, language] });
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }} testID="updates-screen">
      <Screen title="Updates" left={<IconButton name="albums-outline" label="Open stories" onPress={openStatusShortcut} />} right={
        <View style={styles.socialHeaderActions}>
          <View>
            <IconButton name="mail-outline" label="Messages" onPress={() => void openMessageRequests()} />
            {messageRequests.length > 0 ? <View style={[styles.headerUnreadDot, { backgroundColor: colors.destructive }]} /> : null}
          </View>
          <IconButton name="search-outline" label="Search people" onPress={() => setShowPeopleSearch(true)} />
          <Pressable testID="updates-profile-button" onPress={() => setProfileUserId(session?.id ?? 0)} accessibilityRole="button" accessibilityLabel="Open your profile" style={styles.headerProfileButton}>
            <Avatar name={ownCard?.name ?? session?.name ?? 'You'} size={31} color={colors.primary} />
          </Pressable>
          <IconButton name="add" label="Create post or story" onPress={() => setCompose('post')} />
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
                  onCreatePost={() => setCompose('post')}
                  onCreateStory={() => setCompose('status')}
                interestPrompt={interestPrompt}
                onDismissInterestPrompt={() => setInterestPrompt(null)}
                onInterestFeedback={(interested) => {
                  if (!interestPrompt) return;
                  recordInterestFeedback(interestPrompt.topic, interested);
                  if (interested && !interests.includes(interestPrompt.topic)) toggleInterest(interestPrompt.topic);
                  setInterestPrompt(null);
                }}
                  onComment={setSocialCommentPost}
                  onShare={(post) => {
                    if (post.visibility !== 'public' || !post.allowReposts) {
                      Alert.alert('Sharing is off', 'This post is not public or the author has not allowed reposts.');
                      return;
                    }
                    void Share.share({ message: `${post.author.name} on Old Time:\n\n${post.content}` });
                  }}
                 onChanged={(post) => setSocialPosts((items) => items.map((item) => item.id === post.id ? post : item))}
               />

              <View style={[styles.feedTabs, { borderBottomColor: colors.border }]}>
                {(['for-you', 'following', 'interests'] as FeedTab[]).map(item => (
                  <Pressable key={item} testID={`tab-${item}`} onPress={() => selectFeedTab(item)} style={[styles.feedTab, tab === item && { borderBottomColor: colors.primary }]}>
                    <Text style={[styles.feedTabText, { color: tab === item ? colors.primary : colors.mutedForeground }]}>{item === 'for-you' ? 'For You' : item === 'following' ? 'Following' : 'Interests'}</Text>
                  </Pressable>
                ))}
              </View>

              {tab === 'interests' && <InterestPanel interests={interests} onToggle={toggleInterest} languages={settings.feedLanguages} onToggleLanguage={chooseFeedLanguage} onBack={() => setTab('for-you')} colors={colors} />}

              {tab !== 'interests' && socialPosts.length === 0 && visiblePosts.length === 0 && (
                <EmptyState icon="people-outline" title={tab === 'following' ? 'Follow a creator' : 'Choose some interests'} description={tab === 'following' ? 'Follow creators from a story to build your Following feed.' : 'Choose topics so For You knows what to prioritize.'} action={<Pressable onPress={() => setTab(tab === 'following' ? 'for-you' : 'interests')}><Text style={{ color: colors.primary, fontWeight: '600' }}>{tab === 'following' ? 'Open For You' : 'Set interests'}</Text></Pressable>} />
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
                  <Text style={{ color: '#fff', fontSize: 11, fontWeight: '600' }}>{item.likes}</Text>
               </View>
             </Pressable>
           )}
         />
      </Screen>

      <Modal visible={viewMode === 'feed'} transparent animationType="slide" onRequestClose={() => setViewMode('landing')}>
        {viewMode === 'feed' ? (
          <>
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
            onOpenProfile={() => Alert.alert('Profile moved to Inbox', 'Open a conversation or use People search in Updates to view the full profile.')}
            onFollow={(handle: string) => toggleFollow(handle)}
            followedCreators={followedCreators}
            onHide={(post: UpdatePost) => hidePost(post)}
            onOpen={(id: string, post: UpdatePost) => { recordPostInteraction(id, 'open'); maybeAskInterest(post); }}
         />
         {interestPrompt ? <InterestPrompt topic={interestPrompt.topic} title={interestPrompt.title} colors={colors} onDismiss={() => setInterestPrompt(null)} onFeedback={(interested) => { recordInterestFeedback(interestPrompt.topic, interested); if (interested && !interests.includes(interestPrompt.topic)) toggleInterest(interestPrompt.topic); setInterestPrompt(null); }} /> : null}
          </>
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

      <Modal visible={compose !== null} animationType="slide" presentationStyle="fullScreen" onRequestClose={() => setCompose(null)}>
        {compose && (
          <ComposeModal
             type={compose}
              initialMediaUri={capturedStatusMedia?.uri}
              initialMediaType={capturedStatusMedia?.type}
              initialMediaFit={capturedStatusMedia?.fit}
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
                  const uploadUrl = upload.uploadURL.startsWith('/') ? `${apiBaseUrl()}${upload.uploadURL}` : upload.uploadURL;
                  const uploaded = await expoFetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': mimeType, Authorization: `Bearer ${session.authToken}` }, body: file });
                  if (!uploaded.ok) throw new Error('The media upload did not finish.');
                  media = {
                    type: data.type === 'video' ? 'video' : 'image',
                    objectPath: upload.objectPath,
                    mimeType,
                    fit: data.fit === 'cover' ? 'cover' : 'contain',
                  };
                }
                if (compose === 'status') {
                  let storyLocation: { latitude: number; longitude: number } | null = null;
                  if (data.shareLocation) {
                    const permission = await Location.requestForegroundPermissionsAsync();
                    if (!permission.granted) throw new Error('Location permission is needed to add this Story to the map.');
                    const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
                    storyLocation = { latitude: current.coords.latitude, longitude: current.coords.longitude };
                  }
                  const story = await createStory(session.authToken, { content: data.caption, visibility: data.audience, media, location: storyLocation });
                  setSocialStories((items) => [story, ...items]);
                } else {
                  const post = await createSocialPost(session.authToken, {
                    content: data.caption,
                    kind: media?.type === 'video' ? 'video' : media?.type === 'image' ? 'photo' : 'text',
                    media: media ? [media] : undefined,
                 visibility: data.audience,
                 allowReposts: Boolean(data.allowReposts),
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

      <Modal visible={socialCommentPost !== null} transparent animationType="slide" onRequestClose={() => setSocialCommentPost(null)}>
        {socialCommentPost ? (
          <SocialCommentsSheet
            post={socialCommentPost}
            token={session?.authToken ?? ''}
            colors={colors}
            onClose={() => setSocialCommentPost(null)}
            onPostChanged={(updated) => {
              setSocialPosts((items) => items.map((item) => item.id === updated.id ? updated : item));
            }}
          />
        ) : null}
      </Modal>

      <Modal visible={profileUserId !== null} transparent animationType="slide" onRequestClose={() => setProfileUserId(null)}>
        {profileUserId !== null ? (
          <SocialProfileSheet
            userId={profileUserId}
            own={profileUserId === session?.id}
            token={session?.authToken ?? ''}
            colors={colors}
            onClose={() => setProfileUserId(null)}
            onMessageRequest={(userId, name) => {
              if (!session?.authToken) return;
              void createMessageRequest(session.authToken, userId).then(() => {
                Alert.alert('Message request sent', `${name} can accept your request before a chat opens.`);
              }).catch((error) => {
                Alert.alert('Request unavailable', error instanceof Error ? error.message : 'This message request cannot be sent.');
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
            onNotifications={() => {
              setProfileUserId(null);
              void openNotifications();
            }}
            onRequests={() => {
              setProfileUserId(null);
              void openMessageRequests();
            }}
            onBlock={(userId, name) => {
              if (!session?.authToken) return;
              Alert.alert('Block this user?', `${name} will not be able to find or contact you.`, [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Block',
                  style: 'destructive',
                  onPress: () => {
                    void setUserBlocked(session.authToken, userId, true).then(() => {
                      setProfileUserId(null);
                      Alert.alert('User blocked', `${name} can no longer find you.`);
                    }).catch((error) => Alert.alert('Could not block user', error instanceof Error ? error.message : 'Please try again.'));
                  },
                },
              ]);
            }}
            unreadCount={unreadNotifications}
          />
        ) : null}
      </Modal>

      <Modal
        visible={showPeopleSearch}
        transparent
        animationType="slide"
        onRequestClose={() => setShowPeopleSearch(false)}
      >
        <SearchPeopleSheet
          query={peopleQuery}
          results={peopleResults}
          loading={peopleSearchLoading}
          error={peopleSearchError}
          colors={colors}
          onChangeQuery={setPeopleQuery}
          onClose={() => {
            setShowPeopleSearch(false);
            setPeopleQuery('');
            setPeopleResults([]);
            setPeopleSearchError(null);
          }}
          onOpenProfile={(userId) => {
            setShowPeopleSearch(false);
            setProfileUserId(userId);
          }}
        />
      </Modal>

      <Modal visible={showMessageRequests} transparent animationType="slide" onRequestClose={() => setShowMessageRequests(false)}>
        <MessageRequestsSheet
          requests={messageRequests}
          loading={messageRequestsLoading}
          colors={colors}
          onClose={() => setShowMessageRequests(false)}
          onAccept={(messageRequest) => {
            if (!session?.authToken) return;
            void acceptMessageRequest(session.authToken, messageRequest.id).then(({ chatId }) => {
              setMessageRequests((items) => items.filter((item) => item.id !== messageRequest.id));
              setShowMessageRequests(false);
              router.push(`/chat/${chatId}`);
            }).catch((error) => Alert.alert('Could not accept request', error instanceof Error ? error.message : 'Please try again.'));
          }}
          onDecline={(messageRequest) => {
            if (!session?.authToken) return;
            void declineMessageRequest(session.authToken, messageRequest.id).then(() => {
              setMessageRequests((items) => items.filter((item) => item.id !== messageRequest.id));
            }).catch((error) => Alert.alert('Could not decline request', error instanceof Error ? error.message : 'Please try again.'));
          }}
        />
      </Modal>

      <Modal visible={showNotifications} transparent animationType="slide" onRequestClose={() => setShowNotifications(false)}>
        <NotificationsSheet
          notifications={notifications}
          loading={notificationsLoading}
          colors={colors}
          token={session?.authToken ?? ''}
          onClose={() => setShowNotifications(false)}
          onRead={(notification) => {
            if (!notification.readAt && session?.authToken) {
              void markSocialNotificationRead(session.authToken, notification.id);
              setNotifications((items) => items.map((item) => item.id === notification.id ? { ...item, readAt: Date.now() } : item));
            }
            if (notification.storyId) {
              const story = socialStories.find((item) => item.id === notification.storyId);
              if (story) {
                setShowNotifications(false);
                setServerStoryOpen(story);
              }
            }
          }}
        />
      </Modal>

      <Modal visible={serverStoryOpen !== null} transparent animationType="fade" onRequestClose={() => setServerStoryOpen(null)}>
        {serverStoryOpen ? <ServerStoryViewer items={socialStories.map(userStoryViewerItem)} initialItemId={userStoryViewerItemId(serverStoryOpen.id)} token={session?.authToken ?? ''} onClose={() => setServerStoryOpen(null)} /> : null}
      </Modal>

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
      onOpen(firstVisible.item.id, firstVisible.item);
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
           <Text style={{ color: '#fff', fontSize: 16, fontWeight: '600', marginBottom: 8 }}>@{post.handle}</Text>
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
           <Text style={{ color: '#fff', fontWeight: '600', fontSize: 14 }}>{group.author}</Text>
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
           <Text style={{ color: '#fff', fontSize: 28, fontWeight: '600', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 10 }}>{item.caption}</Text>
         </View>
       ) : (
         <View style={{ flex: 1, pointerEvents: 'none', justifyContent: 'flex-end', padding: 20, paddingBottom: 100 }}>
           {item.caption ? <Text style={{ color: '#fff', fontSize: 18, fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 10 }}>{item.caption}</Text> : null}
         </View>
       )}

    </KeyboardAvoidingView>
  );
}

function ComposeModal({ type, onClose, onPublish, colors, initialMediaUri, initialMediaType, initialMediaFit, defaultAudience }: any) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [draft, setDraft] = useState('');
  const storyColors = [colors.brandBlue, ...postColors] as string[];
  const [selectedColor, setSelectedColor] = useState(colors.brandBlue);
  const [tag, setTag] = useState(creatorTags[0]);
  const [audience, setAudience] = useState<SharingAudience>(defaultAudience === 'public' ? 'friends' : (defaultAudience ?? 'friends'));
  const [mediaUri, setMediaUri] = useState<string | null>(initialMediaUri ?? null);
  const [mediaFit, setMediaFit] = useState<'contain' | 'cover'>(initialMediaFit ?? 'contain');
  const [selectedMediaType, setSelectedMediaType] = useState<'photo' | 'video'>(
    initialMediaType === 'video' ? 'video' : 'photo',
  );
   const [publishing, setPublishing] = useState(false);
   const [shareLocation, setShareLocation] = useState(false);
   const [allowReposts, setAllowReposts] = useState(false);
   const gradient: [string, string, string] = type === 'status' && selectedColor === colors.brandBlue
     ? [colors.brandBlue, colors.brandBlue, colors.brandBlue]
     : [...storyGradients[Math.abs(selectedColor.charCodeAt(1) || 0) % storyGradients.length]];

  async function pickMedia() {
    const ImagePicker = await import('expo-image-picker');
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
      allowsEditing: false,
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
          await onPublish({ caption: draft.trim(), color: selectedColor, type: mediaUri ? selectedMediaType : 'text', uri: mediaUri, audience, shareLocation, fit: mediaFit });
       } else {
           await onPublish({ caption: draft.trim(), tag, color: selectedColor, type: mediaUri ? selectedMediaType : 'text', uri: mediaUri, audience, fit: mediaFit, allowReposts });
       }
       onClose();
     } catch (error) {
       Alert.alert('Update not shared', error instanceof Error ? error.message : 'Please check your connection and try again.');
     } finally {
       setPublishing(false);
    }
  }

  return (
    <LinearGradient colors={gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1 }} testID="compose-modal">
     <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
      {mediaUri && (
        <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFill} contentFit={mediaFit} />
      )}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: mediaUri ? 'rgba(0,0,0,0.4)' : 'transparent' }]} />

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingTop: Math.max(insets.top, 20) + 10 }}>
        <IconButton name="close" color="#fff" onPress={onClose} />
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{type === 'status' ? 'Create a story' : 'Create a post'}</Text>
        <Pressable disabled={publishing} onPress={() => void handlePublish()} style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, opacity: publishing ? 0.65 : 1 }}>
          <Text style={{ color: '#000', fontWeight: '700', fontSize: 14 }}>{publishing ? 'Posting…' : type === 'status' ? 'Share to story' : 'Post'}</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
         <TextInput
           autoFocus
           value={draft}
           onChangeText={setDraft}
            placeholder={type === 'status' ? 'Say something…' : 'What’s on your mind?'}
           placeholderTextColor="rgba(255,255,255,0.7)"
           multiline
           style={{ color: '#fff', fontSize: 28, fontWeight: '600', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 10 }}
         />
      </View>

      <View style={{ paddingBottom: Math.max(insets.bottom, 20) + 20, paddingHorizontal: 16, gap: 20 }}>
          <View>
            <Text style={{ color: 'rgba(255,255,255,0.85)', textAlign: 'center', fontSize: 12, fontWeight: '600', marginBottom: 8 }}>AUDIENCE</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 4 }}>
              {((type === 'status'
                ? ['public', 'friends', 'followers', 'close_friends', 'private']
                : ['public', 'friends', 'followers', 'private']
              ) as SharingAudience[]).map((item) => (
                <Pressable key={item} onPress={() => setAudience(item)} style={{ backgroundColor: audience === item ? '#fff' : 'rgba(255,255,255,0.2)', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 }}>
                  <Text style={{ color: audience === item ? '#000' : '#fff', fontWeight: '600', fontSize: 13 }}>{audienceLabel(item)}</Text>
                </Pressable>
              ))}
            </ScrollView>
            {audience === 'public' ? <Text style={{ color: '#fff', textAlign: 'center', fontSize: 11, marginTop: 7 }}>Public was selected explicitly. Anyone on Old Time may see this.</Text> : null}
          </View>

          {type === 'post' && audience === 'public' ? (
            <Pressable onPress={() => setAllowReposts((value) => !value)} style={styles.repostPermission} accessibilityRole="switch" accessibilityState={{ checked: allowReposts }}>
              <View style={[styles.repostPermissionIcon, { backgroundColor: allowReposts ? '#fff' : 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="repeat-outline" size={17} color={allowReposts ? selectedColor : '#fff'} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.repostPermissionTitle}>Allow reposts</Text>
                <Text style={styles.repostPermissionHint}>Let people share this public post in Old Time.</Text>
              </View>
              <View style={[styles.repostPermissionSwitch, { backgroundColor: allowReposts ? '#fff' : 'rgba(255,255,255,0.25)' }]}>
                <View style={[styles.repostPermissionThumb, { backgroundColor: allowReposts ? selectedColor : '#fff', transform: [{ translateX: allowReposts ? 16 : 0 }] }]} />
              </View>
            </Pressable>
          ) : null}

         {type === 'post' && (
           <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
             {creatorTags.map(item => (
               <Pressable key={item} onPress={() => setTag(item)} style={{ backgroundColor: tag === item ? '#fff' : 'rgba(255,255,255,0.2)', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20 }}>
                 <Text style={{ color: tag === item ? '#000' : '#fff', fontWeight: '600', fontSize: 13 }}>#{item}</Text>
               </Pressable>
             ))}
           </ScrollView>
         )}

          {type === 'status' ? (
            <Pressable onPress={() => setShareLocation((value) => !value)} style={styles.mapStoryToggle} accessibilityRole="switch" accessibilityState={{ checked: shareLocation }}>
              <View style={[styles.mapStoryIcon, { backgroundColor: shareLocation ? '#FFFFFF' : 'rgba(255,255,255,0.2)' }]}>
                <Ionicons name="location" size={17} color={shareLocation ? selectedColor : '#FFFFFF'} />
              </View>
              <Text style={styles.mapStoryLabel}>Add to Map</Text>
              <View style={[styles.mapStorySwitch, { backgroundColor: shareLocation ? '#FFFFFF' : 'rgba(255,255,255,0.25)' }]}>
                <View style={[styles.mapStoryThumb, { backgroundColor: shareLocation ? selectedColor : '#FFFFFF', transform: [{ translateX: shareLocation ? 16 : 0 }] }]} />
              </View>
            </Pressable>
          ) : null}

         <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
             <Pressable onPress={() => { onClose(); router.push({ pathname: '/camera', params: { returnTo: type } }); }} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }} accessibilityRole="button" accessibilityLabel={type === 'status' ? 'Open camera for story' : 'Open camera for post'}>
              <Ionicons name="camera" size={22} color="#fff" />
            </Pressable>
            <Pressable onPress={pickMedia} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
              <Ionicons name="image" size={22} color="#fff" />
            </Pressable>
             {storyColors.map(c => (
              <Pressable key={c} onPress={() => setSelectedColor(c)} style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: c, borderWidth: 3, borderColor: selectedColor === c ? '#fff' : 'transparent' }} />
            ))}
         </View>
      </View>
     </KeyboardAvoidingView>
    </LinearGradient>
  );
}

function CommentSheet({ post, onClose, colors, onAdd }: any) {
  const [text, setText] = useState('');
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={{ backgroundColor: colors.card, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, maxHeight: WINDOW_HEIGHT * 0.7 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: '600' }}>{post?.comments.length || 0} comments</Text>
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

function StoryCard({ story, name, isOwn, colors, token, onPress }: { story?: Story; name: string; isOwn?: boolean; colors: any; token: string; onPress: () => void }) {
  const mediaUri = story?.media ? socialMediaUrl(story.media.objectPath) : undefined;
  const gradient = storyGradients[(story?.id ?? name.length) % storyGradients.length];
  return (
    <Pressable onPress={onPress} style={styles.socialStoryCard} accessibilityRole="button" accessibilityLabel={isOwn ? 'View your story' : `View ${name}'s story`}>
      <LinearGradient colors={gradient} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      {mediaUri ? <Image source={{ uri: mediaUri }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      <View style={[StyleSheet.absoluteFill, { backgroundColor: mediaUri ? 'rgba(0,0,0,0.22)' : 'rgba(0,0,0,0.06)' }]} />
      <View style={styles.socialStoryCardTop}>
        <StoryAvatar name={name} size={42} color={colors.card} uri={mediaUri} viewed={Boolean(story?.viewer.viewed)} add={isOwn && !story} />
      </View>
      <View style={styles.socialStoryCardBottom}>
        {isOwn ? <Ionicons name={story ? 'play' : 'add'} size={12} color="#fff" /> : null}
        <Text style={styles.socialStoryCardName} numberOfLines={1}>{isOwn ? (story ? 'Your story' : 'Add story') : name}</Text>
      </View>
    </Pressable>
  );
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
  onCreatePost,
  onCreateStory,
  interestPrompt,
  onDismissInterestPrompt,
  onInterestFeedback,
  onComment,
  onShare,
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
  onCreatePost: () => void;
  onCreateStory: () => void;
  interestPrompt: { topic: string; title: string } | null;
  onDismissInterestPrompt: () => void;
  onInterestFeedback: (interested: boolean) => void;
  onComment: (post: SocialPost) => void;
  onShare: (post: SocialPost) => void;
  onChanged: (post: SocialPost) => void;
}) {
  const ownStory = stories.find((story) => story.viewer.isOwner);
  const otherStories = stories.filter((story) => !story.viewer.isOwner);
  return (
    <View style={styles.socialHub}>
      <View style={styles.socialStoryHeading}>
        <View>
          <Text style={[styles.socialSectionTitle, { color: colors.foreground }]}>Stories</Text>
          <Text style={[styles.socialSectionHint, { color: colors.mutedForeground }]}>Share a moment with your people</Text>
        </View>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.socialStoryRail}>
        <StoryCard story={ownStory} name={card?.name ?? 'You'} isOwn colors={colors} token={token} onPress={ownStory ? () => onOpenStory(ownStory) : onCreateStory} />
        {otherStories.slice(0, 10).map((story) => (
          <StoryCard key={story.id} story={story} name={story.author.name} colors={colors} token={token} onPress={() => onOpenStory(story)} />
        ))}
      </ScrollView>
      <View style={styles.socialCreateRow}>
        <Pressable onPress={onCreatePost} style={[styles.socialCreateButton, { backgroundColor: colors.primary }]} accessibilityRole="button" accessibilityLabel="Create a post">
          <Ionicons name="create-outline" size={18} color="#fff" />
          <Text style={styles.socialCreateButtonText}>Create a post</Text>
        </Pressable>
        <Pressable onPress={onCreateStory} style={[styles.socialCreateButton, { backgroundColor: colors.card, borderColor: colors.border, borderWidth: 1 }]} accessibilityRole="button" accessibilityLabel="Create a story">
          <Ionicons name="add-circle-outline" size={18} color={colors.primary} />
          <Text style={[styles.socialCreateButtonText, { color: colors.foreground }]}>Create a story</Text>
        </Pressable>
      </View>

      {loading ? (
        <View style={[styles.socialState, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : error ? (
        <Pressable onPress={onRetry} style={[styles.socialState, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button">
          <Ionicons name="cloud-offline-outline" size={20} color={colors.destructive} />
          <Text style={{ color: colors.foreground, flex: 1 }}>{error}</Text>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Retry</Text>
        </Pressable>
      ) : posts.length > 0 ? (
        <View style={styles.socialPostList}>
          {posts.slice(0, 3).map((post, index) => (
            <React.Fragment key={post.id}>
              <SocialPostCard post={post} colors={colors} token={token} onOpenProfile={() => onOpenProfile(post.author.id)} onShare={() => onShare(post)} onComment={() => onComment(post)} onChanged={onChanged} />
              {index === 0 && interestPrompt ? <InterestPrompt topic={interestPrompt.topic} title={interestPrompt.title} colors={colors} onDismiss={onDismissInterestPrompt} onFeedback={onInterestFeedback} /> : null}
            </React.Fragment>
          ))}
        </View>
      ) : (
        <View />
      )}
    </View>
  );
}

function SocialPostCard({ post, colors, token, onOpenProfile, onShare, onComment, onChanged }: { post: SocialPost; colors: any; token: string; onOpenProfile: () => void; onShare: () => void; onComment?: () => void; onChanged: (post: SocialPost) => void }) {
  const [busy, setBusy] = useState(false);
  const media = post.media[0];
  const canRepost = post.visibility === 'public' && post.allowReposts;

  async function toggle(relation: 'like' | 'save' | 'repost') {
    if (busy) return;
    const countKey = relation === 'like' ? 'likes' : relation === 'save' ? 'saves' : 'reposts';
    const viewerKey = relation === 'like' ? 'liked' : relation === 'save' ? 'saved' : 'reposted';
    const active = !post.viewer[viewerKey];
    const next: SocialPost = {
      ...post,
      counts: { ...post.counts, [countKey]: Math.max(0, post.counts[countKey] + (active ? 1 : -1)) },
      viewer: { ...post.viewer, [viewerKey]: active },
    };
    onChanged(next);
    setBusy(true);
    try {
      await setPostRelation(token, post.id, relation, active);
    } catch (error) {
      onChanged(post);
      Alert.alert('Action not saved', error instanceof Error ? error.message : 'Please try again.');
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
        <Pressable onPress={() => Alert.alert('Post options', 'Choose what you want to do with this post.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Report', style: 'destructive', onPress: () => void reportSocialContent(token, { targetType: 'post', targetId: post.id, reason: 'other' }).then(() => Alert.alert('Report sent', 'Thanks for helping keep Old Time safe.')).catch(() => Alert.alert('Report unavailable', 'Please try again.')) }])} accessibilityRole="button" accessibilityLabel="Open post options" hitSlop={10}>
          <Ionicons name="ellipsis-horizontal" size={19} color={colors.mutedForeground} />
        </Pressable>
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
        <Pressable onPress={onComment} style={styles.socialAction} accessibilityRole="button" accessibilityLabel={`Open comments, ${post.counts.comments} comments`}>
          <Ionicons name="chatbubble-outline" size={18} color={colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{post.counts.comments}</Text>
        </Pressable>
        <Pressable onPress={() => void toggle('save')} style={styles.socialAction} accessibilityRole="button" accessibilityLabel={post.viewer.saved ? 'Unsave post' : 'Save post'}>
          <Ionicons name={post.viewer.saved ? 'bookmark' : 'bookmark-outline'} size={18} color={post.viewer.saved ? colors.primary : colors.mutedForeground} />
          <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{post.counts.saves}</Text>
        </Pressable>
        <Pressable
          onPress={() => {
            if (!canRepost) {
              Alert.alert('Reposts are off', 'This post must be public and the author must allow reposts.');
              return;
            }
            void toggle('repost');
          }}
          style={styles.socialAction}
          accessibilityRole="button"
          accessibilityLabel={canRepost ? (post.viewer.reposted ? 'Remove repost' : 'Repost') : 'Reposts are disabled'}
        >
          <Ionicons name="repeat-outline" size={19} color={post.viewer.reposted ? colors.primary : canRepost ? colors.mutedForeground : colors.border} />
          <Text style={{ color: canRepost ? colors.mutedForeground : colors.border, fontSize: 12 }}>{post.counts.reposts}</Text>
        </Pressable>
        <Pressable onPress={onShare} style={styles.socialAction} accessibilityRole="button" accessibilityLabel="Share post">
          <Ionicons name="arrow-redo-outline" size={18} color={canRepost ? colors.mutedForeground : colors.border} />
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

function SocialProfileSheet({ userId, own, token, colors, onClose, onMessageRequest, onExclude, onNotifications, onRequests, onBlock, unreadCount }: { userId: number; own: boolean; token: string; colors: any; onClose: () => void; onMessageRequest: (userId: number, name: string) => void; onExclude: (person: { id: number; name: string }) => void; onNotifications: () => void; onRequests: () => void; onBlock: (userId: number, name: string) => void; unreadCount: number }) {
  const [card, setCard] = useState<UserCard | null>(null);
  const [profilePosts, setProfilePosts] = useState<SocialPost[]>([]);
  const [profilePostsLoading, setProfilePostsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [following, setFollowingState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setProfilePostsLoading(true);
    void Promise.all([getUserCard(token, userId), getUserPosts(token, userId)]).then(([next, posts]) => {
      if (!mounted) return;
      setCard(next);
      setFollowingState(next.following);
      setProfilePosts(posts.items);
    }).catch((requestError) => {
      if (mounted) setError(requestError instanceof Error ? requestError.message : 'This profile is unavailable.');
    }).finally(() => {
      if (mounted) {
        setLoading(false);
        setProfilePostsLoading(false);
      }
    });
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
          <ScrollView
            style={{ width: '100%' }}
            contentContainerStyle={styles.socialProfileContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Avatar name={card.name} size={86} color={colors.primary} />
            <Text style={[styles.socialProfileName, { color: colors.foreground }]}>{own ? 'You' : card.name}</Text>
            <Text style={[styles.socialProfileHandle, { color: colors.mutedForeground }]}>@{card.username}</Text>
            {card.bio ? <Text style={[styles.socialProfileBio, { color: colors.foreground }]}>{card.bio}</Text> : null}
            <View style={styles.socialProfileStats}>
              <View><Text style={[styles.profileStatValue, { color: colors.foreground }]}>{card.followerCount}</Text><Text style={[styles.profileStatLabel, { color: colors.mutedForeground }]}>Followers</Text></View>
              <View><Text style={[styles.profileStatValue, { color: colors.foreground }]}>{card.followingCount}</Text><Text style={[styles.profileStatLabel, { color: colors.mutedForeground }]}>Following</Text></View>
            </View>
            <View style={styles.profilePostsHeading}>
              <Text style={[styles.socialSectionTitle, { color: colors.foreground }]}>{own ? 'Your posts' : `${card.name}'s posts`}</Text>
              <Text style={[styles.socialSectionHint, { color: colors.mutedForeground }]}>{profilePosts.length} shared</Text>
            </View>
            {profilePostsLoading ? (
              <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} />
            ) : profilePosts.length > 0 ? (
              <View style={styles.profilePostFeed}>
                {profilePosts.map((post) => (
                  <SocialPostCard
                    key={post.id}
                    post={post}
                    colors={colors}
                    token={token}
                    onOpenProfile={() => undefined}
                    onShare={() => Alert.alert('Post sharing', 'Use repost or share from the post actions.')}
                    onChanged={(updated) => setProfilePosts((items) => items.map((item) => item.id === updated.id ? updated : item))}
                  />
                ))}
              </View>
            ) : (
              <Text style={[styles.profilePostsEmpty, { color: colors.mutedForeground }]}>
                {own ? 'Your public and audience-approved posts will appear here.' : 'No visible posts yet.'}
              </Text>
            )}
            <View style={styles.socialProfileActions}>
              {own ? <Pressable onPress={onNotifications} style={[styles.profileIconAction, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Open notifications"><Ionicons name="notifications-outline" size={19} color={colors.primary} />{unreadCount > 0 ? <View style={{ position: 'absolute', top: -1, right: -1, width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.destructive }} /> : null}</Pressable> : null}
              {own ? <Pressable onPress={onRequests} style={[styles.profileIconAction, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Open social messages"><Ionicons name="mail-unread-outline" size={19} color={colors.primary} /><Text style={{ color: colors.foreground, fontWeight: '600' }}>Messages</Text></Pressable> : null}
              {!own ? <Pressable onPress={() => void toggleFollow()} style={[styles.profileAction, { backgroundColor: following ? colors.secondary : colors.primary }]}><Ionicons name={following ? 'checkmark' : 'person-add-outline'} size={17} color={following ? colors.foreground : '#fff'} /><Text style={{ color: following ? colors.foreground : '#fff', fontWeight: '600' }}>{following ? 'Following' : 'Follow'}</Text></Pressable> : null}
              {!own && card.canMessage ? <Pressable onPress={() => onMessageRequest(userId, card.name)} style={[styles.profileIconAction, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel={`Message ${card.name}`}><Ionicons name="mail-outline" size={19} color={colors.primary} /><Text style={{ color: colors.foreground, fontWeight: '600' }}>Message</Text></Pressable> : null}
            </View>
            {!own ? <Pressable onPress={() => { onExclude({ id: card.id, name: card.name }); Alert.alert('Sharing list updated', `${card.name} was added or removed from your excluded audience list.`); }} style={styles.excludeAction}><Ionicons name="eye-off-outline" size={17} color={colors.mutedForeground} /><Text style={{ color: colors.mutedForeground }}>Toggle excluded from sharing</Text></Pressable> : null}
            {!own ? <Pressable onPress={() => onBlock(card.id, card.name)} style={styles.excludeAction}><Ionicons name="ban-outline" size={17} color={colors.destructive} /><Text style={{ color: colors.destructive }}>Block {card.name}</Text></Pressable> : null}
            <Pressable onPress={onClose} style={[styles.profileDone, { borderColor: colors.border }]}><Text style={{ color: colors.primary, fontWeight: '600' }}>Done</Text></Pressable>
          </ScrollView>
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
              <View style={{ flex: 1 }}><Text style={[styles.notificationText, { color: colors.foreground }]}><Text style={{ fontWeight: '600' }}>{item.actor.name}</Text>{` ${notificationCopy(item.type)}`}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 4 }}>{relativeSocialTime(item.createdAt)}</Text></View>
              {!item.readAt ? <View style={[styles.unreadDot, { backgroundColor: colors.primary }]} /> : null}
            </Pressable>
          ))}
        </ScrollView>}
      </View>
    </KeyboardAvoidingView>
  );
}

function SocialCommentsSheet({ post, token, colors, onClose, onPostChanged }: { post: SocialPost; token: string; colors: any; onClose: () => void; onPostChanged: (post: SocialPost) => void }) {
  const [comments, setComments] = useState<SocialComment[]>([]);
  const [text, setText] = useState('');
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    void getPostComments(token, post.id)
      .then((items) => { if (mounted) setComments(items); })
      .catch(() => { if (mounted) setComments([]); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [post.id, token]);

  async function submit() {
    const content = text.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const comment = await createPostComment(token, post.id, content);
      setComments((items) => [...items, comment]);
      setText('');
      onPostChanged({ ...post, counts: { ...post.counts, comments: post.counts.comments + 1 } });
    } catch (error) {
      Alert.alert('Comment not posted', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.sheetOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.commentsSheet, { backgroundColor: colors.card }]}>
        <View style={styles.sheetTop}>
          <View>
            <Text style={[styles.sheetEyebrow, { color: colors.mutedForeground }]}>SOCIAL POST</Text>
            <Text style={[styles.notificationsTitle, { color: colors.foreground }]}>Comments</Text>
          </View>
          <IconButton name="close" onPress={onClose} size={24} />
        </View>
        {loading ? <ActivityIndicator color={colors.primary} style={{ margin: 34 }} /> : (
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
            {comments.length === 0 ? <Text style={[styles.profilePostsEmpty, { color: colors.mutedForeground }]}>Be the first person to comment.</Text> : comments.map((comment) => (
              <View key={comment.id} style={[styles.commentRow, { borderBottomColor: colors.border }]}>
                <Avatar name={comment.author.name} size={34} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.commentAuthor, { color: colors.foreground }]}>{comment.author.name} <Text style={{ color: colors.mutedForeground, fontWeight: '400' }}>@{comment.author.username}</Text></Text>
                  <Text style={[styles.commentContent, { color: colors.foreground }]}>{comment.content}</Text>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
        <View style={[styles.commentComposer, { borderTopColor: colors.border }]}>
          <TextInput
            value={text}
            onChangeText={setText}
            placeholder="Write a comment…"
            placeholderTextColor={colors.mutedForeground}
            multiline
            maxLength={1000}
            style={[styles.commentInput, { color: colors.foreground, backgroundColor: colors.muted }]}
            accessibilityLabel="Comment"
          />
          <Pressable onPress={() => void submit()} disabled={!text.trim() || sending} style={{ opacity: !text.trim() || sending ? 0.4 : 1 }} accessibilityRole="button" accessibilityLabel="Post comment">
            <Ionicons name="send" size={22} color={colors.primary} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

function MessageRequestsSheet({ requests, loading, colors, onClose, onAccept, onDecline }: { requests: MessageRequest[]; loading: boolean; colors: any; onClose: () => void; onAccept: (request: MessageRequest) => void; onDecline: (request: MessageRequest) => void }) {
  return (
    <KeyboardAvoidingView behavior="padding" style={styles.sheetOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.notificationsSheet, { backgroundColor: colors.card }]}>
        <View style={styles.sheetTop}>
          <View>
            <Text style={[styles.sheetEyebrow, { color: colors.mutedForeground }]}>PRIVATE INBOX</Text>
            <Text style={[styles.notificationsTitle, { color: colors.foreground }]}>Message requests</Text>
          </View>
          <IconButton name="close" onPress={onClose} size={24} />
        </View>
        {loading ? <ActivityIndicator color={colors.primary} style={{ margin: 36 }} /> : (
          <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
            {requests.length === 0 ? (
              <View style={styles.notificationEmpty}>
                <Ionicons name="mail-open-outline" size={28} color={colors.primary} />
                <Text style={[styles.notificationEmptyTitle, { color: colors.foreground }]}>No pending requests</Text>
                <Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>New conversations stay here until you accept them.</Text>
              </View>
            ) : requests.map((item) => (
              <View key={item.id} style={[styles.notificationRow, { borderBottomColor: colors.border }]}>
                <Avatar name={item.sender.name} size={42} color={colors.primary} />
                <View style={{ flex: 1, marginRight: 10 }}>
                  <Text style={[styles.notificationText, { color: colors.foreground }]}>
                    <Text style={{ fontWeight: '700' }}>{item.sender.name}</Text> wants to message you
                  </Text>
                  <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 3 }}>@{item.sender.username}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
                    <Pressable onPress={() => onAccept(item)} style={[styles.profileAction, { backgroundColor: colors.primary, paddingHorizontal: 12, paddingVertical: 8 }]}>
                      <Text style={{ color: '#fff', fontWeight: '700' }}>Accept</Text>
                    </Pressable>
                    <Pressable onPress={() => onDecline(item)} style={[styles.profileIconAction, { borderColor: colors.border, paddingHorizontal: 12, paddingVertical: 8 }]}>
                      <Text style={{ color: colors.foreground, fontWeight: '600' }}>Decline</Text>
                    </Pressable>
                  </View>
                </View>
              </View>
            ))}
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function SearchPeopleSheet({ query, results, loading, error, colors, onChangeQuery, onClose, onOpenProfile }: { query: string; results: SocialUser[]; loading: boolean; error: string | null; colors: any; onChangeQuery: (query: string) => void; onClose: () => void; onOpenProfile: (userId: number) => void }) {
  return (
    <KeyboardAvoidingView behavior="padding" style={styles.sheetOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.notificationsSheet, { backgroundColor: colors.card }]}>
        <View style={styles.sheetTop}>
          <View>
            <Text style={[styles.sheetEyebrow, { color: colors.mutedForeground }]}>SOCIAL DISCOVERY</Text>
            <Text style={[styles.notificationsTitle, { color: colors.foreground }]}>Find people</Text>
          </View>
          <IconButton name="close" onPress={onClose} size={24} />
        </View>
        <View style={[styles.peopleSearchInput, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={onChangeQuery}
            placeholder="Search name or @username"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.peopleSearchText, { color: colors.foreground }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
        <Text style={[styles.peopleSearchHint, { color: colors.mutedForeground }]}>This searches social profiles, not your private chats.</Text>
        {loading ? <ActivityIndicator color={colors.primary} style={{ margin: 30 }} /> : error ? (
          <Text style={[styles.profilePostsEmpty, { color: colors.destructive }]}>{error}</Text>
        ) : query.trim().length < 2 ? (
          <View style={styles.notificationEmpty}>
            <Ionicons name="people-outline" size={28} color={colors.primary} />
            <Text style={[styles.notificationEmptyTitle, { color: colors.foreground }]}>Search by name or username</Text>
          </View>
        ) : results.length === 0 ? (
          <View style={styles.notificationEmpty}>
            <Ionicons name="person-remove-outline" size={28} color={colors.primary} />
            <Text style={[styles.notificationEmptyTitle, { color: colors.foreground }]}>No people found</Text>
            <Text style={{ color: colors.mutedForeground, textAlign: 'center' }}>Try a different name or username.</Text>
          </View>
        ) : (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 25 }}>
            {results.map((person) => (
              <Pressable
                key={person.id}
                onPress={() => onOpenProfile(person.id)}
                style={[styles.peopleSearchRow, { borderBottomColor: colors.border }]}
                accessibilityRole="button"
                accessibilityLabel={`Open ${person.name}'s profile`}
              >
                <Avatar name={person.name} size={44} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.socialAuthorName, { color: colors.foreground }]}>{person.name}</Text>
                  <Text style={[styles.socialAuthorMeta, { color: colors.mutedForeground }]}>@{person.username}</Text>
                </View>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </Pressable>
            ))}
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function notificationCopy(type: string) {
  if (type.includes('reply')) return 'replied to your story';
  if (type.includes('reaction')) return 'reacted to your story';
  return 'interacted with your update';
}

function inferSocialTopic(post: SocialPost) {
  const content = `${post.content} ${post.linkTitle ?? ''}`.toLowerCase();
  const match = INTEREST_OPTIONS.find((interest) => content.includes(interest.id) || content.includes(interest.label.toLowerCase()));
  return match?.id ?? 'culture';
}

function InterestPrompt({ topic, title, colors, onDismiss, onFeedback }: { topic: string; title: string; colors: any; onDismiss: () => void; onFeedback: (interested: boolean) => void }) {
  return (
    <View style={[styles.interestPrompt, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.interestPromptIcon, { backgroundColor: colors.secondary }]}>
        <Ionicons name="sparkles-outline" size={18} color={colors.primary} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[styles.interestPromptTitle, { color: colors.foreground }]}>Interested in this?</Text>
        <Text style={[styles.interestPromptText, { color: colors.mutedForeground }]} numberOfLines={2}>Tell us whether content from {title} belongs in your For You feed.</Text>
      </View>
      <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss interest question" hitSlop={8}>
        <Ionicons name="close" size={18} color={colors.mutedForeground} />
      </Pressable>
      <View style={styles.interestPromptActions}>
        <Pressable onPress={() => onFeedback(false)} style={[styles.interestPromptButton, { borderColor: colors.border }]} accessibilityRole="button">
          <Ionicons name="thumbs-down-outline" size={16} color={colors.mutedForeground} />
          <Text style={[styles.interestPromptButtonText, { color: colors.mutedForeground }]}>Not for me</Text>
        </Pressable>
        <Pressable onPress={() => onFeedback(true)} style={[styles.interestPromptButton, { backgroundColor: colors.primary, borderColor: colors.primary }]} accessibilityRole="button">
          <Ionicons name="thumbs-up-outline" size={16} color="#fff" />
          <Text style={[styles.interestPromptButtonText, { color: '#fff' }]}>Show more</Text>
        </Pressable>
      </View>
    </View>
  );
}

function InterestPanel({ interests, onToggle, languages, onToggleLanguage, onBack, colors }: any) {
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
      <View style={[styles.languageSection, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Text style={[styles.languageSectionTitle, { color: colors.foreground }]}>Content languages</Text>
        <Text style={[styles.languageSectionHint, { color: colors.mutedForeground }]}>Choose the languages you want prioritized in Updates.</Text>
        <View style={styles.languageGrid}>
          {FEED_LANGUAGE_OPTIONS.map((language) => {
            const selected = languages.includes(language.id);
            return (
              <Pressable key={language.id} onPress={() => onToggleLanguage(language.id)} style={[styles.languageChip, { backgroundColor: selected ? colors.primary : colors.muted, borderColor: selected ? colors.primary : colors.border }]} accessibilityRole="button" accessibilityState={{ selected }}>
                <Text style={[styles.languageChipText, { color: selected ? '#fff' : colors.foreground }]}>{language.nativeLabel}</Text>
                <Text style={[styles.languageChipSubtext, { color: selected ? 'rgba(255,255,255,0.78)' : colors.mutedForeground }]}>{language.label}</Text>
              </Pressable>
            );
          })}
        </View>
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
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to For You" style={styles.backButton}>
        <Ionicons name="arrow-back" size={17} color={colors.primary} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  socialHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  headerProfileButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginHorizontal: 1 },
  mapStoryToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center', paddingHorizontal: 12 },
  mapStoryIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  mapStoryLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  mapStorySwitch: { width: 42, height: 24, borderRadius: 12, padding: 3 },
  mapStoryThumb: { width: 18, height: 18, borderRadius: 9 },
  headerAvatarButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerUnreadDot: { position: 'absolute', top: 3, right: 3, width: 9, height: 9, borderRadius: 5, borderWidth: 2, borderColor: '#fff' },
  createPill: { minHeight: 36, borderRadius: 20, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 4 },
  createPillText: { color: '#fff', fontSize: 13, fontWeight: '600' },
  bellButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  notificationBadge: { position: 'absolute', top: 4, right: 3, minWidth: 16, height: 16, borderRadius: 8, paddingHorizontal: 3, alignItems: 'center', justifyContent: 'center' },
  notificationBadgeText: { color: '#fff', fontSize: 9, fontWeight: '600' },
  socialHub: { paddingHorizontal: 10, paddingTop: 10, paddingBottom: 8 },
  socialHubHeading: { flexDirection: 'row', alignItems: 'center', marginBottom: 10 },
  socialHubTitle: { fontSize: 21, fontWeight: '600', letterSpacing: -0.4 },
  socialHubSubtitle: { fontSize: 12, marginTop: 2 },
  mapPill: { minHeight: 38, borderRadius: 20, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapPillText: { fontSize: 13, fontWeight: '600' },
  socialIdentity: { minHeight: 74, borderWidth: 1, borderRadius: 24, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  socialIdentityName: { fontSize: 15, fontWeight: '600' },
  socialIdentityHandle: { fontSize: 11, marginTop: 3, lineHeight: 15 },
  socialProfileLink: { minHeight: 30, borderRadius: 15, paddingHorizontal: 9, flexDirection: 'row', alignItems: 'center', gap: 2 },
  statStack: { alignItems: 'center', minWidth: 46 },
  statValue: { fontSize: 15, fontWeight: '600' },
  statLabel: { fontSize: 9, marginTop: 2 },
  socialStoryRail: { gap: 14, paddingVertical: 14, paddingHorizontal: 4 },
  socialStoryHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, paddingTop: 4 },
  socialStoryCard: { width: 92, height: 142, borderRadius: 18, overflow: 'hidden', padding: 8, justifyContent: 'space-between' },
  socialStoryCardTop: { alignItems: 'flex-start' },
  socialStoryCardBottom: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  socialStoryCardName: { flex: 1, color: '#fff', fontSize: 11, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 4 },
  socialCreateRow: { flexDirection: 'row', gap: 9, marginTop: 2, marginBottom: 5 },
  socialCreateButton: { flex: 1, minHeight: 44, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  socialCreateButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  socialStoryItem: { width: 64, alignItems: 'center' },
  socialStoryName: { fontSize: 10.5, fontWeight: '600', width: 64, textAlign: 'center', marginTop: 5 },
  socialStoryAudience: { fontSize: 8, marginTop: 1 },
  socialState: { minHeight: 68, borderWidth: 1, borderRadius: 14, paddingHorizontal: 14, flexDirection: 'row', gap: 10, alignItems: 'center' },
  socialPostList: { marginTop: 14, gap: 10 },
  socialSectionHeading: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  socialSectionTitle: { fontSize: 16, fontWeight: '600' },
  socialSectionHint: { fontSize: 11, fontWeight: '600' },
  socialPostCard: { borderWidth: 1, borderRadius: 24, overflow: 'hidden', padding: 12 },
  socialPostHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  socialAuthor: { flexDirection: 'row', alignItems: 'center', gap: 9, flex: 1 },
  socialAuthorName: { fontSize: 14, fontWeight: '600' },
  socialAuthorMeta: { fontSize: 10, marginTop: 2 },
  socialPostContent: { fontSize: 14, lineHeight: 20, marginTop: 11 },
  socialPostMedia: { width: '100%', height: 210, borderRadius: 12, marginTop: 11 },
  socialLinkCard: { borderRadius: 11, padding: 10, marginTop: 10, flexDirection: 'row', alignItems: 'center', gap: 9 },
  socialLinkTitle: { fontSize: 12, fontWeight: '600' },
  socialLinkUrl: { fontSize: 10, marginTop: 2 },
  socialPostActions: { flexDirection: 'row', alignItems: 'center', gap: 18, borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, marginTop: 11 },
  repostPermission: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 13, paddingVertical: 10, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.16)' },
  repostPermissionIcon: { width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  repostPermissionTitle: { color: '#fff', fontSize: 13, fontWeight: '800' },
  repostPermissionHint: { color: 'rgba(255,255,255,0.78)', fontSize: 11, marginTop: 2 },
  repostPermissionSwitch: { width: 40, height: 24, borderRadius: 14, padding: 3, justifyContent: 'center' },
  repostPermissionThumb: { width: 18, height: 18, borderRadius: 9 },
  socialAction: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5 },
  socialPostTime: { fontSize: 10, marginLeft: 'auto' },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  socialProfileSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, minHeight: 440, maxHeight: WINDOW_HEIGHT * 0.88, alignItems: 'center' },
  socialProfileContent: { width: '100%', alignItems: 'center', paddingBottom: 12 },
  profilePostsHeading: { width: '100%', flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 9 },
  profilePostFeed: { width: '100%', gap: 12 },
  profilePostsEmpty: { width: '100%', textAlign: 'center', paddingVertical: 26, lineHeight: 19 },
  peopleSearchInput: { minHeight: 46, borderWidth: 1, borderRadius: 13, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, marginTop: 4 },
  peopleSearchText: { flex: 1, fontSize: 16, paddingVertical: 10 },
  peopleSearchHint: { fontSize: 11, marginTop: 8, marginBottom: 10 },
  peopleSearchRow: { minHeight: 70, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', gap: 11 },
  notificationsSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, minHeight: WINDOW_HEIGHT * 0.64, maxHeight: WINDOW_HEIGHT * 0.82, padding: 20 },
  commentsSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, minHeight: WINDOW_HEIGHT * 0.48, maxHeight: WINDOW_HEIGHT * 0.78, padding: 20 },
  sheetTop: { width: '100%', minHeight: 45, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetEyebrow: { fontSize: 10, fontWeight: '600', letterSpacing: 1.4 },
  socialProfileName: { fontSize: 23, fontWeight: '600', marginTop: 13 },
  socialProfileHandle: { fontSize: 14, marginTop: 3 },
  socialProfileBio: { fontSize: 14, lineHeight: 20, textAlign: 'center', maxWidth: 290, marginTop: 10 },
  socialProfileStats: { flexDirection: 'row', gap: 46, marginTop: 22, marginBottom: 22 },
  profileStatValue: { textAlign: 'center', fontSize: 19, fontWeight: '600' },
  profileStatLabel: { fontSize: 11, marginTop: 2 },
  socialProfileActions: { flexDirection: 'row', gap: 9, width: '100%', justifyContent: 'center' },
  profileAction: { minHeight: 44, borderRadius: 22, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  profileIconAction: { minHeight: 44, borderRadius: 22, paddingHorizontal: 17, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  excludeAction: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: 12 },
  profileDone: { width: '100%', minHeight: 44, borderTopWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', marginTop: 5 },
  notificationsTitle: { fontSize: 24, fontWeight: '600', marginTop: 2 },
  notificationRow: { minHeight: 68, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 5, flexDirection: 'row', alignItems: 'center', gap: 10 },
  notificationText: { fontSize: 13, lineHeight: 18 },
  unreadDot: { width: 8, height: 8, borderRadius: 4 },
  notificationEmpty: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 55, gap: 9 },
  notificationEmptyTitle: { fontSize: 17, fontWeight: '600' },
  commentRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  commentAuthor: { fontSize: 13, fontWeight: '700' },
  commentContent: { fontSize: 14, lineHeight: 19, marginTop: 3 },
  commentComposer: { flexDirection: 'row', alignItems: 'flex-end', gap: 10, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth },
  commentInput: { flex: 1, minHeight: 42, maxHeight: 96, borderRadius: 19, paddingHorizontal: 14, paddingVertical: 10, fontSize: 14 },
  serverStoryViewer: { flex: 1, justifyContent: 'space-between' },
  serverStoryShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.32)' },
  serverStoryTop: { paddingTop: 54, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', gap: 10 },
  serverStoryAuthor: { color: '#fff', fontSize: 14, fontWeight: '600' },
  serverStoryMeta: { color: 'rgba(255,255,255,0.78)', fontSize: 11, marginTop: 2 },
  serverStoryContent: { flex: 1, justifyContent: 'center', paddingHorizontal: 30, paddingBottom: 70 },
  serverStoryText: { color: '#fff', fontSize: 28, lineHeight: 36, textAlign: 'center', fontWeight: '600', textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 8 },
  feedTabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth },
  feedTab: { flex: 1, alignItems: 'center', paddingVertical: 11, borderBottomWidth: 2 },
  feedTabText: { fontWeight: '600', fontSize: 14 },
  interestContent: { paddingBottom: 100 },
  interestHeading: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  interestTitle: { fontSize: 23, fontWeight: '600' },
  interestSubtitle: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  interestGrid: { gap: 8 },
  interestChip: { borderWidth: 1, borderRadius: 11, minHeight: 62, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 10 },
  check: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  interestLabel: { fontSize: 14, fontWeight: '600' },
  interestDescription: { fontSize: 11, marginTop: 3 },
  languageSection: { borderWidth: 1, borderRadius: 16, padding: 13, marginBottom: 14 },
  languageSectionTitle: { fontSize: 15, fontWeight: '700' },
  languageSectionHint: { fontSize: 12, lineHeight: 17, marginTop: 3, marginBottom: 10 },
  languageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  languageChip: { borderWidth: 1, borderRadius: 12, minWidth: '30%', flexGrow: 1, paddingHorizontal: 10, paddingVertical: 9 },
  languageChipText: { fontSize: 13, fontWeight: '700' },
  languageChipSubtext: { fontSize: 10, marginTop: 2 },
  interestPrompt: { borderWidth: 1, borderRadius: 17, padding: 12, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'flex-start', gap: 9, marginTop: 2 },
  interestPromptIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  interestPromptTitle: { fontSize: 14, fontWeight: '800' },
  interestPromptText: { fontSize: 11, lineHeight: 15, marginTop: 3 },
  interestPromptActions: { width: '100%', flexDirection: 'row', gap: 8, marginTop: 2 },
  interestPromptButton: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  interestPromptButtonText: { fontSize: 12, fontWeight: '700' },
  pipelineCard: { borderWidth: 1, borderRadius: 11, padding: 14, marginTop: 12 },
  pipelineTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  pipelineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  pipelineNumber: { width: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pipelineStep: { fontSize: 12, flex: 1 },
  pipelineStatus: { fontSize: 10, fontWeight: '600' },
  pipelineFootnote: { fontSize: 11, lineHeight: 16, marginTop: 8 },
  backButton: { width: 44, height: 44, marginTop: 16, alignItems: 'center', justifyContent: 'center' },
});
