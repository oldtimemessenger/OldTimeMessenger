import AsyncStorage from '@react-native-async-storage/async-storage';
import { setUnauthorizedHandler, type AuthenticatedUser } from '@workspace/api-client-react';
import React, { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { InteractionKind } from '@/lib/for-you';

export type StatusItem = {
  id: string;
  author: string;
  caption: string;
  color: string;
  viewed: boolean;
  createdAt: number;
  type?: 'text' | 'photo' | 'video';
  uri?: string;
  viewers?: string[];
  audience?: 'public' | 'friends' | 'followers' | 'close_friends' | 'private';
};

export type UpdatePost = {
  id: string;
  author: string;
  handle: string;
  caption: string;
  tag: string;
  color: string;
  likes: number;
  liked: boolean;
  saved: boolean;
  comments: string[];
  createdAt: number;
  audience?: 'public' | 'friends' | 'followers' | 'close_friends' | 'private';
};

export type CallRecord = {
  id: string;
  name: string;
  phone?: string;
  type: 'voice' | 'video';
  direction: 'incoming' | 'outgoing' | 'missed';
  createdAt: number;
  duration?: string;
};

export type Profile = {
  name: string;
  username: string;
  bio: string;
  phone: string;
  birthday?: string | null;
  avatarUri?: string;
};

export type AppSettings = {
  darkMode: boolean;
  accent: string;
  notifications: boolean;
  sounds: boolean;
  previews: boolean;
  lastSeen: boolean;
  contactPermission: 'everyone' | 'followers' | 'nobody';
  readReceipts: boolean;
  autoDownload: boolean;
  wifiOnly: boolean;
  enterToSend: boolean;
  autoplay: boolean;
  language: string;
  feedLanguages: string[];
  lowPower: boolean;
  statusAudience: 'public' | 'friends' | 'followers' | 'close_friends' | 'private';
  locationAudience: 'public' | 'friends' | 'followers' | 'private';
  excludedPeople: Array<{ id: number; name: string }>;
};

type AppState = {
  hydrated: boolean;
  session: AuthenticatedUser | null;
  statuses: StatusItem[];
  posts: UpdatePost[];
  calls: CallRecord[];
  savedMessages: string[];
  profile: Profile;
  settings: AppSettings;
  interests: string[];
  interestWeights: Record<string, number>;
  followedCreators: string[];
  hiddenPostIds: string[];
  setSession: (user: AuthenticatedUser | null) => void;
  addStatus: (caption: string, color: string, type?: 'text' | 'photo' | 'video', uri?: string, audience?: StatusItem['audience']) => void;
  markStatusViewed: (id: string, viewer?: string) => void;
  addPost: (caption: string, tag: string, color: string, audience?: UpdatePost['audience']) => void;
  togglePostLike: (id: string) => void;
  togglePostSaved: (id: string) => void;
  addPostComment: (id: string, comment: string) => void;
  recordPostInteraction: (id: string, kind: InteractionKind) => void;
  recordInterestFeedback: (topic: string, interested: boolean) => void;
  toggleInterest: (interest: string) => void;
  toggleFollow: (handle: string) => void;
  hidePost: (id: string) => void;
  addCall: (record: Omit<CallRecord, 'id' | 'createdAt'>) => void;
  addSavedMessage: (value: string) => void;
  removeSavedMessage: (value: string) => void;
  updateProfile: (profile: Partial<Profile>) => void;
  updateSettings: (settings: Partial<AppSettings>) => void;
  resetLocalData: () => void;
};

const STORAGE_KEY = 'old-time-mobile-state';
const palette = ['#F0537A', '#4C63F5', '#34C77E', '#E8963C', '#8B5CF6', '#26A69A'];

const initialStatuses: StatusItem[] = [];
const initialPosts: UpdatePost[] = [];

const defaultSettings: AppSettings = {
  darkMode: false,
  accent: '#243C82',
  notifications: false,
  sounds: true,
  previews: true,
  lastSeen: true,
  contactPermission: 'everyone',
  readReceipts: true,
  autoDownload: true,
  wifiOnly: false,
  enterToSend: true,
  autoplay: true,
  language: 'English',
  feedLanguages: ['English'],
  lowPower: false,
  statusAudience: 'friends',
  locationAudience: 'friends',
  excludedPeople: [],
};

const defaultProfile: Profile = { name: 'Old Time User', username: '', bio: 'Keeping in touch, one message at a time.', phone: '' };
const defaultInterests: string[] = [];
const defaultFollowedCreators: string[] = [];

const AppContext = createContext<AppState | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [session, setSessionState] = useState<AuthenticatedUser | null>(null);
  const [statuses, setStatuses] = useState<StatusItem[]>(initialStatuses);
  const [posts, setPosts] = useState<UpdatePost[]>(initialPosts);
  const [calls, setCalls] = useState<CallRecord[]>([]);
  const [savedMessages, setSavedMessages] = useState<string[]>([]);
  const [profile, setProfile] = useState<Profile>(defaultProfile);
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [interests, setInterests] = useState<string[]>(defaultInterests);
  const [interestWeights, setInterestWeights] = useState<Record<string, number>>({});
  const [followedCreators, setFollowedCreators] = useState<string[]>(defaultFollowedCreators);
  const [hiddenPostIds, setHiddenPostIds] = useState<string[]>([]);

  useEffect(() => {
    let active = true;
    async function hydrate() {
      try {
        // A stalled or rejected native storage read must never hold the
        // router on its loading screen indefinitely.
        const raw = await Promise.race([
          AsyncStorage.getItem(STORAGE_KEY),
          new Promise<null>((resolve) => setTimeout(() => resolve(null), 4000)),
        ]);
        if (!active || !raw) return;
        try {
          const state = JSON.parse(raw);
          setSessionState(state.session?.authToken ? state.session : null);
          setStatuses(state.statuses ?? initialStatuses);
          setPosts(state.posts ?? initialPosts);
          setCalls(state.calls ?? []);
          setSavedMessages(state.savedMessages ?? []);
          setProfile({ ...defaultProfile, ...(state.profile ?? {}) });
          const savedSettings = { ...defaultSettings, ...(state.settings ?? {}) };
          if (savedSettings.accent === '#2F63D0' || savedSettings.accent === '#123B73') savedSettings.accent = defaultSettings.accent;
          setSettings(savedSettings);
          setInterests((state.interests ?? defaultInterests).filter((interest: string) => interest !== 'haiti'));
          setInterestWeights(state.interestWeights ?? {});
          setFollowedCreators(state.followedCreators ?? defaultFollowedCreators);
          setHiddenPostIds(state.hiddenPostIds ?? []);
        } catch {
          // A corrupted local cache should not block app launch.
        }
      } catch {
        // Native storage can reject during a cold start; use clean defaults.
      } finally {
        if (active) setHydrated(true);
      }
    }
    void hydrate();
    return () => { active = false; };
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setSessionState(null);
      return AsyncStorage.removeItem(STORAGE_KEY);
    });
    return () => setUnauthorizedHandler(null);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    void AsyncStorage.setItem(STORAGE_KEY, JSON.stringify({ session, statuses, posts, calls, savedMessages, profile, settings, interests, interestWeights, followedCreators, hiddenPostIds }));
  }, [hydrated, session, statuses, posts, calls, savedMessages, profile, settings, interests, interestWeights, followedCreators, hiddenPostIds]);

  const value = useMemo<AppState>(() => ({
    hydrated,
    session,
    statuses,
    posts,
    calls,
    savedMessages,
    profile,
    settings,
    interests,
    interestWeights,
    followedCreators,
    hiddenPostIds,
    setSession: (user) => {
      setSessionState(user);
      if (user) {
        setProfile((current) => ({
          ...current,
          name: user.name,
          username: user.username,
          bio: user.bio,
          phone: user.phone,
          birthday: user.birthday,
        }));
        setSettings((current) => ({
          ...current,
          lastSeen: user.lastSeenVisible,
          contactPermission: user.contactPermission,
        }));
      }
    },
    addStatus: (caption, color, type = 'text', uri, audience = 'friends') => setStatuses((items) => [{ id: `${Date.now()}`, author: 'You', caption, color, type, uri, audience, viewers: [], viewed: false, createdAt: Date.now() }, ...items]),
    markStatusViewed: (id, viewer) => setStatuses((items) => items.map((item) => {
      if (item.id !== id) return item;
      const updatedViewers = viewer && item.viewers && !item.viewers.includes(viewer) ? [...item.viewers, viewer] : item.viewers;
      return { ...item, viewed: true, viewers: updatedViewers };
    })),
    addPost: (caption, tag, color, audience = 'friends') => setPosts((items) => [{ id: `${Date.now()}`, author: profile.name || 'You', handle: profile.username || 'oldtimeuser', caption, tag, color, likes: 0, liked: false, saved: false, comments: [], createdAt: Date.now(), audience }, ...items]),
    togglePostLike: (id) => setPosts((items) => items.map((post) => post.id === id ? { ...post, liked: !post.liked, likes: Math.max(0, post.likes + (post.liked ? -1 : 1)) } : post)),
    togglePostSaved: (id) => setPosts((items) => items.map((post) => post.id === id ? { ...post, saved: !post.saved } : post)),
    addPostComment: (id, comment) => setPosts((items) => items.map((post) => post.id === id ? { ...post, comments: [...post.comments, comment] } : post)),
    recordPostInteraction: (id, kind) => {
      const post = posts.find((item) => item.id === id);
      if (!post) return;
      const multiplier = kind === 'hide' ? -2 : kind === 'open' ? 1 : 3;
      setInterestWeights((current) => ({ ...current, [post.tag]: (current[post.tag] ?? 0) + multiplier }));
    },
    recordInterestFeedback: (topic, interested) => setInterestWeights((current) => ({ ...current, [topic]: (current[topic] ?? 0) + (interested ? 8 : -8) })),
    toggleInterest: (interest) => setInterests((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest]),
    toggleFollow: (handle) => setFollowedCreators((current) => current.includes(handle) ? current.filter((item) => item !== handle) : [...current, handle]),
    hidePost: (id) => setHiddenPostIds((current) => current.includes(id) ? current : [...current, id]),
    addCall: (record) => setCalls((items) => [{ ...record, id: `${Date.now()}`, createdAt: Date.now() }, ...items]),
     addSavedMessage: (value) => setSavedMessages((items) => [value, ...items]),
     removeSavedMessage: (value) => setSavedMessages((items) => items.filter((item) => item !== value)),
    updateProfile: (next) => setProfile((current) => ({ ...current, ...next })),
    updateSettings: (next) => setSettings((current) => ({ ...current, ...next })),
    resetLocalData: () => {
      setStatuses(initialStatuses);
      setPosts(initialPosts);
      setCalls([]);
      setSavedMessages([]);
      setProfile(defaultProfile);
      setSettings(defaultSettings);
      setInterests(defaultInterests);
      setInterestWeights({});
      setFollowedCreators(defaultFollowedCreators);
      setHiddenPostIds([]);
    },
  }), [hydrated, session, statuses, posts, calls, savedMessages, profile, settings, interests, interestWeights, followedCreators, hiddenPostIds]);

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}