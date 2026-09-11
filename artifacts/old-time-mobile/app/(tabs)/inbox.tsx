import { Ionicons } from '@expo/vector-icons';
import { getCall, getCallLiveKitToken, startCall as startCallRequest } from '@workspace/api-client-react';
import { useRouter } from 'expo-router';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import React, { useEffect, useState } from 'react';
import { Alert, Image, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, IconButton } from '@/components/OldTimeUi';
import { useColors } from '@/hooks/useColors';
import { Chat, useOldTime } from '@/context/OldTimeContext';
import { TAB_BAR_CONTENT_CLEARANCE } from '@/constants/layout';

function ChatRow({ chat, onPress }: { chat: Chat; onPress: () => void }) {
  const colors = useColors();
  return <Pressable onPress={onPress} style={({ pressed }) => [styles.chatRow, { borderBottomColor: colors.border }, pressed && { opacity: 0.65 }]}><Avatar source={chat.avatar} size={53} /><View style={styles.chatCopy}><Text style={[styles.chatName, { color: colors.foreground }]}>{chat.name}</Text><Text numberOfLines={1} style={[styles.chatPreview, { color: chat.unread ? colors.foreground : colors.mutedForeground }]}>{chat.preview}</Text></View>{chat.unread ? <View style={[styles.unread, { backgroundColor: colors.primary }]}><Text style={{ color: colors.primaryForeground, fontSize: 11, fontWeight: '800' }}>{chat.unread}</Text></View> : <Text style={[styles.chatTime, { color: colors.mutedForeground }]}>{chat.messages.at(-1)?.createdAt ?? ''}</Text>}</Pressable>;
}

function NewChatModal({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const colors = useColors();
  const { users, currentUserId, searchUsers, createChat } = useOldTime();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<ReturnType<typeof useOldTime>['users'] | null>(null);
  const [creating, setCreating] = useState(false);
  const available = results ?? users.filter((user) => user.id !== currentUserId);

  useEffect(() => {
    if (!query.trim()) {
      setResults(null);
      return;
    }
    const timer = setTimeout(() => {
      void searchUsers(query).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => clearTimeout(timer);
  }, [query, searchUsers]);

  const startChat = async (userId: string) => {
    setCreating(true);
    try {
      await createChat(userId);
      setQuery('');
      onClose();
    } catch (error) {
      Alert.alert('Could not start conversation', error instanceof Error ? error.message : 'Try again.');
    } finally {
      setCreating(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.modalBackdrop}>
        <View style={[styles.newChatSheet, { backgroundColor: colors.card }]}>
          <View style={styles.sheetHandle} />
          <View style={styles.newChatHeader}><Text style={[styles.newChatTitle, { color: colors.foreground }]}>New message</Text><IconButton icon="close" onPress={onClose} accessibilityLabel="Close new message" /></View>
          <View style={[styles.searchWrap, { backgroundColor: colors.paper, borderColor: colors.border }]}><Ionicons name="search-outline" size={18} color={colors.mutedForeground} /><TextInput autoFocus value={query} onChangeText={setQuery} placeholder="Search people" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} /></View>
          <ScrollView contentContainerStyle={styles.peopleList}>
            {available.map((user) => <Pressable key={user.id} disabled={creating} onPress={() => void startChat(user.id)} style={[styles.personRow, { borderBottomColor: colors.border }]}><Avatar source={user.avatar} size={42} accent={user.accent} /><View style={styles.personCopy}><Text style={[styles.personName, { color: colors.foreground }]}>{user.name}</Text><Text style={[styles.personHandle, { color: colors.mutedForeground }]}>@{user.handle}</Text></View><Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} /></Pressable>)}
            {!available.length ? <Text style={[styles.noPeople, { color: colors.mutedForeground }]}>{query ? 'No people found.' : 'No other profiles yet.'}</Text> : null}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

function Conversation({ chat, onBack }: { chat: Chat; onBack: () => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { chats, sendMessage } = useOldTime();
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  const [startingCall, setStartingCall] = useState<'audio' | 'video' | null>(null);
  const freshChat = chats.find((item) => item.id === chat.id) ?? chat;
  const submit = async () => {
    const text = message.trim();
    if (!text || sending) return;
    setSending(true);
    try {
      await sendMessage(chat.id, text);
      setMessage('');
    } catch {
      // The context rolls back the optimistic message and shows the error.
    } finally {
      setSending(false);
    }
  };
  const startCall = async (kind: 'audio' | 'video') => {
    if (startingCall) return;
    setStartingCall(kind);
    try {
      const callInput = { calleeId: Number(freshChat.userId), type: kind === 'video' ? 'video' as const : 'voice' as const };
      const call = await startCallRequest(callInput);
      let current = call;
      for (let attempt = 0; attempt < 60 && current.status === 'ringing'; attempt += 1) {
        await new Promise((resolve) => setTimeout(resolve, 1_000));
        current = await getCall(call.id);
      }
      if (current.status !== 'accepted') {
        throw new Error(current.status === 'missed' ? 'The call was not answered.' : 'The call ended before it connected.');
      }
      const token = await getCallLiveKitToken(current.id);
      router.push({ pathname: '/call', params: { callId: String(current.id), token: token.token, serverUrl: token.url, kind, remoteName: freshChat.name, returnPath: 'inbox' } });
    } catch (error) {
      Alert.alert('Could not start call', error instanceof Error ? error.message : 'Calling is not available right now.');
    } finally {
      setStartingCall(null);
    }
  };
  return <KeyboardAvoidingView behavior="padding" style={[styles.conversation, { backgroundColor: colors.background }]}><View style={[styles.chatHeader, { paddingTop: insets.top + 5, borderBottomColor: colors.border }]}><IconButton icon="chevron-back" onPress={onBack} accessibilityLabel="Back to messages" /><Avatar source={freshChat.avatar} size={35} /><View style={styles.chatHeaderCopy}><Text style={[styles.chatHeaderName, { color: colors.foreground }]}>{freshChat.name}</Text><Text style={[styles.chatHeaderHandle, { color: colors.mutedForeground }]}>@{freshChat.handle}</Text></View><View style={styles.callActions}><Pressable accessibilityRole="button" accessibilityLabel={`Call ${freshChat.name}`} disabled={Boolean(startingCall)} onPress={() => void startCall('audio')} style={[styles.callButton, { borderColor: colors.border, opacity: startingCall && startingCall !== 'audio' ? 0.45 : 1 }]}><Ionicons name="call-outline" size={17} color={colors.foreground} /></Pressable><Pressable accessibilityRole="button" accessibilityLabel={`Video call ${freshChat.name}`} disabled={Boolean(startingCall)} onPress={() => void startCall('video')} style={[styles.callButton, { borderColor: colors.border, opacity: startingCall && startingCall !== 'video' ? 0.45 : 1 }]}><Ionicons name="videocam-outline" size={18} color={colors.foreground} /></Pressable></View></View><ScrollView contentContainerStyle={[styles.messageList, { paddingBottom: TAB_BAR_CONTENT_CLEARANCE }]} keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive">{freshChat.messages.map((item) => <View key={item.id} style={[styles.messageLine, item.fromMe && styles.messageLineMe]}><View style={[styles.messageBubble, { backgroundColor: item.fromMe ? colors.primary : colors.card, borderColor: colors.border }]}><Text style={[styles.messageText, { color: item.fromMe ? colors.primaryForeground : colors.foreground }]}>{item.text}</Text></View><Text style={[styles.messageStamp, { color: colors.mutedForeground }]}>{item.createdAt}</Text></View>)}</ScrollView><View style={[styles.messageComposer, { paddingBottom: Math.max(insets.bottom, TAB_BAR_CONTENT_CLEARANCE - 12), backgroundColor: colors.background, borderTopColor: colors.border }]}><View style={[styles.messageInputWrap, { backgroundColor: colors.card, borderColor: colors.border }]}><TextInput value={message} onChangeText={setMessage} onSubmitEditing={() => void submit()} placeholder="Write a message..." placeholderTextColor={colors.mutedForeground} style={[styles.messageInput, { color: colors.foreground }]} returnKeyType="send" editable={!sending} /><Pressable disabled={!message.trim() || sending} onPress={() => void submit()} style={[styles.messageSend, { backgroundColor: message.trim() && !sending ? colors.primary : colors.muted }]}><Ionicons name="arrow-up" size={17} color={message.trim() && !sending ? colors.primaryForeground : colors.mutedForeground} /></Pressable></View></View></KeyboardAvoidingView>;
}

export default function InboxScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { chats } = useOldTime();
  const [selectedChat, setSelectedChat] = useState<Chat | null>(null);
  const [newChatVisible, setNewChatVisible] = useState(false);

  if (selectedChat) {
    return <Conversation chat={selectedChat} onBack={() => setSelectedChat(null)} />;
  }

  return (
    <ScrollView
      style={[styles.screen, { backgroundColor: colors.background }]}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 12, paddingBottom: TAB_BAR_CONTENT_CLEARANCE }]}
      showsVerticalScrollIndicator={false}
    >
       <View style={styles.header}>
         <Text style={[styles.title, { color: colors.foreground }]}>Chat</Text>
        <Pressable accessibilityRole="button" accessibilityLabel="Start a new message" onPress={() => setNewChatVisible(true)} style={[styles.newMessageButton, { backgroundColor: colors.primary }]}><Ionicons name="create-outline" size={18} color={colors.primaryForeground} /><Text style={[styles.newMessageText, { color: colors.primaryForeground }]}>New</Text></Pressable>
      </View>
      <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your conversations</Text>
      {chats.length ? <View style={[styles.chatList, { borderColor: colors.border, backgroundColor: colors.card }]}>{chats.map((chat) => <ChatRow key={chat.id} chat={chat} onPress={() => setSelectedChat(chat)} />)}</View> : <View style={styles.empty}><Ionicons name="chatbubbles-outline" size={34} color={colors.primary} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No conversations yet.</Text><Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>Start a new message to talk with someone from Community.</Text><Pressable onPress={() => setNewChatVisible(true)} style={[styles.emptyButton, { backgroundColor: colors.primary }]}><Text style={{ color: colors.primaryForeground, fontWeight: '800' }}>Start a conversation</Text></Pressable></View>}
      <NewChatModal visible={newChatVisible} onClose={() => setNewChatVisible(false)} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  eyebrow: { fontFamily: 'Outfit_700Bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 4 },
  title: { fontFamily: 'Fraunces_900Black', fontSize: 36, letterSpacing: -1.2 },
  newMessageButton: { borderRadius: 20, paddingHorizontal: 16, paddingVertical: 10, flexDirection: 'row', alignItems: 'center', gap: 6 },
  newMessageText: { fontFamily: 'Outfit_700Bold', fontSize: 13 },
  sectionTitle: { fontFamily: 'Outfit_700Bold', fontSize: 18, marginBottom: 14 },
  chatList: { borderWidth: 1, borderRadius: 22, paddingHorizontal: 16 },
  chatRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  chatCopy: { flex: 1 },
  chatName: { fontFamily: 'Outfit_700Bold', fontSize: 16, marginBottom: 4 },
  chatPreview: { fontFamily: 'Outfit_400Regular', fontSize: 14 },
  chatTime: { fontFamily: 'Outfit_500Medium', fontSize: 12 },
  unread: { minWidth: 24, height: 24, paddingHorizontal: 6, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  conversation: { flex: 1 },
  chatHeader: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 10, paddingBottom: 10 },
  chatHeaderCopy: { flex: 1, marginLeft: 10 },
  chatHeaderName: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  chatHeaderHandle: { fontFamily: 'Outfit_400Regular', fontSize: 12, marginTop: 2 },
  callActions: { flexDirection: 'row', gap: 8, marginLeft: 10 },
  callButton: { width: 36, height: 36, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  messageList: { padding: 20, gap: 16 },
  messageLine: { alignItems: 'flex-start' },
  messageLineMe: { alignItems: 'flex-end' },
  messageBubble: { maxWidth: '82%', borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 12 },
  messageText: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 22 },
  messageStamp: { fontFamily: 'Outfit_500Medium', fontSize: 11, marginTop: 6, paddingHorizontal: 4 },
  messageComposer: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingTop: 10 },
  messageInputWrap: { minHeight: 52, borderRadius: 26, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 18, paddingRight: 6 },
  messageInput: { flex: 1, fontFamily: 'Outfit_400Regular', fontSize: 15 },
  messageSend: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(28,22,20,0.52)' },
  newChatSheet: { minHeight: '62%', maxHeight: '86%', borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20 },
  sheetHandle: { alignSelf: 'center', marginTop: 12, marginBottom: 8, width: 48, height: 5, borderRadius: 3, backgroundColor: '#E3DDD1' },
  newChatHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
  newChatTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 22, marginLeft: 4 },
  searchWrap: { height: 50, borderWidth: 1, borderRadius: 18, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16 },
  searchInput: { flex: 1, fontFamily: 'Outfit_500Medium', fontSize: 15 },
  peopleList: { paddingVertical: 10 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 14, borderBottomWidth: StyleSheet.hairlineWidth },
  personCopy: { flex: 1 },
  personName: { fontFamily: 'Outfit_700Bold', fontSize: 15 },
  personHandle: { fontFamily: 'Outfit_500Medium', fontSize: 13, marginTop: 4 },
  noPeople: { textAlign: 'center', paddingTop: 36, fontFamily: 'Outfit_500Medium', fontSize: 15 },
  emptyButton: { borderRadius: 24, paddingHorizontal: 20, paddingVertical: 14, marginTop: 20 },
  empty: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 52 },
  emptyTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 20, marginTop: 16 },
  emptyBody: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8 },
});