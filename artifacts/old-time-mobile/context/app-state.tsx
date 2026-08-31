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
  audience?: 'everyone' | 'close_friends';
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
};

export type CallRecord = {
  id: string;
  name: string;
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
  avatarUri?: string;
};

export type AppSettings = {
  darkMode: boolean;
  accent: string;
  notifications: boolean;
  sounds: boolean;
  previews: boolean;
  lastSeen: boolean;
  readReceipts: boolean;
  autoDownload: boolean;
  wifiOnly: boolean;
  enterToSend: boolean;
  autoplay: boolean;
  language: string;
  lowPower: boolean;
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
  addStatus: (caption: string, color: string, type?: 'text' | 'photo' | 'video', uri?: string, audience?: 'everyone' | 'close_friends') => void;
  markStatusViewed: (id: string, viewer?: string) => void;
  addPost: (caption: string, tag: string, color: string) => void;
  togglePostLike: (id: string) => void;
  togglePostSaved: (id: string) => void;
  addPostComment: (id: string, comment: string) => void;
  recordPostInteraction: (id: string, kind: InteractionKind) => void;
  toggleInterest: (interest: string) => void;
  toggleFollow: (handle: string) => void;
  hidePost: (id: string) => void;
  addCall: (record: Omit<CallRecord, 'id' | 'createdAt'>) => void;
  addSavedMessage: (value: string) => void;
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
  accent: '#63BFFB',
  notifications: true,
  sounds: true,
  previews: true,
  lastSeen: true,
  readReceipts: true,
  autoDownload: true,
  wifiOnly: false,
  enterToSend: true,
  autoplay: true,
  language: 'English',
  lowPower: false,
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
    AsyncStorage.getItem(STORAGE_KEY).then((raw) => {
      if (raw) {
        try {
          const state = JSON.parse(raw);
          setSessionState(state.session?.authToken ? state.session : null);
          setStatuses(state.statuses ?? initialStatuses);
          setPosts(state.posts ?? initialPosts);
          setCalls(state.calls ?? []);
          setSavedMessages(state.savedMessages ?? []);
          setProfile({ ...defaultProfile, ...(state.profile ?? {}) });
          setSettings({ ...defaultSettings, ...(state.settings ?? {}) });
          setInterests((state.interests ?? defaultInterests).filter((interest: string) => interest !== 'haiti'));
          setInterestWeights(state.interestWeights ?? {});
          setFollowedCreators(state.followedCreators ?? defaultFollowedCreators);
          setHiddenPostIds(state.hiddenPostIds ?? []);
        } catch {
          // A corrupted local cache should not block app launch.
        }
      }
      setHydrated(true);
    });
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
    setSession: (user) => setSessionState(user),
    addStatus: (caption, color, type = 'text', uri, audience = 'everyone') => setStatuses((items) => [{ id: `${Date.now()}`, author: 'You', caption, color, type, uri, audience, viewers: [], viewed: false, createdAt: Date.now() }, ...items]),
    markStatusViewed: (id, viewer) => setStatuses((items) => items.map((item) => {
      if (item.id !== id) return item;
      const updatedViewers = viewer && item.viewers && !item.viewers.includes(viewer) ? [...item.viewers, viewer] : item.viewers;
      return { ...item, viewed: true, viewers: updatedViewers };
    })),
    addPost: (caption, tag, color) => setPosts((items) => [{ id: `${Date.now()}`, author: profile.name || 'You', handle: profile.username || 'oldtimeuser', caption, tag, color, likes: 0, liked: false, saved: false, comments: [], createdAt: Date.now() }, ...items]),
    togglePostLike: (id) => setPosts((items) => items.map((post) => post.id === id ? { ...post, liked: !post.liked, likes: Math.max(0, post.likes + (post.liked ? -1 : 1)) } : post)),
    togglePostSaved: (id) => setPosts((items) => items.map((post) => post.id === id ? { ...post, saved: !post.saved } : post)),
    addPostComment: (id, comment) => setPosts((items) => items.map((post) => post.id === id ? { ...post, comments: [...post.comments, comment] } : post)),
    recordPostInteraction: (id, kind) => {
      const post = posts.find((item) => item.id === id);
      if (!post) return;
      const multiplier = kind === 'hide' ? -2 : kind === 'open' ? 1 : 3;
      setInterestWeights((current) => ({ ...current, [post.tag]: (current[post.tag] ?? 0) + multiplier }));
    },
    toggleInterest: (interest) => setInterests((current) => current.includes(interest) ? current.filter((item) => item !== interest) : [...current, interest]),
    toggleFollow: (handle) => setFollowedCreators((current) => current.includes(handle) ? current.filter((item) => item !== handle) : [...current, handle]),
    hidePost: (id) => setHiddenPostIds((current) => current.includes(id) ? current : [...current, id]),
    addCall: (record) => setCalls((items) => [{ ...record, id: `${Date.now()}`, createdAt: Date.now() }, ...items]),
    addSavedMessage: (value) => setSavedMessages((items) => [value, ...items]),
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