import { Ionicons } from '@expo/vector-icons';
import { File } from 'expo-file-system';
import { fetch as expoFetch } from 'expo/fetch';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import { Image } from 'expo-image';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  FlatList,
  Keyboard,
  Linking,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useQueryClient } from '@tanstack/react-query';
import { io } from 'socket.io-client';
import {
  getGetInboxQueryKey,
  getListMessagesQueryKey,
  useCreateMessage,
  useGetInbox,
  useListMessages,
  useMarkChatRead,
  useOpenMessage,
  useRequestUploadUrl,
  useSaveMessage,
  type Attachment,
  type Message,
} from '@workspace/api-client-react';
import { Avatar, IconButton, LoadingState } from '@/components/ui';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { VideoSurface } from '@/components/video-surface';
import { presenceLabel } from '@/lib/presence';
import { emojiPickerGroups } from '@/constants/emoji';
import { apiBaseUrl } from '@/lib/api-base-url';
import { getNotes, type Note } from '@/lib/social-api';

type PendingAsset = {
  uri: string;
  name: string;
  mimeType: string;
  size: number;
  type: Attachment['type'];
  width?: number;
  height?: number;
  duration?: number;
};

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

export default function ChatDetailScreen() {
  const { id, mediaUri, mediaType } = useLocalSearchParams<{
    id: string;
    mediaUri?: string;
    mediaType?: 'image' | 'video';
  }>();
  const chatId = Number(id);
  const { session, settings, addCall } = useApp();
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [text, setText] = useState('');
  const [attachmentMenu, setAttachmentMenu] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const [contactProfileOpen, setContactProfileOpen] = useState(false);
  const [uploadLabel, setUploadLabel] = useState<string | null>(null);
  const [clock, setClock] = useState(Date.now());
  const [chatNotes, setChatNotes] = useState<Note[]>([]);
  const inputRef = useRef<TextInput>(null);
  const openingIds = useRef(new Set<number>());
  const handledCameraUri = useRef<string | null>(null);
  const inboxKey = getGetInboxQueryKey(session?.id ?? 0);
  const messagesKey = getListMessagesQueryKey(chatId, { viewerId: session?.id ?? 0 });
  const inbox = useGetInbox(session?.id ?? 0, {
    query: { enabled: Boolean(session), queryKey: inboxKey },
  });
  const messages = useListMessages(
    chatId,
    { viewerId: session?.id ?? 0 },
    {
      query: {
        enabled: Boolean(session && chatId),
        refetchInterval: 3000,
        queryKey: messagesKey,
      },
    },
  );
  const createMessage = useCreateMessage();
  const markRead = useMarkChatRead();
  const openMessage = useOpenMessage();
  const saveMessage = useSaveMessage();
  const requestUploadUrl = useRequestUploadUrl();
  const composerSuggestions = useMemo(() => getComposerSuggestions(new Date()), []);
  const contact = useMemo(
    () => inbox.data?.find((item) => item.chat.id === chatId)?.contact,
    [inbox.data, chatId],
  );
  const visibleMessages = useMemo(
    () => (messages.data ?? []).filter((message) => message.saved || !message.expiresAt || message.expiresAt > clock),
    [clock, messages.data],
  );

  useEffect(() => {
    const timer = setInterval(() => setClock(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (session && chatId) {
      markRead.mutate({ chatId, data: { viewerId: session.id } });
    }
  }, [chatId, session?.id]);

  useEffect(() => {
    if (!session?.authToken || !chatId) return;
    const socket = io(apiBaseUrl(), {
      auth: { token: session.authToken },
      reconnection: true,
    });
    const refreshMessages = (payload?: { chatId?: number }) => {
      if (!payload || payload.chatId === chatId) {
        void queryClient.invalidateQueries({ queryKey: messagesKey });
      }
    };
    const refreshInbox = () => {
      void queryClient.invalidateQueries({ queryKey: inboxKey });
    };

    socket.on('connect', () => socket.emit('join-chat', { chatId }));
    socket.on('new-message', refreshMessages);
    socket.on('message-updated', refreshMessages);
    socket.on('message-expired', refreshMessages);
    socket.on('inbox-updated', refreshInbox);
    return () => {
      socket.emit('leave-chat', { chatId });
      socket.disconnect();
    };
  }, [chatId, inboxKey, messagesKey, queryClient, session?.authToken]);

  useEffect(() => {
    if (!session) return;
    for (const message of visibleMessages) {
      if (
        message.senderId !== session.id &&
        !message.openedAt &&
        !openingIds.current.has(message.id)
      ) {
        openingIds.current.add(message.id);
        openMessage.mutate(
          { messageId: message.id, data: { recipientId: session.id } },
          {
            onSuccess: () => void queryClient.invalidateQueries({ queryKey: messagesKey }),
            onError: () => openingIds.current.delete(message.id),
          },
        );
      }
    }
  }, [session?.id, visibleMessages]);

  useEffect(() => {
    if (!session?.authToken) return;
    let cancelled = false;
    void getNotes(session.authToken, 'chat')
      .then(({ items }) => {
        if (!cancelled) setChatNotes(items.filter((note) => note.owner.id === session.id || note.owner.id === contact?.id));
      })
      .catch(() => {
        if (!cancelled) setChatNotes([]);
      });
    return () => {
      cancelled = true;
    };
  }, [session?.authToken, session?.id, contact?.id]);

  useEffect(() => {
    if (!mediaUri || !session || handledCameraUri.current === mediaUri) return;
    handledCameraUri.current = mediaUri;
    void sendAsset({
      uri: mediaUri,
      name: `old-time-${Date.now()}.${mediaType === 'video' ? 'mp4' : 'jpg'}`,
      mimeType: mediaType === 'video' ? 'video/mp4' : 'image/jpeg',
      size: 1,
      type: mediaType === 'video' ? 'video' : 'image',
    });
  }, [mediaUri, mediaType, session?.id]);

  async function refreshChat() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: messagesKey }),
      queryClient.invalidateQueries({ queryKey: inboxKey }),
    ]);
  }

  function send() {
    const content = text.trim();
    if (!content || !session || createMessage.isPending) return;
    setText('');
    createMessage.mutate(
      { chatId, data: { senderId: session.id, content } },
      {
        onSuccess: () => void refreshChat(),
        onError: () => setText(content),
      },
    );
    inputRef.current?.focus();
  }

  async function callContact() {
    if (!contact?.phone) return;
    try {
      await Linking.openURL(`tel:${contact.phone}`);
      addCall({ name: contact.name, phone: contact.phone, type: 'voice', direction: 'outgoing' });
    } catch {
      Alert.alert('Call unavailable', 'This device cannot open the phone dialer.');
    }
  }

  async function sendAsset(asset: PendingAsset) {
    if (!session || uploadLabel) return;
    try {
      setUploadLabel('Preparing attachment…');
      const localFile = new File(asset.uri);
      const size = Math.max(1, asset.size || localFile.size || 1);
      const upload = await requestUploadUrl.mutateAsync({
        data: { name: asset.name, size, contentType: asset.mimeType },
      });
      setUploadLabel('Uploading…');
      const uploadUrl = upload.uploadURL.startsWith('/')
        ? `${apiBaseUrl()}${upload.uploadURL}`
        : upload.uploadURL;
      const result = await expoFetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': asset.mimeType,
          Authorization: `Bearer ${session.authToken}`,
        },
        body: localFile,
      });
      if (!result.ok) throw new Error(`Upload failed with ${result.status}`);
      setUploadLabel('Sending…');
      await createMessage.mutateAsync({
        chatId,
        data: {
          senderId: session.id,
          attachment: {
            type: asset.type,
            objectPath: upload.objectPath,
            name: asset.name,
            mimeType: asset.mimeType,
            size,
            width: asset.width,
            height: asset.height,
            duration: asset.duration,
          },
        },
      });
      await refreshChat();
    } catch {
      Alert.alert('Attachment not sent', 'The upload did not finish. Check your connection and try again.');
    } finally {
      setUploadLabel(null);
      setAttachmentMenu(false);
    }
  }

  async function choosePhotoOrVideo() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images', 'videos'],
      quality: 0.9,
      selectionLimit: 1,
    });
    if (result.canceled) return;
    const asset = result.assets[0];
    await sendAsset({
      uri: asset.uri,
      name: asset.fileName ?? `old-time-${Date.now()}.${asset.type === 'video' ? 'mp4' : 'jpg'}`,
      mimeType: asset.mimeType ?? (asset.type === 'video' ? 'video/mp4' : 'image/jpeg'),
      size: asset.fileSize ?? 1,
      type: asset.type === 'video' ? 'video' : 'image',
      width: asset.width,
      height: asset.height,
      duration: asset.duration ?? undefined,
    });
  }

  async function chooseFile() {
    const result = await DocumentPicker.getDocumentAsync({ copyToCacheDirectory: true });
    if (result.canceled) return;
    const asset = result.assets[0];
    await sendAsset({
      uri: asset.uri,
      name: asset.name,
      mimeType: asset.mimeType ?? 'application/octet-stream',
      size: asset.size ?? 1,
      type: 'file',
    });
  }

  function save(item: Message) {
    if (!session || saveMessage.isPending) return;
    saveMessage.mutate(
      { messageId: item.id, data: { recipientId: session.id } },
      { onSuccess: () => void refreshChat() },
    );
  }

  if (!session || messages.isLoading) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <LoadingState />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: colors.background }}
      behavior="padding"
      keyboardVerticalOffset={0}
    >
      <View
        style={[
          styles.header,
          {
            paddingTop: insets.top + 3,
            backgroundColor: colors.card,
            borderBottomColor: colors.border,
          },
        ]}
      >
        <IconButton name="chevron-back" onPress={() => router.back()} />
        <Pressable onPress={() => contact && setContactProfileOpen(true)} disabled={!contact} style={styles.contactHeader} accessibilityRole="button" accessibilityLabel={contact ? `Open ${contact.name}'s profile` : 'Conversation contact'}>
          <Avatar name={contact?.name ?? 'Old Time contact'} size={40} />
          <View style={{ flex: 1 }}>
            <Text style={[styles.headerName, { color: colors.foreground }]} numberOfLines={1}>
              {contact?.name ?? 'Conversation'}
            </Text>
            <Text style={[styles.headerSub, { color: colors.mutedForeground }]} numberOfLines={1}>
               {contact ? presenceLabel(contact) : 'offline'}
            </Text>
          </View>
        </Pressable>
        {contact?.phone ? <IconButton name="call-outline" label={`Call ${contact.name}`} onPress={() => void callContact()} /> : null}
      </View>

      {chatNotes.length > 0 ? (
        <View style={[styles.chatNotesStrip, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
          <Ionicons name="sparkles-outline" size={15} color={colors.primary} />
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chatNotesContent}>
            {chatNotes.map((note) => (
              <View key={note.id} style={[styles.chatNoteChip, { backgroundColor: colors.muted }]}>
                <Text style={[styles.chatNoteOwner, { color: colors.primary }]}>{note.owner.id === session.id ? 'You' : note.owner.name}</Text>
                <Text style={[styles.chatNoteText, { color: colors.foreground }]} numberOfLines={1}>{note.content}</Text>
              </View>
            ))}
          </ScrollView>
        </View>
      ) : null}

      <FlatList
        inverted
        data={[...visibleMessages].reverse()}
        keyExtractor={(message) => String(message.id)}
        contentContainerStyle={styles.messageList}
        keyboardDismissMode="interactive"
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }: { item: Message }) => {
          const mine = item.senderId === session.id;
          const seconds = remainingSeconds(item.expiresAt, clock);
          const mediaSource = item.attachment
            ? {
                uri: storageUrl(item.attachment.objectPath),
                headers: { Authorization: `Bearer ${session.authToken}` },
              }
            : null;
          return (
            <View style={[styles.messageLine, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
              <View
                style={[
                  styles.bubble,
                  {
                    backgroundColor: mine ? colors.primary : colors.muted,
                    borderColor: 'transparent',
                    borderBottomRightRadius: mine ? 6 : 20,
                    borderBottomLeftRadius: mine ? 20 : 6,
                  },
                ]}
              >
                {item.attachment?.type === 'image' && mediaSource ? (
                  <Image source={mediaSource} style={styles.attachmentImage} contentFit="cover" />
                ) : item.attachment?.type === 'video' && mediaSource ? (
                  <VideoSurface source={mediaSource} style={styles.attachmentImage} controls loop={false} paused={!settings.autoplay} />
                ) : item.attachment ? (
                  <View style={[styles.fileRow, { backgroundColor: colors.background }]}>
                    <Ionicons
                      name={item.attachment.type === 'video' ? 'play-circle' : 'document-text'}
                      size={30}
                      color={colors.primary}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.fileName, { color: colors.foreground }]} numberOfLines={1}>
                        {item.attachment.name}
                      </Text>
                      <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>
                        {item.attachment.type === 'video' ? 'Video attachment' : 'File attachment'}
                      </Text>
                    </View>
                  </View>
                ) : null}
                {item.content ? (
                  <Text style={[styles.messageText, { color: mine ? colors.primaryForeground : colors.foreground }]}>{item.content}</Text>
                ) : null}
                {seconds !== null && !item.saved ? (
                  <View style={styles.messageMeta}>
                    <Ionicons name="timer-outline" size={13} color={colors.destructive} />
                    <Text style={[styles.retentionText, { color: colors.destructive }]}>
                      {expiryLabel(seconds)}
                    </Text>
                    {!mine ? (
                      <Pressable testID={`save-message-${item.id}`} onPress={() => save(item)}>
                        <Text style={[styles.saveText, { color: colors.primary }]}>Save</Text>
                      </Pressable>
                    ) : null}
                    <MessageTime item={item} mine={mine} colors={colors} />
                  </View>
                ) : item.saved ? (
                  <View style={styles.messageMeta}>
                    <Text style={[styles.savedText, { color: colors.primary }]}>Saved</Text>
                    <MessageTime item={item} mine={mine} colors={colors} />
                  </View>
                ) : <MessageTime item={item} mine={mine} colors={colors} />}
              </View>
            </View>
          );
        }}
        ListEmptyComponent={
          <View style={styles.emptyChat}>
            <Ionicons name="lock-closed-outline" size={18} color={colors.mutedForeground} />
            <Text style={{ color: colors.mutedForeground }}>
              Messages disappear after 1 minute unless you save them.
            </Text>
          </View>
        }
      />

      {uploadLabel && (
        <View style={[styles.uploadBanner, { backgroundColor: colors.secondary }]}>
          <Ionicons name="cloud-upload-outline" size={16} color={colors.primary} />
          <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600' }}>{uploadLabel}</Text>
        </View>
      )}

      <View style={[styles.composerArea, { backgroundColor: colors.card, borderTopColor: colors.border }]}>
        {!text.trim() ? (
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.suggestionRow}
            keyboardShouldPersistTaps="handled"
          >
            {composerSuggestions.map((suggestion) => (
              <Pressable
                key={suggestion.id}
                onPress={() => {
                  setText((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}${suggestion.value}`);
                  inputRef.current?.focus();
                }}
                style={({ pressed }) => [styles.suggestionChip, { backgroundColor: colors.muted, opacity: pressed ? 0.65 : 1 }]}
                accessibilityRole="button"
                accessibilityLabel={`Add ${suggestion.label || suggestion.value}`}
              >
                <Text style={styles.suggestionEmoji}>{suggestion.emoji}</Text>
                {suggestion.label ? <Text style={[styles.suggestionLabel, { color: colors.foreground }]}>{suggestion.label}</Text> : null}
              </Pressable>
            ))}
          </ScrollView>
        ) : null}
        <View
          style={[
            styles.composer,
            {
              paddingBottom: insets.bottom + 8,
            },
          ]}
        >
          <IconButton
            name="camera-outline"
            onPress={() =>
              router.push({ pathname: '/camera', params: { returnChatId: String(chatId) } })
            }
            label="Open camera"
          />
          <View style={[styles.messagePill, { backgroundColor: colors.muted }]}>
            <TextInput
              ref={inputRef}
              value={text}
              onChangeText={setText}
              placeholder="Message"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.messageInput, { color: colors.foreground }]}
              multiline
              maxLength={2000}
              blurOnSubmit={false}
              onSubmitEditing={settings.enterToSend ? send : undefined}
            />
            <IconButton
              name="images-outline"
              onPress={() => setAttachmentMenu(true)}
              label="Add photo or video"
              size={21}
            />
            <IconButton
              name="happy-outline"
              onPress={() => {
                Keyboard.dismiss();
                setEmojiOpen(true);
              }}
              label="Open emoji picker"
              size={21}
            />
            {!text.trim() ? (
              <IconButton
                name="mic-outline"
                onPress={() => Alert.alert('Voice messages', 'Voice notes are coming soon.')}
                label="Record voice message"
                size={21}
              />
            ) : null}
          </View>
          {text.trim() ? (
            <Pressable
              testID="send-message"
              onPress={send}
              disabled={createMessage.isPending}
              style={({ pressed }) => [
                styles.send,
                { backgroundColor: colors.primary, opacity: pressed ? 0.7 : 1 },
              ]}
              accessibilityRole="button"
              accessibilityLabel="Send message"
            >
              <Ionicons name="arrow-up" size={18} color="#fff" />
            </Pressable>
          ) : null}
        </View>
      </View>

      <Modal
        transparent
        visible={attachmentMenu}
        animationType="fade"
        onRequestClose={() => setAttachmentMenu(false)}
      >
        <Pressable style={styles.scrim} onPress={() => setAttachmentMenu(false)}>
          <View
            style={[
              styles.attachmentSheet,
              {
                backgroundColor: colors.card,
                paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 12),
              },
            ]}
          >
            <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Share with {contact?.name ?? 'chat'}</Text>
            <View style={styles.attachmentActions}>
              <AttachmentAction
                icon="camera"
                label="Camera"
                color={colors.primary}
                onPress={() => {
                  setAttachmentMenu(false);
                  router.push({ pathname: '/camera', params: { returnChatId: String(chatId) } });
                }}
              />
              <AttachmentAction icon="images" label="Photos" color="#4BB77B" onPress={choosePhotoOrVideo} />
              <AttachmentAction icon="document-text" label="File" color="#8B6DE9" onPress={chooseFile} />
            </View>
          </View>
        </Pressable>
      </Modal>

      <EmojiPickerSheet
        visible={emojiOpen}
        onClose={() => setEmojiOpen(false)}
        onSelect={(emoji) => {
          setText((current) => `${current}${current && !current.endsWith(' ') ? ' ' : ''}${emoji}`);
          setEmojiOpen(false);
          inputRef.current?.focus();
        }}
      />
      <Modal visible={contactProfileOpen} transparent animationType="slide" onRequestClose={() => setContactProfileOpen(false)}>
        <View style={styles.profileOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setContactProfileOpen(false)} />
          <View style={[styles.contactProfileSheet, { backgroundColor: colors.card }]}>
            <View style={styles.profileGrabber} />
            <View style={styles.contactProfileHero}>
              <Avatar name={contact?.name ?? 'Contact'} size={78} color={colors.primary} />
              <Text style={[styles.contactProfileName, { color: colors.foreground }]}>{contact?.name ?? 'Contact'}</Text>
              {contact?.username ? <Text style={[styles.contactProfileUsername, { color: colors.mutedForeground }]}>@{contact.username}</Text> : null}
              {contact?.bio ? <Text style={[styles.contactProfileBio, { color: colors.foreground }]}>{contact.bio}</Text> : null}
            </View>
            <View style={[styles.contactProfileStatus, { backgroundColor: colors.secondary }]}>
              <Ionicons name="ellipse" size={10} color={colors.primary} />
              <Text style={[styles.contactProfileStatusText, { color: colors.foreground }]}>{contact ? presenceLabel(contact) : 'offline'}</Text>
            </View>
            {contact?.phone ? <Pressable onPress={() => { setContactProfileOpen(false); void callContact(); }} style={[styles.contactProfileAction, { backgroundColor: colors.primary }]} accessibilityRole="button" accessibilityLabel={`Call ${contact.name}`}>
              <Ionicons name="call-outline" size={18} color="#fff" />
              <Text style={styles.contactProfileActionText}>Call</Text>
            </Pressable> : null}
          </View>
        </View>
      </Modal>
    </KeyboardAvoidingView>
  );
}

function MessageTime({
  item,
  mine,
  colors,
}: {
  item: Message;
  mine: boolean;
  colors: ReturnType<typeof useColors>;
}) {
  return (
    <Text style={[styles.messageTime, { color: mine ? 'rgba(255,255,255,0.72)' : colors.mutedForeground }]}>
      {new Date(item.timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}
      {mine ? (
        <Text style={{ color: item.read ? colors.primary : colors.mutedForeground }}>
          {'  '}{item.read ? '✓✓' : '✓'}
        </Text>
      ) : null}
    </Text>
  );
}

function AttachmentAction({
  icon,
  label,
  color,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  color: string;
  onPress: () => void;
}) {
  return (
    <Pressable testID={`attachment-${label.toLowerCase()}`} onPress={onPress} style={styles.attachmentAction}>
      <View style={[styles.attachmentIcon, { backgroundColor: color }]}>
        <Ionicons name={icon} size={25} color="#fff" />
      </View>
      <Text style={styles.attachmentLabel}>{label}</Text>
    </Pressable>
  );
}

function EmojiPickerSheet({ visible, onClose, onSelect }: { visible: boolean; onClose: () => void; onSelect: (emoji: string) => void }) {
  const colors = useColors();
  const [activeCategory, setActiveCategory] = useState(emojiPickerGroups[0].id);
  const [search, setSearch] = useState('');
  const [recent, setRecent] = useState(['❤️', '😂', '👍', '🙏', '🔥', '😍', '😭', '🎉']);
  const category = emojiPickerGroups.find((item) => item.id === activeCategory) ?? emojiPickerGroups[0];
  const query = search.trim().toLowerCase();
  const visibleEmojis = query
    ? category.emojis.filter((emoji) => emoji.includes(query) || emojiSearchTerms[emoji]?.includes(query))
    : category.emojis;

  useEffect(() => {
    if (visible) setSearch('');
  }, [visible]);

  function selectEmoji(emoji: string) {
    setRecent((current) => [emoji, ...current.filter((item) => item !== emoji)].slice(0, 12));
    onSelect(emoji);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.emojiOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.emojiSheet, { backgroundColor: colors.card }]}>
          <View style={styles.emojiHeader}>
            <Text style={[styles.emojiTitle, { color: colors.foreground }]}>Emoji</Text>
            <IconButton name="close" onPress={onClose} size={22} />
          </View>
          <View style={[styles.emojiSearch, { backgroundColor: colors.muted }]}>
            <Ionicons name="search" size={17} color={colors.mutedForeground} />
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder="Search emoji"
              placeholderTextColor={colors.mutedForeground}
              style={[styles.emojiSearchInput, { color: colors.foreground }]}
              autoCorrect={false}
              returnKeyType="search"
            />
            {search ? <Pressable onPress={() => setSearch('')} hitSlop={8}><Ionicons name="close-circle" size={17} color={colors.mutedForeground} /></Pressable> : null}
          </View>
          <Text style={[styles.emojiSectionLabel, { color: colors.mutedForeground }]}>Recent</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recentEmojiRow}>
            {recent.map((emoji) => (
              <Pressable key={emoji} onPress={() => selectEmoji(emoji)} style={styles.recentEmojiButton} accessibilityRole="button" accessibilityLabel={`Insert ${emoji}`}>
                <Text style={styles.recentEmojiText}>{emoji}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.emojiCategoryRail}>
            {emojiPickerGroups.map((item) => (
              <Pressable
                key={item.id}
                onPress={() => setActiveCategory(item.id)}
                style={[styles.emojiCategory, { backgroundColor: activeCategory === item.id ? colors.primary : colors.muted }]}
                accessibilityRole="tab"
                accessibilityState={{ selected: activeCategory === item.id }}
                accessibilityLabel={`${item.label} emoji`}
              >
                <Ionicons name={item.icon as keyof typeof Ionicons.glyphMap} size={18} color={activeCategory === item.id ? colors.primaryForeground : colors.mutedForeground} />
              </Pressable>
            ))}
          </ScrollView>
          <ScrollView contentContainerStyle={styles.emojiGrid} showsVerticalScrollIndicator={false}>
            {visibleEmojis.map((emoji, index) => (
              <Pressable key={`${category.id}-${emoji}-${index}`} onPress={() => selectEmoji(emoji)} style={({ pressed }) => [styles.emojiButton, { backgroundColor: pressed ? colors.muted : 'transparent' }]} accessibilityRole="button" accessibilityLabel={`Insert ${emoji}`}>
                <Text style={styles.emojiText}>{emoji}</Text>
              </Pressable>
            ))}
            {visibleEmojis.length === 0 ? <Text style={[styles.noEmojiResults, { color: colors.mutedForeground }]}>No emoji found</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

type ComposerSuggestion = {
  id: string;
  emoji: string;
  label: string;
  value: string;
};

function getComposerSuggestions(date: Date): ComposerSuggestion[] {
  const month = date.getMonth();
  const day = date.getDate();
  const hour = date.getHours();
  const suggestions: ComposerSuggestion[] = [
    { id: 'heart', emoji: '❤️', label: '', value: '❤️' },
    { id: 'laugh', emoji: '😂', label: '', value: '😂' },
    { id: 'thumbs-up', emoji: '👍', label: '', value: '👍' },
  ];

  if ((month === 8 && day >= 1 && day <= 10) || (month === 4 && day >= 1 && day <= 8)) {
    suggestions.push({ id: 'seasonal', emoji: '🇺🇸', label: month === 8 ? 'Happy Labor Day' : 'Happy Memorial Day', value: month === 8 ? 'Happy Labor Day 🇺🇸' : 'Happy Memorial Day 🇺🇸' });
  } else if (month === 1 && day <= 16) {
    suggestions.push({ id: 'seasonal', emoji: '💌', label: "Happy Valentine's Day", value: "Happy Valentine's Day 💌" });
  } else if (month === 9 && day >= 20) {
    suggestions.push({ id: 'seasonal', emoji: '🎃', label: 'Happy Halloween', value: 'Happy Halloween 🎃' });
  } else if (month === 10 && day >= 15) {
    suggestions.push({ id: 'seasonal', emoji: '🦃', label: 'Happy Thanksgiving', value: 'Happy Thanksgiving 🦃' });
  } else if (month === 11) {
    suggestions.push({ id: 'seasonal', emoji: '🎄', label: 'Happy Holidays', value: 'Happy Holidays 🎄' });
  } else {
    suggestions.push({ id: 'seasonal', emoji: month >= 5 && month <= 7 ? '☀️' : '✨', label: month >= 5 && month <= 7 ? 'Summer mood' : 'Good vibes', value: month >= 5 && month <= 7 ? '☀️' : '✨' });
  }

  suggestions.push(
    hour < 12
      ? { id: 'time', emoji: '☀️', label: 'Good morning', value: 'Good morning ☀️' }
      : hour >= 20
        ? { id: 'time', emoji: '🌙', label: 'Good night', value: 'Good night 🌙' }
        : { id: 'time', emoji: '🔥', label: 'Streak', value: '🔥' },
  );
  return suggestions;
}

const emojiSearchTerms: Record<string, string> = {
  '❤️': 'heart love red',
  '😂': 'laugh tears funny',
  '🤣': 'laugh rolling funny',
  '👍': 'thumbs up approve yes',
  '👎': 'thumbs down no',
  '🙏': 'pray please thanks',
  '🔥': 'fire lit hot',
  '😍': 'heart eyes love',
  '😭': 'cry tears sad',
  '😡': 'angry mad',
  '🎉': 'party celebration',
  '💯': 'hundred perfect',
  '✨': 'sparkles magic',
  '🤔': 'thinking',
  '😉': 'wink',
  '😎': 'cool sunglasses',
  '🥳': 'party celebrate',
  '👋': 'wave hello bye',
  '👏': 'clap applause',
  '💔': 'broken heart',
  '✅': 'check done yes',
  '❌': 'x no wrong',
};

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: {
    minHeight: 60,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerName: { fontSize: 16, fontWeight: '700' },
  headerSub: { fontSize: 12, marginTop: 2 },
  contactHeader: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, marginLeft: 8, marginRight: 8 },
  chatNotesStrip: { minHeight: 42, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  chatNotesContent: { gap: 7, paddingVertical: 6 },
  chatNoteChip: { maxWidth: 220, borderRadius: 14, paddingHorizontal: 10, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 },
  chatNoteOwner: { fontSize: 11, fontWeight: '800' },
  chatNoteText: { fontSize: 12, flexShrink: 1 },
  messageList: { paddingHorizontal: 14, paddingTop: 12, paddingBottom: 12 },
  messageLine: { flexDirection: 'row', marginBottom: 7 },
  bubble: {
    maxWidth: '82%',
    minWidth: 92,
    borderRadius: 20,
    borderWidth: 0,
    paddingHorizontal: 13,
    paddingTop: 9,
    paddingBottom: 7,
  },
  messageText: { fontSize: 16, lineHeight: 21 },
  messageTime: { fontSize: 10, alignSelf: 'flex-end', marginTop: 4 },
  attachmentImage: { width: 220, height: 260, borderRadius: 11, marginBottom: 4 },
  fileRow: {
    width: 230,
    borderRadius: 11,
    padding: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 9,
  },
  fileName: { fontSize: 13, fontWeight: '700' },
  messageMeta: { minHeight: 14, flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  retentionText: { fontSize: 11, fontWeight: '600' },
  saveText: { fontSize: 11, fontWeight: '800' },
  savedText: { fontSize: 11, fontWeight: '700' },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    transform: [{ scaleY: -1 }],
    paddingHorizontal: 32,
  },
  uploadBanner: {
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 7,
  },
  composerArea: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  suggestionRow: {
    gap: 8,
    paddingHorizontal: 14,
    paddingTop: 8,
    paddingBottom: 3,
  },
  suggestionChip: {
    minHeight: 38,
    borderRadius: 20,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
  },
  suggestionEmoji: { fontSize: 22 },
  suggestionLabel: { fontSize: 16, fontWeight: '500' },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 6,
    paddingHorizontal: 10,
    paddingTop: 9,
  },
  messagePill: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    borderRadius: 23,
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingLeft: 2,
    paddingRight: 5,
  },
  messageInput: {
    flex: 1,
    minHeight: 44,
    maxHeight: 110,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 16,
  },
  send: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 1,
  },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'flex-end' },
  profileOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.38)' },
  contactProfileSheet: { borderTopLeftRadius: 26, borderTopRightRadius: 26, paddingHorizontal: 22, paddingTop: 12, paddingBottom: 28 },
  profileGrabber: { alignSelf: 'center', width: 36, height: 4, borderRadius: 2, backgroundColor: '#B8B8B8', marginBottom: 20 },
  contactProfileHero: { alignItems: 'center' },
  contactProfileName: { fontSize: 21, fontWeight: '700', marginTop: 12 },
  contactProfileUsername: { fontSize: 14, marginTop: 4 },
  contactProfileBio: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginTop: 12 },
  contactProfileStatus: { minHeight: 40, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 },
  contactProfileStatusText: { fontSize: 14, fontWeight: '600' },
  contactProfileAction: { minHeight: 44, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 12 },
  contactProfileActionText: { color: '#fff', fontSize: 16, fontWeight: '700' },
  attachmentSheet: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  sheetTitle: { fontSize: 16, fontWeight: '800', marginBottom: 22 },
  attachmentActions: { flexDirection: 'row', justifyContent: 'space-around' },
  attachmentAction: { width: 74, alignItems: 'center', gap: 8, paddingBottom: 12 },
  attachmentIcon: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center' },
  attachmentLabel: { fontSize: 12, fontWeight: '600', color: '#4A4A4A' },
  emojiOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.42)' },
  emojiSheet: { maxHeight: '78%', minHeight: 430, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 12, paddingBottom: 10 },
  emojiHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, marginBottom: 9 },
  emojiTitle: { fontSize: 20, fontWeight: '800' },
  emojiSearch: { height: 40, borderRadius: 20, marginHorizontal: 16, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  emojiSearchInput: { flex: 1, fontSize: 15, paddingVertical: 0 },
  emojiSectionLabel: { fontSize: 11, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.7, marginTop: 11, marginLeft: 18, marginBottom: 2 },
  recentEmojiRow: { gap: 4, paddingHorizontal: 14, paddingBottom: 7 },
  recentEmojiButton: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
  recentEmojiText: { fontSize: 25 },
  emojiCategoryRail: { gap: 7, paddingHorizontal: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: 'rgba(120,120,130,0.18)' },
  emojiCategory: { width: 38, height: 35, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  emojiGrid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, paddingTop: 6, paddingBottom: 22 },
  emojiButton: { width: '12.5%', aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
  emojiText: { fontSize: 28, lineHeight: 35 },
  noEmojiResults: { width: '100%', textAlign: 'center', paddingVertical: 30, fontSize: 14 },
});