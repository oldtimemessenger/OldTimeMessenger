import { Ionicons } from '@expo/vector-icons';
import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as ImagePicker from 'expo-image-picker';
import * as Location from 'expo-location';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  AppState,
  Dimensions,
  FlatList,
  Keyboard,
  Linking,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import {
  getGetInboxQueryKey,
  getListMessagesQueryKey,
  useGetInbox,
  useListMessages,
  useMarkChatRead,
  useOpenMessage,
  useRequestUploadUrl,
  useSaveMessage,
  type Attachment,
} from '@workspace/api-client-react';
import { Avatar, IconButton, LoadingState } from '@/components/ui';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoSurface } from '@/components/video-surface';
import { apiBaseUrl } from '@/lib/api-base-url';
import { getNotes, updateUserProfile, type Note } from '@/lib/social-api';
import {
  ChatAttachment,
  ChatMessage,
  ChatPresence,
  markVoiceMessagePlayed,
  sendChatMessage,
  setMessageReaction,
  startManagedCall,
  updateChatMessage,
} from '@/lib/chat-api';

type PendingAsset = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  type: Attachment['type'] | 'location';
  width?: number;
  height?: number;
  duration?: number;
  latitude?: number;
  longitude?: number;
  label?: string;
};

type ChatContact = {
  id: number;
  phone?: string;
  name: string;
  username?: string;
  bio?: string;
  online?: boolean;
  lastSeen?: number;
  lastSeenVisible?: boolean;
  chatPresence?: ChatPresence;
};

type LocalMessageState = {
  localId: string;
  clientId: string;
  chatId: number;
  senderId: number;
  content: string;
  attachment: ChatAttachment | null;
  replyToMessageId?: number | null;
  replyPreview?: ChatMessage['replyPreview'];
  timestamp: number;
  status: 'sending' | 'failed';
};

type UiMessage = ChatMessage & {
  localStatus?: 'sending' | 'failed';
  localId?: string;
};

type MessageListItem =
  | { type: 'separator'; id: string; label: string }
  | { type: 'message'; id: string; message: UiMessage; groupedTop: boolean; groupedBottom: boolean };

type RecordingMode = 'idle' | 'recording' | 'locked' | 'paused';
type TypingState = 'idle' | 'typing' | 'recording';

const REACTION_OPTIONS = ['❤️', '😂', '👍', '👎', '😮', '😢', '🙏'] as const;
const PLAYBACK_RATES = [1, 1.5, 2] as const;
const CHAT_STATUS_OPTIONS: Array<{ value: ChatPresence; label: string; color: string; text: string }> = [
  { value: 'available', label: 'Available', color: '#34C77E', text: 'online' },
  { value: 'busy', label: 'Busy', color: '#F59E0B', text: 'busy' },
  { value: 'dnd', label: 'Do not disturb', color: '#EF4444', text: 'Do not disturb' },
];

function storageUrl(objectPath: string) {
  return `${apiBaseUrl()}/api/storage${objectPath}`;
}

function remainingSeconds(expiresAt: number | null, clock: number) {
  if (!expiresAt) return null;
  return Math.max(0, Math.ceil((expiresAt - clock) / 1000));
}

function expiryLabel(seconds: number) {
  return seconds >= 60 ? `${Math.ceil(seconds / 60)}m` : `${seconds}s`;
}

function durationLabel(seconds: number) {
  const safeSeconds = Math.max(0, Math.floor(seconds));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, '0')}`;
}

function dayKey(timestamp: number) {
  return new Date(timestamp).toDateString();
}

function dateSeparatorLabel(timestamp: number) {
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) return 'Today';
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric' });
}

function extractUrls(text: string) {
  return text.match(/https?:\/\/[^\s]+/g) ?? [];
}

function linkPreviewLabel(text: string) {
  const first = extractUrls(text)[0];
  if (!first) return null;
  try {
    return new URL(first).hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}

function presenceLabel(contact?: ChatContact | null, typingState: TypingState = 'idle') {
  if (!contact) return { text: 'offline', color: '#94A3B8' };
  if (typingState === 'typing') return { text: 'typing…', color: '#34C77E' };
  if (typingState === 'recording') return { text: 'recording audio…', color: '#F59E0B' };
  const chatPresence = contact.chatPresence ?? 'available';
  const configured = CHAT_STATUS_OPTIONS.find((item) => item.value === chatPresence) ?? CHAT_STATUS_OPTIONS[0];
  if (contact.online) return { text: configured.text, color: configured.color };
  if (contact.lastSeenVisible === false || !contact.lastSeen) return { text: 'offline', color: '#94A3B8' };
  const lastSeen = new Date(contact.lastSeen);
  const now = new Date();
  if (lastSeen.toDateString() === now.toDateString()) {
    return { text: `last seen today at ${lastSeen.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`, color: '#94A3B8' };
  }
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (lastSeen.toDateString() === yesterday.toDateString()) {
    return { text: `last seen yesterday at ${lastSeen.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}`, color: '#94A3B8' };
  }
  return {
    text: `last seen ${lastSeen.toLocaleDateString([], { month: 'short', day: 'numeric' })}`,
    color: '#94A3B8',
  };
}

function bubbleStatus(message: UiMessage, mine: boolean) {
  if (!mine) return null;
  if (message.localStatus === 'failed') return 'failed';
  if (message.localStatus === 'sending') return 'sending';
  if (message.read || message.openedAt) return 'read';
  if (message.deliveredAt) return 'delivered';
  return 'sent';
}

function buildReplyPreview(message: UiMessage, senderName: string) {
  return {
    id: message.id,
    senderId: message.senderId,
    senderName,
    content: message.deletedForEveryone ? 'This message was deleted.' : message.content,
    attachmentType: message.deletedForEveryone ? 'text' : (message.attachment?.type ?? 'text'),
    deleted: Boolean(message.deletedForEveryone),
  } as const;
}

function mergeMessages(serverMessages: ChatMessage[], pendingMessages: LocalMessageState[]) {
  const serverByClientId = new Set(serverMessages.map((message) => message.clientId).filter(Boolean));
  const pending = pendingMessages
    .filter((message) => !serverByClientId.has(message.clientId))
    .map<UiMessage>((message) => ({
      id: -Number(message.timestamp),
      chatId: message.chatId,
      senderId: message.senderId,
      clientId: message.clientId,
      content: message.content,
      timestamp: message.timestamp,
      read: false,
      attachment: message.attachment,
      replyToMessageId: message.replyToMessageId,
      replyPreview: message.replyPreview,
      expiresAt: null,
      saved: false,
      reactions: [],
      localStatus: message.status,
      localId: message.localId,
    }));
  return [...serverMessages.map((message) => ({ ...message } as UiMessage)), ...pending]
    .sort((left, right) => left.timestamp - right.timestamp);
}

function buildMessageItems(messages: UiMessage[]): MessageListItem[] {
  const items: MessageListItem[] = [];
  for (let index = 0; index < messages.length; index += 1) {
    const message = messages[index];
    const previous = messages[index - 1];
    const next = messages[index + 1];
    if (!previous || dayKey(previous.timestamp) !== dayKey(message.timestamp)) {
      items.push({ type: 'separator', id: `sep-${dayKey(message.timestamp)}`, label: dateSeparatorLabel(message.timestamp) });
    }
    const groupedTop = Boolean(previous && previous.senderId === message.senderId && dayKey(previous.timestamp) === dayKey(message.timestamp) && message.timestamp - previous.timestamp < 5 * 60 * 1000);
    const groupedBottom = Boolean(next && next.senderId === message.senderId && dayKey(next.timestamp) === dayKey(message.timestamp) && next.timestamp - message.timestamp < 5 * 60 * 1000);
    items.push({ type: 'message', id: `${message.clientId ?? message.id}`, message, groupedTop, groupedBottom });
  }
  return items;
}

function renderLinkedText(text: string, color: string, linkColor: string) {
  const regex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(regex);
  return (
    <Text style={{ color, fontSize: 15, lineHeight: 21 }}>
      {parts.map((part, index) => {
        const isLink = /^https?:\/\//.test(part);
        if (!isLink) return <Text key={`${part}-${index}`}>{part}</Text>;
        return (
          <Text key={`${part}-${index}`} style={{ color: linkColor, textDecorationLine: 'underline' }} onPress={() => void Linking.openURL(part).catch(() => undefined)}>
            {part}
          </Text>
        );
      })}
    </Text>
  );
}

function compactWaveform(progress: number, active = false) {
  return Array.from({ length: 18 }, (_, index) => ({
    id: `${index}`,
    active: index / 18 <= progress,
    height: 8 + ((index * 7) % 14),
  })).map((bar) => (
    <View key={bar.id} style={{ width: 3, borderRadius: 3, height: bar.height, backgroundColor: bar.active ? (active ? '#fff' : '#243C82') : 'rgba(148,163,184,0.35)' }} />
  ));
}

export default function ChatDetailScreen() {
  const { id, mediaUri, mediaType } = useLocalSearchParams<{
    id: string;
    mediaUri?: string;
    mediaType?: 'image' | 'video';
  }>();
  const chatId = Number(id);
  const { session, settings } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { width: windowWidth, height: windowHeight } = Dimensions.get('window');
  const listRef = useRef<FlatList<MessageListItem>>(null);
  const inputRef = useRef<TextInput>(null);
  const swipeRefs = useRef<Record<string, Swipeable | null>>({});
  const openingIds = useRef(new Set<number>());
  const notesRequestId = useRef(0);
  const handledCameraUri = useRef<string | null>(null);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const remoteTypingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const uploadInFlight = useRef(false);
  const recordingLocked = useRef(false);
  const recordGestureState = useRef<'idle' | 'cancel' | 'lock'>('idle');
  const recordStartedRef = useRef(false);
  const audioPlayedRef = useRef<number | null>(null);
  const chatSocketRef = useRef<ReturnType<typeof io> | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 120);
  const audioPlayer = useAudioPlayer(null, { updateInterval: 200 });
  const audioStatus = useAudioPlayerStatus(audioPlayer);

  const inboxKey = getGetInboxQueryKey(session?.id ?? 0);
  const messagesKey = getListMessagesQueryKey(chatId, { viewerId: session?.id ?? 0 });
  const inbox = useGetInbox(session?.id ?? 0, { query: { enabled: Boolean(session), queryKey: inboxKey } });
  const messages = useListMessages(
    chatId,
    { viewerId: session?.id ?? 0 },
    { query: { enabled: Boolean(session && chatId), queryKey: messagesKey } },
  );
  const markRead = useMarkChatRead();
  const openMessage = useOpenMessage();
  const saveMessage = useSaveMessage();
  const requestUploadUrl = useRequestUploadUrl();

  const [text, setText] = useState('');
  const [chatNotes, setChatNotes] = useState<Note[]>([]);
  const [chatNotesError, setChatNotesError] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [pendingMessages, setPendingMessages] = useState<LocalMessageState[]>([]);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('idle');
  const [draftAssets, setDraftAssets] = useState<PendingAsset[]>([]);
  const [draftCaption, setDraftCaption] = useState('');
  const [draftIndex, setDraftIndex] = useState(0);
  const [attachmentMenu, setAttachmentMenu] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [actionMessage, setActionMessage] = useState<UiMessage | null>(null);
  const [replyTarget, setReplyTarget] = useState<UiMessage | null>(null);
  const [editingMessage, setEditingMessage] = useState<UiMessage | null>(null);
  const [forwardMessage, setForwardMessage] = useState<UiMessage | null>(null);
  const [forwardTargets, setForwardTargets] = useState<number[]>([]);
  const [typingState, setTypingState] = useState<TypingState>('idle');
  const [activeAudioMessageId, setActiveAudioMessageId] = useState<number | null>(null);
  const [playbackRate, setPlaybackRate] = useState<(typeof PLAYBACK_RATES)[number]>(1);
  const [mediaViewerIndex, setMediaViewerIndex] = useState<number | null>(null);
  const [statusSheetOpen, setStatusSheetOpen] = useState(false);
  const [selfStatus, setSelfStatus] = useState<ChatPresence>('available');

  const contact = useMemo(
    () => inbox.data?.find((item) => item.chat.id === chatId)?.contact as ChatContact | undefined,
    [chatId, inbox.data],
  );
  const serverMessages = useMemo(() => (messages.data as unknown as ChatMessage[] | undefined) ?? [], [messages.data]);
  const visibleMessages = useMemo(
    () => mergeMessages(serverMessages.filter((message) => message.saved || !message.expiresAt || message.expiresAt > clock), pendingMessages),
    [clock, pendingMessages, serverMessages],
  );
  const items = useMemo(() => buildMessageItems(visibleMessages), [visibleMessages]);
  const messageIndexById = useMemo(() => {
    const map = new Map<number, number>();
    items.forEach((item, index) => {
      if (item.type === 'message') map.set(item.message.id, index);
    });
    return map;
  }, [items]);
  const mediaItems = useMemo(
    () => visibleMessages.filter((message) => message.attachment?.type === 'image' || message.attachment?.type === 'video'),
    [visibleMessages],
  );

  const mergeIncomingMessage = useCallback((message: ChatMessage) => {
    queryClient.setQueryData(messagesKey, (current: unknown) => {
      const existing = Array.isArray(current) ? current as ChatMessage[] : [];
      const filtered = existing.filter((item) => item.id !== message.id && item.clientId !== message.clientId);
      return [...filtered, message].sort((left, right) => left.timestamp - right.timestamp);
    });
    queryClient.invalidateQueries({ queryKey: inboxKey }).catch(() => undefined);
    setPendingMessages((current) => current.filter((item) => item.clientId !== message.clientId));
  }, [inboxKey, messagesKey, queryClient]);

  const refreshChat = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: messagesKey }),
      queryClient.invalidateQueries({ queryKey: inboxKey }),
    ]);
  }, [inboxKey, messagesKey, queryClient]);

  const loadChatNotes = useCallback(async () => {
    const requestId = ++notesRequestId.current;
    const authToken = session?.authToken;
    const userId = session?.id;
    const contactId = contact?.id;
    if (!authToken || !userId) return;
    try {
      const { items: loaded } = await getNotes(authToken, 'chat');
      if (requestId !== notesRequestId.current) return;
      setChatNotes(loaded.filter((note) => note.owner.id === userId || note.owner.id === contactId));
      setChatNotesError(null);
    } catch {
      if (requestId !== notesRequestId.current) return;
      setChatNotesError('Notes could not be refreshed.');
    }
  }, [contact?.id, session?.authToken, session?.id]);

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => {
      clearInterval(timer);
      if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
      if (remoteTypingTimer.current) clearTimeout(remoteTypingTimer.current);
    };
  }, []);

  useEffect(() => {
    setSelfStatus(((session as unknown as { chatPresence?: ChatPresence } | null)?.chatPresence) ?? 'available');
  }, [session]);

  useEffect(() => {
    void loadChatNotes();
    return () => {
      notesRequestId.current += 1;
    };
  }, [loadChatNotes]);

  useEffect(() => {
    if (!session || !chatId) return;
    markRead.mutate({ chatId, data: { viewerId: session.id } });
  }, [chatId, markRead, session]);

  useEffect(() => {
    if (!session?.authToken || !chatId) return;
    const socket = io(apiBaseUrl(), { auth: { token: session.authToken }, reconnection: true, transports: ['websocket'] });
    chatSocketRef.current = socket;
    const handleTyping = (payload: { chatId?: number; state?: TypingState; userId?: number }) => {
      if (payload.chatId !== chatId || payload.userId === session.id) return;
      setTypingState(payload.state === 'recording' ? 'recording' : payload.state === 'typing' ? 'typing' : 'idle');
      if (remoteTypingTimer.current) clearTimeout(remoteTypingTimer.current);
      if (payload.state && payload.state !== 'idle') {
        remoteTypingTimer.current = setTimeout(() => setTypingState('idle'), 4000);
      }
    };
    const handleMessage = (payload: ChatMessage & { chatId?: number }) => {
      if (payload.chatId !== chatId) return;
      mergeIncomingMessage(payload);
    };
    const handleMessageHidden = (payload: { chatId?: number; messageId?: number }) => {
      if (payload.chatId === chatId) void refreshChat();
    };
    socket.on('connect', () => socket.emit('join-chat', { chatId }));
    socket.on('new-message', handleMessage);
    socket.on('message-updated', handleMessage);
    socket.on('message-hidden', handleMessageHidden);
    socket.on('message-expired', () => void refreshChat());
    socket.on('inbox-updated', () => void queryClient.invalidateQueries({ queryKey: inboxKey }));
    socket.on('user-typing', handleTyping);
    return () => {
      socket.emit('typing', { chatId, state: 'idle' });
      socket.emit('leave-chat', { chatId });
      socket.off('new-message', handleMessage);
      socket.off('message-updated', handleMessage);
      socket.off('message-hidden', handleMessageHidden);
      socket.off('user-typing', handleTyping);
      chatSocketRef.current = null;
      socket.disconnect();
    };
  }, [chatId, inboxKey, mergeIncomingMessage, queryClient, refreshChat, session?.authToken, session?.id]);

  useEffect(() => {
    if (!session) return;
    for (const message of visibleMessages) {
      if (message.senderId !== session.id && !message.openedAt && message.id > 0 && !openingIds.current.has(message.id)) {
        openingIds.current.add(message.id);
        openMessage.mutate(
          { messageId: message.id, data: { recipientId: session.id } },
          {
            onSuccess: (updated) => {
              mergeIncomingMessage(updated as unknown as ChatMessage);
              openingIds.current.delete(message.id);
            },
            onError: () => openingIds.current.delete(message.id),
          },
        );
      }
    }
  }, [mergeIncomingMessage, openMessage, session, visibleMessages]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'active') {
        audioPlayer.pause();
        if (recordingMode !== 'idle') {
          void finishRecording(true).catch(() => undefined);
        }
      }
    });
    return () => {
      subscription.remove();
      audioPlayer.pause();
    };
  }, [audioPlayer, recordingMode]);

  useEffect(() => {
    if (!mediaUri || handledCameraUri.current === mediaUri) return;
    handledCameraUri.current = mediaUri;
    setDraftCaption('');
    setDraftIndex(0);
    setDraftAssets([{ uri: mediaUri, name: `old-time-${Date.now()}.${mediaType === 'video' ? 'mp4' : 'jpg'}`, mimeType: mediaType === 'video' ? 'video/mp4' : 'image/jpeg', size: 1, type: mediaType === 'video' ? 'video' : 'image' }]);
  }, [mediaType, mediaUri]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [editingMessage, replyTarget]);

  useEffect(() => {
    if (activeAudioMessageId !== null && audioPlayedRef.current !== activeAudioMessageId) {
      const active = visibleMessages.find((message) => message.id === activeAudioMessageId);
      if (active && active.senderId !== session?.id && audioStatus.playing) {
        audioPlayedRef.current = activeAudioMessageId;
        if (session?.authToken && session.id) {
          void markVoiceMessagePlayed(session.authToken, activeAudioMessageId, session.id).then((updated) => {
            if ('id' in updated) mergeIncomingMessage(updated as ChatMessage);
          }).catch(() => undefined);
        }
      }
    }
  }, [activeAudioMessageId, audioStatus.playing, mergeIncomingMessage, session, visibleMessages]);

  useEffect(() => {
    audioPlayedRef.current = null;
  }, [activeAudioMessageId]);

  const emitTypingState = useCallback((state: TypingState) => {
    chatSocketRef.current?.emit('typing', { chatId, state });
  }, [chatId]);

  function scheduleTypingState(nextText: string) {
    setText(nextText);
    if (!session?.authToken) return;
    emitTypingState(nextText.trim() ? 'typing' : 'idle');
    if (typingStopTimer.current) clearTimeout(typingStopTimer.current);
    typingStopTimer.current = setTimeout(() => emitTypingState('idle'), 1800);
  }

  async function queueMessage(input: { content?: string; attachment?: ChatAttachment | null; reply?: UiMessage | null }) {
    if (!session?.authToken || !session.id) return;
    shouldAutoScrollRef.current = true;
    const clientId = `${session.id}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const timestamp = Date.now();
    const optimistic: LocalMessageState = {
      localId: clientId,
      clientId,
      chatId,
      senderId: session.id,
      content: input.content?.trim() ?? '',
      attachment: input.attachment ?? null,
      replyToMessageId: input.reply?.id ?? null,
      replyPreview: input.reply ? buildReplyPreview(input.reply, input.reply.senderId === session.id ? 'You' : (contact?.name ?? 'Contact')) : null,
      timestamp,
      status: 'sending',
    };
    setPendingMessages((current) => [...current, optimistic]);
    try {
      const created = await sendChatMessage(session.authToken, chatId, {
        senderId: session.id,
        clientId,
        content: optimistic.content || undefined,
        attachment: optimistic.attachment ?? undefined,
        replyToMessageId: optimistic.replyToMessageId,
      });
      mergeIncomingMessage(created);
      setReplyTarget(null);
      setEditingMessage(null);
      setDraftCaption('');
      setDraftAssets([]);
      setDraftIndex(0);
      emitTypingState('idle');
    } catch {
      setPendingMessages((current) => current.map((message) => message.clientId === clientId ? { ...message, status: 'failed' } : message));
    }
  }

  function sendText() {
    const content = text.trim();
    if (!content || !session) return;
    if (editingMessage && editingMessage.id > 0) {
      const messageId = editingMessage.id;
      setText('');
      setEditingMessage(null);
      void updateChatMessage(session.authToken!, messageId, { userId: session.id, mode: 'edit', content })
        .then((updated) => {
          if ('id' in updated) mergeIncomingMessage(updated as ChatMessage);
          setReplyTarget(null);
        })
        .catch((error) => {
          setText(content);
          Alert.alert('Message not edited', error instanceof Error ? error.message : 'Please try again.');
        });
      return;
    }
    setText('');
    void queueMessage({ content, reply: replyTarget });
  }

  async function uploadAsset(asset: PendingAsset, caption?: string, reply?: UiMessage | null) {
    if (!session?.authToken || !session.id || uploadInFlight.current) return false;
    uploadInFlight.current = true;
    try {
      if (asset.type === 'location') {
        await queueMessage({
          content: caption?.trim() || asset.label || 'Shared location',
          attachment: {
            type: 'location',
            objectPath: `/objects/location/${session.id}-${Date.now()}`,
            name: asset.name,
            mimeType: 'application/location+json',
            size: 1,
            latitude: asset.latitude ?? 0,
            longitude: asset.longitude ?? 0,
            label: asset.label,
          },
          reply,
        });
        return true;
      }
      setUploadLabel('Preparing attachment…');
      const localFile = new File(asset.uri);
      const size = Math.max(1, asset.size || localFile.size || 1);
      const upload = await requestUploadUrl.mutateAsync({ data: { name: asset.name, size, contentType: asset.mimeType } });
      setUploadLabel('Uploading…');
      const uploadUrl = upload.uploadURL.startsWith('/') ? `${apiBaseUrl()}${upload.uploadURL}` : upload.uploadURL;
      const response = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': asset.mimeType, Authorization: 'Bearer ' + session.authToken }, body: localFile as unknown as BodyInit });
      if (!response.ok) throw new Error(`Upload failed with ${response.status}`);
      await queueMessage({
        content: caption?.trim() || undefined,
        attachment: {
          type: asset.type as ChatAttachment['type'],
          objectPath: upload.objectPath,
          name: asset.name,
          mimeType: asset.mimeType,
          size,
          width: asset.width,
          height: asset.height,
          duration: asset.duration,
          label: asset.label,
        } as ChatAttachment,
        reply,
      });
      return true;
    } catch (error) {
      Alert.alert(asset.type === 'audio' ? 'Voice note failed' : 'Media failed', error instanceof Error ? error.message : 'Please try again.');
      return false;
    } finally {
      uploadInFlight.current = false;
      setUploadLabel(null);
      setAttachmentMenu(false);
    }
  }

  async function sendDraftAssets() {
    const assets = [...draftAssets];
    const reply = replyTarget;
    for (let index = 0; index < assets.length; index += 1) {
      const asset = assets[index];
      const sent = await uploadAsset(asset, index === 0 ? draftCaption : '', reply);
      if (!sent) return;
    }
  }

  async function choosePhotoOrVideo() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.92,
      allowsEditing: false,
      allowsMultipleSelection: true,
      selectionLimit: 6,
    });
    if (result.canceled) return;
    setDraftAssets(result.assets.map((asset) => ({
      uri: asset.uri,
      name: asset.fileName ?? `old-time-${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
      mimeType: asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      size: asset.fileSize ?? 1,
      type: asset.type === 'video' ? 'video' : 'image',
      width: asset.width,
      height: asset.height,
      duration: asset.duration ?? undefined,
    })));
    setDraftCaption('');
    setDraftIndex(0);
  }

  async function chooseFile() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    await uploadAsset({ uri: asset.uri, name: asset.name, mimeType: asset.mimeType ?? 'application/octet-stream', size: asset.size ?? 1, type: 'file' }, draftCaption, replyTarget);
  }

  async function shareLocation() {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Location unavailable', 'Allow location access to share your location in chat.');
      return;
    }
    const position = await Location.getCurrentPositionAsync({});
    const place = await Location.reverseGeocodeAsync(position.coords).catch(() => []);
    const label = place[0]
      ? [place[0].name, place[0].city, place[0].region].filter(Boolean).join(', ')
      : 'Current location';
    setDraftAssets([{ uri: '', name: 'Current location', mimeType: 'application/location+json', size: 1, type: 'location', latitude: position.coords.latitude, longitude: position.coords.longitude, label }]);
    setDraftCaption('');
    setDraftIndex(0);
  }

  async function beginRecording() {
    if (uploadInFlight.current || recordingMode !== 'idle') return;
    const permission = await requestRecordingPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Microphone access needed', permission.canAskAgain ? 'Allow microphone access to record a voice note.' : 'Microphone access is off. Enable it in Settings to record a voice note.');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    recordStartedRef.current = true;
    recordingLocked.current = false;
    recordGestureState.current = 'idle';
    setRecordingMode('recording');
    emitTypingState('recording');
  }

  async function finalizeVoiceMessage(cancelled = false) {
    if (!recordStartedRef.current) return;
    const uri = recorder.uri;
    const duration = Math.max(recorder.currentTime, recorderState.durationMillis / 1000);
    await setAudioModeAsync({ allowsRecording: false });
    if (!cancelled && uri && duration >= 0.2) {
      await uploadAsset({ uri, name: `voice-note-${Date.now()}.m4a`, mimeType: 'audio/mp4', size: new File(uri).size || 1, type: 'audio', duration }, undefined, replyTarget);
    }
    recordStartedRef.current = false;
    recordingLocked.current = false;
    setRecordingMode('idle');
    emitTypingState('idle');
  }

  async function finishRecording(cancelled = false) {
    try {
      if (recordingMode === 'paused') {
        const uri = recorder.uri;
        const duration = Math.max(recorder.currentTime, recorderState.durationMillis / 1000);
        await recorder.stop();
        await setAudioModeAsync({ allowsRecording: false });
        if (!cancelled && uri && duration >= 0.2) {
          await uploadAsset({ uri, name: `voice-note-${Date.now()}.m4a`, mimeType: 'audio/mp4', size: new File(uri).size || 1, type: 'audio', duration }, undefined, replyTarget);
        }
        recordStartedRef.current = false;
        recordingLocked.current = false;
        setRecordingMode('idle');
        emitTypingState('idle');
        return;
      }
      await recorder.stop();
      await finalizeVoiceMessage(cancelled);
    } catch {
      setRecordingMode('idle');
      recordStartedRef.current = false;
      emitTypingState('idle');
      if (!cancelled) Alert.alert('Voice note failed', 'Couldn’t send voice message.');
    }
  }

  async function pauseRecording() {
    try {
      await recorder.pause();
      setRecordingMode('paused');
    } catch {
      Alert.alert('Voice note failed', 'Recording could not be paused.');
    }
  }

  async function resumeRecording() {
    try {
      recorder.record();
      setRecordingMode('locked');
    } catch {
      Alert.alert('Voice note failed', 'Recording could not resume.');
    }
  }

  const recordResponder = useMemo(() => PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onPanResponderGrant: () => { void beginRecording(); },
    onPanResponderMove: (_, gesture) => {
      if (recordingMode === 'idle') return;
      if (gesture.dx < -80) recordGestureState.current = 'cancel';
      else if (gesture.dy < -90) {
        recordGestureState.current = 'lock';
        if (!recordingLocked.current) {
          recordingLocked.current = true;
          setRecordingMode('locked');
        }
      } else recordGestureState.current = 'idle';
    },
    onPanResponderRelease: () => {
      if (recordGestureState.current === 'cancel') void finishRecording(true);
      else if (recordingLocked.current) setRecordingMode('locked');
      else void finishRecording(false);
      recordGestureState.current = 'idle';
    },
    onPanResponderTerminate: () => { void finishRecording(true); },
  }), [recordingMode]);

  function openQuotedMessage(messageId?: number | null) {
    if (!messageId) return;
    const index = messageIndexById.get(messageId);
    if (index === undefined) {
      Alert.alert('Original unavailable', 'That message is no longer available.');
      return;
    }
    listRef.current?.scrollToIndex({ index, animated: true, viewPosition: 0.4 });
  }

  function retryMessage(message: UiMessage) {
    if (!message.localId) return;
    const pending = pendingMessages.find((item) => item.localId === message.localId);
    if (!pending) return;
    setPendingMessages((current) => current.filter((item) => item.localId !== message.localId));
    void queueMessage({
      content: pending.content,
      attachment: pending.attachment,
      reply: pending.replyPreview ? ({ id: pending.replyPreview.id, senderId: pending.replyPreview.senderId, content: pending.replyPreview.content, attachment: null, timestamp: pending.timestamp, read: false, expiresAt: null, saved: false } as UiMessage) : null,
    });
  }

  function save(item: UiMessage) {
    if (!session || item.id <= 0 || saveMessage.isPending) return;
    saveMessage.mutate({ messageId: item.id, data: { recipientId: session.id } }, { onSuccess: (updated) => mergeIncomingMessage(updated as unknown as ChatMessage) });
  }

  async function toggleAudio(message: UiMessage) {
    if (!message.attachment || message.attachment.type !== 'audio' || !session?.authToken) return;
    if (activeAudioMessageId === message.id) {
      if (audioStatus.playing) audioPlayer.pause();
      else audioPlayer.play();
      return;
    }
    audioPlayer.pause();
    audioPlayer.replace({ uri: storageUrl(message.attachment.objectPath), headers: { Authorization: 'Bearer ' + session.authToken } });
    audioPlayer.setPlaybackRate(playbackRate);
    setActiveAudioMessageId(message.id);
    audioPlayer.play();
  }

  async function openLocation(message: UiMessage) {
    if (message.attachment?.type !== 'location') return;
    const { latitude, longitude } = message.attachment;
    const url = Platform.select({
      ios: `https://maps.apple.com/?ll=${latitude},${longitude}`,
      default: `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`,
    }) ?? `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    await Linking.openURL(url).catch(() => Alert.alert('Location unavailable', 'Maps could not be opened.'));
  }

  async function copyText(value: string) {
    await Clipboard.setStringAsync(value);
    setActionMessage(null);
    Alert.alert('Copied');
  }

  async function reactToMessage(message: UiMessage, emoji: string) {
    if (!session?.authToken || !session.id || message.id <= 0) return;
    try {
      const updated = await setMessageReaction(session.authToken, message.id, session.id, emoji);
      mergeIncomingMessage(updated);
      setActionMessage(null);
    } catch (error) {
      Alert.alert('Reaction not saved', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function deleteMessage(message: UiMessage, mode: 'delete_for_me' | 'delete_for_everyone') {
    if (!session?.authToken || !session.id || message.id <= 0) return;
    try {
      const updated = await updateChatMessage(session.authToken, message.id, { userId: session.id, mode });
      if ('id' in updated) mergeIncomingMessage(updated as ChatMessage);
      else await refreshChat();
      setActionMessage(null);
      if (replyTarget?.id === message.id) setReplyTarget(null);
      if (editingMessage?.id === message.id) setEditingMessage(null);
    } catch (error) {
      Alert.alert('Message not deleted', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function forwardSelectedMessage() {
    if (!session?.authToken || !session.id || !forwardMessage || forwardTargets.length === 0) return;
    try {
      await Promise.all(forwardTargets.map((targetId) => sendChatMessage(session.authToken!, targetId, {
        senderId: session.id,
        clientId: `${session.id}-${targetId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        content: forwardMessage.content || (forwardMessage.attachment?.type === 'location' ? `Location: ${forwardMessage.attachment.label ?? 'Shared location'}` : 'Forwarded message'),
        attachment: forwardMessage.attachment ?? undefined,
      })));
      setForwardMessage(null);
      setForwardTargets([]);
      Alert.alert('Forwarded');
    } catch (error) {
      Alert.alert('Forward failed', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function startCall(type: 'voice' | 'video') {
    if (!session?.authToken || !contact?.id) return;
    try {
      const call = await startManagedCall(session.authToken, { calleeId: contact.id, type });
      router.push({ pathname: '/call/[id]', params: { id: String(call.id) } } as never);
    } catch (error) {
      Alert.alert('Call not started', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  async function updateMyChatStatus(status: ChatPresence) {
    if (!session?.authToken || !session.id) return;
    const previous = selfStatus;
    setSelfStatus(status);
    try {
      await updateUserProfile(session.authToken, session.id, { chatPresence: status });
      setStatusSheetOpen(false);
    } catch (error) {
      setSelfStatus(previous);
      Alert.alert('Status not updated', error instanceof Error ? error.message : 'Please try again.');
    }
  }

  if (!session || messages.isLoading) {
    return <View style={[styles.center, { backgroundColor: colors.background }]}><LoadingState /></View>;
  }

  const headerPresence = presenceLabel(contact, typingState);
  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.background }} behavior="padding" keyboardVerticalOffset={0}>
      <View style={[styles.header, { paddingTop: insets.top + 6, backgroundColor: colors.card, borderBottomColor: colors.border }]}> 
        <IconButton name="chevron-back" onPress={() => router.back()} label="Back" />
        <View style={styles.headerBody}>
          <View style={styles.headerContact}>
            <Avatar name={contact?.name ?? 'Conversation'} size={42} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.headerName, { color: colors.foreground }]} numberOfLines={1}>{contact?.name ?? 'Conversation'}</Text>
              <View style={styles.headerStatusRow}>
                <View style={[styles.statusDot, { backgroundColor: headerPresence.color }]} />
                <Text style={[styles.headerSub, { color: colors.mutedForeground }]} numberOfLines={1}>{headerPresence.text}</Text>
              </View>
            </View>
          </View>
        </View>
        <View style={styles.headerActions}>
          <IconButton name="call-outline" label="Voice call" onPress={() => void startCall('voice')} />
          <IconButton name="videocam-outline" label="Video call" onPress={() => void startCall('video')} />
          <IconButton name="ellipsis-vertical" label="More" onPress={() => setStatusSheetOpen(true)} />
        </View>
      </View>

      {chatNotes.length > 0 || chatNotesError ? (
        <View style={[styles.chatNotesStrip, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Ionicons name="sparkles-outline" size={15} color={colors.primary} />
          {chatNotes.length > 0 ? (
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chatNotesContent}>
              {chatNotes.map((note) => (
                <View key={note.id} style={[styles.chatNoteChip, { backgroundColor: colors.muted }]}>
                  <Text style={[styles.chatNoteOwner, { color: colors.primary }]}>{note.owner.id === session.id ? 'You' : note.owner.name}</Text>
                  <Text style={[styles.chatNoteText, { color: colors.foreground }]} numberOfLines={1}>{note.content}</Text>
                </View>
              ))}
            </ScrollView>
          ) : null}
          {chatNotesError ? <Pressable accessibilityRole="button" accessibilityLabel="Retry loading chat notes" onPress={() => void loadChatNotes()}><Text style={{ color: colors.destructive, fontSize: 12 }}>{chatNotesError} Retry</Text></Pressable> : null}
        </View>
      ) : null}

      <FlatList
        ref={listRef}
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={[styles.messageList, { paddingBottom: 18 }]}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        onContentSizeChange={() => {
          if (shouldAutoScrollRef.current) {
            listRef.current?.scrollToEnd({ animated: true });
          }
        }}
        onScroll={({ nativeEvent }) => {
          const distanceFromBottom =
            nativeEvent.contentSize.height - (nativeEvent.contentOffset.y + nativeEvent.layoutMeasurement.height);
          shouldAutoScrollRef.current = distanceFromBottom < 120;
        }}
        scrollEventThrottle={16}
        renderItem={({ item }) => {
          if (item.type === 'separator') {
            return (
              <View style={styles.separatorWrap}>
                <View style={[styles.separatorChip, { backgroundColor: colors.secondary }]}>
                  <Text style={[styles.separatorText, { color: colors.mutedForeground }]}>{item.label}</Text>
                </View>
              </View>
            );
          }
          const message = item.message;
          const mine = message.senderId === session.id;
          const seconds = remainingSeconds(message.expiresAt, clock);
          const mediaSource = message.attachment && message.attachment.type !== 'location'
            ? { uri: storageUrl(message.attachment.objectPath), headers: { Authorization: 'Bearer ' + session.authToken } }
            : null;
          const status = bubbleStatus(message, mine);
          const domain = message.content ? linkPreviewLabel(message.content) : null;
          const galleryIndex = mediaItems.findIndex((entry) => entry.id === message.id || (entry.clientId && entry.clientId === message.clientId));
          const attachmentPlayed = Boolean(message.playedAt || message.openedAt);
          const showUnreadAudioDot = message.attachment?.type === 'audio' && !mine && !attachmentPlayed;
          return (
            <Swipeable
              ref={(ref) => { swipeRefs.current[item.id] = ref; }}
              onSwipeableOpen={() => {
                setReplyTarget(message);
                swipeRefs.current[item.id]?.close();
              }}
              overshootLeft={false}
              renderLeftActions={() => (
                <View style={styles.replySwipeAction}>
                  <Ionicons name="arrow-undo" size={18} color={colors.primary} />
                  <Text style={{ color: colors.primary, fontWeight: '700' }}>Reply</Text>
                </View>
              )}
            >
              <Pressable
                onLongPress={() => setActionMessage(message)}
                onPress={() => {
                  if (message.localStatus === 'failed') retryMessage(message);
                }}
                delayLongPress={180}
                style={[styles.messageLine, { justifyContent: mine ? 'flex-end' : 'flex-start', marginTop: item.groupedTop ? 4 : 12 }]}
              >
                <View style={[styles.bubbleWrap, { alignItems: mine ? 'flex-end' : 'flex-start' }]}>
                  <View style={styles.senderMetaRow}>
                    {!mine && !item.groupedTop ? <Text style={[styles.senderLabel, { color: colors.mutedForeground }]}>{contact?.name ?? 'Contact'}</Text> : null}
                  </View>
                  <View style={[
                    styles.bubble,
                    {
                      backgroundColor: mine ? colors.primary : colors.muted,
                      borderBottomRightRadius: mine && item.groupedBottom ? 8 : 20,
                      borderBottomLeftRadius: !mine && item.groupedBottom ? 8 : 20,
                      borderTopRightRadius: mine && item.groupedTop ? 8 : 20,
                      borderTopLeftRadius: !mine && item.groupedTop ? 8 : 20,
                      opacity: message.localStatus === 'failed' ? 0.78 : 1,
                    },
                  ]}>
                    {message.replyPreview ? (
                      <Pressable onPress={() => openQuotedMessage(message.replyPreview?.id)} style={[styles.quoteCard, { backgroundColor: mine ? 'rgba(255,255,255,0.16)' : colors.background }]}>
                        <Text style={[styles.quoteOwner, { color: mine ? colors.primaryForeground : colors.primary }]}>{message.replyPreview.senderName}</Text>
                        <Text style={[styles.quoteText, { color: mine ? 'rgba(255,255,255,0.86)' : colors.mutedForeground }]} numberOfLines={2}>
                          {message.replyPreview.deleted ? 'This message was deleted.' : message.replyPreview.content || message.replyPreview.attachmentType}
                        </Text>
                      </Pressable>
                    ) : null}
                    {message.attachment?.type === 'image' && mediaSource ? (
                      <Pressable onPress={() => setMediaViewerIndex(galleryIndex)}>
                        <Image source={mediaSource} style={styles.attachmentImage} contentFit="cover" />
                      </Pressable>
                    ) : null}
                    {message.attachment?.type === 'video' && mediaSource ? (
                      <Pressable onPress={() => setMediaViewerIndex(galleryIndex)}>
                        <VideoSurface source={mediaSource} style={styles.attachmentImage} controls loop={false} paused={!settings.autoplay} />
                      </Pressable>
                    ) : null}
                    {message.attachment?.type === 'audio' ? (
                      <View style={styles.audioBubble}>
                        <Pressable onPress={() => void toggleAudio(message)} style={[styles.audioPlay, { backgroundColor: mine ? 'rgba(255,255,255,0.22)' : colors.primary }]}>
                          <Ionicons name={activeAudioMessageId === message.id && audioStatus.playing ? 'pause' : 'play'} size={18} color="#fff" />
                        </Pressable>
                        <Pressable
                          onPress={(event) => {
                            if (message.id !== activeAudioMessageId || !audioStatus.duration) return;
                            const ratio = Math.max(0, Math.min(1, event.nativeEvent.locationX / 140));
                            audioPlayer.seekTo?.(audioStatus.duration * ratio);
                          }}
                          style={styles.audioTrackWrap}
                        >
                          <View style={styles.waveformRow}>
                            {compactWaveform(
                              activeAudioMessageId === message.id && audioStatus.duration > 0
                                ? audioStatus.currentTime / audioStatus.duration
                                : 0,
                              mine,
                            )}
                          </View>
                          <View style={styles.audioMetaRow}>
                            <Text style={[styles.audioDuration, { color: mine ? 'rgba(255,255,255,0.82)' : colors.mutedForeground }]}>
                              {durationLabel(activeAudioMessageId === message.id ? audioStatus.currentTime : 0)} / {durationLabel(activeAudioMessageId === message.id && audioStatus.duration > 0 ? audioStatus.duration : (message.attachment.duration ?? 0))}
                            </Text>
                            <Pressable onPress={() => {
                              const nextRate = PLAYBACK_RATES[(PLAYBACK_RATES.indexOf(playbackRate) + 1) % PLAYBACK_RATES.length];
                              setPlaybackRate(nextRate);
                              audioPlayer.setPlaybackRate(nextRate);
                            }}>
                              <Text style={[styles.audioRate, { color: mine ? colors.primaryForeground : colors.primary }]}>{playbackRate}x</Text>
                            </Pressable>
                          </View>
                        </Pressable>
                        {showUnreadAudioDot ? <View style={[styles.unplayedDot, { backgroundColor: colors.primary }]} /> : null}
                      </View>
                    ) : null}
                    {message.attachment?.type === 'file' ? (
                      <View style={[styles.fileRow, { backgroundColor: mine ? 'rgba(255,255,255,0.14)' : colors.background }]}>
                        <Ionicons name="document-text" size={28} color={mine ? '#fff' : colors.primary} />
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.fileName, { color: mine ? colors.primaryForeground : colors.foreground }]} numberOfLines={1}>{message.attachment.name}</Text>
                          <Text style={{ color: mine ? 'rgba(255,255,255,0.76)' : colors.mutedForeground, fontSize: 11 }}>Document</Text>
                        </View>
                      </View>
                    ) : null}
                    {message.attachment?.type === 'location' ? (
                      <Pressable onPress={() => void openLocation(message)} style={[styles.locationCard, { backgroundColor: mine ? 'rgba(255,255,255,0.14)' : colors.background }]}>
                        <View style={[styles.locationIcon, { backgroundColor: mine ? 'rgba(255,255,255,0.22)' : `${colors.primary}18` }]}><Ionicons name="location" size={18} color={mine ? '#fff' : colors.primary} /></View>
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.locationTitle, { color: mine ? colors.primaryForeground : colors.foreground }]}>{message.attachment.label ?? 'Shared location'}</Text>
                          <Text style={{ color: mine ? 'rgba(255,255,255,0.76)' : colors.mutedForeground, fontSize: 11 }}>Tap to open maps</Text>
                        </View>
                      </Pressable>
                    ) : null}
                    {message.content ? (
                      <View style={{ marginTop: message.attachment ? 10 : 0 }}>
                        {renderLinkedText(message.content, mine ? colors.primaryForeground : colors.foreground, mine ? '#D7EEFF' : colors.primary)}
                      </View>
                    ) : null}
                    {domain ? (
                      <View style={[styles.linkPreview, { backgroundColor: mine ? 'rgba(255,255,255,0.14)' : colors.background }]}>
                        <Ionicons name="link-outline" size={14} color={mine ? '#fff' : colors.primary} />
                        <Text style={{ color: mine ? colors.primaryForeground : colors.foreground, fontSize: 12, fontWeight: '600' }}>{domain}</Text>
                      </View>
                    ) : null}
                    <View style={styles.messageMeta}>
                      {seconds !== null && !message.saved ? (
                        <View style={styles.expiryMeta}><Ionicons name="timer-outline" size={12} color={colors.destructive} /><Text style={[styles.retentionText, { color: colors.destructive }]}>{expiryLabel(seconds)}</Text></View>
                      ) : null}
                      {message.saved ? <Text style={[styles.savedText, { color: mine ? colors.primaryForeground : colors.primary }]}>Saved</Text> : null}
                      <Text style={[styles.messageTime, { color: mine ? 'rgba(255,255,255,0.72)' : colors.mutedForeground }]}>
                        {new Date(message.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
                        {message.editedAt ? ' · edited' : ''}
                        {status === 'sending' ? ' · sending…' : status === 'failed' ? ' · failed' : status === 'delivered' ? '  ✓✓' : status === 'read' ? '  ✓✓' : '  ✓'}
                      </Text>
                    </View>
                  </View>
                  {message.reactions?.length ? (
                    <View style={[styles.reactionBar, { backgroundColor: colors.card, borderColor: colors.border }]}>
                      {message.reactions.map((reaction) => (
                        <Pressable key={`${message.id}-${reaction.emoji}`} onPress={() => void reactToMessage(message, reaction.emoji)} style={[styles.reactionChip, { backgroundColor: reaction.reacted ? `${colors.primary}16` : 'transparent' }]}>
                          <Text style={styles.reactionEmoji}>{reaction.emoji}</Text>
                          <Text style={[styles.reactionCount, { color: reaction.reacted ? colors.primary : colors.mutedForeground }]}>{reaction.count}</Text>
                        </Pressable>
                      ))}
                    </View>
                  ) : null}
                </View>
              </Pressable>
            </Swipeable>
          );
        }}
        ListEmptyComponent={<View style={styles.emptyChat}><Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.mutedForeground} /><Text style={{ color: colors.mutedForeground }}>Start the conversation.</Text></View>}
      />

      {uploadLabel ? <View style={[styles.uploadBanner, { backgroundColor: colors.secondary }]}><Ionicons name="cloud-upload-outline" size={16} color={colors.primary} /><Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600' }}>{uploadLabel}</Text></View> : null}

      <View style={[styles.composerArea, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {replyTarget ? (
          <View style={[styles.replyPreviewComposer, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.replyComposerOwner, { color: colors.primary }]}>{replyTarget.senderId === session.id ? 'You' : contact?.name ?? 'Contact'}</Text>
              <Text style={[styles.replyComposerText, { color: colors.foreground }]} numberOfLines={2}>{replyTarget.content || replyTarget.attachment?.type || 'Message'}</Text>
            </View>
            <Pressable onPress={() => setReplyTarget(null)}><Ionicons name="close" size={18} color={colors.mutedForeground} /></Pressable>
          </View>
        ) : null}
        {editingMessage ? (
          <View style={[styles.replyPreviewComposer, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.replyComposerOwner, { color: colors.primary }]}>Editing message</Text>
              <Text style={[styles.replyComposerText, { color: colors.foreground }]} numberOfLines={2}>{editingMessage.content}</Text>
            </View>
            <Pressable onPress={() => { setEditingMessage(null); setText(''); }}><Ionicons name="close" size={18} color={colors.mutedForeground} /></Pressable>
          </View>
        ) : null}

        {recordingMode === 'locked' || recordingMode === 'paused' ? (
          <View style={[styles.lockedRecorder, { backgroundColor: colors.secondary, borderColor: colors.border }]}> 
            <View style={styles.lockedRecorderTop}><Text style={[styles.lockedRecorderTitle, { color: colors.destructive }]}>Recording voice note</Text><Text style={[styles.lockedRecorderTime, { color: colors.foreground }]}>{durationLabel(recorderState.durationMillis / 1000)}</Text></View>
            <View style={styles.lockedWaveform}>{compactWaveform(((recorderState.durationMillis / 1000) % 10) / 10)}</View>
            <View style={styles.lockedRecorderActions}>
              <Pressable onPress={() => void finishRecording(true)} style={[styles.lockedAction, { backgroundColor: colors.card }]}><Ionicons name="trash-outline" size={18} color={colors.destructive} /><Text style={{ color: colors.destructive, fontWeight: '700' }}>Delete</Text></Pressable>
              {recordingMode === 'paused'
                ? <Pressable onPress={() => void resumeRecording()} style={[styles.lockedAction, { backgroundColor: colors.card }]}><Ionicons name="play" size={18} color={colors.foreground} /><Text style={{ color: colors.foreground, fontWeight: '700' }}>Resume</Text></Pressable>
                : <Pressable onPress={() => void pauseRecording()} style={[styles.lockedAction, { backgroundColor: colors.card }]}><Ionicons name="pause" size={18} color={colors.foreground} /><Text style={{ color: colors.foreground, fontWeight: '700' }}>Pause</Text></Pressable>}
              <Pressable onPress={() => void finishRecording(false)} style={[styles.lockedAction, { backgroundColor: colors.primary }]}><Ionicons name="arrow-up" size={18} color="#fff" /><Text style={{ color: '#fff', fontWeight: '700' }}>Send</Text></Pressable>
            </View>
          </View>
        ) : null}

        <View style={[styles.composer, { paddingBottom: insets.bottom + 8 }]}> 
          <Pressable onPress={() => setAttachmentMenu(true)} style={[styles.sideComposerButton, { backgroundColor: colors.muted }]} accessibilityLabel="Open attachment menu">
            <Ionicons name="add" size={20} color={colors.foreground} />
          </Pressable>
          <View style={[styles.messagePill, { backgroundColor: colors.muted }]}> 
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={scheduleTypingState}
              placeholder="Message"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.messageInput, { color: colors.foreground }]}
              multiline
              maxLength={2000}
              blurOnSubmit={false}
              onSubmitEditing={settings.enterToSend ? sendText : undefined}
            />
            <Pressable onPress={() => { Keyboard.dismiss(); setEmojiOpen((current) => !current); }} style={styles.inlineComposerButton} accessibilityLabel="Open emoji picker">
              <Ionicons name="happy-outline" size={20} color={colors.foreground} />
            </Pressable>
          </View>
          {text.trim() ? (
            <Pressable onPress={sendText} style={[styles.sideComposerButton, { backgroundColor: colors.primary }]} accessibilityLabel="Send message">
              <Ionicons name="arrow-up" size={18} color="#fff" />
            </Pressable>
          ) : (
            <View {...recordResponder.panHandlers} style={[styles.sideComposerButton, { backgroundColor: colors.primary }]}>
              <Ionicons name="mic-outline" size={19} color="#fff" />
            </View>
          )}
        </View>

        {emojiOpen ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.compactEmojiRail} keyboardShouldPersistTaps="handled">
            {['😀','😂','😍','🙏','🔥','🎉','❤️','👍','👎','😮','😢'].map((emoji) => (
              <Pressable key={emoji} onPress={() => { setText((current) => `${current}${emoji}`); inputRef.current?.focus(); }} style={[styles.compactEmojiButton, { backgroundColor: colors.muted }]}> 
                <Text style={styles.compactEmojiText}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>
        ) : null}

        {recordingMode === 'recording' ? (
          <View style={styles.recordHintRow}>
            <Text style={[styles.recordHintText, { color: colors.destructive }]}>Recording {durationLabel(recorderState.durationMillis / 1000)}</Text>
            <Text style={[styles.recordHintSecondary, { color: colors.mutedForeground }]}>Swipe left to cancel · swipe up to lock</Text>
          </View>
        ) : null}
      </View>

      <Modal transparent visible={attachmentMenu} animationType="fade" onRequestClose={() => setAttachmentMenu(false)}>
        <View style={styles.scrim}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => setAttachmentMenu(false)} />
          <View style={[styles.attachmentSheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 14) }]}>
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Share in chat</Text>
            <View style={styles.attachmentActions}>
              <AttachmentAction icon="camera" label="Camera" color={colors.primary} onPress={() => { setAttachmentMenu(false); router.push({ pathname: '/camera', params: { returnChatId: String(chatId) } } as never); }} />
              <AttachmentAction icon="images" label="Photos & Videos" color="#4BB77B" onPress={() => { setAttachmentMenu(false); void choosePhotoOrVideo(); }} />
              <AttachmentAction icon="document-text" label="Document" color="#8B6DE9" onPress={() => { setAttachmentMenu(false); void chooseFile(); }} />
              <AttachmentAction icon="location" label="Location" color="#F97316" onPress={() => { setAttachmentMenu(false); void shareLocation(); }} />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(draftAssets.length)} transparent animationType="slide" onRequestClose={() => setDraftAssets([])}>
        <View style={styles.mediaPreviewOverlay}>
          <View style={[styles.mediaPreviewSheet, { backgroundColor: colors.background, paddingTop: insets.top + 8 }]}> 
            <View style={styles.mediaPreviewHeader}><IconButton name="close" onPress={() => setDraftAssets([])} /><Text style={[styles.mediaPreviewTitle, { color: colors.foreground }]}>Preview</Text><Pressable onPress={() => void sendDraftAssets()} style={[styles.previewSendButton, { backgroundColor: colors.primary }]}><Ionicons name="paper-plane" size={17} color="#fff" /></Pressable></View>
            <ScrollView horizontal pagingEnabled showsHorizontalScrollIndicator={false} onMomentumScrollEnd={(event) => setDraftIndex(Math.round(event.nativeEvent.contentOffset.x / windowWidth))}>
              {draftAssets.map((asset, index) => (
                <View key={`${asset.name}-${index}`} style={{ width: windowWidth, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, minHeight: windowHeight * 0.48 }}>
                  {asset.type === 'video' ? <VideoSurface source={{ uri: asset.uri }} style={styles.fullscreenPreview} controls loop={false} /> : asset.type === 'image' ? <Image source={{ uri: asset.uri }} style={styles.fullscreenPreview} contentFit="contain" /> : asset.type === 'location' ? <View style={[styles.locationDraftCard, { backgroundColor: colors.card }]}><Ionicons name="location" size={34} color={colors.primary} /><Text style={[styles.locationDraftTitle, { color: colors.foreground }]}>{asset.label ?? 'Current location'}</Text><Text style={{ color: colors.mutedForeground }}>Latitude {asset.latitude?.toFixed(4)} · Longitude {asset.longitude?.toFixed(4)}</Text></View> : <View style={[styles.locationDraftCard, { backgroundColor: colors.card }]}><Ionicons name="document-text" size={34} color={colors.primary} /><Text style={[styles.locationDraftTitle, { color: colors.foreground }]}>{asset.name}</Text></View>}
                </View>
              ))}
            </ScrollView>
            <View style={styles.previewPagination}>{draftAssets.map((asset, index) => <View key={`${asset.name}-${index}`} style={[styles.previewDot, { backgroundColor: index === draftIndex ? colors.primary : colors.border }]} />)}</View>
            <View style={[styles.previewCaptionWrap, { backgroundColor: colors.card, borderColor: colors.border }]}> 
              <TextInput value={draftCaption} onChangeText={setDraftCaption} placeholder="Add a caption" placeholderTextColor={colors.mutedForeground} style={[styles.previewCaptionInput, { color: colors.foreground }]} multiline />
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={actionMessage !== null} transparent animationType="slide" onRequestClose={() => setActionMessage(null)}>
        <Pressable style={styles.actionOverlay} onPress={() => setActionMessage(null)}>
          <View style={[styles.actionSheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.reactionPickerRow}>{REACTION_OPTIONS.map((emoji) => <Pressable key={emoji} onPress={() => actionMessage && void reactToMessage(actionMessage, emoji)} style={[styles.actionReactionButton, { backgroundColor: colors.muted }]}><Text style={styles.actionReactionEmoji}>{emoji}</Text></Pressable>)}</View>
            <ActionRow icon="arrow-undo" label="Reply" onPress={() => { if (actionMessage) setReplyTarget(actionMessage); setActionMessage(null); }} />
            {actionMessage?.content ? <ActionRow icon="copy-outline" label="Copy" onPress={() => actionMessage && void copyText(actionMessage.content)} /> : null}
            {actionMessage?.content ? <ActionRow icon="arrow-redo-outline" label="Forward" onPress={() => { if (actionMessage) setForwardMessage(actionMessage); setActionMessage(null); }} /> : null}
            {!actionMessage?.deletedForEveryone ? <ActionRow icon="bookmark-outline" label="Save" onPress={() => { if (actionMessage) save(actionMessage); setActionMessage(null); }} /> : null}
            {actionMessage?.senderId === session.id && actionMessage.content && !actionMessage.attachment && !actionMessage.deletedForEveryone ? <ActionRow icon="create-outline" label="Edit" onPress={() => { setEditingMessage(actionMessage); setText(actionMessage.content); setActionMessage(null); }} /> : null}
            <ActionRow icon="warning-outline" label="Report" onPress={() => { setActionMessage(null); Alert.alert('Reported'); }} />
            <ActionRow icon="trash-outline" label="Delete for me" destructive onPress={() => actionMessage && void deleteMessage(actionMessage, 'delete_for_me')} />
            {actionMessage?.senderId === session.id ? <ActionRow icon="trash-outline" label="Delete for everyone" destructive onPress={() => actionMessage && void deleteMessage(actionMessage, 'delete_for_everyone')} /> : null}
          </View>
        </Pressable>
      </Modal>

      <Modal visible={forwardMessage !== null} transparent animationType="slide" onRequestClose={() => { setForwardMessage(null); setForwardTargets([]); }}>
        <View style={styles.actionOverlay}>
          <View style={[styles.forwardSheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <View style={styles.forwardHeader}><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Forward message</Text><IconButton name="close" onPress={() => { setForwardMessage(null); setForwardTargets([]); }} /></View>
            <ScrollView>{(inbox.data ?? []).filter((item) => item.chat.id !== chatId).map((item) => {
              const selected = forwardTargets.includes(item.chat.id);
              return <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: selected }} key={item.chat.id} onPress={() => setForwardTargets((current) => selected ? current.filter((value) => value !== item.chat.id) : [...current, item.chat.id])} style={[styles.forwardRow, { borderBottomColor: colors.border }]}><Avatar name={item.contact.name} size={42} /><View style={{ flex: 1 }}><Text style={[styles.forwardName, { color: colors.foreground }]}>{item.contact.name}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{item.lastMessage?.content ?? 'Start a conversation'}</Text></View><Ionicons name={selected ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={selected ? colors.primary : colors.mutedForeground} /></Pressable>;
            })}</ScrollView>
            <Pressable onPress={() => void forwardSelectedMessage()} disabled={!forwardTargets.length} style={[styles.forwardSend, { backgroundColor: colors.primary, opacity: forwardTargets.length ? 1 : 0.45 }]}><Text style={{ color: '#fff', fontWeight: '700' }}>Forward</Text></Pressable>
          </View>
        </View>
      </Modal>

      <Modal visible={mediaViewerIndex !== null} transparent animationType="fade" onRequestClose={() => setMediaViewerIndex(null)}>
        <View style={styles.viewerOverlay}>
          <View style={[styles.viewerHeader, { paddingTop: insets.top + 6 }]}><IconButton name="close" onPress={() => setMediaViewerIndex(null)} /><Text style={{ color: '#fff', fontWeight: '700' }}>{mediaViewerIndex !== null ? `${mediaViewerIndex + 1} / ${mediaItems.length}` : ''}</Text></View>
          <ScrollView key={`viewer-${mediaViewerIndex ?? 'closed'}`} horizontal pagingEnabled contentOffset={{ x: Math.max(0, mediaViewerIndex ?? 0) * windowWidth, y: 0 }} showsHorizontalScrollIndicator={false}>
            {mediaItems.map((message) => {
              const source = message.attachment ? { uri: storageUrl(message.attachment.objectPath), headers: { Authorization: 'Bearer ' + session.authToken } } : null;
              return <View key={message.id} style={{ width: windowWidth, height: windowHeight * 0.78, justifyContent: 'center', alignItems: 'center' }}>{message.attachment?.type === 'video' && source ? <VideoSurface source={source} style={{ width: windowWidth, height: windowHeight * 0.7 }} controls loop={false} /> : source ? <Image source={source} style={{ width: windowWidth, height: windowHeight * 0.7 }} contentFit="contain" /> : null}<Text style={{ color: '#fff', marginTop: 12, paddingHorizontal: 18 }}>{message.content}</Text></View>;
            })}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={statusSheetOpen} transparent animationType="slide" onRequestClose={() => setStatusSheetOpen(false)}>
        <Pressable style={styles.actionOverlay} onPress={() => setStatusSheetOpen(false)}>
          <View style={[styles.actionSheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 16) }]}>
            <Text style={[styles.sheetTitle, { color: colors.foreground, textAlign: 'center', marginBottom: 10 }]}>My chat status</Text>
            {CHAT_STATUS_OPTIONS.map((option) => (
              <Pressable key={option.value} onPress={() => void updateMyChatStatus(option.value)} style={[styles.statusOption, { borderColor: colors.border, backgroundColor: selfStatus === option.value ? colors.secondary : 'transparent' }]}>
                <View style={[styles.statusDot, { backgroundColor: option.color }]} />
                <Text style={[styles.statusOptionLabel, { color: colors.foreground }]}>{option.label}</Text>
                {selfStatus === option.value ? <Ionicons name="checkmark" size={18} color={colors.primary} /> : null}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function AttachmentAction({ icon, label, color, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.attachmentAction}><View style={[styles.attachmentIcon, { backgroundColor: color }]}><Ionicons name={icon} size={24} color="#fff" /></View><Text style={styles.attachmentLabel}>{label}</Text></Pressable>;
}

function ActionRow({ icon, label, onPress, destructive = false }: { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void; destructive?: boolean }) {
  return <Pressable onPress={onPress} style={styles.actionRow}><Ionicons name={icon} size={19} color={destructive ? '#EF4444' : '#243C82'} /><Text style={[styles.actionLabel, destructive && { color: '#EF4444' }]}>{label}</Text></Pressable>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingBottom: 10, borderBottomWidth: StyleSheet.hairlineWidth, gap: 8 },
  headerBody: { flex: 1 },
  headerContact: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerName: { fontSize: 16, fontWeight: '800' },
  headerSub: { fontSize: 12.5 },
  headerStatusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  chatNotesStrip: { minHeight: 42, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  chatNotesContent: { gap: 8, paddingRight: 12 },
  chatNoteChip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, minWidth: 120 },
  chatNoteOwner: { fontSize: 11, fontWeight: '800', marginBottom: 1 },
  chatNoteText: { fontSize: 12.5 },
  messageList: { paddingHorizontal: 12, paddingTop: 8 },
  separatorWrap: { alignItems: 'center', marginVertical: 10 },
  separatorChip: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 999 },
  separatorText: { fontSize: 12, fontWeight: '700' },
  messageLine: { flexDirection: 'row' },
  bubbleWrap: { maxWidth: '86%' },
  senderMetaRow: { minHeight: 12, marginBottom: 2 },
  senderLabel: { fontSize: 11, fontWeight: '700', marginLeft: 6 },
  bubble: { borderRadius: 20, padding: 10, minWidth: 76 },
  quoteCard: { borderRadius: 12, padding: 10, marginBottom: 8 },
  quoteOwner: { fontSize: 12, fontWeight: '800', marginBottom: 2 },
  quoteText: { fontSize: 12.5, lineHeight: 17 },
  attachmentImage: { width: 220, height: 260, borderRadius: 14 },
  audioBubble: { flexDirection: 'row', gap: 10, alignItems: 'center', minWidth: 220 },
  audioPlay: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  audioTrackWrap: { flex: 1 },
  waveformRow: { minHeight: 28, flexDirection: 'row', alignItems: 'center', gap: 3 },
  audioMetaRow: { marginTop: 8, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  audioDuration: { fontSize: 11.5, fontWeight: '700' },
  audioRate: { fontSize: 11.5, fontWeight: '800' },
  unplayedDot: { width: 8, height: 8, borderRadius: 4 },
  fileRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 10, borderRadius: 12 },
  fileName: { fontSize: 14, fontWeight: '700' },
  locationCard: { flexDirection: 'row', gap: 10, alignItems: 'center', borderRadius: 14, padding: 12 },
  locationIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  locationTitle: { fontSize: 14, fontWeight: '700' },
  linkPreview: { marginTop: 8, alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 6, borderRadius: 12 },
  messageMeta: { marginTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  expiryMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  retentionText: { fontSize: 11, fontWeight: '700' },
  savedText: { fontSize: 11.5, fontWeight: '800' },
  messageTime: { fontSize: 11.5, fontWeight: '700' },
  reactionBar: { marginTop: 4, alignSelf: 'flex-start', flexDirection: 'row', gap: 4, paddingHorizontal: 6, paddingVertical: 4, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  reactionChip: { flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: 999, paddingHorizontal: 6, paddingVertical: 2 },
  reactionEmoji: { fontSize: 14 },
  reactionCount: { fontSize: 11, fontWeight: '800' },
  emptyChat: { paddingVertical: 48, alignItems: 'center', gap: 6 },
  uploadBanner: { minHeight: 36, marginHorizontal: 12, marginBottom: 8, borderRadius: 14, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12 },
  composerArea: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingTop: 8 },
  replyPreviewComposer: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 8, flexDirection: 'row', alignItems: 'center', gap: 10 },
  replyComposerOwner: { fontSize: 12, fontWeight: '800', marginBottom: 2 },
  replyComposerText: { fontSize: 13.5 },
  lockedRecorder: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, padding: 12, marginBottom: 8 },
  lockedRecorderTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  lockedRecorderTitle: { fontSize: 13, fontWeight: '800' },
  lockedRecorderTime: { fontSize: 14, fontWeight: '800' },
  lockedWaveform: { flexDirection: 'row', alignItems: 'center', gap: 4, marginVertical: 12 },
  lockedRecorderActions: { flexDirection: 'row', gap: 8 },
  lockedAction: { flex: 1, minHeight: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center', gap: 6, flexDirection: 'row' },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  sideComposerButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  messagePill: { flex: 1, minHeight: 42, borderRadius: 22, paddingLeft: 14, paddingRight: 8, paddingVertical: 6, flexDirection: 'row', alignItems: 'flex-end' },
  messageInput: { flex: 1, minHeight: 24, maxHeight: 120, fontSize: 15, paddingTop: 3, paddingBottom: 3 },
  inlineComposerButton: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  compactEmojiRail: { paddingBottom: 8, gap: 8 },
  compactEmojiButton: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  compactEmojiText: { fontSize: 18 },
  recordHintRow: { paddingBottom: 8, gap: 2 },
  recordHintText: { fontSize: 12, fontWeight: '800' },
  recordHintSecondary: { fontSize: 11.5 },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end' },
  attachmentSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 18, paddingTop: 18 },
  sheetTitle: { fontSize: 17, fontWeight: '800' },
  attachmentActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 18, paddingTop: 18 },
  attachmentAction: { width: '28%', alignItems: 'center', gap: 8, marginBottom: 10 },
  attachmentIcon: { width: 58, height: 58, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  attachmentLabel: { fontSize: 12.5, fontWeight: '700', textAlign: 'center' },
  mediaPreviewOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.4)', justifyContent: 'flex-end' },
  mediaPreviewSheet: { minHeight: '92%', borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  mediaPreviewHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 10 },
  mediaPreviewTitle: { fontSize: 16, fontWeight: '800' },
  previewSendButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  fullscreenPreview: { width: '100%', height: 380, borderRadius: 20 },
  previewPagination: { flexDirection: 'row', justifyContent: 'center', gap: 6, marginBottom: 10 },
  previewDot: { width: 8, height: 8, borderRadius: 4 },
  previewCaptionWrap: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 18, marginHorizontal: 16, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 16 },
  previewCaptionInput: { minHeight: 24, maxHeight: 100, fontSize: 15 },
  locationDraftCard: { width: '100%', borderRadius: 20, alignItems: 'center', justifyContent: 'center', gap: 8, padding: 24, minHeight: 240 },
  locationDraftTitle: { fontSize: 16, fontWeight: '800' },
  actionOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.32)', justifyContent: 'flex-end' },
  actionSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 16 },
  reactionPickerRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 8, marginBottom: 10 },
  actionReactionButton: { flex: 1, minHeight: 42, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  actionReactionEmoji: { fontSize: 22 },
  actionRow: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 12 },
  actionLabel: { fontSize: 15, fontWeight: '700', color: '#111827' },
  forwardSheet: { maxHeight: '75%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingHorizontal: 16, paddingTop: 16 },
  forwardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  forwardRow: { minHeight: 62, flexDirection: 'row', alignItems: 'center', gap: 10, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 8 },
  forwardName: { fontSize: 15, fontWeight: '700' },
  forwardSend: { minHeight: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 12 },
  viewerOverlay: { flex: 1, backgroundColor: '#000' },
  viewerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 12, paddingBottom: 10 },
  statusOption: { minHeight: 48, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  statusOptionLabel: { flex: 1, fontSize: 15, fontWeight: '700' },
  replySwipeAction: { width: 80, alignItems: 'center', justifyContent: 'center', gap: 6 },
});
