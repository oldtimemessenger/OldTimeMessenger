import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import * as Location from 'expo-location';
import * as Haptics from 'expo-haptics';
import * as WebBrowser from 'expo-web-browser';
import {
  ActivityIndicator, Alert, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
  Animated, FlatList, Dimensions, Platform, Share, PanResponder
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
import { INTEREST_OPTIONS, INTEREST_ROOTS, rankForYou, type InterestNode } from '@/lib/for-you';
import { useColors } from '@/hooks/useColors';
import { apiBaseUrl } from '@/lib/api-base-url';
import { discoveryEmbedUrl, getDiscoveryFeed, type DiscoveryItem } from '@/lib/map-api';
import { VideoSurface } from '@/components/video-surface';
import { ServerStoryViewer } from '@/components/server-story-viewer';
import { userStoryViewerItem, userStoryViewerItemId } from '@/components/story-viewer-content';
import { buildStoryViewerItems } from '@/lib/story-viewer-sequence';
import { AdMobNativeFeedAd } from '@/components/admob-native-feed-ad';
import { AdMobBanner } from '@/components/admob-banner';
import { ChatComposer } from '@/components/chat-composer';
import { adManager } from '@/lib/ad-manager';
import { createChat, createMessage, getDirectChat, listUsers, useRequestUploadUrl, type User } from '@workspace/api-client-react';
import {
  createStory,
  createHub,
  createNote,
  acceptMessageRequest,
  createMessageRequest,
  declineMessageRequest,
  createSocialPost,
  getSocialFeed,
  getSocialNotifications,
  getMessageRequests,
  getSharingExclusions,
  getHub,
  getHubDiscovery,
  getHubFeed,
  getMyHubs,
  getStories,
  getNotes,
  updateNote,
  deleteNote,
  getUserCard,
  getUserConnections,
  getUserPosts,
  getPostComments,
  createPostComment,
  reportSocialContent,
  markSocialNotificationRead,
  searchSocial,
  searchHubs,
  setFollowing,
  setPostHubs,
  setUserBlocked,
  setCommentLike,
  setPostRelation,
  setSharingExcluded,
  joinHub,
  leaveHub,
  socialMediaUrl,
  viewSocialPost,
   socialAvatarUrl,
  viewStory,
  type SocialNotification,
  type SocialComment,
  type MessageRequest,
  type SocialPost,
  type CommunityFilter,
  type SocialUser,
  type Story,
  type Note,
  type UserCard,
  type SocialConnection,
  type SocialHub,
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
type FeedTab = 'for-you' | 'following' | 'community' | 'interests';
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

function MediaFeedFloatingHeader({
  tab,
  onSelectTab,
  onOpenHub,
  onOpenCommunity,
  onOpenCreate,
  onOpenSettings,
  onOpenSearch,
  onOpenMessages,
  onOpenProfile,
  unreadRequests,
  ownCard,
  session,
}: {
  tab: FeedTab;
  onSelectTab: (tab: FeedTab) => void;
  onOpenHub: () => void;
  onOpenCommunity: () => void;
  onOpenCreate: () => void;
  onOpenSettings: () => void;
  onOpenSearch: () => void;
  onOpenMessages: () => void;
  onOpenProfile: () => void;
  unreadRequests: number;
  ownCard: any;
  session: any;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.mediaFeedHeader, { top: insets.top }]}>
      <View style={styles.mediaFeedHeaderActions}>
        <View style={styles.mediaFeedHeaderGroup}>
          <Pressable onPress={onOpenHub} accessibilityRole="button" accessibilityLabel="Open Updates" style={styles.floatingUpdatesButton}>
            <Ionicons name="newspaper" size={17} color="#fff" />
            <Text style={styles.floatingUpdatesText}>Current</Text>
          </Pressable>
          <Pressable onPress={onOpenCommunity} accessibilityRole="button" accessibilityLabel="Open Hubs" style={styles.floatingIconButton}>
            <Ionicons name="albums" size={21} color="#fff" />
          </Pressable>
        </View>
        <View style={styles.mediaFeedHeaderGroup}>
          <Pressable onPress={onOpenCreate} accessibilityRole="button" accessibilityLabel="Create an update" style={styles.floatingIconButton}>
            <Ionicons name="add" size={23} color="#fff" />
          </Pressable>
          <Pressable onPress={onOpenSettings} accessibilityRole="button" accessibilityLabel="Open Updates settings" style={styles.floatingIconButton}>
            <Ionicons name="options-outline" size={21} color="#fff" />
          </Pressable>
          <Pressable onPress={onOpenSearch} accessibilityRole="button" accessibilityLabel="Search people" style={styles.floatingIconButton}>
            <Ionicons name="search" size={21} color="#fff" />
          </Pressable>
          <Pressable onPress={onOpenMessages} accessibilityRole="button" accessibilityLabel="Open messages" style={styles.floatingIconButton}>
            <Ionicons name="mail" size={21} color="#fff" />
            {unreadRequests > 0 && <View style={[styles.headerUnreadDot, styles.floatingUnreadDot]} />}
          </Pressable>
          <Pressable onPress={onOpenProfile} accessibilityRole="button" accessibilityLabel="Open your profile">
            <Avatar name={ownCard?.name ?? session?.name ?? 'You'} size={32} color="#4C63F5" uri={socialAvatarUrl(ownCard?.avatarObjectPath ?? session?.avatarObjectPath)} />
          </Pressable>
        </View>
      </View>

      <View style={styles.mediaFeedTabs}>
        <Pressable onPress={() => onSelectTab('for-you')} accessibilityRole="tab" accessibilityState={{ selected: tab === 'for-you' }}>
          <Text style={[styles.mediaFeedTabText, tab === 'for-you' && styles.mediaFeedTabTextActive]}>For You</Text>
        </Pressable>
        <Pressable onPress={() => onSelectTab('following')} accessibilityRole="tab" accessibilityState={{ selected: tab === 'following' }}>
          <Text style={[styles.mediaFeedTabText, tab === 'following' && styles.mediaFeedTabTextActive]}>Following</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function UpdatesScreen() {
  const colors = useColors();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { mediaUri, mediaType, mediaFit, composeType } = useLocalSearchParams<{
    mediaUri?: string;
    mediaType?: 'photo' | 'video';
    mediaFit?: 'contain' | 'cover';
    composeType?: 'status' | 'post';
  }>();
  const { statuses, posts, interests, interestWeights, followedCreators, hiddenPostIds, markStatusViewed, togglePostLike, togglePostSaved, addPostComment, recordPostInteraction, recordInterestFeedback, toggleInterest, toggleFollow, hidePost: persistHiddenPost, session, settings, updateSettings } = useApp();
  const requestUploadUrl = useRequestUploadUrl();

  const [viewMode, setViewMode] = useState<'media-feed' | 'landing' | 'feed' | 'creator-feed' | 'status'>('media-feed');
  const [showCommunity, setShowCommunity] = useState(false);
  const [communityFilter, setCommunityFilter] = useState<CommunityFilter>('friends');
  const [hubQuery, setHubQuery] = useState('');
  const [hubSearchResults, setHubSearchResults] = useState<SocialHub[]>([]);
  const [hubDiscovery, setHubDiscovery] = useState<{ myHubs: SocialHub[]; suggestedHubs: SocialHub[]; trendingHubs: SocialHub[]; recentlyActiveHubs: SocialHub[]; categories: string[] } | null>(null);
  const [hubDiscoveryLoading, setHubDiscoveryLoading] = useState(false);
  const [hubDiscoveryError, setHubDiscoveryError] = useState<string | null>(null);
  const [activeHub, setActiveHub] = useState<SocialHub | null>(null);
  const [activeHubChildren, setActiveHubChildren] = useState<SocialHub[]>([]);
  const [hubFeed, setHubFeed] = useState<SocialPost[]>([]);
  const [hubFeedLoading, setHubFeedLoading] = useState(false);
  const [hubFeedError, setHubFeedError] = useState<string | null>(null);
  const [hubFeedCursor, setHubFeedCursor] = useState<number | null>(null);
  const [hubFeedLoadingMore, setHubFeedLoadingMore] = useState(false);
  const [hubFeedTab, setHubFeedTab] = useState<'for-you' | 'trending' | 'latest'>('for-you');
  const [hubCreateOpen, setHubCreateOpen] = useState(false);
  const [tab, setTab] = useState<FeedTab>('for-you');
  const [feedIndex, setFeedIndex] = useState(0);
  const [storyGroupOpen, setStoryGroupOpen] = useState<StatusUserGroup | null>(null);
  const [compose, setCompose] = useState<'status' | 'post' | null>(null);
  const [postComposerSurface, setPostComposerSurface] = useState<'creator' | 'community'>('creator');
  const [commentPost, setCommentPost] = useState<UpdatePost | null>(null);
  const [socialCommentPost, setSocialCommentPost] = useState<SocialPost | null>(null);
  const [capturedStatusMedia, setCapturedStatusMedia] = useState<{
    uri: string;
    type: 'photo' | 'video';
    fit?: 'contain' | 'cover';
  } | null>(null);
  const [socialPosts, setSocialPosts] = useState<SocialPost[]>([]);
  const [discoveryItems, setDiscoveryItems] = useState<DiscoveryItem[]>([]);
  const [socialStories, setSocialStories] = useState<Story[]>([]);
  const [notes, setNotes] = useState<Note[]>([]);
  const [socialLoading, setSocialLoading] = useState(true);
  const [communityCursor, setCommunityCursor] = useState<number | null>(null);
  const [communityLoadingMore, setCommunityLoadingMore] = useState(false);
  const [socialError, setSocialError] = useState<string | null>(null);
  const [profileUserId, setProfileUserId] = useState<number | null>(null);
  const [showNotifications, setShowNotifications] = useState(false);
  const [notifications, setNotifications] = useState<SocialNotification[]>([]);
  const [notificationsLoading, setNotificationsLoading] = useState(false);
  const [ownCard, setOwnCard] = useState<UserCard | null>(null);
  const [serverStoryOpen, setServerStoryOpen] = useState<Story | null>(null);
  const [showMessagesInbox, setShowMessagesInbox] = useState(false);
  const [showMessageRequests, setShowMessageRequests] = useState(false);
  const [messageRequests, setMessageRequests] = useState<MessageRequest[]>([]);
  const [messageRequestsLoading, setMessageRequestsLoading] = useState(false);
  const [showPeopleSearch, setShowPeopleSearch] = useState(false);
  const [showCreateMenu, setShowCreateMenu] = useState(false);
  const [showFeedSettings, setShowFeedSettings] = useState(false);
  const [showInterestSettings, setShowInterestSettings] = useState(false);
  const [socialVideoOpen, setSocialVideoOpen] = useState<{ uri: string; title: string } | null>(null);
  const [peopleQuery, setPeopleQuery] = useState('');
  const [peopleResults, setPeopleResults] = useState<SocialUser[]>([]);
  const [peopleSearchLoading, setPeopleSearchLoading] = useState(false);
  const [peopleSearchError, setPeopleSearchError] = useState<string | null>(null);
  const [interestPrompt, setInterestPrompt] = useState<{ topic: string; title: string } | null>(null);
  const [noteEditor, setNoteEditor] = useState<Note | 'new' | null>(null);
  const [showNewMessage, setShowNewMessage] = useState(false);
  const [sharePost, setSharePost] = useState<SocialPost | null>(null);
  const [shareInOldTime, setShareInOldTime] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const promptedContent = useRef(new Set<string>());

  const showFeedback = useCallback((message: string) => {
    setFeedback(message);
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    feedbackTimer.current = setTimeout(() => setFeedback(null), 2800);
  }, []);

  useEffect(() => () => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
  }, []);

  useEffect(() => {
    const surface = showCommunity ? 'community-feed' : viewMode === 'creator-feed' ? 'creator-feed' : 'updates';
    adManager.setActiveSurface(surface);
  }, [showCommunity, viewMode]);

  const loadSocial = useCallback(async (mode: 'for-you' | 'following' | 'community' = 'for-you', filter: CommunityFilter = communityFilter) => {
    if (!session?.authToken) return;
    setSocialLoading(true);
    setSocialError(null);
    try {
      const [feed, storyPage, card, notificationPage, exclusions] = await Promise.all([
        getSocialFeed(session.authToken, mode, null, filter, interests, mode !== 'community'),
        getStories(session.authToken),
        getUserCard(session.authToken, session.id),
        getSocialNotifications(session.authToken),
        getSharingExclusions(session.authToken),
      ]);
      setSocialPosts(feed.items);
      setCommunityCursor(mode === 'community' ? feed.nextCursor : null);
      setSocialStories(storyPage.items);
      setOwnCard(card);
      setNotifications(notificationPage.items);
      updateSettings({ excludedPeople: exclusions.items.map((item) => ({ id: item.id, name: item.name })) });

      if (mode === 'community') {
        setDiscoveryItems([]);
      } else {
        const [noteResult, discoveryResult] = await Promise.allSettled([
          getNotes(session.authToken),
          mode === 'for-you'
            ? getDiscoveryFeed(session.authToken)
            : Promise.resolve({ items: [] as DiscoveryItem[] }),
        ]);
        if (noteResult.status === 'fulfilled') setNotes(noteResult.value.items);
        if (discoveryResult.status === 'fulfilled') setDiscoveryItems(discoveryResult.value.items);
        const optionalFailure = noteResult.status === 'rejected'
          ? noteResult.reason
          : discoveryResult.status === 'rejected'
            ? discoveryResult.reason
            : null;
        if (optionalFailure) {
          setSocialError(optionalFailure instanceof Error
            ? optionalFailure.message
            : 'Some updates could not be loaded. Try again.');
        }
      }
    } catch (error) {
      setSocialError(error instanceof Error ? error.message : 'Social updates are unavailable right now.');
    } finally {
      setSocialLoading(false);
    }
  }, [communityFilter, interests, session?.authToken, session?.id]);

  const loadMoreCommunity = useCallback(async () => {
    if (!session?.authToken || !communityCursor || communityLoadingMore) return;
    setCommunityLoadingMore(true);
    try {
      const page = await getSocialFeed(session.authToken, 'community', communityCursor, communityFilter, interests);
      setSocialPosts((items) => {
        const known = new Set(items.map((item) => item.id));
        return [...items, ...page.items.filter((item) => !known.has(item.id))];
      });
      setCommunityCursor(page.nextCursor);
    } catch (error) {
      Alert.alert('Community could not load more', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setCommunityLoadingMore(false);
    }
  }, [communityCursor, communityFilter, communityLoadingMore, interests, session?.authToken]);

  const loadMoreHubFeed = useCallback(async () => {
    if (!session?.authToken || !activeHub?.id || !hubFeedCursor || hubFeedLoadingMore) return;
    setHubFeedLoadingMore(true);
    try {
      const page = await getHubFeed(session.authToken, activeHub.id, hubFeedTab, hubFeedCursor);
      setHubFeed((items) => {
        const seen = new Set(items.map((item) => item.id));
        return [...items, ...page.items.filter((item) => !seen.has(item.id))];
      });
      setHubFeedCursor(page.nextCursor);
    } catch (error) {
      setHubFeedError(error instanceof Error ? error.message : 'Could not load more hub posts.');
    } finally {
      setHubFeedLoadingMore(false);
    }
  }, [activeHub?.id, hubFeedCursor, hubFeedLoadingMore, hubFeedTab, session?.authToken]);

  useEffect(() => {
    void loadSocial();
  }, [loadSocial]);

  useEffect(() => {
    if (!showCommunity || !session?.authToken) return;
    const query = hubQuery.trim();
    if (query.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      void searchHubs(session.authToken!, query).then((result) => {
        if (!cancelled) setHubSearchResults(result.items);
      }).catch((error) => {
        if (!cancelled) setHubDiscoveryError(error instanceof Error ? error.message : 'Hub search is unavailable.');
      });
    }, 240);
    return () => { cancelled = true; clearTimeout(timer); };
  }, [hubQuery, session?.authToken, showCommunity]);

  useEffect(() => {
    const firstPost = socialPosts[0];
    if (showCommunity || socialLoading || !firstPost) return;
    const key = `social-${firstPost.id}`;
    if (promptedContent.current.has(key) || Math.random() > 0.32) return;
    promptedContent.current.add(key);
    setInterestPrompt({ topic: inferSocialTopic(firstPost), title: firstPost.author.name });
  }, [showCommunity, socialLoading, socialPosts]);

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

  async function refreshMessageRequests() {
    if (!session?.authToken) return;
    setMessageRequestsLoading(true);
    try {
      setMessageRequests((await getMessageRequests(session.authToken)).items);
    } catch {
      setMessageRequests([]);
    } finally {
      setMessageRequestsLoading(false);
    }
  }

  function openMessagesInbox() {
    setShowMessagesInbox(true);
    void refreshMessageRequests();
  }

  function openMessageRequests() {
    setShowMessageRequests(true);
    void refreshMessageRequests();
  }

  const unreadNotifications = notifications.filter((item) => !item.readAt).length;
  useEffect(() => {
    if (!mediaUri && !composeType) return;
    if (mediaUri) {
      setCapturedStatusMedia({
        uri: mediaUri,
        type: mediaType === 'video' ? 'video' : 'photo',
        fit: mediaFit,
      });
    }
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
  const creatorPosts = useMemo(
    () => socialPosts.filter((post) => post.media?.some((media) => media.type === 'image' || media.type === 'video')),
    [socialPosts],
  );
  const creatorGridItems = useMemo(
    () => blendCreatorDiscovery(creatorPosts, discoveryItems),
    [creatorPosts, discoveryItems],
  );

  async function openDiscoveryItem(item: DiscoveryItem) {
    await WebBrowser.openBrowserAsync(discoveryEmbedUrl(item.id), {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: colors.primary,
    });
  }

  function hidePost(post: UpdatePost) {
    persistHiddenPost(post.id);
    recordPostInteraction(post.id, 'hide');
  }

  function selectFeedTab(nextTab: FeedTab) {
    if (nextTab === 'community') {
      openCommunity();
      return;
    }
    setTab(nextTab);
    setFeedIndex(0);
    if (nextTab === 'interests') void loadSocial('for-you', 'interests');
    else void loadSocial(nextTab);
  }

  const loadHubDiscovery = useCallback(async (query = '') => {
    if (!session?.authToken) return;
    setHubDiscoveryLoading(true);
    setHubDiscoveryError(null);
    try {
      const result = await getHubDiscovery(session.authToken, query.trim() || undefined);
      setHubDiscovery({
        myHubs: result.myHubs,
        suggestedHubs: result.suggestedHubs,
        trendingHubs: result.trendingHubs,
        recentlyActiveHubs: result.recentlyActiveHubs,
        categories: result.categories,
      });
      setHubSearchResults(result.searchResults ?? []);
    } catch (error) {
      setHubDiscoveryError(error instanceof Error ? error.message : 'Hubs are unavailable right now.');
    } finally {
      setHubDiscoveryLoading(false);
    }
  }, [session?.authToken]);

  const loadHubDetails = useCallback(async (hubId: number, tabValue: 'for-you' | 'trending' | 'latest' = hubFeedTab) => {
    if (!session?.authToken) return;
    setHubFeedLoading(true);
    setHubFeedError(null);
    try {
      const [hubResult, feedResult] = await Promise.all([
        getHub(session.authToken, hubId),
        getHubFeed(session.authToken, hubId, tabValue),
      ]);
      setActiveHub(hubResult.hub);
      setActiveHubChildren(hubResult.children);
      setHubFeed(feedResult.items);
      setHubFeedCursor(feedResult.nextCursor);
    } catch (error) {
      setHubFeedError(error instanceof Error ? error.message : 'This Hub is unavailable right now.');
    } finally {
      setHubFeedLoading(false);
    }
  }, [hubFeedTab, session?.authToken]);

  function openCommunity() {
    setShowCommunity(true);
    setHubQuery('');
    setActiveHub(null);
    setHubFeed([]);
    setHubFeedCursor(null);
    void loadHubDiscovery();
  }

  function closeCommunity() {
    setShowCommunity(false);
    setActiveHub(null);
    setHubQuery('');
    setHubSearchResults([]);
  }

  async function changeCommunityFilter(filter: CommunityFilter) {
    setCommunityFilter(filter);
    if (!session?.authToken) return;
    const my = await getMyHubs(session.authToken).catch(() => null);
    if (!my) return;
    if (filter === 'friends') setHubSearchResults(my.items);
    else if (filter === 'following') setHubSearchResults(my.items.filter((hub) => hub.postCount > 0));
    else setHubSearchResults(my.items.filter((hub) => hub.category !== null));
  }

  function openHubFromChip(hub: { id: number; name: string; slug: string }) {
    setShowCommunity(true);
    setHubQuery('');
    setActiveHub({
      id: hub.id,
      name: hub.name,
      slug: hub.slug,
      description: '',
      icon: null,
      coverImage: null,
      category: null,
      status: 'active',
      privacy: 'public',
      memberCount: 0,
      postCount: 0,
      createdBy: 0,
      joined: false,
      role: null,
      parent: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    void loadHubDetails(hub.id, hubFeedTab);
  }

  function shareSocialPost(post: SocialPost) {
    setShareInOldTime(false);
    setSharePost(post);
  }

  function closeSocialShare() {
    setSharePost(null);
    setShareInOldTime(false);
  }

  async function systemShareSocialPost(post: SocialPost) {
    if (post.visibility !== 'public') {
      showFeedback('Only public posts can be shared outside Old Time.');
      return;
    }
    try {
      await Share.share({ message: `${post.author.name} on Old Time:\n\n${post.content}` });
      closeSocialShare();
    } catch (error) {
      showFeedback(error instanceof Error ? error.message : 'Sharing is unavailable right now.');
    }
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

  const editingNote = noteEditor !== null && noteEditor !== 'new' ? noteEditor : null;

  return (
     <View style={{ flex: 1, backgroundColor: '#000' }} testID="updates-screen">
       {/* Layer 0: Main Media Feed */}
       <CreatorFeedPager
         posts={creatorPosts}
         initialIndex={feedIndex}
         token={session?.authToken ?? ''}
         colors={colors}
         headerControls={
           <MediaFeedFloatingHeader
             tab={tab}
             onSelectTab={selectFeedTab}
             onOpenHub={() => setViewMode('landing')}
             onOpenCommunity={openCommunity}
              onOpenCreate={() => setShowCreateMenu(true)}
              onOpenSettings={() => setShowFeedSettings((value) => !value)}
             onOpenSearch={() => setShowPeopleSearch(true)}
             onOpenMessages={openMessagesInbox}
             onOpenProfile={() => setProfileUserId(session?.id ?? 0)}
             unreadRequests={messageRequests.filter(r => r.status === 'pending').length}
             ownCard={ownCard}
             session={session}
           />
         }
         onComment={setSocialCommentPost}
         onShare={shareSocialPost}
         onOpenProfile={(userId) => { setProfileUserId(userId); }}
         onChanged={(updated) => setSocialPosts((items) => items.map((item) => item.id === updated.id ? updated : item))}
       />

       {/* Layer 1: Current Updates (Hub) Modal */}
        <Modal visible={viewMode === 'landing'} transparent animationType="slide" onRequestClose={() => setViewMode('media-feed')}>
         <View style={{ flex: 1, backgroundColor: colors.background }}>
             <Screen title="Current" left={
             <View style={styles.headerLeftActions}>
               <IconButton name="chevron-down" label="Back to Feed" onPress={() => setViewMode('media-feed')} />
             </View>
           } right={
             <View style={styles.socialHeaderActions}>
                <IconButton name="add" label="Create an update" onPress={() => setShowCreateMenu(true)} />
                <IconButton name="options-outline" label="Open Updates settings" onPress={() => setShowFeedSettings((value) => !value)} />
               <IconButton name="search-outline" label="Search people" onPress={() => setShowPeopleSearch(true)} />
                <View>
                  <IconButton name="mail-outline" label="Open messages" onPress={openMessagesInbox} />
                  {messageRequests.length > 0 ? <View style={[styles.headerUnreadDot, { backgroundColor: colors.destructive }]} /> : null}
                </View>
               <Pressable testID="updates-profile-button" onPress={() => setProfileUserId(session?.id ?? 0)} accessibilityRole="button" accessibilityLabel="Open your profile" style={styles.headerProfileButton}>
                  <Avatar name={ownCard?.name ?? session?.name ?? 'You'} size={31} color={colors.primary} uri={socialAvatarUrl(ownCard?.avatarObjectPath ?? session?.avatarObjectPath)} />
               </Pressable>
             </View>
           }>
             <FlatList
                testID="updates-feed"
                data={socialPosts.filter((post) => post.media.some((media) => media.type === 'image' || media.type === 'video'))}
                keyExtractor={(item) => String(item.id)}
                contentContainerStyle={{ paddingHorizontal: 10, paddingBottom: 100 }}
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
                    tab={tab}
                    interests={interests}
                    onSelectTab={selectFeedTab}
                    onOpenCreate={() => setShowCreateMenu(true)}
                    onOpenSettings={() => setShowFeedSettings((value) => !value)}
                   interestPrompt={interestPrompt}
                   onDismissInterestPrompt={() => setInterestPrompt(null)}
                   onInterestFeedback={(interested) => {
                     if (!interestPrompt) return;
                     recordInterestFeedback(interestPrompt.topic, interested);
                     if (interested && !interests.includes(interestPrompt.topic)) toggleInterest(interestPrompt.topic);
                     setInterestPrompt(null);
                   }}
                   onComment={setSocialCommentPost}
                   onShare={shareSocialPost}
                   onChanged={(post) => setSocialPosts((items) => items.map((item) => item.id === post.id ? post : item))}
                   onOpenHub={openHubFromChip}
                    onOpenVideo={(post) => {
                      const media = post.media[0];
                      if (media?.type === 'video') setSocialVideoOpen({ uri: socialMediaUrl(media.objectPath), title: post.author.name });
                    }}
                 />
                 <View style={{ paddingHorizontal: 14, paddingTop: 12, paddingBottom: 8 }}>
                   <AdMobBanner />
                 </View>
               </>}
               renderItem={({ item, index }) => (
                  <SocialPostCard
                    post={item}
                    colors={colors}
                    token={session?.authToken ?? ''}
                    onOpenProfile={() => setProfileUserId(item.author.id)}
                    onShare={() => shareSocialPost(item)}
                    onComment={() => setSocialCommentPost(item)}
                    onChanged={(post) => setSocialPosts((items) => items.map((current) => current.id === post.id ? post : current))}
                    onOpenHub={openHubFromChip}
                    onOpenVideo={(post) => {
                      const media = post.media[0];
                      if (media?.type === 'video') setSocialVideoOpen({ uri: socialMediaUrl(media.objectPath), title: post.author.name });
                    }}
                  />
               )}
                ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
                ListEmptyComponent={
                  socialLoading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 42 }} /> :
                    <EmptyState
                      icon="people-outline"
                      title={tab === 'following' ? 'Follow a creator' : 'No updates yet'}
                      description={tab === 'following' ? 'Follow creators from a Story or post to build your Following feed.' : 'Photo and video updates from people and creators will appear here.'}
                    />
                }
             />
           </Screen>
         </View>
       </Modal>

       {/* Layer 2: Hubs Modal */}
       <Modal visible={showCommunity} transparent animationType="slide" onRequestClose={closeCommunity}>
         <View style={{ flex: 1, backgroundColor: colors.background }}>
           <Screen title={activeHub ? activeHub.name : 'Hubs'} left={<View style={styles.headerLeftActions}><IconButton name="chevron-down" label="Back" onPress={closeCommunity} /></View>} right={<View style={styles.socialHeaderActions}><IconButton name="add" label={activeHub ? 'Create post in hub' : 'Create a Hub'} onPress={() => { if (activeHub) { setPostComposerSurface('community'); setCompose('post'); } else setHubCreateOpen(true); }} /></View>}>
             {activeHub ? (
               <HubFeed
                 hub={activeHub}
                 children={activeHubChildren}
                 posts={hubFeed}
                 loading={hubFeedLoading}
                 error={hubFeedError}
                 loadingMore={hubFeedLoadingMore}
                 tab={hubFeedTab}
                 colors={colors}
                 token={session?.authToken ?? ''}
                 onSelectTab={(nextTab) => {
                   setHubFeedTab(nextTab);
                   void loadHubDetails(activeHub.id, nextTab);
                 }}
                 onOpenChild={(hub) => void loadHubDetails(hub.id, hubFeedTab)}
                 onOpenProfile={setProfileUserId}
                 onComment={setSocialCommentPost}
                 onShare={shareSocialPost}
                 onChanged={(updated) => setHubFeed((items) => items.map((item) => item.id === updated.id ? updated : item))}
                 onOpenHub={openHubFromChip}
                 onRetry={() => void loadHubDetails(activeHub.id, hubFeedTab)}
                 onLoadMore={() => void loadMoreHubFeed()}
                 onJoinToggle={async () => {
                   if (!session?.authToken) return;
                   try {
                     if (activeHub.joined) await leaveHub(session.authToken, activeHub.id);
                     else await joinHub(session.authToken, activeHub.id);
                     await Promise.all([loadHubDetails(activeHub.id, hubFeedTab), loadHubDiscovery(hubQuery)]);
                   } catch (error) {
                     setHubFeedError(error instanceof Error ? error.message : 'Membership could not be updated.');
                   }
                 }}
                 onBackToDiscover={() => {
                   setActiveHub(null);
                   void loadHubDiscovery(hubQuery);
                 }}
               />
             ) : (
               <HubDiscoveryPanel
                 query={hubQuery}
                 onQueryChange={setHubQuery}
                 loading={hubDiscoveryLoading}
                 error={hubDiscoveryError}
                 filter={communityFilter}
                 onFilterChange={(filter) => { void changeCommunityFilter(filter); }}
                 data={hubDiscovery}
                 searchResults={hubSearchResults}
                 colors={colors}
                 onRetry={() => void loadHubDiscovery(hubQuery)}
                 onCreateHub={() => setHubCreateOpen(true)}
                 onOpenHub={(hub) => void loadHubDetails(hub.id, hubFeedTab)}
               />
             )}
           </Screen>
         </View>
       </Modal>

       <Modal visible={hubCreateOpen} transparent animationType="slide" onRequestClose={() => setHubCreateOpen(false)}>
         <CreateHubSheet
           token={session?.authToken ?? ''}
           colors={colors}
           onClose={() => setHubCreateOpen(false)}
           onCreated={(hub) => {
             setActiveHub(hub);
             setHubFeedTab('for-you');
             void loadHubDetails(hub.id, 'for-you');
           }}
         />
       </Modal>

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
             onOpenProfile={(handle: string) => {
               setViewMode('landing');
               setPeopleQuery(handle.replace(/^@/, ''));
               setShowPeopleSearch(true);
             }}
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
              token={session?.authToken ?? ''}
              mediaRequired={compose === 'post' && postComposerSurface === 'creator'}
              initialMediaUri={capturedStatusMedia?.uri}
              initialMediaType={capturedStatusMedia?.type}
              initialMediaFit={capturedStatusMedia?.fit}
               initialHubIds={activeHub ? [activeHub.id] : []}
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
                  const story = await createStory(session.authToken, { content: data.caption, textPosition: data.textPosition, visibility: data.audience, media, location: storyLocation, taggedUserIds: data.taggedUserIds });
                  setSocialStories((items) => [story, ...items]);
                } else {
                  const post = await createSocialPost(session.authToken, {
                    content: data.caption,
                    kind: media?.type === 'video' ? 'video' : media?.type === 'image' ? 'photo' : 'text',
                    media: media ? [media] : undefined,
                 visibility: data.audience,
                 allowReposts: Boolean(data.allowReposts),
                  });
                  const withHubs = data.hubIds?.length ? await setPostHubs(session.authToken, post.id, data.hubIds) : null;
                  const published = withHubs?.post ?? post;
                  setSocialPosts((items) => [published, ...items]);
                   if (postComposerSurface === 'community') {
                     setShowCommunity(true);
                     if (activeHub) void loadHubDetails(activeHub.id, hubFeedTab);
                   }
                }
                setCapturedStatusMedia(null);
             }}
          />
        )}
      </Modal>

      <Modal visible={showCreateMenu} transparent animationType="slide" onRequestClose={() => setShowCreateMenu(false)}>
        <CreateActionSheet
          colors={colors}
          onClose={() => setShowCreateMenu(false)}
          onCreatePost={() => {
            setShowCreateMenu(false);
            setPostComposerSurface('creator');
            setCompose('post');
          }}
          onCreateStory={() => {
            setShowCreateMenu(false);
            setCompose('status');
          }}
          onOpenCamera={() => {
            setShowCreateMenu(false);
            router.push({ pathname: '/camera', params: { returnTo: 'post' } });
          }}
        />
      </Modal>

      <Modal visible={showFeedSettings} transparent animationType="fade" onRequestClose={() => setShowFeedSettings(false)}>
        <Pressable style={styles.feedSettingsOverlay} onPress={() => setShowFeedSettings(false)}>
          <View style={[styles.feedSettingsMenu, { top: insets.top + 58, backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.feedSettingsEyebrow, { color: colors.mutedForeground }]}>UPDATES</Text>
            <Pressable style={styles.feedSettingsItem} onPress={() => { setShowFeedSettings(false); setShowInterestSettings(true); }}>
              <Ionicons name="options-outline" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.feedSettingsTitle, { color: colors.foreground }]}>Edit interests</Text>
                <Text style={[styles.feedSettingsHint, { color: colors.mutedForeground }]}>Tune what appears in For You</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} />
            </Pressable>
            <Pressable style={styles.feedSettingsItem} onPress={() => { setShowFeedSettings(false); openCommunity(); }}>
              <Ionicons name="albums-outline" size={18} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.feedSettingsTitle, { color: colors.foreground }]}>Browse Hubs</Text>
                <Text style={[styles.feedSettingsHint, { color: colors.mutedForeground }]}>Find conversations around your interests</Text>
              </View>
              <Ionicons name="chevron-forward" size={17} color={colors.mutedForeground} />
            </Pressable>
          </View>
        </Pressable>
      </Modal>

      <Modal visible={showInterestSettings} animationType="slide" onRequestClose={() => setShowInterestSettings(false)}>
        <Screen title="Feed settings" left={<IconButton name="chevron-down" label="Close feed settings" onPress={() => setShowInterestSettings(false)} />}>
          <InterestPanel
            interests={interests}
            onToggle={toggleInterest}
            languages={settings.feedLanguages}
            onToggleLanguage={chooseFeedLanguage}
            onBack={() => setShowInterestSettings(false)}
            colors={colors}
          />
        </Screen>
      </Modal>

      <Modal visible={socialVideoOpen !== null} animationType="fade" presentationStyle="fullScreen" onRequestClose={() => setSocialVideoOpen(null)}>
        {socialVideoOpen ? (
          <SocialVideoViewer
            video={socialVideoOpen}
            token={session?.authToken ?? ''}
            colors={colors}
            onClose={() => setSocialVideoOpen(null)}
          />
        ) : null}
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

      <Modal visible={sharePost !== null} transparent animationType="slide" onRequestClose={closeSocialShare}>
        {sharePost ? shareInOldTime ? (
          <SharePostInOldTimeSheet
            post={sharePost}
            viewerId={session?.id ?? 0}
            colors={colors}
            onBack={() => setShareInOldTime(false)}
            onClose={closeSocialShare}
            onShared={(name) => {
              closeSocialShare();
              showFeedback(`Shared with ${name}.`);
            }}
          />
        ) : (
          <SocialPostShareSheet
            post={sharePost}
            colors={colors}
            onClose={closeSocialShare}
            onShareInOldTime={() => {
              if (sharePost.visibility !== 'public') {
                showFeedback('Only public posts can be shared in another conversation.');
                return;
              }
              setShareInOldTime(true);
            }}
            onSystemShare={() => void systemShareSocialPost(sharePost)}
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
                showFeedback(`Message request sent to ${name}.`);
              }).catch((error) => {
                showFeedback(error instanceof Error ? error.message : 'Message request unavailable.');
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
                showFeedback(active ? `${person.name} won’t see future shares.` : `${person.name} can see future shares.`);
              }).catch((error) => showFeedback(error instanceof Error ? error.message : 'Sharing list was not updated.'));
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
                      showFeedback(`${name} was blocked.`);
                    }).catch((error) => showFeedback(error instanceof Error ? error.message : 'Could not block user.'));
                  },
                },
              ]);
            }}
            unreadCount={unreadNotifications}
             onComment={setSocialCommentPost}
             onShare={shareSocialPost}
              onFeedback={showFeedback}
             onOpenHub={openHubFromChip}
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

      <Modal visible={showMessagesInbox} transparent animationType="slide" onRequestClose={() => setShowMessagesInbox(false)}>
        <MessagesInboxSheet
          requestCount={messageRequests.filter((item) => item.status === 'pending').length}
          loading={messageRequestsLoading}
          username={ownCard?.username ?? session?.username ?? 'oldtime'}
          displayName={ownCard?.name ?? session?.name ?? 'Old Time'}
          posts={socialPosts}
          notes={notes}
          colors={colors}
          onClose={() => setShowMessagesInbox(false)}
          onCreateNote={() => {
            setShowMessagesInbox(false);
            setNoteEditor('new');
          }}
          onEditNote={(note) => {
            setShowMessagesInbox(false);
            setNoteEditor(note);
          }}
          onDeleteNote={(note) => {
            if (!session?.authToken) return;
            void deleteNote(session.authToken, note.id).then(() => {
              setNotes((items) => items.filter((item) => item.id !== note.id));
            }).catch((error) => Alert.alert('Could not delete note', error instanceof Error ? error.message : 'Please try again.'));
          }}
          onCreateMessage={() => {
            setShowMessagesInbox(false);
            setShowNewMessage(true);
          }}
          onOpenRequests={() => {
            setShowMessagesInbox(false);
            openMessageRequests();
          }}
        />
      </Modal>

      <Modal visible={showNewMessage} transparent animationType="slide" onRequestClose={() => setShowNewMessage(false)}>
        <NewMessageSheet
          viewerId={session?.id ?? 0}
          colors={colors}
          onClose={() => setShowNewMessage(false)}
          onChatReady={(chatId) => {
            setShowNewMessage(false);
            router.push(`/chat/${chatId}`);
          }}
        />
      </Modal>

      <Modal visible={noteEditor !== null} transparent animationType="slide" onRequestClose={() => setNoteEditor(null)}>
        {noteEditor !== null ? (
          <NoteEditorSheet
            note={editingNote}
            colors={colors}
            onClose={() => setNoteEditor(null)}
            onSave={async (content) => {
              if (!session?.authToken) throw new Error('Sign in again to save a note.');
              const saved = noteEditor === 'new'
                ? await createNote(session.authToken, content)
                : await updateNote(session.authToken, editingNote!.id, content);
              setNotes((items) => [saved, ...items.filter((item) => item.id !== saved.id)]);
              setNoteEditor(null);
            }}
            onDelete={editingNote ? async () => {
              if (!session?.authToken) return;
              await deleteNote(session.authToken, editingNote.id);
              setNotes((items) => items.filter((item) => item.id !== editingNote.id));
              setNoteEditor(null);
            } : undefined}
          />
        ) : null}
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
        {serverStoryOpen ? <ServerStoryViewer items={buildStoryViewerItems(socialStories)} initialItemId={userStoryViewerItemId(serverStoryOpen.id)} token={session?.authToken ?? ''} onClose={() => setServerStoryOpen(null)} /> : null}
      </Modal>

      {feedback ? <View pointerEvents="none" style={[styles.inlineFeedback, { backgroundColor: colors.foreground }]}><Text style={[styles.inlineFeedbackText, { color: colors.background }]}>{feedback}</Text></View> : null}
    </View>
  );
}

type StarterCard = {
  id: string;
  starterAction: 'map' | 'story' | 'interests' | 'community';
  eyebrow: string;
  title: string;
  detail: string;
  icon: keyof typeof Ionicons.glyphMap;
  colors: readonly [string, string];
};

const FOR_YOU_STARTERS: StarterCard[] = [
  { id: 'whats-happening', starterAction: 'map', eyebrow: 'NEAR YOU', title: 'See what’s happening', detail: 'Explore Stories, live rooms, and trending moments on the Map.', icon: 'map', colors: ['#172554', '#2563EB'] },
  { id: 'create-story', starterAction: 'story', eyebrow: 'YOUR MOMENT', title: 'Share your first Story', detail: 'Post a photo or video that disappears after 24 hours.', icon: 'camera', colors: ['#4C1D95', '#C026D3'] },
  { id: 'choose-interests', starterAction: 'interests', eyebrow: 'FOR YOU', title: 'Choose what you enjoy', detail: 'Pick topics so Old Time can personalize your feed.', icon: 'options', colors: ['#7C2D12', '#F97316'] },
  { id: 'open-community', starterAction: 'community', eyebrow: 'HUBS', title: 'Discover communities', detail: 'Find hubs by profession, interests, and location.', icon: 'people', colors: ['#064E3B', '#10B981'] },
];

type CreatorGridItem = SocialPost | DiscoveryItem | StarterCard;

function blendCreatorDiscovery(nativePosts: SocialPost[], externalItems: DiscoveryItem[]): CreatorGridItem[] {
  if (!externalItems.length) return nativePosts.length ? nativePosts : FOR_YOU_STARTERS;
  if (!nativePosts.length) return externalItems;
  const externalBudget = nativePosts.length >= 12
    ? Math.max(1, Math.ceil(externalItems.length * 0.35))
    : externalItems.length;
  const available = externalItems.slice(0, externalBudget);
  const blended: CreatorGridItem[] = [];
  let externalIndex = 0;
  nativePosts.forEach((post, index) => {
    blended.push(post);
    if ((index + 1) % 3 === 0 && externalIndex < available.length) {
      blended.push(available[externalIndex]);
      externalIndex += 1;
    }
  });
  while (externalIndex < available.length) {
    blended.push(available[externalIndex]);
    externalIndex += 1;
  }
  return blended;
}

function StarterGridCard({ item }: { item: StarterCard }) {
  return (
    <LinearGradient colors={[...item.colors]} style={StyleSheet.absoluteFill}>
      <View style={{ flex: 1, padding: 10, justifyContent: 'space-between' }}>
        <View style={{ width: 31, height: 31, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.16)' }}>
          <Ionicons name={item.icon} size={17} color="#fff" />
        </View>
        <View>
          <Text style={{ color: 'rgba(255,255,255,.72)', fontSize: 9, fontWeight: '900', letterSpacing: 0.8 }}>{item.eyebrow}</Text>
          <Text numberOfLines={3} style={{ color: '#fff', fontSize: 14, lineHeight: 17, fontWeight: '900', marginTop: 4 }}>{item.title}</Text>
          <Text numberOfLines={3} style={{ color: 'rgba(255,255,255,.72)', fontSize: 10, lineHeight: 13, marginTop: 5 }}>{item.detail}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

function DiscoveryGridCard({ item }: { item: DiscoveryItem }) {
  const platformLabel = item.platform === 'x' ? 'X' : item.platform[0].toUpperCase() + item.platform.slice(1);
  return (
    <LinearGradient
      colors={item.platform === 'youtube' ? ['#1f0e12', '#7f1d1d'] : item.platform === 'tiktok' ? ['#071923', '#164e63'] : ['#17122d', '#4c1d95']}
      style={StyleSheet.absoluteFill}
    >
      <View style={{ flex: 1, padding: 10, justifyContent: 'space-between' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
          <Ionicons name="flame" size={15} color="#FDBA74" />
          <Text style={{ color: '#FDBA74', fontSize: 10, fontWeight: '900', letterSpacing: 0.6 }}>TRENDING</Text>
        </View>
        <View>
          <Text numberOfLines={3} style={{ color: '#fff', fontSize: 13, lineHeight: 17, fontWeight: '800' }}>{item.title}</Text>
          <Text numberOfLines={1} style={{ color: 'rgba(255,255,255,.72)', fontSize: 10, marginTop: 5 }}>{item.creator.handle || item.creator.name} · {platformLabel}</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

function CreatorFeedPager({ posts, initialIndex, token, colors, headerControls, onComment, onShare, onOpenProfile, onChanged }: {
  posts: SocialPost[];
  initialIndex: number;
  token: string;
  colors: any;
  headerControls?: React.ReactNode;
  onComment: (post: SocialPost) => void;
  onShare: (post: SocialPost) => void;
  onOpenProfile: (userId: number) => void;
  onChanged: (post: SocialPost) => void;
}) {
  const insets = useSafeAreaInsets();
  const feedItems = useMemo(() => adManager.blendNativeAds('creator-feed', posts, (post) => String(post.id)), [posts]);
  const initialPostId = posts[Math.min(initialIndex, Math.max(posts.length - 1, 0))]?.id;
  const initialFeedIndex = Math.max(0, feedItems.findIndex((item) => item.kind === 'content' && item.content.id === initialPostId));
  const [currentIndex, setCurrentIndex] = useState(initialFeedIndex);
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (listRef.current && feedItems.length > initialFeedIndex) {
      listRef.current.scrollToIndex({ index: initialFeedIndex, animated: false });
      setCurrentIndex(initialFeedIndex);
    }
  }, [initialFeedIndex, feedItems.length]);

  const onViewableItemsChanged = useRef(({ viewableItems }: any) => {
    const firstVisible = viewableItems.find((entry: any) => entry?.item?.key);
    if (!firstVisible) return;
    setCurrentIndex(firstVisible.index ?? 0);
    if (firstVisible.item.kind === 'content') {
      adManager.recordContentView('creator-feed', String(firstVisible.item.content.id));
    }
  }).current;

  return (
    <View style={styles.creatorFeedPager} testID="creator-feed-pager">
      {headerControls}
      <FlatList
        ref={listRef}
        data={feedItems}
        keyExtractor={(item) => item.key}
        pagingEnabled
        snapToInterval={WINDOW_HEIGHT}
        decelerationRate="fast"
        showsVerticalScrollIndicator={false}
        initialScrollIndex={initialFeedIndex}
        getItemLayout={(_, index) => ({ length: WINDOW_HEIGHT, offset: WINDOW_HEIGHT * index, index })}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        ListEmptyComponent={
          <View style={{ width: WINDOW_WIDTH, height: WINDOW_HEIGHT, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons name="videocam-outline" size={48} color="rgba(255,255,255,0.2)" />
            <Text style={{ color: 'rgba(255,255,255,0.6)', marginTop: 12, fontWeight: '600' }}>No updates right now</Text>
          </View>
        }
        renderItem={({ item, index }) => item.kind === 'native-ad' ? (
          <View style={styles.creatorFeedPage}>
            <AdMobNativeFeedAd surface="creator-feed" placement={item.placement} fullScreen />
          </View>
        ) : (
          <CreatorFeedPost
            post={item.content}
            active={index === currentIndex}
            token={token}
            colors={colors}
            onComment={() => onComment(item.content)}
            onShare={() => onShare(item.content)}
            onOpenProfile={() => onOpenProfile(item.content.author.id)}
            onChanged={onChanged}
          />
        )}
      />
    </View>
  );
}

function HeartBurst({ burstKey }: { burstKey: number }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!burstKey) return;
    progress.setValue(0);
    Animated.sequence([
      Animated.spring(progress, { toValue: 0.68, friction: 4, tension: 140, useNativeDriver: true }),
      Animated.timing(progress, { toValue: 1, duration: 360, useNativeDriver: true }),
    ]).start();
  }, [burstKey, progress]);

  if (!burstKey) return null;
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        styles.creatorHeart,
        {
          opacity: progress.interpolate({ inputRange: [0, 0.68, 1], outputRange: [0, 0.95, 0] }),
          transform: [
            { scale: progress.interpolate({ inputRange: [0, 0.68, 1], outputRange: [0.35, 1.08, 1] }) },
            { rotate: '-8deg' },
          ],
        },
      ]}
    >
      <Ionicons name="heart" size={118} color="#fff" style={styles.heartBurstShadow} />
    </Animated.View>
  );
}

function CreatorFeedPost({ post, active, token, colors, onComment, onShare, onOpenProfile, onChanged }: {
  post: SocialPost;
  active: boolean;
  token: string;
  colors: any;
  onComment: () => void;
  onShare: () => void;
  onOpenProfile: () => void;
  onChanged: (post: SocialPost) => void;
}) {
  const insets = useSafeAreaInsets();
  const [muted, setMuted] = useState(true);
  const [userPaused, setUserPaused] = useState(false);
  const [heartBurstKey, setHeartBurstKey] = useState(0);
  const [saveInFlight, setSaveInFlight] = useState(false);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const relationInFlightRef = useRef<{ like: boolean; save: boolean }>({ like: false, save: false });
  const media = post.media?.[0];
  const mediaUrl = media ? socialMediaUrl(media.objectPath) : null;

  useEffect(() => {
    if (!active) setUserPaused(false);
  }, [active]);

  useEffect(() => () => {
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
  }, []);

  async function changeRelation(relation: 'like' | 'repost' | 'save') {
    if ((relation === 'like' || relation === 'save') && relationInFlightRef.current[relation]) return;
    const activeNow = relation === 'like' ? post.viewer.liked : relation === 'repost' ? post.viewer.reposted : post.viewer.saved;
    const nextActive = !activeNow;
    const countKey = relation === 'like' ? 'likes' : relation === 'repost' ? 'reposts' : 'saves';
    const next: SocialPost = {
      ...post,
      counts: { ...post.counts, [countKey]: Math.max(0, post.counts[countKey] + (nextActive ? 1 : -1)) },
      viewer: { ...post.viewer, liked: relation === 'like' ? nextActive : post.viewer.liked, reposted: relation === 'repost' ? nextActive : post.viewer.reposted, saved: relation === 'save' ? nextActive : post.viewer.saved },
    };
    if (relation === 'like' || relation === 'save') relationInFlightRef.current[relation] = true;
    if (relation === 'save') setSaveInFlight(true);
    onChanged(next);
    try {
      await setPostRelation(token, post.id, relation, nextActive);
    } catch (error) {
      onChanged(post);
      Alert.alert('Could not update post', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      if (relation === 'like' || relation === 'save') relationInFlightRef.current[relation] = false;
      if (relation === 'save') setSaveInFlight(false);
    }
  }

  function doubleTap() {
    if (!post.viewer.liked) void changeRelation('like');
    setHeartBurstKey((key) => key + 1);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function singleTap() {
    if (media?.type === 'video') {
      if (active) setUserPaused((value) => !value);
      return;
    }
  }

  function handleMediaTap() {
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
      doubleTap();
      return;
    }
    tapTimeoutRef.current = setTimeout(() => {
      tapTimeoutRef.current = null;
      singleTap();
    }, 220);
  }

  return (
    <View style={styles.creatorFeedPage}>
      <Pressable
        style={StyleSheet.absoluteFill}
        onPress={handleMediaTap}
        accessibilityRole="button"
        accessibilityLabel={media?.type === 'video' ? 'Creator post video' : 'Like this creator post'}
        accessibilityHint={media?.type === 'video' ? 'Pauses or resumes the video. Use the Like post button to like' : undefined}
        accessibilityActions={media?.type === 'video' ? [{ name: 'activate', label: userPaused ? 'Resume video' : 'Pause video' }] : undefined}
        onAccessibilityAction={media?.type === 'video' ? (event) => {
          const actionName = event.nativeEvent.actionName;
          if (actionName === 'activate') {
            if (active) setUserPaused((value) => !value);
          }
        } : undefined}
      >
        {mediaUrl && media?.type === 'video' ? <VideoSurface source={mediaUrl} style={StyleSheet.absoluteFill} muted={muted} paused={!active || userPaused} /> : mediaUrl ? <Image source={{ uri: mediaUrl }} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}
      </Pressable>
      <View style={styles.creatorFeedShade} pointerEvents="none" />
      <HeartBurst burstKey={heartBurstKey} />
      <Pressable onPress={() => setMuted((value) => !value)} style={[styles.creatorMuteButton, { top: Math.max(insets.top, 20) + 14 }]} accessibilityRole="button" accessibilityLabel={muted ? 'Unmute video' : 'Mute video'}>
        <Ionicons name={muted ? 'volume-mute' : 'volume-medium'} size={20} color="#fff" />
      </Pressable>
      <View style={[styles.creatorFeedActions, { bottom: Math.max(insets.bottom, 16) + 110 }]}>
        <Pressable onPress={() => void changeRelation('like')} style={styles.creatorAction} accessibilityRole="button" accessibilityLabel="Like post">
          <Ionicons name={post.viewer.liked ? 'heart' : 'heart-outline'} size={34} color={post.viewer.liked ? '#FFD54A' : '#fff'} />
          <Text style={styles.creatorActionCount}>{post.counts.likes}</Text>
        </Pressable>
        <Pressable onPress={onComment} style={styles.creatorAction} accessibilityRole="button" accessibilityLabel="Open comments">
          <Ionicons name="chatbubble-ellipses-outline" size={32} color="#fff" />
          <Text style={styles.creatorActionCount}>{post.counts.comments}</Text>
        </Pressable>
        <Pressable
          onPress={() => void changeRelation('save')}
          disabled={saveInFlight}
          style={[styles.creatorAction, { opacity: saveInFlight ? 0.55 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={post.viewer.saved ? 'Unsave post' : 'Save post'}
          accessibilityState={{ disabled: saveInFlight, selected: post.viewer.saved, busy: saveInFlight }}
        >
          <Ionicons name={post.viewer.saved ? 'bookmark' : 'bookmark-outline'} size={31} color={post.viewer.saved ? '#FFD54A' : '#fff'} />
          <Text style={styles.creatorActionCount}>{post.counts.saves}</Text>
        </Pressable>
        <Pressable onPress={onShare} style={styles.creatorAction} accessibilityRole="button" accessibilityLabel="Share post">
          <Ionicons name="arrow-redo-outline" size={32} color="#fff" style={{ transform: [{ scaleX: -1 }] }} />
          <Text style={styles.creatorActionCount}>Share</Text>
        </Pressable>
      </View>
      <View style={[styles.creatorFeedCaption, { bottom: Math.max(insets.bottom, 16) + 84 }]}>
        <Pressable onPress={onOpenProfile} accessibilityRole="button" accessibilityLabel={`Open ${post.author.name}'s profile`}>
          <Text style={styles.creatorAuthor}>{post.author.username}</Text>
        </Pressable>
        {post.content ? <Text style={styles.creatorCaption}>{post.content}</Text> : null}
      </View>
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
  const [heartBurstKey, setHeartBurstKey] = useState(0);
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => {
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current);
  }, []);

  function doubleTap() {
    if (!post.liked) onLike();
    setHeartBurstKey((key) => key + 1);
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  function handleMediaTap() {
    if (tapTimeoutRef.current) {
      clearTimeout(tapTimeoutRef.current);
      tapTimeoutRef.current = null;
      doubleTap();
      return;
    }
    tapTimeoutRef.current = setTimeout(() => {
      tapTimeoutRef.current = null;
    }, 220);
  }

  return (
    <View style={{ width: WINDOW_WIDTH, height: WINDOW_HEIGHT, backgroundColor: post.color }}>
      <Pressable style={StyleSheet.absoluteFill} onPress={handleMediaTap} accessibilityRole="button" accessibilityLabel="Post media" accessibilityHint="Double tap to like" />

      {post.uri && (post as UpdatePost & { type?: string }).type === 'video' ? (
        <VideoSurface source={post.uri} style={StyleSheet.absoluteFill} muted paused />
      ) : post.uri ? (
        <Image source={{ uri: post.uri }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: post.color, justifyContent: 'center', alignItems: 'center' }]}>
           <View style={{ position: 'absolute', width: 250, height: 250, borderRadius: 125, backgroundColor: 'rgba(255,255,255,0.08)', right: -100, top: -50 }} />
        </View>
      )}

      <HeartBurst burstKey={heartBurstKey} />

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

function ComposeModal({ type, token, mediaRequired = false, onClose, onPublish, colors, initialMediaUri, initialMediaType, initialMediaFit, defaultAudience, initialHubIds = [] }: any) {
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
   const [taggedUsers, setTaggedUsers] = useState<SocialUser[]>([]);
   const [hubPickerOpen, setHubPickerOpen] = useState(false);
   const [hubSearch, setHubSearch] = useState('');
   const [hubSearchResults, setHubSearchResults] = useState<SocialHub[]>([]);
   const [selectedHubs, setSelectedHubs] = useState<SocialHub[]>([]);
   const [tagPickerOpen, setTagPickerOpen] = useState(false);
   const [tagQuery, setTagQuery] = useState('');
   const [tagResults, setTagResults] = useState<SocialUser[]>([]);
   const [tagSearching, setTagSearching] = useState(false);
   const [storyTextOffset, setStoryTextOffset] = useState({ x: 0, y: 0 });
   const storyTextOffsetRef = useRef({ x: 0, y: 0 });
   const storyTextStart = useRef({ x: 0, y: 0 });
   const gradient: [string, string, string] = type === 'status' && selectedColor === colors.brandBlue
     ? [colors.brandBlue, colors.brandBlue, colors.brandBlue]
     : [...storyGradients[Math.abs(selectedColor.charCodeAt(1) || 0) % storyGradients.length]];

   useEffect(() => {
     if (type !== 'post' || !token || !initialHubIds.length) return;
     let cancelled = false;
     void getMyHubs(token).then((result) => {
      if (!cancelled) setSelectedHubs(result.items.filter((hub) => initialHubIds.includes(hub.id)));
     }).catch(() => undefined);
     return () => { cancelled = true; };
   }, [initialHubIds, token, type]);

   useEffect(() => {
     if (!tagPickerOpen || !token || tagQuery.trim().length < 2) {
       setTagResults([]);
       return;
     }
     let cancelled = false;
     setTagSearching(true);
     void searchSocial(token, tagQuery.trim()).then((result) => {
       if (!cancelled) setTagResults(result.users.filter((user) => !taggedUsers.some((tagged) => tagged.id === user.id)).slice(0, 8));
     }).catch(() => {
       if (!cancelled) setTagResults([]);
     }).finally(() => {
       if (!cancelled) setTagSearching(false);
     });
     return () => { cancelled = true; };
   }, [tagPickerOpen, tagQuery, taggedUsers, token]);

   useEffect(() => {
     if (!hubPickerOpen || !token || hubSearch.trim().length < 2) {
       setHubSearchResults([]);
       return;
     }
     let cancelled = false;
     void searchHubs(token, hubSearch.trim()).then((result) => {
       if (!cancelled) setHubSearchResults(result.items);
     }).catch(() => {
       if (!cancelled) setHubSearchResults([]);
     });
     return () => { cancelled = true; };
   }, [hubPickerOpen, hubSearch, token]);

   useEffect(() => {
     storyTextOffsetRef.current = storyTextOffset;
   }, [storyTextOffset]);

   const storyTextPanResponder = useRef(
     PanResponder.create({
       onStartShouldSetPanResponder: () => false,
      onMoveShouldSetPanResponderCapture: (_, gestureState) => Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5,
       onMoveShouldSetPanResponder: (_, gestureState) => Math.abs(gestureState.dx) > 5 || Math.abs(gestureState.dy) > 5,
       onPanResponderGrant: () => {
         storyTextStart.current = storyTextOffsetRef.current;
       },
       onPanResponderMove: (_, gestureState) => {
         setStoryTextOffset({
           x: Math.max(-WINDOW_WIDTH * 0.3, Math.min(WINDOW_WIDTH * 0.3, storyTextStart.current.x + gestureState.dx)),
           y: Math.max(-WINDOW_HEIGHT * 0.26, Math.min(WINDOW_HEIGHT * 0.26, storyTextStart.current.y + gestureState.dy)),
         });
       },
     }),
   ).current;

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
      if (mediaRequired && !mediaUri) {
        Alert.alert('Add a photo or video', 'Creator updates are media-only. Choose a photo or video before posting.');
        return;
      }
     setPublishing(true);
     try {
       if (type === 'status') {
            await onPublish({
              caption: draft.trim(),
              textPosition: {
                x: Number((storyTextOffset.x / WINDOW_WIDTH).toFixed(4)),
                y: Number((storyTextOffset.y / WINDOW_HEIGHT).toFixed(4)),
              },
              color: selectedColor,
              type: mediaUri ? selectedMediaType : 'text',
              uri: mediaUri,
              audience,
              shareLocation,
              fit: mediaFit,
              taggedUserIds: taggedUsers.map((user) => user.id),
            });
       } else {
           await onPublish({ caption: draft.trim(), tag, color: selectedColor, type: mediaUri ? selectedMediaType : 'text', uri: mediaUri, audience, fit: mediaFit, allowReposts, hubIds: selectedHubs.map((hub) => hub.id) });
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
        <Text style={{ color: '#fff', fontSize: 16, fontWeight: '700' }}>{type === 'status' ? 'Create a story' : mediaRequired ? 'Create media' : 'Create a post'}</Text>
        <Pressable disabled={publishing} onPress={() => void handlePublish()} style={{ backgroundColor: '#fff', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, opacity: publishing ? 0.65 : 1 }}>
          <Text style={{ color: '#000', fontWeight: '700', fontSize: 14 }}>{publishing ? 'Posting…' : type === 'status' ? 'Share to story' : mediaRequired ? 'Share media' : 'Post'}</Text>
        </Pressable>
      </View>

      <View style={{ flex: 1, justifyContent: 'center', paddingHorizontal: 20 }}>
        {type === 'status' ? (
          <View style={styles.storyCanvas} pointerEvents="box-none">
            <View
              {...storyTextPanResponder.panHandlers}
              style={[styles.storyTextLayer, { transform: [{ translateX: storyTextOffset.x }, { translateY: storyTextOffset.y }] }]}
            >
              <TextInput
                autoFocus
                value={draft}
                onChangeText={setDraft}
                placeholder="Write your Story…"
                placeholderTextColor="rgba(255,255,255,0.72)"
                multiline
                maxLength={280}
                style={styles.storyTextInput}
                accessibilityLabel="Story text"
              />
            </View>
            <Text pointerEvents="none" style={styles.storyTextHint}>Tap the text to edit · drag it anywhere</Text>
          </View>
        ) : mediaRequired ? (
          <View style={styles.mediaComposerPrompt}>
            <Ionicons name="image-outline" size={34} color="#fff" />
            <Text style={styles.mediaComposerPromptText}>{mediaUri ? 'Media ready to share' : 'Choose a photo or video'}</Text>
          </View>
        ) : (
          <TextInput
            autoFocus
            value={draft}
            onChangeText={setDraft}
            placeholder="What’s on your mind?"
            placeholderTextColor="rgba(255,255,255,0.7)"
            multiline
            style={{ color: '#fff', fontSize: 28, fontWeight: '600', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.3)', textShadowRadius: 10 }}
          />
        )}
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

          {type === 'post' ? (
            <View style={styles.tagPicker}>
              <Pressable onPress={() => setHubPickerOpen((open) => !open)} style={styles.tagPickerButton} accessibilityRole="button" accessibilityLabel="Add post to hubs">
                <Ionicons name="albums-outline" size={17} color="#fff" />
                <Text style={styles.mapStoryLabel}>{selectedHubs.length ? `Added to ${selectedHubs.length} hubs` : 'Add to Hubs'}</Text>
              </Pressable>
              {selectedHubs.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagChips}>
                  {selectedHubs.map((hub) => (
                    <Pressable key={hub.id} onPress={() => setSelectedHubs((items) => items.filter((item) => item.id !== hub.id))} style={styles.tagChip} accessibilityRole="button" accessibilityLabel={`Remove ${hub.name}`}>
                      <Text style={styles.tagChipText}>#{hub.name} ×</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
              {hubPickerOpen ? (
                <View style={styles.tagResultsBox}>
                  <TextInput value={hubSearch} onChangeText={setHubSearch} autoFocus placeholder="Search professions, interests, communities…" placeholderTextColor="rgba(255,255,255,0.68)" style={styles.tagSearchInput} accessibilityLabel="Search hubs" />
                  {hubSearch.trim().length < 2 ? <Text style={styles.tagSearchHint}>Type at least two characters.</Text> : hubSearchResults.length === 0 ? <Text style={styles.tagSearchHint}>No Hubs found.</Text> : hubSearchResults.map((hub) => (
                    <Pressable key={hub.id} onPress={() => { if (!selectedHubs.some((item) => item.id === hub.id)) setSelectedHubs((items) => [...items, hub]); setHubSearch(''); }} style={styles.tagResultRow} accessibilityRole="button" accessibilityLabel={`Add ${hub.name}`}>
                      <View><Text style={styles.tagResultName}>{hub.name}</Text><Text style={styles.tagResultUsername}>{hub.category ?? 'Hub'}</Text></View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}

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

          {type === 'status' ? (
            <View style={styles.tagPicker}>
              <Pressable onPress={() => setTagPickerOpen((open) => !open)} style={styles.tagPickerButton} accessibilityRole="button" accessibilityLabel="Tag people in story">
                <Ionicons name="person-add-outline" size={17} color="#fff" />
                <Text style={styles.mapStoryLabel}>{taggedUsers.length ? `${taggedUsers.length} people tagged` : 'Tag people'}</Text>
              </Pressable>
              {taggedUsers.length ? (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tagChips}>
                  {taggedUsers.map((user) => (
                    <Pressable key={user.id} onPress={() => setTaggedUsers((items) => items.filter((item) => item.id !== user.id))} style={styles.tagChip} accessibilityRole="button" accessibilityLabel={`Remove ${user.name} tag`}>
                      <Text style={styles.tagChipText}>@{user.username} ×</Text>
                    </Pressable>
                  ))}
                </ScrollView>
              ) : null}
              {tagPickerOpen ? (
                <View style={styles.tagResultsBox}>
                  <TextInput value={tagQuery} onChangeText={setTagQuery} autoFocus placeholder="Search people by name or username" placeholderTextColor="rgba(255,255,255,0.68)" style={styles.tagSearchInput} accessibilityLabel="Search people to tag" />
                  {tagSearching ? <Text style={styles.tagSearchHint}>Searching…</Text> : tagQuery.trim().length < 2 ? <Text style={styles.tagSearchHint}>Type at least two characters.</Text> : tagResults.length === 0 ? <Text style={styles.tagSearchHint}>No people found.</Text> : tagResults.map((user) => (
                    <Pressable key={user.id} onPress={() => { setTaggedUsers((items) => [...items, user]); setTagQuery(''); }} style={styles.tagResultRow} accessibilityRole="button" accessibilityLabel={`Tag ${user.name}`}>
                      <Avatar name={user.name} size={30} color="rgba(255,255,255,0.28)" />
                      <View><Text style={styles.tagResultName}>{user.name}</Text><Text style={styles.tagResultUsername}>@{user.username}</Text></View>
                    </Pressable>
                  ))}
                </View>
              ) : null}
            </View>
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
  tab,
  interests,
  onSelectTab,
  onOpenCreate,
  onOpenSettings,
  onOpenVideo,
  interestPrompt,
  onDismissInterestPrompt,
  onInterestFeedback,
  onComment,
  onShare,
  onChanged,
  onOpenHub,
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
  tab: FeedTab;
  interests: string[];
  onSelectTab: (tab: FeedTab) => void;
  onOpenCreate: () => void;
  onOpenSettings: () => void;
  onOpenVideo: (post: SocialPost) => void;
  interestPrompt: { topic: string; title: string } | null;
  onDismissInterestPrompt: () => void;
  onInterestFeedback: (interested: boolean) => void;
  onComment: (post: SocialPost) => void;
  onShare: (post: SocialPost) => void;
  onChanged: (post: SocialPost) => void;
  onOpenHub: (hub: { id: number; name: string; slug: string }) => void;
}) {
  const ownStory = stories.find((story) => story.viewer.isOwner);
  const otherStories = stories.filter((story) => !story.viewer.isOwner);
  return (
    <View style={styles.socialHub}>
      <View style={styles.socialStoryHeading}>
        <View />
        <Pressable onPress={onOpenSettings} style={[styles.feedSettingsButton, { borderColor: colors.border, backgroundColor: colors.card }]} accessibilityRole="button" accessibilityLabel="Open Updates settings">
          <Ionicons name="options-outline" size={17} color={colors.foreground} />
        </Pressable>
      </View>
      <View style={[styles.socialFeedTabs, { borderBottomColor: colors.border }]}>
        {(['for-you', 'following'] as FeedTab[]).map((item) => (
          <Pressable
            key={item}
            testID={`tab-${item}`}
            onPress={() => onSelectTab(item)}
            style={[styles.socialFeedTab, tab === item && styles.socialFeedTabActive]}
            accessibilityRole="tab"
            accessibilityState={{ selected: tab === item }}
          >
            <Text style={[styles.socialFeedTabText, { color: tab === item ? colors.foreground : colors.mutedForeground }]}>{item === 'for-you' ? 'For You' : 'Following'}</Text>
          </Pressable>
        ))}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.socialStoryRail}>
        <StoryCard story={ownStory} name={card?.name ?? 'You'} isOwn colors={colors} token={token} onPress={ownStory ? () => onOpenStory(ownStory) : onOpenCreate} />
        {otherStories.slice(0, 10).map((story) => (
          <StoryCard key={story.id} story={story} name={story.author.name} colors={colors} token={token} onPress={() => onOpenStory(story)} />
        ))}
      </ScrollView>
      <View style={styles.interestRailHeader}>
        <Text style={[styles.socialSectionHint, { color: colors.mutedForeground }]}>Interests</Text>
        <Pressable onPress={onOpenSettings} accessibilityRole="button" accessibilityLabel="Edit interests">
          <Text style={[styles.interestEditText, { color: colors.primary }]}>Edit</Text>
        </Pressable>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.interestRail}>
        {(interests.length ? interests.slice(0, 8) : ['Add interests']).map((interest) => (
          <Pressable key={interest} onPress={onOpenSettings} style={[styles.compactInterestChip, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <Text style={[styles.interestChipText, { color: colors.foreground }]}>{interest}</Text>
          </Pressable>
        ))}
      </ScrollView>
      <View style={styles.suggestedPeopleRail}>
        <Text style={[styles.socialSectionHint, { color: colors.mutedForeground }]}>Suggested for you</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestedPeopleList}>
          {Array.from(new Map(posts.map((post) => [post.author.id, post.author])).values()).slice(0, 6).map((author) => (
            <Pressable key={author.id} onPress={() => onOpenProfile(author.id)} style={[styles.suggestedPerson, { backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel={`Open ${author.name}'s profile`}>
              <Avatar name={author.name} size={28} color={colors.primary} uri={socialAvatarUrl(author.avatarObjectPath)} />
              <Text style={[styles.suggestedPersonName, { color: colors.foreground }]} numberOfLines={1}>{author.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
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
      ) : (
        <View />
      )}
    </View>
  );
}

function HubDiscoveryPanel({
  query,
  onQueryChange,
  loading,
  error,
  data,
  searchResults,
  filter,
  onFilterChange,
  colors,
  onRetry,
  onCreateHub,
  onOpenHub,
}: {
  query: string;
  onQueryChange: (value: string) => void;
  loading: boolean;
  error: string | null;
  data: { myHubs: SocialHub[]; suggestedHubs: SocialHub[]; trendingHubs: SocialHub[]; recentlyActiveHubs: SocialHub[]; categories: string[] } | null;
  searchResults: SocialHub[];
  filter: CommunityFilter;
  onFilterChange: (value: CommunityFilter) => void;
  colors: any;
  onRetry: () => void;
  onCreateHub: () => void;
  onOpenHub: (hub: SocialHub) => void;
}) {
  const isSearching = query.trim().length >= 2;
  const sections: Array<{ title: string; items: SocialHub[] }> = isSearching
    ? [{ title: 'Search results', items: searchResults }]
    : [
      { title: 'My Hubs', items: data?.myHubs ?? [] },
      { title: 'Suggested Hubs', items: data?.suggestedHubs ?? [] },
      { title: 'Trending Hubs', items: data?.trendingHubs ?? [] },
      { title: 'Recently Active', items: data?.recentlyActiveHubs ?? [] },
    ];
  return (
    <ScrollView contentContainerStyle={styles.hubDiscoveryContent} keyboardShouldPersistTaps="handled">
      <View style={[styles.hubSearchBox, { backgroundColor: colors.secondary }]}>
        <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
        <TextInput value={query} onChangeText={onQueryChange} placeholder="Search professions, interests, communities…" placeholderTextColor={colors.mutedForeground} style={[styles.hubSearchInput, { color: colors.foreground }]} />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.communityFilters}>
        {([['friends', 'My Hubs'], ['following', 'Active'], ['interests', 'Categories']] as [CommunityFilter, string][]).map(([value, label]) => (
          <Pressable key={value} onPress={() => onFilterChange(value)} style={[styles.communityFilter, { borderColor: filter === value ? colors.primary : colors.border, backgroundColor: filter === value ? colors.primary : colors.card }]}>
            <Text style={{ color: filter === value ? '#fff' : colors.foreground, fontSize: 13, fontWeight: '700' }}>{label}</Text>
          </Pressable>
        ))}
      </ScrollView>
      {error ? (
        <Pressable onPress={onRetry} style={[styles.communityState, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.communityStateTitle, { color: colors.foreground }]}>Hubs are unavailable</Text>
          <Text style={[styles.communityStateText, { color: colors.mutedForeground }]}>{error}</Text>
          <Text style={[styles.communityRetry, { color: colors.primary }]}>Try again</Text>
        </Pressable>
      ) : null}
      {!error && loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 24 }} /> : null}
      {!error && !loading ? sections.map((section) => (
        <View key={section.title} style={styles.hubSection}>
          <Text style={[styles.socialSectionTitle, { color: colors.foreground }]}>{section.title}</Text>
          {section.items.length === 0 ? <Text style={[styles.socialSectionHint, { color: colors.mutedForeground }]}>{section.title === 'Search results' ? 'No Hubs found.' : 'Nothing here yet.'}</Text> : null}
          {section.items.map((hub) => (
            <Pressable key={hub.id} onPress={() => onOpenHub(hub)} style={[styles.hubRow, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.hubRowTitle, { color: colors.foreground }]}>{hub.name}</Text>
                <Text style={[styles.hubRowMeta, { color: colors.mutedForeground }]}>{hub.memberCount} members · {hub.postCount} posts</Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </View>
      )) : null}
      {!isSearching ? (
        <View style={styles.hubSection}>
          <Text style={[styles.socialSectionTitle, { color: colors.foreground }]}>Categories</Text>
          <View style={styles.hubCategoryWrap}>
            {(data?.categories ?? []).map((category) => (
              <View key={category} style={[styles.hubCategoryChip, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                <Text style={[styles.hubCategoryChipText, { color: colors.foreground }]}>{category}</Text>
              </View>
            ))}
          </View>
        </View>
      ) : null}
      {isSearching && searchResults.length === 0 ? (
        <View style={[styles.communityState, { paddingTop: 10 }]}>
          <Text style={[styles.communityStateTitle, { color: colors.foreground }]}>No Hubs found.</Text>
          <Text style={[styles.communityStateText, { color: colors.mutedForeground }]}>Can’t find what you’re looking for?</Text>
          <Pressable onPress={onCreateHub} style={[styles.communityCreateButton, { backgroundColor: colors.primary }]}>
            <Text style={styles.communityCreateButtonText}>Create a Hub</Text>
          </Pressable>
        </View>
      ) : null}
    </ScrollView>
  );
}

function HubFeed({
  hub,
  children,
  posts,
  loading,
  error,
  loadingMore,
  tab,
  colors,
  token,
  onSelectTab,
  onOpenChild,
  onOpenProfile,
  onComment,
  onShare,
  onChanged,
  onOpenHub,
  onRetry,
  onLoadMore,
  onJoinToggle,
  onBackToDiscover,
}: {
  hub: SocialHub;
  children: SocialHub[];
  posts: SocialPost[];
  loading: boolean;
  error: string | null;
  loadingMore: boolean;
  tab: 'for-you' | 'trending' | 'latest';
  colors: any;
  token: string;
  onSelectTab: (tab: 'for-you' | 'trending' | 'latest') => void;
  onOpenChild: (hub: SocialHub) => void;
  onOpenProfile: (id: number) => void;
  onComment: (post: SocialPost) => void;
  onShare: (post: SocialPost) => void;
  onChanged: (post: SocialPost) => void;
  onOpenHub: (hub: { id: number; name: string; slug: string }) => void;
  onRetry: () => void;
  onLoadMore: () => void;
  onJoinToggle: () => void;
  onBackToDiscover: () => void;
}) {
  const tabs: Array<{ key: 'for-you' | 'trending' | 'latest'; label: string }> = [{ key: 'for-you', label: 'For You' }, { key: 'trending', label: 'Trending' }, { key: 'latest', label: 'Latest' }];
  return (
    <FlatList
      data={posts}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={styles.communityFeedContent}
      onEndReached={onLoadMore}
      onEndReachedThreshold={0.7}
      ListHeaderComponent={(
        <View style={styles.communityIntro}>
          <Pressable onPress={onBackToDiscover} style={[styles.communityCloseButton, { borderColor: colors.border, marginBottom: 10 }]}>
            <Ionicons name="chevron-back" size={18} color={colors.foreground} />
          </Pressable>
          <Text style={[styles.communityIntroTitle, { color: colors.foreground }]}>{hub.name}</Text>
          {hub.description ? <Text style={[styles.communityIntroText, { color: colors.mutedForeground }]}>{hub.description}</Text> : null}
          <Text style={[styles.socialSectionHint, { color: colors.mutedForeground }]}>{hub.memberCount} members · {hub.postCount} posts</Text>
          <Pressable onPress={onJoinToggle} style={[styles.communityCreateButton, { backgroundColor: hub.joined ? colors.secondary : colors.primary }]}>
            <Text style={[styles.communityCreateButtonText, { color: hub.joined ? colors.foreground : '#fff' }]}>{hub.joined ? 'Leave Hub' : 'Join Hub'}</Text>
          </Pressable>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.communityFilters}>
            {tabs.map((item) => (
              <Pressable key={item.key} onPress={() => onSelectTab(item.key)} style={[styles.communityFilter, { borderColor: tab === item.key ? colors.primary : colors.border, backgroundColor: tab === item.key ? colors.primary : colors.card }]}>
                <Text style={{ color: tab === item.key ? '#fff' : colors.foreground, fontSize: 13, fontWeight: '700' }}>{item.label}</Text>
              </Pressable>
            ))}
            {(['Discussions', 'Creators', 'Lives'] as const).map((item) => (
              <View key={item} style={[styles.communityFilter, { borderColor: colors.border, backgroundColor: colors.secondary, opacity: 0.7 }]}>
                <Text style={{ color: colors.mutedForeground, fontSize: 13, fontWeight: '700' }}>{item}</Text>
              </View>
            ))}
          </ScrollView>
          {children.length ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.communityFilters}>
              {children.map((child) => (
                <Pressable key={child.id} onPress={() => onOpenChild(child)} style={[styles.hubChildChip, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                  <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600' }}>{child.name}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>
      )}
      ListEmptyComponent={loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : error ? (
        <Pressable onPress={onRetry} style={[styles.communityState, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Text style={[styles.communityStateTitle, { color: colors.foreground }]}>Hub feed unavailable</Text>
          <Text style={[styles.communityStateText, { color: colors.mutedForeground }]}>{error}</Text>
          <Text style={[styles.communityRetry, { color: colors.primary }]}>Try again</Text>
        </Pressable>
      ) : (
        <View style={styles.communityState}>
          <Text style={[styles.communityStateTitle, { color: colors.foreground }]}>Nothing here yet.</Text>
          <Text style={[styles.communityStateText, { color: colors.mutedForeground }]}>Be the first to post in this Hub.</Text>
        </View>
      )}
      renderItem={({ item }) => (
        <SocialPostCard
          post={item}
          colors={colors}
          token={token}
          onOpenProfile={() => onOpenProfile(item.author.id)}
          onShare={() => onShare(item)}
          onComment={() => onComment(item)}
          onChanged={onChanged}
          onOpenHub={onOpenHub}
        />
      )}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ margin: 18 }} /> : <View style={{ height: 12 }} />}
    />
  );
}

function CreateHubSheet({ token, colors, onClose, onCreated }: { token: string; colors: any; onClose: () => void; onCreated: (hub: SocialHub) => void }) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <KeyboardAvoidingView behavior="padding" style={styles.sheetOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.commentSheet, { backgroundColor: colors.card }]}>
        <View style={styles.sheetTop}>
          <Text style={[styles.notificationsTitle, { color: colors.foreground }]}>Create a Hub</Text>
          <IconButton name="close" onPress={onClose} size={24} />
        </View>
        <TextInput value={name} onChangeText={setName} placeholder="Hub name" placeholderTextColor={colors.mutedForeground} style={[styles.composeInput, { color: colors.foreground, borderColor: colors.border }]} />
        <TextInput value={description} onChangeText={setDescription} placeholder="Description" placeholderTextColor={colors.mutedForeground} style={[styles.composeInput, { color: colors.foreground, borderColor: colors.border }]} multiline />
        <TextInput value={category} onChangeText={setCategory} placeholder="Category" placeholderTextColor={colors.mutedForeground} style={[styles.composeInput, { color: colors.foreground, borderColor: colors.border }]} />
        {error ? <Text style={[styles.newMessageError, { color: colors.destructive }]}>{error}</Text> : null}
        <Pressable
          onPress={() => {
            if (!name.trim() || submitting) return;
            setSubmitting(true);
            setError(null);
            void createHub(token, { name: name.trim(), description: description.trim(), category: category.trim() || null }).then((hub) => {
              onCreated(hub);
              onClose();
            }).catch((cause) => {
              setError(cause instanceof Error ? cause.message : 'Hub could not be created.');
            }).finally(() => setSubmitting(false));
          }}
          style={[styles.communityCreateButton, { backgroundColor: colors.primary, marginTop: 10, opacity: submitting ? 0.7 : 1 }]}
        >
          <Text style={styles.communityCreateButtonText}>{submitting ? 'Creating…' : 'Create Hub'}</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function CommunityFeed({
  posts,
  loading,
  error,
  colors,
  token,
  filter,
  interests,
  onFilterChange,
  onClose,
  onCreatePost,
  onRetry,
  onEndReached,
  loadingMore,
  onOpenProfile,
  onComment,
  onShare,
  onChanged,
  onOpenHub,
}: {
  posts: SocialPost[];
  loading: boolean;
  error: string | null;
  colors: any;
  token: string;
  filter: CommunityFilter;
  interests: string[];
  onFilterChange: (filter: CommunityFilter) => void;
  onClose: () => void;
  onCreatePost: () => void;
  onRetry: () => void;
  onEndReached: () => void;
  loadingMore: boolean;
  onOpenProfile: (id: number) => void;
  onComment: (post: SocialPost) => void;
  onShare: (post: SocialPost) => void;
  onChanged: (post: SocialPost) => void;
  onOpenHub: (hub: { id: number; name: string; slug: string }) => void;
}) {
  const feedItems = useMemo(() => adManager.blendNativeAds('community-feed', posts, (post) => String(post.id)), [posts]);
  return (
    <FlatList
      testID="community-feed"
      data={feedItems}
      keyExtractor={(item) => item.key}
      contentContainerStyle={styles.communityFeedContent}
      showsVerticalScrollIndicator={false}
      onEndReached={onEndReached}
      onEndReachedThreshold={0.7}
      ListHeaderComponent={
        <View style={styles.communityIntro}>
          <View style={styles.communityTitleRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.communityIntroTitle, { color: colors.foreground }]}>Community</Text>
              <Text style={[styles.communityIntroText, { color: colors.mutedForeground }]}>From people and interests.</Text>
            </View>
            <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Back to Updates" style={[styles.communityCloseButton, { borderColor: colors.border }]}>
              <Ionicons name="close" size={20} color={colors.foreground} />
            </Pressable>
          </View>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.communityFilters}>
            {([
              ['friends', 'Friends'],
              ['following', 'Following'],
              ['interests', 'Interests'],
            ] as [CommunityFilter, string][]).map(([value, label]) => (
              <Pressable key={value} onPress={() => onFilterChange(value)} accessibilityRole="tab" accessibilityState={{ selected: filter === value }} style={[styles.communityFilter, { borderColor: filter === value ? colors.primary : colors.border, backgroundColor: filter === value ? colors.primary : colors.card }]}>
                <Text style={{ color: filter === value ? '#fff' : colors.foreground, fontSize: 13, fontWeight: '700' }}>{label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable onPress={onCreatePost} style={[styles.communityCreateButton, { backgroundColor: colors.primary }]} accessibilityRole="button" accessibilityLabel="Create a community post">
            <Ionicons name="create-outline" size={17} color="#fff" />
            <Text style={styles.communityCreateButtonText}>Create a post</Text>
          </Pressable>
          {filter === 'interests' && interests.length === 0 ? (
            <View style={[styles.communityFilterHint, { backgroundColor: colors.secondary }]}>
              <Ionicons name="options-outline" size={16} color={colors.primary} />
               <Text style={[styles.communityFilterHintText, { color: colors.foreground }]}>Choose interests to personalize this view.</Text>
            </View>
          ) : null}
        </View>
      }
      ListEmptyComponent={
        loading ? <ActivityIndicator color={colors.primary} style={{ margin: 40 }} /> :
          error ? (
            <Pressable onPress={onRetry} style={[styles.communityState, { borderColor: colors.border, backgroundColor: colors.card }]} accessibilityRole="button">
              <Text style={[styles.communityStateTitle, { color: colors.foreground }]}>Community is unavailable</Text>
              <Text style={[styles.communityStateText, { color: colors.mutedForeground }]}>{error}</Text>
              <Text style={[styles.communityRetry, { color: colors.primary }]}>Try again</Text>
            </Pressable>
          ) : (
            <View style={styles.communityState}>
              <Ionicons name="people-outline" size={32} color={colors.primary} />
              <Text style={[styles.communityStateTitle, { color: colors.foreground }]}>{filter === 'interests' && interests.length === 0 ? 'No interests selected' : 'No posts in this view'}</Text>
              <Text style={[styles.communityStateText, { color: colors.mutedForeground }]}>{filter === 'friends' ? 'Posts from mutual connections will appear here.' : filter === 'following' ? 'Posts from people you follow will appear here.' : 'Try another interest or choose more in Updates.'}</Text>
            </View>
          )
      }
      renderItem={({ item }) => item.kind === 'native-ad' ? (
        <AdMobNativeFeedAd surface="community-feed" placement={item.placement} />
      ) : (
        <SocialPostCard
          post={item.content}
          colors={colors}
          token={token}
          onOpenProfile={() => onOpenProfile(item.content.author.id)}
          onShare={() => onShare(item.content)}
          onComment={() => onComment(item.content)}
          onChanged={onChanged}
          onOpenHub={onOpenHub}
        />
      )}
      ItemSeparatorComponent={() => <View style={{ height: 10 }} />}
      ListFooterComponent={loadingMore ? <ActivityIndicator color={colors.primary} style={{ margin: 18 }} /> : <View style={{ height: 10 }} />}
    />
  );
}

function SocialPostCard({ post, colors, token, onOpenProfile, onShare, onComment, onChanged, onOpenHub, onOpenVideo }: { post: SocialPost; colors: any; token: string; onOpenProfile: () => void; onShare: () => void; onComment?: () => void; onChanged: (post: SocialPost) => void; onOpenHub?: (hub: { id: number; name: string; slug: string }) => void; onOpenVideo?: (post: SocialPost) => void }) {
  const [busy, setBusy] = useState(false);
  const [saveInFlight, setSaveInFlight] = useState(false);
  const [expired, setExpired] = useState(false);
  const saveInFlightRef = useRef(false);
  const media = post.media[0];
  const canRepost = post.visibility === 'public' && post.allowReposts;

  useEffect(() => {
    if (!post.viewer.viewed || post.viewer.viewExpiresAt === null) return;
    const remaining = Math.max(0, post.viewer.viewExpiresAt - Date.now());
    const timeout = setTimeout(() => setExpired(true), remaining);
    return () => clearTimeout(timeout);
  }, [post.author.id, post.viewer.viewExpiresAt, post.viewer.viewed]);

  useEffect(() => {
    if (post.viewer.viewed) return;
    let active = true;
    void viewSocialPost(token, post.id)
      .then((result) => {
        if (!active) return;
        onChanged({
          ...post,
          viewer: {
            ...post.viewer,
            viewed: true,
            viewExpiresAt: result.expiresAt,
          },
        });
      })
      .catch(() => {
        // The card can remain visible if a transient view event fails.
      });
    return () => {
      active = false;
    };
  }, [post.id, post.viewer.viewed, token]);

  if (expired) return null;

  async function toggle(relation: 'like' | 'save' | 'repost') {
    if (relation === 'save' && saveInFlightRef.current) return;
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
    if (relation === 'save') {
      saveInFlightRef.current = true;
      setSaveInFlight(true);
    }
    setBusy(true);
    try {
      await setPostRelation(token, post.id, relation, active);
    } catch (error) {
      onChanged(post);
      Alert.alert('Action not saved', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
      if (relation === 'save') {
        saveInFlightRef.current = false;
        setSaveInFlight(false);
      }
    }
  }
  return (
    <View style={[styles.socialPostCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.socialPostHeader}>
        <Pressable onPress={onOpenProfile} style={styles.socialAuthor} accessibilityRole="button" accessibilityLabel={`Open ${post.author.name}'s profile`}>
          <Avatar name={post.author.name} size={38} color={colors.primary} uri={socialAvatarUrl(post.author.avatarObjectPath)} />
          <View>
            <Text style={[styles.socialAuthorName, { color: colors.foreground }]}>{post.author.name}</Text>
            <Text style={[styles.socialAuthorMeta, { color: colors.mutedForeground }]}>{audienceLabel(post.visibility)}</Text>
          </View>
        </Pressable>
        <Pressable onPress={() => Alert.alert('Post options', 'Choose what you want to do with this post.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Report', style: 'destructive', onPress: () => void reportSocialContent(token, { targetType: 'post', targetId: post.id, reason: 'other' }).then(() => Alert.alert('Report sent', 'Thanks for helping keep Old Time safe.')).catch(() => Alert.alert('Report unavailable', 'Please try again.')) }])} accessibilityRole="button" accessibilityLabel="Open post options" hitSlop={10}>
          <Ionicons name="ellipsis-horizontal" size={19} color={colors.mutedForeground} />
        </Pressable>
      </View>
      {post.content ? <Text style={[styles.socialPostContent, { color: colors.foreground }]}>{post.content}</Text> : null}
      {post.hubs?.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.postHubChipRow}>
          {post.hubs.slice(0, 4).map((hub) => (
            <Pressable
              key={hub.id}
              onPress={() => onOpenHub?.(hub)}
              style={[styles.postHubChip, { borderColor: colors.border, backgroundColor: colors.secondary }]}
              accessibilityRole="button"
              accessibilityLabel={`Open ${hub.name} hub`}
            >
              <Text style={[styles.postHubChipText, { color: colors.primary }]}>#{hub.name}</Text>
            </Pressable>
          ))}
        </ScrollView>
      ) : null}
      {media?.type === 'image' ? <Image source={{ uri: socialMediaUrl(media.objectPath), headers: { Authorization: `Bearer ${token}` } }} style={styles.socialPostMedia} contentFit="cover" /> : null}
      {media?.type === 'video' ? (
        <Pressable
          onPress={() => onOpenVideo?.(post)}
          style={styles.socialVideoPreview}
          accessibilityRole="button"
          accessibilityLabel={`Open ${post.author.name}'s video full screen`}
          accessibilityHint="Opens the video viewer"
        >
          <VideoSurface source={{ uri: socialMediaUrl(media.objectPath), headers: { Authorization: `Bearer ${token}` } }} style={styles.socialPostMedia} muted controls={false} />
          <View pointerEvents="none" style={styles.socialVideoExpand}>
            <Ionicons name="expand-outline" size={18} color="#fff" />
          </View>
        </Pressable>
      ) : null}
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
        <Pressable
          onPress={() => void toggle('save')}
          disabled={saveInFlight}
          style={[styles.socialAction, { opacity: saveInFlight ? 0.55 : 1 }]}
          accessibilityRole="button"
          accessibilityLabel={post.viewer.saved ? 'Unsave post' : 'Save post'}
          accessibilityState={{ disabled: saveInFlight, selected: post.viewer.saved, busy: saveInFlight }}
        >
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
          <Ionicons name="arrow-redo-outline" size={18} color={colors.mutedForeground} />
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

function CreateActionSheet({
  colors,
  onClose,
  onCreatePost,
  onCreateStory,
  onOpenCamera,
}: {
  colors: any;
  onClose: () => void;
  onCreatePost: () => void;
  onCreateStory: () => void;
  onOpenCamera: () => void;
}) {
  const options = [
    { icon: 'create-outline' as const, title: 'Create a post', hint: 'Share a photo or video with your feed.', onPress: onCreatePost },
    { icon: 'timer-outline' as const, title: 'Create a story', hint: 'Share a moment that disappears after 24 hours.', onPress: onCreateStory },
    { icon: 'camera-outline' as const, title: 'Camera / media creation', hint: 'Open the camera to capture something new.', onPress: onOpenCamera },
  ];
  return (
    <View style={styles.sheetOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.createActionSheet, { backgroundColor: colors.card }]}>
        <View style={styles.sheetTop}>
          <View>
            <Text style={[styles.sheetEyebrow, { color: colors.mutedForeground }]}>SHARE SOMETHING</Text>
            <Text style={[styles.notificationsTitle, { color: colors.foreground }]}>Create</Text>
          </View>
          <IconButton name="close" onPress={onClose} size={24} />
        </View>
        {options.map((option) => (
          <Pressable key={option.title} onPress={option.onPress} style={[styles.createActionItem, { borderBottomColor: colors.border }]} accessibilityRole="button">
            <View style={[styles.createActionIcon, { backgroundColor: colors.secondary }]}>
              <Ionicons name={option.icon} size={22} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.shareOptionTitle, { color: colors.foreground }]}>{option.title}</Text>
              <Text style={[styles.shareOptionHint, { color: colors.mutedForeground }]}>{option.hint}</Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}

function SocialVideoViewer({
  video,
  token,
  colors,
  onClose,
}: {
  video: { uri: string; title: string };
  token: string;
  colors: any;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.socialVideoViewer}>
      <View style={[styles.socialVideoViewerHeader, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={onClose} style={styles.socialVideoClose} accessibilityRole="button" accessibilityLabel="Close video viewer">
          <Ionicons name="chevron-back" size={24} color="#fff" />
        </Pressable>
        <Text style={styles.socialVideoViewerTitle} numberOfLines={1}>{video.title}</Text>
        <View style={{ width: 42 }} />
      </View>
      <View style={styles.socialVideoViewerStage}>
        <VideoSurface
          source={{ uri: video.uri, headers: { Authorization: `Bearer ${token}` } }}
          style={styles.socialVideoViewerMedia}
          controls
          muted={false}
          loop={false}
          contentFit="contain"
        />
      </View>
      <Text style={[styles.socialVideoViewerHint, { color: 'rgba(255,255,255,0.65)', paddingBottom: insets.bottom + 12 }]}>Tap the back button to return to Updates</Text>
    </View>
  );
}

function socialPostReference(post: SocialPost) {
  const preview = post.content.trim().slice(0, 1400);
  const fallback = `${post.author.name} shared a ${post.kind} post.`;
  return `Shared an Old Time post from @${post.author.username}\n\n${preview || fallback}\n\nPost #${post.id}`;
}

function SocialPostShareSheet({ post, colors, onClose, onShareInOldTime, onSystemShare }: {
  post: SocialPost;
  colors: any;
  onClose: () => void;
  onShareInOldTime: () => void;
  onSystemShare: () => void;
}) {
  return (
    <KeyboardAvoidingView behavior="padding" style={styles.sheetOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.shareMenuSheet, { backgroundColor: colors.card }]}>
        <View style={styles.sheetTop}>
          <View>
            <Text style={[styles.sheetEyebrow, { color: colors.mutedForeground }]}>SOCIAL POST</Text>
            <Text style={[styles.notificationsTitle, { color: colors.foreground }]}>Share post</Text>
          </View>
          <IconButton name="close" onPress={onClose} size={24} />
        </View>
        <View style={[styles.sharePostPreview, { backgroundColor: colors.muted }]}>
          <Text style={[styles.commentAuthor, { color: colors.foreground }]}>@{post.author.username}</Text>
          <Text style={[styles.commentContent, { color: colors.foreground }]} numberOfLines={3}>
            {post.content || `${post.author.name} shared a ${post.kind} post.`}
          </Text>
        </View>
        <Pressable onPress={onShareInOldTime} style={[styles.shareOption, { borderBottomColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Share in Old Time">
          <View style={[styles.shareOptionIcon, { backgroundColor: colors.secondary }]}>
            <Ionicons name="chatbubbles-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.shareOptionTitle, { color: colors.foreground }]}>Share in Old Time</Text>
            <Text style={[styles.shareOptionHint, { color: colors.mutedForeground }]}>Send a reference in a conversation</Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={colors.mutedForeground} />
        </Pressable>
        <Pressable onPress={onSystemShare} style={styles.shareOption} accessibilityRole="button" accessibilityLabel="System Share">
          <View style={[styles.shareOptionIcon, { backgroundColor: colors.secondary }]}>
            <Ionicons name="share-outline" size={22} color={colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.shareOptionTitle, { color: colors.foreground }]}>System Share</Text>
            <Text style={[styles.shareOptionHint, { color: colors.mutedForeground }]}>Use your device’s share options</Text>
          </View>
          <Ionicons name="chevron-forward" size={19} color={colors.mutedForeground} />
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

function SharePostInOldTimeSheet({ post, viewerId, colors, onBack, onClose, onShared }: {
  post: SocialPost;
  viewerId: number;
  colors: any;
  onBack: () => void;
  onClose: () => void;
  onShared: (name: string) => void;
}) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [sharingId, setSharingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void listUsers({ viewerId })
      .then((items) => { if (active) setPeople(items.filter((person) => person.id !== viewerId)); })
      .catch(() => { if (active) setError('People are unavailable right now.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [viewerId]);

  const visiblePeople = people.filter((person) => `${person.name} ${person.username ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));

  async function shareWith(person: User) {
    if (sharingId !== null) return;
    setSharingId(person.id);
    setError(null);
    try {
      const direct = await getDirectChat(viewerId, person.id);
      const chat = direct.chat ?? await createChat({ userIds: [viewerId, person.id] });
      await createMessage(chat.id, {
        senderId: viewerId,
        content: socialPostReference(post),
      });
      onShared(person.name);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : `The post could not be shared with ${person.name}.`);
      setSharingId(null);
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.messagesInboxOverlay, { backgroundColor: colors.card }]}>
      <View style={[styles.messagesInboxSheet, { backgroundColor: colors.card, paddingTop: insets.top + 8 }]}>
        <View style={styles.messagesInboxHeader}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <IconButton name="chevron-back" onPress={onBack} size={24} label="Back to share options" />
            <View>
              <Text style={[styles.newMessageEyebrow, { color: colors.mutedForeground }]}>SHARE IN OLD TIME</Text>
              <Text style={[styles.newMessageTitle, { color: colors.foreground }]}>Choose a conversation</Text>
            </View>
          </View>
          <IconButton name="close" onPress={onClose} size={24} />
        </View>
        <View style={[styles.messagesSearch, { backgroundColor: colors.muted }]}>
          <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Search people"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.messagesSearchInput, { color: colors.foreground }]}
          />
        </View>
        <View style={[styles.shareReferenceHint, { backgroundColor: colors.secondary }]}>
          <Ionicons name="document-text-outline" size={18} color={colors.primary} />
          <Text style={[styles.shareOptionHint, { color: colors.mutedForeground, flex: 1 }]}>
            A text reference to the original post will be sent. Its media will not be copied.
          </Text>
        </View>
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 10, paddingBottom: insets.bottom + 24 }}>
            {error ? <Text style={[styles.newMessageError, { color: colors.destructive }]}>{error}</Text> : null}
            {visiblePeople.map((person) => (
              <Pressable
                key={person.id}
                onPress={() => void shareWith(person)}
                style={[styles.messageContactRow, { borderBottomColor: colors.border, opacity: sharingId !== null && sharingId !== person.id ? 0.45 : 1 }]}
                disabled={sharingId !== null}
                accessibilityRole="button"
                accessibilityLabel={`Share post with ${person.name}`}
                accessibilityState={{ disabled: sharingId !== null, busy: sharingId === person.id }}
              >
                <Avatar name={person.name} size={50} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.messageContactName, { color: colors.foreground }]}>{person.name}</Text>
                  {person.username ? <Text style={[styles.messageContactPreview, { color: colors.mutedForeground }]}>@{person.username}</Text> : null}
                </View>
                {sharingId === person.id ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="send-outline" size={22} color={colors.primary} />}
              </Pressable>
            ))}
            {!error && visiblePeople.length === 0 ? <View style={styles.messagesEmpty}><Ionicons name="people-outline" size={28} color={colors.primary} /><Text style={[styles.messagesEmptyTitle, { color: colors.foreground }]}>No one found</Text><Text style={[styles.messagesEmptyText, { color: colors.mutedForeground }]}>Try another name.</Text></View> : null}
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function SocialProfileSheet({ userId, own, token, colors, onClose, onMessageRequest, onExclude, onNotifications, onRequests, onBlock, unreadCount, onComment, onShare, onFeedback, onOpenHub }: { userId: number; own: boolean; token: string; colors: any; onClose: () => void; onMessageRequest: (userId: number, name: string) => void; onExclude: (person: { id: number; name: string }) => void; onNotifications: () => void; onRequests: () => void; onBlock: (userId: number, name: string) => void; unreadCount: number; onComment: (post: SocialPost) => void; onShare: (post: SocialPost) => void; onFeedback: (message: string) => void; onOpenHub: (hub: { id: number; name: string; slug: string }) => void }) {
  const [card, setCard] = useState<UserCard | null>(null);
  const [profilePosts, setProfilePosts] = useState<SocialPost[]>([]);
  const [profilePostsLoading, setProfilePostsLoading] = useState(true);
  const [loading, setLoading] = useState(true);
  const [following, setFollowingState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionType, setConnectionType] = useState<'followers' | 'following' | null>(null);
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
      onFeedback(next ? `Following ${card.name}.` : `Unfollowed ${card.name}.`);
    } catch {
      setFollowingState(!next);
      onFeedback('Follow was not updated.');
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
            <Avatar name={card.name} size={86} color={colors.primary} uri={socialAvatarUrl(card.avatarObjectPath)} />
            <Text style={[styles.socialProfileName, { color: colors.foreground }]}>{own ? 'You' : card.name}</Text>
            <Text style={[styles.socialProfileHandle, { color: colors.mutedForeground }]}>{card.username}</Text>
            {card.bio ? <Text style={[styles.socialProfileBio, { color: colors.foreground }]}>{card.bio}</Text> : null}
            <View style={styles.socialProfileStats}>
              <Pressable onPress={() => setConnectionType('followers')} accessibilityRole="button" accessibilityLabel={`View ${card.followerCount} followers`}><Text style={[styles.profileStatValue, { color: colors.foreground }]}>{card.followerCount}</Text><Text style={[styles.profileStatLabel, { color: colors.mutedForeground }]}>Followers</Text></Pressable>
              <Pressable onPress={() => setConnectionType('following')} accessibilityRole="button" accessibilityLabel={`View ${card.followingCount} following`}><Text style={[styles.profileStatValue, { color: colors.foreground }]}>{card.followingCount}</Text><Text style={[styles.profileStatLabel, { color: colors.mutedForeground }]}>Following</Text></Pressable>
            </View>
            <View style={styles.socialProfileActions}>
              {own ? <Pressable onPress={onNotifications} style={[styles.profileIconAction, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Open notifications"><Ionicons name="notifications-outline" size={19} color={colors.primary} />{unreadCount > 0 ? <View style={{ position: 'absolute', top: -1, right: -1, width: 9, height: 9, borderRadius: 4.5, backgroundColor: colors.destructive }} /> : null}<Text style={{ color: colors.foreground, fontWeight: '600' }}>Notifications</Text></Pressable> : null}
              {own ? <Pressable onPress={onRequests} style={[styles.profileIconAction, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Open social messages"><Ionicons name="mail-unread-outline" size={19} color={colors.primary} /><Text style={{ color: colors.foreground, fontWeight: '600' }}>Messages</Text></Pressable> : null}
              {!own ? <Pressable onPress={() => void toggleFollow()} style={[styles.profileAction, { backgroundColor: following ? colors.secondary : colors.primary }]}><Ionicons name={following ? 'checkmark' : 'person-add-outline'} size={17} color={following ? colors.foreground : '#fff'} /><Text style={{ color: following ? colors.foreground : '#fff', fontWeight: '600' }}>{following ? 'Following' : 'Follow'}</Text></Pressable> : null}
              {!own && card.canMessage ? <Pressable onPress={() => onMessageRequest(userId, card.name)} style={[styles.profileIconAction, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel={`Message ${card.name}`}><Ionicons name="mail-outline" size={19} color={colors.primary} /><Text style={{ color: colors.foreground, fontWeight: '600' }}>Message</Text></Pressable> : null}
            </View>
            <View style={[styles.profileContentTab, { borderBottomColor: colors.primary }]} accessibilityRole="tab" accessibilityState={{ selected: true }}>
              <Ionicons name="grid-outline" size={16} color={colors.primary} />
              <Text style={[styles.profileContentTabText, { color: colors.primary }]}>Posts</Text>
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
                    onShare={() => onShare(post)}
                    onComment={() => onComment(post)}
                    onChanged={(updated) => setProfilePosts((items) => items.map((item) => item.id === updated.id ? updated : item))}
                    onOpenHub={onOpenHub}
                  />
                ))}
              </View>
            ) : (
              <Text style={[styles.profilePostsEmpty, { color: colors.mutedForeground }]}>
                 {own ? 'Your posts will appear here.' : 'No visible posts yet.'}
              </Text>
            )}
            {!own ? <Pressable onPress={() => onExclude({ id: card.id, name: card.name })} style={styles.excludeAction}><Ionicons name="eye-off-outline" size={17} color={colors.mutedForeground} /><Text style={{ color: colors.mutedForeground }}>Sharing visibility</Text></Pressable> : null}
            {!own ? <Pressable onPress={() => onBlock(card.id, card.name)} style={styles.excludeAction}><Ionicons name="ban-outline" size={17} color={colors.destructive} /><Text style={{ color: colors.destructive }}>Block {card.name}</Text></Pressable> : null}
            <Pressable onPress={onClose} style={[styles.profileDone, { borderColor: colors.border }]}><Text style={{ color: colors.primary, fontWeight: '600' }}>Done</Text></Pressable>
          </ScrollView>
        ) : null}
        {connectionType ? <ConnectionListSheet type={connectionType} userId={userId} token={token} colors={colors} onClose={() => setConnectionType(null)} /> : null}
      </View>
    </KeyboardAvoidingView>
  );
}

function ConnectionListSheet({ type, userId, token, colors, onClose }: { type: 'followers' | 'following'; userId: number; token: string; colors: any; onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<SocialConnection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const timer = setTimeout(() => {
      setLoading(true);
      setError(null);
      void getUserConnections(token, userId, type, query.trim() || undefined)
        .then((page) => { if (mounted) setItems(page.items); })
        .catch((requestError) => { if (mounted) setError(requestError instanceof Error ? requestError.message : 'Connections are unavailable.'); })
        .finally(() => { if (mounted) setLoading(false); });
    }, query.trim() ? 220 : 0);
    return () => { mounted = false; clearTimeout(timer); };
  }, [query, token, type, userId]);

  return (
    <View style={styles.connectionOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.connectionSheet, { backgroundColor: colors.card }]}>
        <View style={styles.sheetTop}>
          <Text style={[styles.notificationsTitle, { color: colors.foreground }]}>{type === 'followers' ? 'Followers' : 'Following'}</Text>
          <IconButton name="close" onPress={onClose} size={24} />
        </View>
        <View style={[styles.peopleSearchInput, { backgroundColor: colors.muted, borderColor: colors.border }]}>
          <Ionicons name="search-outline" size={17} color={colors.mutedForeground} />
          <TextInput value={query} onChangeText={setQuery} placeholder="Search" placeholderTextColor={colors.mutedForeground} style={[styles.peopleSearchText, { color: colors.foreground }]} autoCapitalize="none" autoCorrect={false} />
        </View>
        {loading ? <ActivityIndicator color={colors.primary} style={{ margin: 30 }} /> : error ? (
          <Text style={[styles.profilePostsEmpty, { color: colors.destructive }]}>{error}</Text>
        ) : items.length ? (
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: 20 }}>
            {items.map((person) => (
              <View key={person.id} style={[styles.peopleSearchRow, { borderBottomColor: colors.border }]}>
                <Avatar name={person.name} size={42} color={colors.primary} />
                <View style={{ flex: 1 }}><Text style={[styles.socialAuthorName, { color: colors.foreground }]}>{person.name}</Text>{person.bio ? <Text numberOfLines={1} style={[styles.socialAuthorMeta, { color: colors.mutedForeground }]}>{person.bio}</Text> : null}</View>
              </View>
            ))}
          </ScrollView>
        ) : <Text style={[styles.profilePostsEmpty, { color: colors.mutedForeground }]}>{query.trim() ? 'No matches.' : `No ${type} yet.`}</Text>}
      </View>
    </View>
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
  const [error, setError] = useState<string | null>(null);
  const [replyingTo, setReplyingTo] = useState<SocialComment | null>(null);
  const [expandedReplies, setExpandedReplies] = useState<Record<number, boolean>>({});
  const [likeInFlight, setLikeInFlight] = useState<Record<number, boolean>>({});

  useEffect(() => {
    let mounted = true;
    setLoading(true);
    setError(null);
    void getPostComments(token, post.id)
      .then((items) => { if (mounted) setComments(items); })
      .catch((requestError) => {
        if (!mounted) return;
        setError(requestError instanceof Error ? requestError.message : 'Comments are unavailable.');
      })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, [post.id, token]);

  const repliesByParent = useMemo(() => {
    const grouped = new Map<number, SocialComment[]>();
    for (const comment of comments) {
      if (comment.parentId === null) continue;
      const replies = grouped.get(comment.parentId) ?? [];
      replies.push(comment);
      grouped.set(comment.parentId, replies);
    }
    return grouped;
  }, [comments]);

  async function submit(value = text) {
    const content = value.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const comment = await createPostComment(token, post.id, content, replyingTo?.id ?? null);
      setComments((items) => [...items, comment]);
      setText('');
      if (replyingTo) {
        setExpandedReplies((items) => ({ ...items, [replyingTo.id]: true }));
      }
      setReplyingTo(null);
      onPostChanged({ ...post, counts: { ...post.counts, comments: post.counts.comments + 1 } });
    } catch (error) {
      Alert.alert('Comment not posted', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSending(false);
    }
  }

  async function toggleLike(comment: SocialComment) {
    if (likeInFlight[comment.id]) return;
    const nextLiked = !comment.liked;
    setLikeInFlight((items) => ({ ...items, [comment.id]: true }));
    setComments((items) => items.map((item) => item.id === comment.id ? {
      ...item,
      liked: nextLiked,
      likeCount: Math.max(0, item.likeCount + (nextLiked ? 1 : -1)),
    } : item));
    try {
      await setCommentLike(token, comment.id, nextLiked);
    } catch (requestError) {
      setComments((items) => items.map((item) => item.id === comment.id ? {
        ...item,
        liked: comment.liked,
        likeCount: comment.likeCount,
      } : item));
      Alert.alert('Comment like not updated', requestError instanceof Error ? requestError.message : 'Please try again.');
    } finally {
      setLikeInFlight((items) => {
        const next = { ...items };
        delete next[comment.id];
        return next;
      });
    }
  }

  function renderComment(comment: SocialComment, depth = 0): React.ReactNode {
    const replies = repliesByParent.get(comment.id) ?? [];
    const expanded = expandedReplies[comment.id] !== false;
    const indent = Math.min(depth, 4) * 20;
    return (
      <View key={comment.id} style={{ marginLeft: indent }}>
        <View style={[styles.commentRow, { borderBottomColor: colors.border }]}>
          <Avatar name={comment.author.name} size={depth ? 29 : 34} color={colors.primary} uri={socialAvatarUrl(comment.author.avatarObjectPath)} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.commentAuthor, { color: colors.foreground }]}>{comment.author.name} <Text style={{ color: colors.mutedForeground, fontWeight: '400' }}>@{comment.author.username}</Text></Text>
            <Text style={[styles.commentContent, { color: colors.foreground }]}>{comment.content}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 15, marginTop: 7 }}>
              <Pressable
                onPress={() => void toggleLike(comment)}
                disabled={Boolean(likeInFlight[comment.id])}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 4, opacity: likeInFlight[comment.id] ? 0.55 : 1 }}
                accessibilityRole="button"
                accessibilityLabel={comment.liked ? 'Unlike comment' : 'Like comment'}
              >
                <Ionicons name={comment.liked ? 'heart' : 'heart-outline'} size={16} color={comment.liked ? colors.destructive : colors.mutedForeground} />
                <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{comment.likeCount}</Text>
              </Pressable>
              <Pressable onPress={() => setReplyingTo(comment)} accessibilityRole="button" accessibilityLabel={`Reply to @${comment.author.username}`}>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, fontWeight: '600' }}>Reply</Text>
              </Pressable>
            </View>
          </View>
        </View>
        {replies.length > 0 ? (
          <Pressable
            onPress={() => setExpandedReplies((items) => ({ ...items, [comment.id]: !expanded }))}
            style={{ paddingVertical: 7 }}
            accessibilityRole="button"
            accessibilityLabel={expanded ? `Collapse ${replies.length} replies` : `Expand ${replies.length} replies`}
          >
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>
              {expanded ? 'Hide replies' : `View ${replies.length} ${replies.length === 1 ? 'reply' : 'replies'}`}
            </Text>
          </Pressable>
        ) : null}
        {expanded ? replies.map((reply) => renderComment(reply, depth + 1)) : null}
      </View>
    );
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
        {loading ? <ActivityIndicator color={colors.primary} style={{ margin: 34 }} /> : error ? (
          <Text style={[styles.profilePostsEmpty, { color: colors.destructive }]}>{error}</Text>
        ) : (
          <ScrollView style={{ maxHeight: 320 }} contentContainerStyle={{ paddingBottom: 12 }} keyboardShouldPersistTaps="handled">
            {comments.length === 0 ? <Text style={[styles.profilePostsEmpty, { color: colors.mutedForeground }]}>Be the first person to comment.</Text> : comments.filter((comment) => comment.parentId === null).map((comment) => renderComment(comment))}
          </ScrollView>
        )}
        {replyingTo ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, paddingVertical: 8 }}>
            <Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600', flex: 1 }}>Replying to @{replyingTo.author.username}</Text>
            <Pressable onPress={() => setReplyingTo(null)} accessibilityRole="button" accessibilityLabel="Cancel reply">
              <Ionicons name="close-circle-outline" size={20} color={colors.mutedForeground} />
            </Pressable>
          </View>
        ) : null}
        <View style={[styles.commentComposer, { borderTopColor: colors.border }]}>
          <ChatComposer
            value={text}
            onChangeText={setText}
            onSendText={(value) => void submit(value)}
            onOpenAttachments={() => undefined}
            onRecordVoice={() => undefined}
            colors={colors}
            placeholder={replyingTo ? 'Write a reply…' : 'Write a comment…'}
            showAttachments={false}
            idleAction="send"
            disabled={sending}
          />
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

function MessagesInboxSheet({ requestCount, loading, username, displayName, notes, posts, colors, onClose, onCreateMessage, onOpenRequests, onCreateNote, onEditNote }: { requestCount: number; loading: boolean; username: string; displayName: string; notes: Note[]; posts: SocialPost[]; colors: any; onClose: () => void; onCreateMessage: () => void; onOpenRequests: () => void; onCreateNote: () => void; onEditNote: (note: Note) => void; onDeleteNote: (note: Note) => void }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const ownNote = notes.find((note) => note.viewer.isOwner);
  const sharedNotes = notes.filter((note) => !note.viewer.isOwner);
  const messageAuthors = Array.from(new Map(posts.map((post) => [post.author.id, post.author])).values()).filter((author) => author.username !== username);
  const visibleAuthors = messageAuthors.filter((author) => `${author.name} ${author.username}`.toLowerCase().includes(query.trim().toLowerCase()));
  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.messagesInboxOverlay, { backgroundColor: colors.card }]}>
      <View style={[styles.messagesInboxSheet, { backgroundColor: colors.card, paddingTop: insets.top + 8 }]}>
        <View style={styles.messagesInboxHeader}>
          <Text style={[styles.messagesInboxUsername, { color: colors.foreground }]}>{username}</Text>
          <View style={styles.messagesInboxHeaderActions}>
            <IconButton name="close" onPress={onClose} size={24} />
            <IconButton name="create-outline" onPress={onCreateMessage} size={24} label="Create a message" />
          </View>
        </View>
        <View style={[styles.messagesSearch, { backgroundColor: colors.muted }]}>
          <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search messages on Old Time"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.messagesSearchInput, { color: colors.foreground }]}
            returnKeyType="search"
          />
        </View>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: insets.bottom + 28 }}>
          <Pressable
            onPress={() => ownNote ? onEditNote(ownNote) : onCreateNote()}
            style={[styles.ownNoteCard, { backgroundColor: colors.muted, borderColor: colors.border }]}
            accessibilityRole="button"
            accessibilityLabel={ownNote ? 'Edit your note' : 'Create a note'}
          >
            <Avatar name={displayName} size={48} color={colors.primary} />
            <View style={styles.ownNoteCopy}>
              <Text style={[styles.ownNoteTitle, { color: colors.foreground }]}>{ownNote ? 'Your note' : 'Share a note'}</Text>
              <Text style={[styles.ownNoteText, { color: colors.mutedForeground }]} numberOfLines={2}>
                {ownNote?.content ?? 'Let friends know what’s on your mind.'}
              </Text>
            </View>
            <View style={[styles.ownNoteAction, { backgroundColor: colors.card }]}>
              <Ionicons name={ownNote ? 'pencil' : 'add'} size={17} color={colors.primary} />
            </View>
          </Pressable>
          {sharedNotes.length > 0 ? (
            <View style={styles.friendNotes}>
              <Text style={[styles.friendNotesLabel, { color: colors.mutedForeground }]}>FRIENDS’ NOTES</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.notesRail}>
                {sharedNotes.slice(0, 8).map((note) => (
                  <View key={note.id} style={[styles.friendNoteCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                    <Avatar name={note.owner.name} size={34} color={colors.primary} />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.noteName, { color: colors.foreground }]} numberOfLines={1}>{note.owner.name}</Text>
                      <Text style={[styles.friendNoteText, { color: colors.mutedForeground }]} numberOfLines={2}>{note.content}</Text>
                    </View>
                  </View>
                ))}
              </ScrollView>
            </View>
          ) : null}
          <View style={styles.messagesTabs}>
            <View style={styles.messagesTab} accessibilityRole="tab" accessibilityState={{ selected: true }}>
              <Text style={[styles.messagesTabText, { color: colors.foreground }]}>Messages</Text>
            </View>
            <Pressable onPress={onOpenRequests} style={styles.messagesTab} accessibilityRole="tab" accessibilityLabel="Requests">
              <Text style={[styles.messagesTabText, { color: colors.mutedForeground }]}>Requests</Text>
              {requestCount > 0 ? <View style={[styles.messagesTabBadge, { backgroundColor: colors.primary }]}><Text style={styles.messagesTabBadgeText}>{requestCount}</Text></View> : null}
            </Pressable>
          </View>
          {loading && requestCount === 0 ? <ActivityIndicator color={colors.primary} style={{ margin: 20 }} /> : visibleAuthors.length === 0 ? (
            <View style={styles.messagesEmpty}>
              <Ionicons name="chatbubbles-outline" size={28} color={colors.primary} />
              <Text style={[styles.messagesEmptyTitle, { color: colors.foreground }]}>No messages yet</Text>
              <Text style={[styles.messagesEmptyText, { color: colors.mutedForeground }]}>Your conversations will appear here.</Text>
            </View>
          ) : visibleAuthors.slice(0, 12).map((author, index) => (
            <Pressable key={author.id} onPress={onCreateMessage} style={({ pressed }) => [styles.messageContactRow, { opacity: pressed ? 0.7 : 1 }]} accessibilityRole="button" accessibilityLabel={`Create a message for ${author.name}`}>
              <Avatar name={author.name} size={58} color={colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.messageContactName, { color: colors.foreground }]} numberOfLines={1}>{author.name}</Text>
                <Text style={[styles.messageContactPreview, { color: index % 3 === 0 ? colors.foreground : colors.mutedForeground }]} numberOfLines={1}>{index % 3 === 0 ? '2 new messages' : index % 3 === 1 ? 'Seen recently' : 'Sent a message' } · {index + 2}h</Text>
              </View>
              {index % 3 === 0 ? <View style={[styles.messageUnreadDot, { backgroundColor: colors.primary }]} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  );
}

function NewMessageSheet({ viewerId, colors, onClose, onChatReady }: { viewerId: number; colors: any; onClose: () => void; onChatReady: (chatId: number) => void }) {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const [people, setPeople] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [creatingId, setCreatingId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    void listUsers({ viewerId })
      .then((items) => { if (active) setPeople(items.filter((person) => person.id !== viewerId)); })
      .catch(() => { if (active) setError('People are unavailable right now.'); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [viewerId]);

  const visiblePeople = people.filter((person) => `${person.name} ${person.username ?? ''}`.toLowerCase().includes(query.trim().toLowerCase()));

  async function choosePerson(person: User) {
    if (creatingId !== null) return;
    setCreatingId(person.id);
    setError(null);
    try {
      const chat = await createChat({ userIds: [viewerId, person.id] });
      onChatReady(chat.id);
    } catch {
      setError(`A message with ${person.name} could not be started.`);
      setCreatingId(null);
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={[styles.messagesInboxOverlay, { backgroundColor: colors.card }]}>
      <View style={[styles.messagesInboxSheet, { backgroundColor: colors.card, paddingTop: insets.top + 8 }]}>
        <View style={styles.messagesInboxHeader}>
          <View>
            <Text style={[styles.newMessageEyebrow, { color: colors.mutedForeground }]}>NEW CONVERSATION</Text>
            <Text style={[styles.newMessageTitle, { color: colors.foreground }]}>Create a message</Text>
          </View>
          <IconButton name="close" onPress={onClose} size={24} />
        </View>
        <View style={[styles.messagesSearch, { backgroundColor: colors.muted }]}>
          <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
          <TextInput
            autoFocus
            value={query}
            onChangeText={setQuery}
            placeholder="Who do you want to message?"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.messagesSearchInput, { color: colors.foreground }]}
          />
        </View>
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 40 }} /> : (
          <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ paddingTop: 16, paddingBottom: insets.bottom + 24 }}>
            {error ? <Text style={[styles.newMessageError, { color: colors.destructive }]}>{error}</Text> : null}
            {visiblePeople.map((person) => (
              <Pressable key={person.id} onPress={() => void choosePerson(person)} style={[styles.messageContactRow, { borderBottomColor: colors.border }]} disabled={creatingId !== null}>
                <Avatar name={person.name} size={50} color={colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.messageContactName, { color: colors.foreground }]}>{person.name}</Text>
                  {person.username ? <Text style={[styles.messageContactPreview, { color: colors.mutedForeground }]}>@{person.username}</Text> : null}
                </View>
                {creatingId === person.id ? <ActivityIndicator color={colors.primary} /> : <Ionicons name="arrow-forward-circle-outline" size={24} color={colors.primary} />}
              </Pressable>
            ))}
            {!error && visiblePeople.length === 0 ? <View style={styles.messagesEmpty}><Ionicons name="people-outline" size={28} color={colors.primary} /><Text style={[styles.messagesEmptyTitle, { color: colors.foreground }]}>No one found</Text><Text style={[styles.messagesEmptyText, { color: colors.mutedForeground }]}>Try another name.</Text></View> : null}
          </ScrollView>
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

function NoteEditorSheet({ note, colors, onClose, onSave, onDelete }: { note: Note | null; colors: any; onClose: () => void; onSave: (content: string) => Promise<void>; onDelete?: () => Promise<void> }) {
  const insets = useSafeAreaInsets();
  const [content, setContent] = useState(note?.content ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    if (!content.trim()) {
      setError('Write something first.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(content.trim());
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save your note.');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (!onDelete) return;
    setSaving(true);
    setError(null);
    try {
      await onDelete();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not delete your note.');
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior="padding" style={styles.sheetOverlay}>
      <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
      <View style={[styles.noteEditorSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 18 }]}>
        <View style={styles.sheetTop}>
          <View>
            <Text style={[styles.sheetEyebrow, { color: colors.mutedForeground }]}>MESSAGES</Text>
            <Text style={[styles.notificationsTitle, { color: colors.foreground }]}>{note ? 'Edit your note' : 'New note'}</Text>
          </View>
          <IconButton name="close" onPress={onClose} size={24} />
        </View>
        <TextInput
          autoFocus
          multiline
          maxLength={280}
          value={content}
          onChangeText={setContent}
          placeholder="Share what’s on your mind…"
          placeholderTextColor={colors.mutedForeground}
          style={[styles.noteEditorInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]}
        />
        <View style={styles.noteEditorFooter}>
          <Text style={[styles.noteEditorHint, { color: colors.mutedForeground }]}>Visible in chats for 24 hours. Your note stays here until you delete it.</Text>
          {error ? <Text style={[styles.noteEditorError, { color: colors.destructive }]}>{error}</Text> : null}
          <View style={styles.noteEditorActions}>
            {onDelete ? <Pressable onPress={remove} disabled={saving}><Text style={[styles.noteDeleteButton, { color: colors.destructive }]}>Delete</Text></Pressable> : <View />}
            <Pressable onPress={() => void save()} disabled={saving} style={[styles.noteSaveButton, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}>
              {saving ? <ActivityIndicator size="small" color="#fff" /> : <Text style={styles.noteSaveButtonText}>{note ? 'Save changes' : 'Share note'}</Text>}
            </Pressable>
          </View>
        </View>
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
            placeholder="Search name or username"
            placeholderTextColor={colors.mutedForeground}
            style={[styles.peopleSearchText, { color: colors.foreground }]}
            autoCapitalize="none"
            autoCorrect={false}
            returnKeyType="search"
          />
        </View>
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
                  <Text style={[styles.socialAuthorMeta, { color: colors.mutedForeground }]}>{person.username}</Text>
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
  if (type.includes('mention')) return 'tagged you in a story';
  if (type.includes('reply')) return 'replied to your story';
  if (type.includes('reaction')) return 'reacted to your story';
  if (type.includes('comment')) return 'commented on your post';
  if (type.includes('like')) return 'liked your post';
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
      <View style={styles.interestPromptTop}>
        <Text style={[styles.interestPromptTitle, { color: colors.foreground }]}>Interested in this?</Text>
        <Pressable onPress={onDismiss} accessibilityRole="button" accessibilityLabel="Dismiss interest question" hitSlop={8}>
          <Ionicons name="close" size={18} color={colors.mutedForeground} />
        </Pressable>
      </View>
      <Text style={[styles.interestPromptText, { color: colors.mutedForeground }]} numberOfLines={2}>Show more posts like this from {title}?</Text>
      <View style={styles.interestPromptActions}>
        <Pressable onPress={() => onFeedback(false)} style={[styles.interestPromptButton, { borderColor: colors.border }]} accessibilityRole="button">
          <Text style={[styles.interestPromptButtonText, { color: colors.mutedForeground }]}>No thanks</Text>
        </Pressable>
        <Pressable onPress={() => onFeedback(true)} style={[styles.interestPromptButton, { backgroundColor: colors.primary, borderColor: colors.primary }]} accessibilityRole="button">
          <Text style={[styles.interestPromptButtonText, { color: '#fff' }]}>Show more</Text>
        </Pressable>
      </View>
    </View>
  );
}

function interestNodeMatches(node: InterestNode, query: string): boolean {
  if (!query) return true;
  if (node.name.toLowerCase().includes(query)) return true;
  return Boolean(node.sub?.some((child) => interestNodeMatches(child, query)));
}

function countSelected(node: InterestNode, interests: string[]): number {
  return (interests.includes(node.id) ? 1 : 0) + (node.sub?.reduce((total, child) => total + countSelected(child, interests), 0) ?? 0);
}

function InterestNodeRow({ node, depth, interests, query, expanded, onToggle, onToggleExpanded, onToggleNearby, colors }: { node: InterestNode; depth: number; interests: string[]; query: string; expanded: Set<string>; onToggle: (id: string) => void; onToggleExpanded: (id: string) => void; onToggleNearby: (id: string) => void; colors: any }) {
  if (!interestNodeMatches(node, query)) return null;
  const hasChildren = Boolean(node.sub?.length);
  const selected = interests.includes(node.id);
  const selectedChildren = hasChildren ? countSelected(node, interests) : 0;
  const open = expanded.has(node.id) || Boolean(query);
  const description = node.id === 'nearby' && !selected ? 'Enable location for nearby stories' : node.blurb;
  return (
    <View style={[styles.interestNodeGroup, depth > 0 && styles.interestNodeChildGroup]}>
      <View style={[depth === 0 ? styles.interestChip : styles.interestChildChip, { backgroundColor: selected ? colors.primary : colors.card, borderColor: selected ? colors.primary : colors.border }]}>
        <Pressable onPress={() => (node.id === 'nearby' ? onToggleNearby(node.id) : onToggle(node.id))} style={styles.interestNodeMain} accessibilityRole="checkbox" accessibilityState={{ checked: selected }} accessibilityLabel={`Toggle ${node.name}`}>
          <View style={[styles.check, { backgroundColor: selected ? '#fff' : colors.muted }]}>{selected ? <Ionicons name="checkmark" size={13} color={colors.primary} /> : null}</View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.interestLabel, { color: selected ? '#fff' : colors.foreground }]}>{node.name}</Text>
            {description ? <Text style={[styles.interestDescription, { color: selected ? 'rgba(255,255,255,0.8)' : colors.mutedForeground }]}>{description}</Text> : null}
            {selectedChildren > 0 ? <Text style={[styles.interestSelectedCount, { color: selected ? 'rgba(255,255,255,0.82)' : colors.primary }]}>{selectedChildren} selected</Text> : null}
          </View>
        </Pressable>
        {hasChildren ? (
          <Pressable onPress={() => onToggleExpanded(node.id)} style={styles.interestExpandButton} accessibilityRole="button" accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${node.name}`}>
            <Ionicons name={open ? 'chevron-up' : 'chevron-down'} size={19} color={selected ? '#fff' : colors.foreground} />
          </Pressable>
        ) : node.id === 'nearby' ? <Ionicons name="location-outline" size={17} color={selected ? '#fff' : colors.primary} style={{ marginRight: 12 }} /> : null}
      </View>
      {hasChildren && open ? (
        <View style={styles.interestChildren}>
          {node.sub?.map((child) => <InterestNodeRow key={child.id} node={child} depth={depth + 1} interests={interests} query={query} expanded={expanded} onToggle={onToggle} onToggleExpanded={onToggleExpanded} onToggleNearby={onToggleNearby} colors={colors} />)}
        </View>
      ) : null}
    </View>
  );
}

function InterestPanel({ interests, onToggle, languages, onToggleLanguage, onBack, colors }: any) {
  const [locationEnabled, setLocationEnabled] = useState(false);
  const [query, setQuery] = useState('');
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
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

  function toggleExpanded(id: string) {
    setExpanded((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
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
      <View style={[styles.interestSearch, { backgroundColor: colors.muted, borderColor: colors.border }]}>
        <Ionicons name="search-outline" size={18} color={colors.mutedForeground} />
        <TextInput value={query} onChangeText={(value) => setQuery(value.toLowerCase())} placeholder="Search topics, teams, leagues…" placeholderTextColor={colors.mutedForeground} style={[styles.interestSearchInput, { color: colors.foreground }]} autoCapitalize="none" autoCorrect={false} />
        {query ? <Pressable onPress={() => setQuery('')} accessibilityRole="button" accessibilityLabel="Clear interest search"><Ionicons name="close-circle" size={17} color={colors.mutedForeground} /></Pressable> : null}
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
      <View style={styles.interestGrid}>
        {INTEREST_ROOTS.map((node) => <InterestNodeRow key={node.id} node={node} depth={0} interests={interests} query={query} expanded={expanded} onToggle={onToggle} onToggleExpanded={toggleExpanded} onToggleNearby={(id) => void handleToggle(id)} colors={colors} />)}
        {INTEREST_ROOTS.every((node) => !interestNodeMatches(node, query)) ? <Text style={[styles.interestNoResults, { color: colors.mutedForeground }]}>No topics match “{query}”.</Text> : null}
      </View>
      <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to For You" style={styles.backButton}>
        <Ionicons name="arrow-back" size={17} color={colors.primary} />
      </Pressable>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  mediaFeedHeader: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 10,
    paddingHorizontal: 14,
    gap: 8,
  },
  mediaFeedHeaderActions: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mediaFeedHeaderGroup: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
  },
  mediaFeedTabs: {
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 20,
    paddingHorizontal: 16,
    paddingVertical: 7,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  mediaFeedTabText: {
    color: 'rgba(255,255,255,0.66)',
    fontSize: 16,
    fontWeight: '600',
    textShadowColor: 'rgba(0,0,0,0.5)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 4,
  },
  mediaFeedTabTextActive: {
    color: '#fff',
    fontWeight: '800',
  },
  floatingUpdatesButton: {
    height: 36,
    borderRadius: 18,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  floatingUpdatesText: {
    color: '#fff',
    fontSize: 12,
    fontWeight: '700',
  },
  floatingUnreadDot: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: '#FF3B30',
  },
  floatingIconButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
  },
  creatorFeedPager: { flex: 1, backgroundColor: '#000' },
  creatorFeedPage: { width: WINDOW_WIDTH, height: WINDOW_HEIGHT, backgroundColor: '#111' },
  creatorFeedBack: { position: 'absolute', left: 12, zIndex: 50, width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.28)' },
  creatorMuteButton: { position: 'absolute', right: 16, width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.3)' },
  creatorFeedShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.16)' },
  creatorHeart: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', zIndex: 20 },
  heartBurstShadow: { textShadowColor: 'rgba(0,0,0,0.22)', textShadowOffset: { width: 0, height: 3 }, textShadowRadius: 8 },
  creatorFeedActions: { position: 'absolute', right: 12, alignItems: 'center', gap: 20 },
  creatorAction: { alignItems: 'center', minWidth: 42 },
  creatorActionCount: { color: '#fff', fontSize: 12, fontWeight: '700', marginTop: 4 },
  creatorFeedCaption: { position: 'absolute', left: 16, right: 82 },
  creatorAuthor: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 8 },
  creatorCaption: { color: '#fff', fontSize: 15, lineHeight: 22 },
  communityCreateButton: { minHeight: 42, borderRadius: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, marginTop: 8 },
  communityCreateButtonText: { color: '#fff', fontSize: 13, fontWeight: '700' },
  socialHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  headerProfileButton: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', marginHorizontal: 1 },
  mapStoryToggle: { minHeight: 44, flexDirection: 'row', alignItems: 'center', gap: 10, alignSelf: 'center', paddingHorizontal: 12 },
  mapStoryIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  mapStoryLabel: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
  mapStorySwitch: { width: 42, height: 24, borderRadius: 12, padding: 3 },
  mapStoryThumb: { width: 18, height: 18, borderRadius: 9 },
  tagPicker: { gap: 8 },
  storyCanvas: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  storyTextLayer: { width: '100%', maxWidth: 360, minHeight: 74, justifyContent: 'center' },
  storyTextInput: { color: '#fff', fontSize: 28, lineHeight: 34, fontWeight: '600', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.34)', textShadowRadius: 10, paddingHorizontal: 10, paddingVertical: 10 },
  storyTextHint: { position: 'absolute', bottom: 22, color: 'rgba(255,255,255,0.72)', fontSize: 12, fontWeight: '600', textAlign: 'center' },
  tagPickerButton: { minHeight: 40, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  tagChips: { gap: 7, paddingHorizontal: 4 },
  tagChip: { backgroundColor: 'rgba(255,255,255,0.25)', borderRadius: 16, paddingHorizontal: 10, paddingVertical: 7 },
  tagChipText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  tagResultsBox: { backgroundColor: 'rgba(0,0,0,0.24)', borderRadius: 16, padding: 8, maxHeight: 190 },
  tagSearchInput: { minHeight: 38, borderWidth: 1, borderColor: 'rgba(255,255,255,0.55)', borderRadius: 19, paddingHorizontal: 12, color: '#fff', fontSize: 13, marginBottom: 5 },
  tagSearchHint: { color: 'rgba(255,255,255,0.78)', textAlign: 'center', padding: 10, fontSize: 12 },
  tagResultRow: { flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 6 },
  tagResultName: { color: '#fff', fontSize: 13, fontWeight: '700' },
  tagResultUsername: { color: 'rgba(255,255,255,0.72)', fontSize: 11, marginTop: 1 },
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
  feedSettingsButton: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  socialFeedTabs: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 2 },
  socialFeedTab: { flex: 1, minHeight: 42, alignItems: 'center', justifyContent: 'center', borderBottomWidth: 2, borderBottomColor: 'transparent' },
  socialFeedTabActive: { borderBottomColor: '#FF7A1A' },
  socialFeedTabText: { fontSize: 13, fontWeight: '700' },
  socialStoryCard: { width: 92, height: 142, borderRadius: 18, overflow: 'hidden', padding: 8, justifyContent: 'space-between' },
  socialStoryCardTop: { alignItems: 'flex-start' },
  socialStoryCardBottom: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  socialStoryCardName: { flex: 1, color: '#fff', fontSize: 11, fontWeight: '800', textShadowColor: 'rgba(0,0,0,0.4)', textShadowRadius: 4 },
  interestRailHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4, marginTop: 2 },
  interestRail: { gap: 7, paddingHorizontal: 4, paddingVertical: 8 },
  compactInterestChip: { borderWidth: 1, borderRadius: 16, paddingHorizontal: 11, paddingVertical: 7 },
  interestChipText: { fontSize: 11, fontWeight: '700' },
  interestEditText: { fontSize: 11, fontWeight: '800' },
  suggestedPeopleRail: { marginTop: 2 },
  suggestedPeopleList: { gap: 7, paddingVertical: 8, paddingHorizontal: 4 },
  suggestedPerson: { minHeight: 42, borderWidth: 1, borderRadius: 21, paddingHorizontal: 8, paddingRight: 12, flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 142 },
  suggestedPersonName: { fontSize: 11, fontWeight: '700', flexShrink: 1 },
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
  postHubChipRow: { flexDirection: 'row', gap: 7, paddingTop: 10 },
  postHubChip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 6 },
  postHubChipText: { fontSize: 11, fontWeight: '700' },
  socialPostMedia: { width: '100%', height: 210, borderRadius: 12, marginTop: 11 },
  socialVideoPreview: { position: 'relative' },
  socialVideoExpand: { position: 'absolute', right: 10, bottom: 10, width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.52)' },
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
  mediaComposerPrompt: { alignItems: 'center', gap: 10 },
  mediaComposerPromptText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  socialAction: { minHeight: 30, flexDirection: 'row', alignItems: 'center', gap: 5 },
  socialPostTime: { fontSize: 10, marginLeft: 'auto' },
  shareMenuSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 28 },
  sharePostPreview: { borderRadius: 15, padding: 13, marginTop: 12, marginBottom: 8 },
  shareOption: { minHeight: 72, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  shareOptionIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  shareOptionTitle: { fontSize: 15, fontWeight: '700' },
  shareOptionHint: { fontSize: 12, lineHeight: 17, marginTop: 2 },
  shareReferenceHint: { borderRadius: 13, padding: 11, marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 9 },
  sheetOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.55)' },
  createActionSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20, paddingBottom: 28 },
  createActionItem: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth },
  createActionIcon: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  feedSettingsOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.12)' },
  feedSettingsMenu: { position: 'absolute', right: 12, width: 268, borderWidth: 1, borderRadius: 18, padding: 12, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 14, shadowOffset: { width: 0, height: 7 }, elevation: 8 },
  feedSettingsEyebrow: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, paddingHorizontal: 4, paddingBottom: 5 },
  feedSettingsItem: { minHeight: 58, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(128,128,128,0.18)' },
  feedSettingsTitle: { fontSize: 13, fontWeight: '700' },
  feedSettingsHint: { fontSize: 10, marginTop: 2 },
  socialVideoViewer: { flex: 1, backgroundColor: '#000', justifyContent: 'space-between' },
  socialVideoViewerHeader: { minHeight: 58, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12 },
  socialVideoClose: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,0.12)' },
  socialVideoViewerTitle: { color: '#fff', fontSize: 15, fontWeight: '700', maxWidth: WINDOW_WIDTH - 130, textAlign: 'center' },
  socialVideoViewerStage: { flex: 1, justifyContent: 'center' },
  socialVideoViewerMedia: { width: WINDOW_WIDTH, height: WINDOW_HEIGHT * 0.76 },
  socialVideoViewerHint: { fontSize: 11, textAlign: 'center' },
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
  messagesInboxOverlay: { flex: 1 },
  messagesInboxSheet: { flex: 1, paddingHorizontal: 16 },
  noteEditorSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20 },
  noteEditorInput: { minHeight: 128, borderWidth: 1, borderRadius: 16, paddingHorizontal: 15, paddingVertical: 13, fontSize: 17, textAlignVertical: 'top', marginTop: 12 },
  noteEditorFooter: { marginTop: 10 },
  noteEditorHint: { fontSize: 12, lineHeight: 17 },
  noteEditorError: { fontSize: 12, marginTop: 6 },
  noteEditorActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 },
  noteDeleteButton: { fontSize: 15, fontWeight: '700', paddingVertical: 11, paddingHorizontal: 5 },
  noteSaveButton: { minHeight: 44, borderRadius: 22, minWidth: 126, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  noteSaveButtonText: { color: '#fff', fontSize: 14, fontWeight: '700' },
  messagesInboxHeader: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  messagesInboxUsername: { fontSize: 21, fontWeight: '800', letterSpacing: -0.5 },
  messagesInboxHeaderActions: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  messagesSearch: { minHeight: 45, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, marginTop: 4 },
  messagesSearchInput: { flex: 1, fontSize: 16, paddingVertical: 9 },
  ownNoteCard: { minHeight: 82, borderWidth: StyleSheet.hairlineWidth, borderRadius: 22, marginTop: 18, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  ownNoteCopy: { flex: 1 },
  ownNoteTitle: { fontSize: 15, fontWeight: '700' },
  ownNoteText: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  ownNoteAction: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  friendNotes: { paddingTop: 18 },
  friendNotesLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1, marginBottom: 9 },
  notesRail: { gap: 9, paddingBottom: 16 },
  friendNoteCard: { width: 188, minHeight: 66, borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 10 },
  noteName: { fontSize: 12, fontWeight: '700' },
  friendNoteText: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  messagesTabs: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(128,128,128,0.28)' },
  messagesTab: { minHeight: 48, minWidth: 92, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  messagesTabText: { fontSize: 16, fontWeight: '700' },
  messagesTabBadge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  messagesTabBadgeText: { color: '#fff', fontSize: 11, fontWeight: '700' },
  messagesEmpty: { alignItems: 'center', paddingTop: 60, gap: 8 },
  messagesEmptyTitle: { fontSize: 17, fontWeight: '700' },
  messagesEmptyText: { fontSize: 13 },
  messageContactRow: { minHeight: 76, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  messageContactName: { fontSize: 15, fontWeight: '700' },
  messageContactPreview: { fontSize: 13, marginTop: 4 },
  messageUnreadDot: { width: 9, height: 9, borderRadius: 5, marginRight: 4 },
  newMessageEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  newMessageTitle: { fontSize: 21, fontWeight: '800', letterSpacing: -0.4, marginTop: 1 },
  newMessageError: { fontSize: 13, textAlign: 'center', paddingVertical: 10 },
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
  inlineFeedback: { position: 'absolute', left: 18, right: 18, bottom: Platform.OS === 'web' ? 46 : 26, minHeight: 42, borderRadius: 12, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  inlineFeedbackText: { fontSize: 13, fontWeight: '600', textAlign: 'center' },
  connectionOverlay: { ...StyleSheet.absoluteFillObject, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.58)', zIndex: 10 },
  connectionSheet: { minHeight: WINDOW_HEIGHT * 0.54, maxHeight: WINDOW_HEIGHT * 0.76, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20 },
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
  interestContent: { paddingHorizontal: 16, paddingBottom: 150 },
  interestHeading: { flexDirection: 'row', alignItems: 'center', paddingVertical: 15 },
  interestTitle: { fontSize: 23, fontWeight: '600' },
  interestSubtitle: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  interestSearch: { minHeight: 44, borderWidth: 1, borderRadius: 22, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, marginBottom: 14 },
  interestSearchInput: { flex: 1, fontSize: 15, paddingVertical: 8 },
  interestGrid: { gap: 8 },
  interestChip: { borderWidth: 1, borderRadius: 11, minHeight: 62, paddingHorizontal: 14, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
  interestChildChip: { borderWidth: 1, borderRadius: 11, minHeight: 54, marginLeft: 14, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 8 },
  interestNodeGroup: { gap: 6 },
  interestNodeChildGroup: { gap: 6 },
  interestNodeMain: { flex: 1, minHeight: 52, flexDirection: 'row', alignItems: 'center', gap: 10 },
  interestExpandButton: { width: 38, minHeight: 52, alignItems: 'center', justifyContent: 'center' },
  interestChildren: { gap: 6 },
  check: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  interestLabel: { fontSize: 14, fontWeight: '600' },
  interestDescription: { fontSize: 11, marginTop: 3 },
  interestSelectedCount: { fontSize: 10, fontWeight: '600', marginTop: 3 },
  interestNoResults: { textAlign: 'center', paddingVertical: 28, fontSize: 13 },
  languageSection: { borderWidth: 1, borderRadius: 16, padding: 15, marginBottom: 14 },
  languageSectionTitle: { fontSize: 15, fontWeight: '700' },
  languageSectionHint: { fontSize: 12, lineHeight: 17, marginTop: 3, marginBottom: 10 },
  languageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  languageChip: { borderWidth: 1, borderRadius: 12, minWidth: '30%', flexGrow: 1, paddingHorizontal: 12, paddingVertical: 11 },
  languageChipText: { fontSize: 13, fontWeight: '700' },
  languageChipSubtext: { fontSize: 10, marginTop: 2 },
  interestPrompt: { borderWidth: 1, borderRadius: 14, padding: 12, marginTop: 2 },
  interestPromptTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  interestPromptTitle: { fontSize: 14, fontWeight: '800' },
  interestPromptText: { fontSize: 12, lineHeight: 16, marginTop: 4 },
  interestPromptActions: { flexDirection: 'row', gap: 8, marginTop: 10 },
  interestPromptButton: { flex: 1, minHeight: 38, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
  interestPromptButtonText: { fontSize: 12, fontWeight: '700' },
  headerLeftActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  communityFeedContent: { paddingHorizontal: 16, paddingTop: 10, paddingBottom: 150 },
  communityIntro: { paddingBottom: 12 },
  communityTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  communityCloseButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  communityIntroTitle: { fontSize: 17, fontWeight: '600' },
  communityIntroText: { fontSize: 13, lineHeight: 18, marginTop: 3 },
  communityFilters: { gap: 8, paddingTop: 12, paddingBottom: 4 },
  communityFilter: { minHeight: 36, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  communityFilterHint: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingHorizontal: 11, paddingVertical: 9, borderRadius: 10, marginTop: 9 },
  communityFilterHintText: { flex: 1, fontSize: 12, lineHeight: 16 },
  communityState: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 54, gap: 8 },
  communityStateTitle: { fontSize: 17, fontWeight: '700', textAlign: 'center' },
  communityStateText: { fontSize: 13, lineHeight: 18, textAlign: 'center' },
  communityRetry: { fontSize: 14, fontWeight: '700', marginTop: 4 },
  hubDiscoveryContent: { paddingHorizontal: 14, paddingBottom: 120 },
  hubSearchBox: { minHeight: 44, borderRadius: 22, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  hubSearchInput: { flex: 1, fontSize: 15, paddingVertical: 9 },
  hubSection: { marginTop: 16, gap: 8 },
  hubRow: { borderWidth: 1, borderRadius: 14, minHeight: 56, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8 },
  hubRowTitle: { fontSize: 14, fontWeight: '700' },
  hubRowMeta: { fontSize: 11, marginTop: 3 },
  hubCategoryWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  hubCategoryChip: { borderWidth: 1, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 7 },
  hubCategoryChipText: { fontSize: 12, fontWeight: '600' },
  hubChildChip: { borderWidth: 1, borderRadius: 15, paddingHorizontal: 11, paddingVertical: 8 },
  commentSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 20 },
  composeInput: { minHeight: 46, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, marginTop: 10 },
  profileContentTab: { width: '100%', minHeight: 42, borderBottomWidth: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginBottom: 12 },
  profileContentTabText: { fontSize: 14, fontWeight: '700' },
  pipelineCard: { borderWidth: 1, borderRadius: 11, padding: 14, marginTop: 12 },
  pipelineTitle: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  pipelineRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  pipelineNumber: { width: 23, height: 23, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  pipelineStep: { fontSize: 12, flex: 1 },
  pipelineStatus: { fontSize: 10, fontWeight: '600' },
  pipelineFootnote: { fontSize: 11, lineHeight: 16, marginTop: 8 },
  backButton: { width: 44, height: 44, marginTop: 16, alignItems: 'center', justifyContent: 'center' },
});
