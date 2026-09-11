import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, ImageSourcePropType } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import {
  createChat as apiCreateChat,
  createComment as apiCreateComment,
  createMessage as apiCreateMessage,
  createPost as apiCreatePost,
  createReport as apiCreateReport,
  getNotifications as apiGetNotifications,
  getBootstrap,
  markNotificationsRead as apiMarkNotificationsRead,
  searchUsers as apiSearchUsers,
  toggleFollow as apiToggleFollow,
  togglePostLike as apiTogglePostLike,
} from '@/lib/api-client-react';
import { updateUserProfile as apiUpdateUserProfile } from '@workspace/api-client-react';
import { cleanupMediaUpload, createStory as apiCreateStory, resolveRemoteMediaUrl, updateProfileAvatar as apiUpdateProfileAvatar, uploadMedia } from '@/lib/api';

export type MediaType = 'image' | 'video' | 'quote';

export type User = {
  id: string;
  name: string;
  handle: string;
  bio: string;
  verificationBadge: boolean;
  accent: string;
  avatar?: ImageSourcePropType;
  followers: number;
  following: number;
  isFollowing: boolean;
};

export type Comment = {
  id: string;
  author: string;
  handle: string;
  text: string;
  createdAt: string;
};

export type Post = {
  id: string;
  authorId: string;
  author: string;
  handle: string;
  avatar?: ImageSourcePropType;
  imageUri: ImageSourcePropType | string;
  mediaType: MediaType;
  caption: string;
  location: string;
  likes: number;
  comments: Comment[];
  likedByMe: boolean;
  createdAt: string;
};

export type Message = {
  id: string;
  fromMe: boolean;
  text: string;
  createdAt: string;
};

export type Chat = {
  id: string;
  userId: string;
  name: string;
  handle: string;
  avatar?: ImageSourcePropType;
  preview: string;
  unread: number;
  messages: Message[];
};

export type Notification = {
  id: string;
  type: string;
  message: string;
  read: boolean;
  postId: string | null;
  createdAt: string;
  actor: User | null;
};

type Store = {
  currentUserId: string;
  profile: User | null;
  users: User[];
  posts: Post[];
  chats: Chat[];
  notifications: Notification[];
};

type Bootstrap = Awaited<ReturnType<typeof getBootstrap>>;

const STORAGE_KEY = 'old-time-store-v3';
const makeId = () => Date.now().toString() + Math.random().toString(36).slice(2, 8);

const initialStore: Store = { currentUserId: '', profile: null, users: [], posts: [], chats: [], notifications: [] };

function remoteUser(user: Bootstrap['profile'] | Bootstrap['users'][number]): User {
  const serverUser = user as typeof user & { verificationBadge?: unknown };
  return {
    id: user.id,
    name: user.displayName,
    handle: user.handle,
    bio: user.bio,
    verificationBadge: serverUser.verificationBadge === true,
    accent: user.accent,
    avatar: user.avatarUrl ? { uri: user.avatarUrl } : undefined,
    followers: user.followersCount,
    following: user.followingCount,
    isFollowing: user.isFollowing,
  };
}

function remotePost(post: Bootstrap['posts'][number], avatarById: Map<string, ImageSourcePropType>): Post {
  return {
    id: post.id,
    authorId: post.author.id,
    author: post.author.displayName,
    handle: post.author.handle,
    avatar: post.author.avatarUrl ? { uri: post.author.avatarUrl } : avatarById.get(post.author.id),
    imageUri: post.mediaType === 'quote' ? '' : resolveRemoteMediaUrl(post.mediaUrl),
    mediaType: post.mediaType,
    caption: post.caption,
    location: post.location,
    likes: post.likesCount,
    comments: post.comments.map((comment) => ({
      id: comment.id,
      author: comment.author.displayName,
      handle: comment.author.handle,
      text: comment.body,
      createdAt: new Date(comment.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    })),
    likedByMe: post.likedByMe,
    createdAt: new Date(post.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
  };
}

function remoteChat(chat: Bootstrap['chats'][number], currentUserId: string): Chat {
  const avatar = chat.user.avatarUrl ? { uri: chat.user.avatarUrl } : undefined;
  return {
    id: chat.id,
    userId: chat.user.id,
    name: chat.user.displayName,
    handle: chat.user.handle,
    avatar,
    preview: chat.messages.at(-1)?.body ?? 'Start a conversation',
    unread: chat.unread,
    messages: chat.messages.map((message) => ({
      id: message.id,
      fromMe: message.senderId === currentUserId,
      text: message.body,
      createdAt: new Date(message.createdAt).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }),
    })),
  };
}

function remoteNotification(notification: Awaited<ReturnType<typeof apiGetNotifications>>[number], currentUserId: string): Notification {
  return {
    id: notification.id,
    type: notification.type,
    message: notification.message,
    read: notification.read,
    postId: notification.postId,
    createdAt: new Date(notification.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' }),
    actor: notification.actor ? remoteUser(notification.actor) : null,
  };
}

function storeFromBootstrap(data: Bootstrap): Store {
  const avatarById = new Map(data.users.flatMap((user) => user.avatarUrl ? [[user.id, { uri: user.avatarUrl } as ImageSourcePropType] as const] : []));
  return {
    currentUserId: data.profile.id,
    profile: remoteUser(data.profile),
    users: data.users.map((user) => remoteUser(user)),
    posts: data.posts.map((post) => remotePost(post, avatarById)),
    chats: data.chats.map((chat) => remoteChat(chat, data.profile.id)),
    notifications: [],
  };
}

type OldTimeContextValue = Store & {
  hydrated: boolean;
  syncing: boolean;
  syncError: string | null;
  refreshFromServer: () => Promise<void>;
  refreshNotifications: () => Promise<void>;
  markNotificationsRead: () => Promise<void>;
  searchUsers: (query: string) => Promise<User[]>;
  createChat: (userId: string) => Promise<void>;
  reportPost: (postId: string, reason: 'spam' | 'harassment' | 'nudity' | 'violence' | 'copyright' | 'other') => Promise<void>;
  toggleLike: (postId: string) => Promise<void>;
  addComment: (postId: string, text: string) => Promise<void>;
  toggleFollow: (userId: string) => Promise<void>;
  sendMessage: (chatId: string, text: string) => Promise<void>;
  createPost: (input: { imageUri: string; mediaType: MediaType; caption: string; location: string; hubIds?: string[]; name?: string; contentType?: string; size?: number }) => Promise<string | undefined>;
  createStory: (input: { imageUri?: string; mediaType?: Exclude<MediaType, 'quote'>; caption: string; name?: string; contentType?: string; size?: number; width?: number; height?: number; duration?: number }) => Promise<void>;
  updateProfile: (input: { name: string; username: string; bio: string }) => Promise<void>;
  updateProfileAvatar: (input: { uri: string; contentType?: string; size?: number }) => Promise<void>;
};

const OldTimeContext = createContext<OldTimeContextValue | null>(null);

export function OldTimeProvider({ children }: { children: ReactNode }) {
  const { getToken, isSignedIn, userId } = useAuth();
  const queryClient = useQueryClient();
  const [store, setStore] = useState<Store>(initialStore);
  const [hydrated, setHydrated] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const previousUserId = useRef<string | null>(null);
  const activeUserId = useRef<string | null>(userId);
  const activeSignedIn = useRef(isSignedIn);
  const identityGeneration = useRef(0);

  activeUserId.current = userId;
  activeSignedIn.current = isSignedIn;

  useEffect(() => {
    identityGeneration.current += 1;
    const lastUserId = previousUserId.current;
    if (lastUserId !== userId) {
      if (lastUserId) void AsyncStorage.removeItem(`${STORAGE_KEY}:${lastUserId}`);
      queryClient.clear();
    }
    previousUserId.current = userId ?? null;
    setHydrated(false);
    setStore(initialStore);
    setSyncError(null);
    if (!userId) {
      setHydrated(true);
      return;
    }
    let cancelled = false;
    AsyncStorage.getItem(`${STORAGE_KEY}:${userId}`)
      .then((value) => {
        if (value && !cancelled) {
          try {
            const cached = JSON.parse(value) as Store;
            setStore(cached);
          } catch {
            void AsyncStorage.removeItem(`${STORAGE_KEY}:${userId}`);
          }
        }
      })
      .finally(() => {
        if (!cancelled) setHydrated(true);
      });
    return () => {
      cancelled = true;
      identityGeneration.current += 1;
    };
  }, [queryClient, userId]);

  const refreshNotifications = async () => {
    if (!isSignedIn) return;
    try {
      const remoteNotifications = await apiGetNotifications();
      setStore((current) => ({
        ...current,
        notifications: remoteNotifications.map((notification) => remoteNotification(notification, current.currentUserId)),
      }));
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Could not load notifications.');
    }
  };

  const refreshFromServer = async () => {
    if (!isSignedIn) return;
    const requestUserId = userId;
    const requestGeneration = identityGeneration.current;
    if (!requestUserId) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const [bootstrap, remoteNotifications] = await Promise.all([getBootstrap(), apiGetNotifications()]);
      if (
        requestGeneration !== identityGeneration.current ||
        activeUserId.current !== requestUserId ||
        !activeSignedIn.current
      ) {
        return;
      }
      const nextStore = storeFromBootstrap(bootstrap);
      nextStore.notifications = remoteNotifications.map((notification) => remoteNotification(notification, bootstrap.profile.id));
      setStore(nextStore);
    } catch (error) {
      setSyncError(error instanceof Error ? error.message : 'Could not sync your account.');
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    if (hydrated && isSignedIn) void refreshFromServer();
  }, [hydrated, isSignedIn]);

  useEffect(() => {
    if (hydrated && userId) AsyncStorage.setItem(`${STORAGE_KEY}:${userId}`, JSON.stringify(store)).catch(() => undefined);
  }, [hydrated, store, userId]);

  const value = useMemo<OldTimeContextValue>(() => ({
    ...store,
    hydrated,
    syncing,
    syncError,
    refreshFromServer,
    refreshNotifications,
    markNotificationsRead: async () => {
      if (!isSignedIn) return;
      setStore((current) => ({ ...current, notifications: current.notifications.map((notification) => ({ ...notification, read: true })) }));
      try {
        await apiMarkNotificationsRead();
      } catch (error) {
        setSyncError(error instanceof Error ? error.message : 'Could not update notifications.');
        await refreshNotifications();
      }
    },
    searchUsers: async (query) => {
      if (!query.trim()) return [];
      const results = await apiSearchUsers({ q: query.trim() });
      return results.map((user) => remoteUser(user));
    },
    createChat: async (userId) => {
      const chat = await apiCreateChat({ userId });
      setStore((current) => current.chats.some((item) => item.id === chat.id)
        ? current
        : { ...current, chats: [...current.chats, remoteChat(chat, current.currentUserId)] });
    },
    reportPost: async (postId, reason) => {
      try {
        await apiCreateReport({ postId, userId: null, reason });
        Alert.alert('Report sent', 'Thanks for helping keep Old Time welcoming.');
      } catch (error) {
        Alert.alert('Could not send report', error instanceof Error ? error.message : 'Please try again.');
        throw error;
      }
    },
    toggleLike: async (postId) => {
      const previousPost = store.posts.find((post) => post.id === postId);
      if (!previousPost) return;
      setStore((current) => ({
        ...current,
        posts: current.posts.map((post) => post.id === postId ? {
          ...post,
          likedByMe: !post.likedByMe,
          likes: post.likes + (post.likedByMe ? -1 : 1),
        } : post),
      }));
      try {
        await apiTogglePostLike(postId);
      } catch (error) {
        setStore((current) => ({ ...current, posts: current.posts.map((post) => post.id === postId ? previousPost : post) }));
        Alert.alert('Could not update like', error instanceof Error ? error.message : 'Please try again.');
      }
    },
    addComment: async (postId, text) => {
      const profile = store.profile;
      if (!profile || !store.currentUserId || profile.id !== store.currentUserId) {
        const error = new Error('Your profile is unavailable. Please refresh before adding a comment.');
        Alert.alert('Could not add comment', error.message);
        throw error;
      }
      const optimisticId = makeId();
      setStore((current) => ({
        ...current,
        posts: current.posts.map((post) => post.id === postId ? {
          ...post,
          comments: [...post.comments, {
            id: optimisticId,
            author: profile.name,
            handle: profile.handle,
            text,
            createdAt: 'now',
          }],
        } : post),
      }));
      try {
        const comment = await apiCreateComment(postId, { body: text });
        setStore((current) => ({
          ...current,
          posts: current.posts.map((post) => post.id === postId ? {
            ...post,
            comments: post.comments.map((item) => item.id === optimisticId ? {
              id: comment.id,
              author: comment.author.displayName,
              handle: comment.author.handle,
              text: comment.body,
              createdAt: 'now',
            } : item),
          } : post),
        }));
      } catch (error) {
        setStore((current) => ({
          ...current,
          posts: current.posts.map((post) => post.id === postId ? { ...post, comments: post.comments.filter((item) => item.id !== optimisticId) } : post),
        }));
        Alert.alert('Could not add comment', error instanceof Error ? error.message : 'Please try again.');
      }
    },
    toggleFollow: async (userId) => {
      const previousUser = store.users.find((user) => user.id === userId);
      if (!previousUser) return;
      setStore((current) => ({
        ...current,
        users: current.users.map((user) => user.id === userId ? {
          ...user,
          isFollowing: !user.isFollowing,
          followers: user.followers + (user.isFollowing ? -1 : 1),
        } : user),
      }));
      try {
        await apiToggleFollow(userId);
      } catch (error) {
        setStore((current) => ({ ...current, users: current.users.map((user) => user.id === userId ? previousUser : user) }));
        Alert.alert('Could not update follow', error instanceof Error ? error.message : 'Please try again.');
      }
    },
    sendMessage: async (chatId, text) => {
      const previousChat = store.chats.find((chat) => chat.id === chatId);
      if (!previousChat) return;
      setStore((current) => ({
        ...current,
        chats: current.chats.map((chat) => chat.id === chatId ? {
          ...chat,
          preview: text,
          messages: [...chat.messages, { id: makeId(), fromMe: true, text, createdAt: 'now' }],
        } : chat),
      }));
      try {
        await apiCreateMessage(chatId, { body: text });
      } catch (error) {
        setStore((current) => ({ ...current, chats: current.chats.map((chat) => chat.id === chatId ? previousChat : chat) }));
        Alert.alert('Could not send message', error instanceof Error ? error.message : 'Please try again.');
        throw error;
      }
    },
    createPost: async ({ imageUri, mediaType, caption, location, hubIds, name, contentType, size }) => {
      if (!isSignedIn) throw new Error('Sign in required');
      if (mediaType === 'quote') {
        const result = await apiCreatePost({ mediaUrl: '', mediaType, caption, location, hubIds });
        await refreshFromServer();
        return result.id;
      }
      const extension = mediaType === 'video' ? 'mp4' : 'jpg';
      const resolvedContentType = contentType ?? (mediaType === 'video' ? 'video/mp4' : 'image/jpeg');
      const objectPath = await uploadMedia({
        uri: imageUri,
        mediaType,
        name: name ?? `old-time.${extension}`,
        contentType: resolvedContentType,
        size,
        getToken,
      });
      let result;
      try {
        result = await apiCreatePost({ mediaUrl: objectPath, mediaType, caption, location, hubIds });
      } catch (error) {
        await cleanupMediaUpload(objectPath, getToken);
        throw error;
      }
      await refreshFromServer();
      return result.id;
    },
    createStory: async ({ imageUri, mediaType, caption, name, contentType, size, width, height, duration }) => {
      if (!isSignedIn) throw new Error('Sign in required');
      if (mediaType && imageUri) {
        const extension = mediaType === 'video' ? 'mp4' : 'jpg';
        const objectPath = await uploadMedia({
          uri: imageUri,
          mediaType,
          name: name ?? `old-time-story.${extension}`,
          contentType: contentType ?? (mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
          size,
          getToken,
        });
        try {
          await apiCreateStory({
            content: caption,
            visibility: 'friends',
            media: {
              type: mediaType,
              objectPath,
              mimeType: contentType ?? (mediaType === 'video' ? 'video/mp4' : 'image/jpeg'),
              width,
              height,
              duration,
              fit: 'cover',
            },
          }, getToken);
        } catch (error) {
          await cleanupMediaUpload(objectPath, getToken);
          throw error;
        }
        return;
      }
      await apiCreateStory({ content: caption, visibility: 'friends', media: null }, getToken);
    },
    updateProfile: async ({ name, username, bio }) => {
      if (!isSignedIn || !userId) throw new Error('Sign in required');
      const normalizedName = name.trim();
      const normalizedUsername = username.trim().replace(/^@+/, '').toLowerCase();
      const normalizedBio = bio.trim();
      if (!normalizedName) throw new Error('Enter your name.');
      if (!/^[a-z0-9_]{3,24}$/.test(normalizedUsername)) {
        throw new Error('Username must be 3–24 characters using letters, numbers, or underscores.');
      }
      if (normalizedBio.length > 150) throw new Error('Your bio must be 150 characters or fewer.');
      await apiUpdateUserProfile(Number(userId), {
        name: normalizedName,
        username: normalizedUsername,
        bio: normalizedBio,
      });
      await refreshFromServer();
    },
    updateProfileAvatar: async ({ uri, contentType, size }) => {
      if (!isSignedIn || !userId) throw new Error('Sign in required');
      const objectPath = await uploadMedia({
        uri,
        mediaType: 'image',
        name: 'old-time-profile.jpg',
        contentType: contentType ?? 'image/jpeg',
        size,
        getToken,
      });
      try {
        await apiUpdateProfileAvatar({ userId, objectPath, getToken });
      } catch (error) {
        await cleanupMediaUpload(objectPath, getToken);
        throw error;
      }
      await refreshFromServer();
    },
  }), [getToken, hydrated, isSignedIn, refreshFromServer, store, syncing, syncError, userId]);

  return <OldTimeContext.Provider value={value}>{children}</OldTimeContext.Provider>;
}

export function useOldTime() {
  const context = useContext(OldTimeContext);
  if (!context) throw new Error('useOldTime must be used inside OldTimeProvider');
  return context;
}

export function resolveMediaSource(source: ImageSourcePropType | string): ImageSourcePropType {
  return typeof source === 'string' ? { uri: source } : source;
}
