import { Ionicons } from '@expo/vector-icons';
import {
  createCurrentEventMessage,
  getCurrentEventMessages,
  getCurrentEventLiveKitToken,
  getCurrentEventRoom,
  getCurrentEventWallet,
  joinCurrentEventRoom,
  leaveCurrentEventRoom,
  sendCurrentEventGift,
  setCurrentEventHand,
  updateCurrentEventParticipant,
  type CurrentEventMessage,
  type CurrentEventParticipant,
  type CurrentEventRoom,
} from '@workspace/api-client-react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  Share,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui';
import { useColors } from '@/hooks/useColors';
import { useRevenueCat } from '@/lib/revenuecat';
import { audioService } from '@/lib/audio-service';
import { useApp } from '@/context/app-state';
import { apiBaseUrl } from '@/lib/api-base-url';
import { io } from 'socket.io-client';

const gifts = [
  { key: 'coffee' as const, label: 'Coffee', icon: 'cafe-outline' as const, cost: 25 },
  { key: 'idea' as const, label: 'Idea', icon: 'bulb-outline' as const, cost: 100 },
  { key: 'heart' as const, label: 'Heart', icon: 'heart-outline' as const, cost: 200 },
  { key: 'gem' as const, label: 'Gem', icon: 'diamond-outline' as const, cost: 500 },
  { key: 'studio' as const, label: 'Studio', icon: 'radio-outline' as const, cost: 1000 },
];

function mergeMessages(current: CurrentEventMessage[], incoming: CurrentEventMessage[]) {
  const byId = new Map(current.map((item) => [item.id, item]));
  for (const item of incoming) byId.set(item.id, item);
  return [...byId.values()].sort((left, right) => left.createdAt - right.createdAt || left.id - right.id);
}

function roleLabel(role: CurrentEventParticipant['role']) {
  if (role === 'host') return 'Host';
  if (role === 'moderator') return 'Moderator';
  if (role === 'speaker') return 'Speaker';
  return 'Listener';
}

export default function CurrentEventRoomScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { session } = useApp();
  const params = useLocalSearchParams<{ id: string }>();
  const roomId = Number(params.id);
  const [room, setRoom] = useState<CurrentEventRoom | null>(null);
  const [messages, setMessages] = useState<CurrentEventMessage[]>([]);
  const [wallet, setWallet] = useState({ coins: 0, gold: 0, pendingGold: 0 });
  const [loading, setLoading] = useState(true);
  const [chatOpen, setChatOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [storeOpen, setStoreOpen] = useState(false);
  const [verifyPromptOpen, setVerifyPromptOpen] = useState(false);
  const [verifyPromptDismissed, setVerifyPromptDismissed] = useState(false);
  const revenueCat = useRevenueCat();
  const [message, setMessage] = useState('');
  const [giftRecipientId, setGiftRecipientId] = useState<number | null>(null);
  const [reactionCount, setReactionCount] = useState(0);
  const [roomUnavailable, setRoomUnavailable] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [audioState, setAudioState] = useState<'idle' | 'connecting' | 'live' | 'error'>('idle');
  const [audioMuted, setAudioMuted] = useState(false);
  const roomEndedRef = useRef(false);

  const loadRoom = useCallback(async (join = false) => {
    if (!Number.isInteger(roomId) || roomId < 1) return;
    try {
      let nextRoom = await getCurrentEventRoom(roomId);
      if (!nextRoom.isLive) {
        roomEndedRef.current = true;
        setRoom(nextRoom);
        return;
      }
      if (join && nextRoom.viewer.participantId === null) {
        nextRoom = await joinCurrentEventRoom(roomId);
      }
      setRoom(nextRoom);
      setRoomUnavailable(false);
      if (nextRoom.viewer.participantId !== null) {
        const [messageResult, walletResult] = await Promise.all([
          getCurrentEventMessages(roomId),
          getCurrentEventWallet(),
        ]);
        setMessages((current) => mergeMessages(current, messageResult.items));
        setWallet(walletResult);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : '';
      if (/404|not found/i.test(message)) {
        roomEndedRef.current = true;
        setRoomUnavailable(true);
        return;
      }
      setFeedback(error instanceof Error ? error.message : 'Room unavailable.');
    } finally {
      setLoading(false);
    }
  }, [roomId, router]);

  useEffect(() => {
    void loadRoom(true);
    const interval = setInterval(() => {
      if (!roomEndedRef.current) void loadRoom(false);
    }, 5_000);
    return () => {
      clearInterval(interval);
    };
  }, [loadRoom]);

  useEffect(() => {
    if (!session?.authToken || !room?.isLive || room.viewer.participantId === null || !Number.isInteger(roomId) || roomId < 1) return;
    const socket = io(apiBaseUrl(), {
      auth: { token: session.authToken },
      reconnection: true,
    });
    const refreshRoom = (payload?: { roomId?: unknown }) => {
      if (!payload || payload.roomId === roomId) void loadRoom(false);
    };
    const receiveMessage = (payload: unknown) => {
      if (!payload || typeof payload !== 'object') return;
      const incoming = payload as CurrentEventMessage;
      if (incoming.roomId !== roomId || !Number.isInteger(incoming.id)) return;
      setMessages((current) => mergeMessages(current, [incoming]));
    };
    const joinRoom = () => socket.emit('join-current-event', { roomId });

    socket.on('connect', joinRoom);
    socket.on('current-event-message', receiveMessage);
    socket.on('current-event-room-updated', refreshRoom);
    return () => {
      socket.emit('leave-current-event', { roomId });
      socket.off('connect', joinRoom);
      socket.off('current-event-message', receiveMessage);
      socket.off('current-event-room-updated', refreshRoom);
      socket.disconnect();
    };
  }, [loadRoom, room?.isLive, room?.viewer.participantId, roomId, session?.authToken]);

  const connectAudio = useCallback(async () => {
    if (!room || room.viewer.participantId === null) return;
    setAudioState('connecting');
    try {
      const token = await getCurrentEventLiveKitToken(room.id);
      await audioService.join(room.id, room.viewer.role ?? 'listener', { ...token, canPublish: token.canPublish });
      setAudioMuted(room.viewer.muted || !token.canPublish);
      if (room.viewer.muted) await audioService.setMuted(true);
      setAudioState('live');
    } catch (error) {
      setAudioState('error');
      setFeedback(error instanceof Error ? error.message : 'Audio could not connect.');
    }
  }, [room]);

  useEffect(() => {
    if (room?.viewer.participantId !== null && room?.isLive) void connectAudio();
    return () => { void audioService.leave(); };
  // Reconnect only when this viewer enters/leaves a room, not on chat polling.
  // `connectAudio` intentionally reads the room snapshot from this render.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room?.id, room?.viewer.participantId, room?.isLive]);

  const speakers = useMemo(() => room?.participants.filter((participant) => ['host', 'moderator', 'speaker'].includes(participant.role)) ?? [], [room]);
  const listeners = useMemo(() => room?.participants.filter((participant) => participant.role === 'listener') ?? [], [room]);
  const canModerate = room?.viewer.role === 'host' || room?.viewer.role === 'moderator';
  const activeRecipientId = giftRecipientId ?? speakers.find((participant) => participant.user.id !== room?.viewer.participantId)?.user.id ?? speakers[0]?.user.id ?? null;

  useEffect(() => {
    if (room?.viewer.role === 'host' && !session?.phoneVerified && !verifyPromptDismissed) {
      setVerifyPromptOpen(true);
    } else {
      setVerifyPromptOpen(false);
    }
  }, [room?.viewer.role, session?.phoneVerified, verifyPromptDismissed]);

  async function leaveRoom() {
    if (room?.isLive && room.viewer.participantId !== null) await leaveCurrentEventRoom(room.id).catch(() => undefined);
    await audioService.leave();
    router.back();
  }

  function confirmLeaveRoom() {
    if (room?.viewer.role === 'host') {
      Alert.alert('End room?', 'This ends the room for everyone and clears its unsaved chat.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'End room', style: 'destructive', onPress: () => void leaveRoom() },
      ]);
      return;
    }
    void leaveRoom();
  }

  async function moderate(participant: CurrentEventParticipant, action: 'promote' | 'mute' | 'unmute' | 'remove') {
    if (!room) return;
    try {
      const nextRoom = await updateCurrentEventParticipant(room.id, participant.id, { action });
      setRoom(nextRoom);
      if (participant.id === room.viewer.participantId && (action === 'mute' || action === 'unmute')) {
        const nextMuted = action === 'mute';
        setAudioMuted(nextMuted);
        await audioService.setMuted(nextMuted);
      }
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Moderation unavailable.');
    }
  }

  async function sendMessage() {
    if (!room || !message.trim()) return;
    try {
      const sent = await createCurrentEventMessage(room.id, { content: message.trim() });
      setMessages((items) => mergeMessages(items, [sent]));
      setMessage('');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Message not sent.');
    }
  }

  async function sendGift(gift: (typeof gifts)[number]) {
    if (!room || !activeRecipientId) return;
    if (wallet.coins < gift.cost) {
      setGiftOpen(false);
      setStoreOpen(true);
      return;
    }
    try {
      const result = await sendCurrentEventGift(room.id, { gift: gift.key, recipientId: activeRecipientId });
      setWallet((current) => ({ ...current, coins: result.coinsRemaining }));
      setGiftOpen(false);
      setFeedback('Gift sent.');
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Gift not sent.');
    }
  }

  async function shareRoom() {
    if (!room) return;
    try {
      await Share.share({
        message: `Join me in Access: ${room.title}`,
      });
    } catch {}
  }

  async function promoteFromPeople(participant: CurrentEventParticipant) {
    await moderate(participant, 'promote');
    setPeopleOpen(false);
  }

  async function raiseHand() {
    if (!room || room.viewer.role !== 'listener') return;
    try {
      const nextRoom = await setCurrentEventHand(room.id, { raised: !room.viewer.handRaised });
      setRoom(nextRoom);
    } catch (error) {
      setFeedback(error instanceof Error ? error.message : 'Could not update hand raise.');
    }
  }

  if (loading || (!room && !roomUnavailable)) {
    return <View style={[styles.loading, { backgroundColor: colors.background }]}><ActivityIndicator color={colors.primary} /></View>;
  }

  if (roomUnavailable || !room) {
    return <EndedRoomState colors={colors} topInset={insets.top} onBack={() => router.back()} />;
  }

  if (!room.isLive) {
    return <EndedRoomState colors={colors} topInset={insets.top} onBack={() => router.back()} />;
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={confirmLeaveRoom} accessibilityLabel="Leave Access room" style={styles.headerButton}>
          <Ionicons name="chevron-down" size={25} color={colors.foreground} />
        </Pressable>
        <View pointerEvents="none" style={styles.headerCenter}>
          <Text style={[styles.headerKicker, { color: colors.mutedForeground }]}>ACCESS</Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]} numberOfLines={1}>{room.title}</Text>
        </View>
        <Pressable onPress={() => setPeopleOpen(true)} accessibilityLabel="Open people panel" style={styles.headerButton}>
          <Ionicons name="people-outline" size={22} color={colors.foreground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 112 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.liveRow}>
          <View style={styles.livePill}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
          <Text style={[styles.listenerSummary, { color: colors.mutedForeground }]}>{room.counts.speakers} speakers · {room.counts.listeners} listeners</Text>
          <Pressable onPress={() => setStoreOpen(true)}><Text style={[styles.coinBalance, { color: colors.foreground }]}>◈ {wallet.coins}  +</Text></Pressable>
        </View>

        {audioState !== 'live' ? (
          <View style={[styles.audioNotice, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Ionicons name={audioState === 'error' ? 'warning-outline' : 'volume-high-outline'} size={18} color={colors.mutedForeground} />
            <Text style={[styles.audioNoticeText, { color: colors.mutedForeground }]}>{audioState === 'connecting' ? 'Connecting audio…' : audioState === 'error' ? 'Audio did not connect.' : 'Preparing audio…'}</Text>
            {audioState === 'error' ? <Pressable onPress={() => void connectAudio()}><Text style={{ color: colors.primary, fontSize: 12, fontWeight: '600' }}>Retry</Text></Pressable> : null}
          </View>
        ) : null}
        {feedback ? (
          <Pressable onPress={() => setFeedback(null)} style={[styles.feedback, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Text style={[styles.feedbackText, { color: colors.foreground }]}>{feedback}</Text>
          </Pressable>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Stage</Text>
        <View style={styles.stageGrid}>
          {speakers.map((participant) => (
            <Pressable key={participant.id} onPress={() => setGiftRecipientId(participant.user.id)} style={[styles.speakerCard, { backgroundColor: colors.card, borderColor: activeRecipientId === participant.user.id ? colors.primary : colors.border }, activeRecipientId === participant.user.id && styles.speakerCardSelected]}>
              <View style={[styles.avatarRing, { borderColor: participant.role === 'host' ? colors.destructive : colors.primary }]}><Avatar name={participant.user.name} size={58} color={participant.role === 'host' ? colors.destructive : colors.primary} /></View>
              <Text style={[styles.speakerName, { color: colors.foreground }]} numberOfLines={1}>{participant.user.name}</Text>
              <Text style={[styles.speakerRole, { color: colors.mutedForeground }]}>{participant.role === 'host' ? 'host' : participant.role}</Text>
              <Ionicons name={participant.muted ? 'mic-off' : 'radio'} size={14} color={participant.muted ? colors.mutedForeground : colors.primary} />
            </Pressable>
          ))}
          {speakers.length === 0 ? <Text style={[styles.noSpeakers, { backgroundColor: colors.card, color: colors.mutedForeground, borderColor: colors.border }]}>No speakers yet.</Text> : null}
        </View>

        {canModerate ? (
          <View style={[styles.moderationPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>Moderator controls</Text>
            <Text style={[styles.peopleHeading, { color: colors.mutedForeground }]}>HAND RAISES</Text>
            {room.participants.filter((participant) => participant.role === 'listener' && participant.handRaised).map((participant) => (
              <View key={`hand-${participant.id}`} style={styles.controlRow}>
                <Avatar name={participant.user.name} size={30} color={colors.primary} />
                <Text style={[styles.controlName, { color: colors.foreground }]}>{participant.user.name} raised hand</Text>
                <Pressable onPress={() => void moderate(participant, 'promote')} style={[styles.smallAction, { backgroundColor: colors.muted }]}><Text style={[styles.smallActionText, { color: colors.primary }]}>Invite</Text></Pressable>
              </View>
            ))}
            {room.participants.filter((participant) => participant.role === 'listener' && participant.handRaised).length === 0 ? <Text style={styles.mutedNote}>No hands raised.</Text> : null}
            <Text style={[styles.peopleHeading, { color: colors.mutedForeground }]}>PARTICIPANTS</Text>
            {room.participants.filter((participant) => participant.role !== 'host').slice(0, 6).map((participant) => (
              <View key={participant.id} style={styles.controlRow}>
                <Avatar name={participant.user.name} size={30} color={colors.primary} />
                <Text style={[styles.controlName, { color: colors.foreground }]}>{participant.user.name}</Text>
                {participant.role === 'listener' ? <Pressable onPress={() => void moderate(participant, 'promote')} style={[styles.smallAction, { backgroundColor: colors.muted }]}><Text style={[styles.smallActionText, { color: colors.primary }]}>Stage</Text></Pressable> : null}
                {participant.role !== 'listener' ? <Pressable onPress={() => void moderate(participant, participant.muted ? 'unmute' : 'mute')} style={[styles.smallAction, { backgroundColor: colors.muted }]}><Text style={[styles.smallActionText, { color: colors.primary }]}>{participant.muted ? 'Unmute' : 'Mute'}</Text></Pressable> : null}
              </View>
            ))}
            {room.participants.filter((participant) => participant.role !== 'host').length === 0 ? <Text style={styles.mutedNote}>No one else is in this room yet.</Text> : null}
          </View>
        ) : null}

        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Listeners</Text>
        <View style={styles.listenerRow}>
          {listeners.map((participant) => (
            <View key={participant.id} style={styles.listener}>
              <Avatar name={participant.user.name} size={38} color={colors.foreground} />
              <Text style={[styles.listenerName, { color: colors.foreground }]} numberOfLines={1}>{participant.user.name}</Text>
            </View>
          ))}
          {listeners.length === 0 ? <Text style={styles.mutedNote}>No listeners yet.</Text> : null}
        </View>

        <View style={styles.roomActions}>
          {['host', 'moderator', 'speaker'].includes(room.viewer.role ?? '') ? <Pressable accessibilityRole="button" accessibilityLabel={audioMuted ? 'Unmute microphone in Access room' : 'Mute microphone in Access room'} onPress={() => { const next = !audioMuted; setAudioMuted(next); void audioService.setMuted(next); }} style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name={audioMuted ? 'mic-off-outline' : 'mic-outline'} size={20} color={colors.foreground} />
            <Text style={[styles.actionText, { color: colors.foreground }]}>{audioMuted ? 'unmute' : 'mute'}</Text>
          </Pressable> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Open Access chat" onPress={() => setChatOpen(true)} style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="chatbubble-outline" size={20} color={colors.foreground} />
            <Text style={[styles.actionText, { color: colors.foreground }]}>chat</Text>
          </Pressable>
          {room.viewer.role === 'listener' ? <Pressable accessibilityRole="button" accessibilityLabel={room.viewer.handRaised ? 'Lower your hand' : 'Raise your hand to speak'} onPress={() => void raiseHand()} style={[styles.actionButton, { backgroundColor: room.viewer.handRaised ? colors.primary : colors.card, borderColor: colors.border }]}>
            <Ionicons name="hand-left-outline" size={20} color={room.viewer.handRaised ? colors.primaryForeground : colors.foreground} />
            <Text style={[styles.actionText, { color: room.viewer.handRaised ? colors.primaryForeground : colors.foreground }]}>{room.viewer.handRaised ? 'hand up' : 'raise hand'}</Text>
          </Pressable> : room.viewer.handRaised ? <View style={[styles.actionButton, { backgroundColor: colors.muted, borderColor: colors.border, opacity: 0.75 }]}>
            <Ionicons name="hand-left-outline" size={20} color={colors.mutedForeground} />
            <Text style={[styles.actionText, { color: colors.mutedForeground }]}>hand up</Text>
          </View> : null}
          <Pressable accessibilityRole="button" accessibilityLabel="Send reaction in Access room" onPress={() => setReactionCount((count) => count + 1)} style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="heart-outline" size={20} color={colors.foreground} />
            <Text style={[styles.actionText, { color: colors.foreground }]}>{reactionCount || 'react'}</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Open supporter gifts in Access room" onPress={() => setGiftOpen(true)} style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="gift-outline" size={20} color={colors.foreground} />
            <Text style={[styles.actionText, { color: colors.foreground }]}>support</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Open people in Access room" onPress={() => setPeopleOpen(true)} style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="people-outline" size={20} color={colors.foreground} />
            <Text style={[styles.actionText, { color: colors.foreground }]}>people</Text>
          </Pressable>
          <Pressable accessibilityRole="button" accessibilityLabel="Share Access room" onPress={() => void shareRoom()} style={[styles.actionButton, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="share-social-outline" size={20} color={colors.foreground} />
            <Text style={[styles.actionText, { color: colors.foreground }]}>share</Text>
          </Pressable>
        </View>
      </ScrollView>

      <View style={[styles.leaveBar, { backgroundColor: colors.background, paddingBottom: insets.bottom + 10 }]}>
        <Pressable onPress={confirmLeaveRoom} style={[styles.leaveButton, { backgroundColor: colors.destructive }]}><Ionicons name="exit-outline" size={19} color={colors.destructiveForeground} /><Text style={[styles.leaveText, { color: colors.destructiveForeground }]}>{room.viewer.role === 'host' ? 'end room' : 'leave quietly'}</Text></Pressable>
      </View>

      <Modal visible={peopleOpen} animationType="slide" transparent onRequestClose={() => setPeopleOpen(false)}>
        <KeyboardAvoidingView behavior="padding" style={styles.modalRoot}>
          <Pressable style={styles.modalShade} accessibilityRole="button" accessibilityLabel="Close people panel" onPress={() => setPeopleOpen(false)} />
          <View accessible accessibilityLabel="People panel" accessibilityViewIsModal style={[styles.chatSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 10 }]}>
            <View style={styles.sheetHeader}><Text style={[styles.sheetTitle, { color: colors.foreground }]}>People</Text><Pressable accessibilityRole="button" accessibilityLabel="Close people panel" onPress={() => setPeopleOpen(false)}><Ionicons name="close" size={24} color={colors.foreground} /></Pressable></View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <Text style={[styles.peopleHeading, { color: colors.mutedForeground }]}>HOSTS & SPEAKERS</Text>
              {speakers.map((participant) => (
                <View key={participant.id} style={styles.controlRow}>
                  <Avatar name={participant.user.name} size={30} color={colors.primary} />
                  <Text style={[styles.controlName, { color: colors.foreground }]}>{participant.user.name} · {roleLabel(participant.role)}</Text>
                  {canModerate && participant.id !== room.viewer.participantId && participant.role !== 'host' ? <Pressable onPress={() => void moderate(participant, participant.muted ? 'unmute' : 'mute')} style={[styles.smallAction, { backgroundColor: colors.muted }]}><Text style={[styles.smallActionText, { color: colors.primary }]}>{participant.muted ? 'Unmute' : 'Mute'}</Text></Pressable> : null}
                </View>
              ))}
              <Text style={[styles.peopleHeading, { color: colors.mutedForeground }]}>AUDIENCE</Text>
              {listeners.length === 0 ? <Text style={[styles.mutedNote, { color: colors.mutedForeground }]}>No listeners right now.</Text> : listeners.map((participant) => (
                <View key={participant.id} style={styles.controlRow}>
                  <Avatar name={participant.user.name} size={30} color={colors.foreground} />
                  <Text style={[styles.controlName, { color: colors.foreground }]}>{participant.user.name}{participant.handRaised ? ' · hand raised' : ''}</Text>
                  {canModerate && participant.handRaised ? <Pressable onPress={() => void promoteFromPeople(participant)} style={[styles.smallAction, { backgroundColor: colors.muted }]}><Text style={[styles.smallActionText, { color: colors.primary }]}>Invite to speak</Text></Pressable> : null}
                </View>
              ))}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={chatOpen} animationType="slide" transparent onRequestClose={() => setChatOpen(false)}>
        <KeyboardAvoidingView behavior="padding" style={styles.modalRoot}>
          <Pressable style={styles.modalShade} accessibilityRole="button" accessibilityLabel="Close chat panel" onPress={() => setChatOpen(false)} />
          <View accessible accessibilityLabel="Access chat panel" accessibilityViewIsModal style={[styles.chatSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 10 }]}>
            <View style={styles.sheetHeader}><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Access chat</Text><Pressable accessibilityRole="button" accessibilityLabel="Close chat panel" onPress={() => setChatOpen(false)}><Ionicons name="close" size={24} color={colors.foreground} /></Pressable></View>
            <FlatList
              data={[...messages].reverse()}
              inverted
              keyExtractor={(item) => String(item.id)}
              contentContainerStyle={styles.messageList}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => <View style={[styles.message, { backgroundColor: colors.muted }]}><Text style={[styles.messageAuthor, { color: colors.primary }]}>{item.sender.name}</Text><Text style={[styles.messageText, { color: colors.foreground }]}>{item.content}</Text></View>}
              ListEmptyComponent={<Text style={[styles.mutedNote, { color: colors.mutedForeground }]}>Be the first to say hello.</Text>}
            />
            <View style={styles.messageComposer}>
              <TextInput value={message} onChangeText={setMessage} placeholder="Say something..." placeholderTextColor={colors.mutedForeground} style={[styles.messageInput, { backgroundColor: colors.muted, color: colors.foreground }]} returnKeyType="send" onSubmitEditing={() => void sendMessage()} />
              <Pressable onPress={() => void sendMessage()} style={[styles.sendButton, { backgroundColor: colors.primary }]}><Ionicons name="arrow-up" size={19} color={colors.primaryForeground} /></Pressable>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={giftOpen} transparent animationType="slide" onRequestClose={() => setGiftOpen(false)}>
        <View style={styles.modalShadeRoot}><View style={styles.modalShade} /><View style={[styles.giftSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetHeader}><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Send a gift</Text><Pressable onPress={() => setGiftOpen(false)}><Ionicons name="close" size={24} color={colors.foreground} /></Pressable></View>
          <Text style={[styles.sheetHint, { color: colors.mutedForeground }]}>{activeRecipientId ? 'Choose a gift.' : 'Choose a speaker.'}</Text>
          <View style={styles.giftGrid}>{gifts.map((gift) => <Pressable key={gift.key} disabled={!activeRecipientId} onPress={() => void sendGift(gift)} style={[styles.giftItem, { backgroundColor: colors.muted }, !activeRecipientId && { opacity: 0.45 }]}><Ionicons name={gift.icon} size={25} color={colors.primary} /><Text style={[styles.giftLabel, { color: colors.foreground }]}>{gift.label}</Text><Text style={[styles.giftCost, { color: colors.mutedForeground }]}>◈ {gift.cost}</Text></Pressable>)}</View>
           <Text style={[styles.walletBalance, { color: colors.mutedForeground }]}>Balance ◈ {wallet.coins}</Text>
        </View></View>
      </Modal>

      <Modal visible={storeOpen} transparent animationType="slide" onRequestClose={() => setStoreOpen(false)}>
        <View style={styles.modalShadeRoot}><View style={styles.modalShade} /><View style={[styles.giftSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 20 }]}>
          <View style={styles.sheetHeader}><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Get coins</Text><Pressable onPress={() => setStoreOpen(false)}><Ionicons name="close" size={24} color={colors.foreground} /></Pressable></View>
          <Text style={[styles.sheetHint, { color: colors.mutedForeground }]}>Use coins to support speakers. Prices are shown by the App Store.</Text>
          {revenueCat.loading ? <ActivityIndicator color={colors.primary} /> : revenueCat.packages.map((item) => (
            <Pressable key={item.identifier} disabled={revenueCat.purchasing} onPress={async () => {
              try {
                const credited = await revenueCat.purchase(item);
                const nextWallet = await getCurrentEventWallet();
                setWallet(nextWallet);
                setFeedback(`${credited} coins added.`);
              } catch (error: any) {
                if (!error?.userCancelled) setFeedback(error?.message ?? 'Purchase unavailable.');
              }
            }} style={[styles.packRow, { backgroundColor: colors.muted, opacity: revenueCat.purchasing ? 0.55 : 1 }]}>
              <View><Text style={[styles.packName, { color: colors.foreground }]}>{item.product.title}</Text><Text style={[styles.packCoins, { color: colors.mutedForeground }]}>{item.product.description || 'Access coins'}</Text></View>
              <Text style={[styles.packName, { color: colors.primary }]}>{item.product.priceString}</Text>
            </Pressable>
          ))}
          {!revenueCat.loading && revenueCat.packages.length === 0 ? <Text style={[styles.sheetHint, { color: colors.mutedForeground }]}>Coin packs are not available from this store yet.</Text> : null}
          <Pressable disabled={revenueCat.purchasing} onPress={async () => {
            try {
              const credited = await revenueCat.restore();
              setWallet(await getCurrentEventWallet());
              setFeedback(credited ? `${credited} coins restored.` : 'Wallet is up to date.');
            } catch (error: any) {
              setFeedback(error?.message ?? 'Restore unavailable.');
            }
          }} style={styles.walletLink}><Text style={[styles.walletLinkText, { color: colors.primary }]}>Restore purchases</Text></Pressable>
        </View></View>
      </Modal>

      <Modal visible={verifyPromptOpen} transparent animationType="fade" onRequestClose={() => setVerifyPromptOpen(false)}>
        <View style={styles.verifyShade}>
          <View accessibilityRole="alert" accessibilityLabel="Verification prompt" style={[styles.verifyCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.verifyTitle, { color: colors.foreground }]}>Get verified badge</Text>
            <Text style={[styles.verifyText, { color: colors.mutedForeground }]}>Get your verification badge to unlock Access host perks.</Text>
            <View style={styles.verifyActions}>
              <Pressable accessibilityRole="button" accessibilityLabel="Dismiss verification prompt" onPress={() => { setVerifyPromptDismissed(true); setVerifyPromptOpen(false); }}><Text style={[styles.verifyActionText, { color: colors.mutedForeground }]}>Later</Text></Pressable>
              <Pressable accessibilityRole="button" accessibilityLabel="Open settings to get verified" onPress={() => { setVerifyPromptOpen(false); router.push('/(tabs)/settings'); }} style={[styles.verifyButton, { backgroundColor: colors.primary }]}><Text style={[styles.verifyButtonText, { color: colors.primaryForeground }]}>Get verified</Text></Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function EndedRoomState({ colors, topInset, onBack }: { colors: any; topInset: number; onBack: () => void }) {
  return (
    <View style={[styles.endedRoot, { backgroundColor: colors.background, paddingTop: topInset }]}>
      <View style={[styles.endedHeader, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={onBack} accessibilityLabel="Back to Access" style={styles.headerButton}>
          <Ionicons name="chevron-down" size={25} color={colors.foreground} />
        </Pressable>
        <Text style={[styles.endedHeaderTitle, { color: colors.foreground }]}>Access</Text>
        <View style={styles.headerButton} />
      </View>
      <View style={styles.endedContent}>
        <Ionicons name="radio-outline" size={42} color={colors.mutedForeground} />
        <Text style={[styles.endedTitle, { color: colors.foreground }]}>This room has ended</Text>
        <Text style={[styles.endedText, { color: colors.mutedForeground }]}>The host closed this conversation. Go back to see what’s live now.</Text>
        <Pressable onPress={onBack} style={[styles.endedButton, { backgroundColor: colors.primary }]}>
          <Text style={{ color: colors.primaryForeground, fontWeight: '600' }}>Back to Access</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  endedRoot: { flex: 1 },
  endedHeader: { minHeight: 60, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  endedHeaderTitle: { fontSize: 24, lineHeight: 30, fontWeight: '600', letterSpacing: -0.4 },
  endedContent: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  endedTitle: { fontSize: 22, lineHeight: 28, fontWeight: '600', marginTop: 14 },
  endedText: { fontSize: 14, lineHeight: 19, textAlign: 'center', marginTop: 8, maxWidth: 290 },
  endedButton: { minHeight: 48, borderRadius: 24, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  header: { height: 64, paddingHorizontal: 12, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 42, height: 42, justifyContent: 'center', alignItems: 'center' },
  headerCenter: { position: 'absolute', left: 54, right: 54, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8 },
  headerKicker: { fontSize: 10, fontWeight: '600', letterSpacing: 1 },
  headerTitle: { fontSize: 17, fontWeight: '600', marginTop: 3 },
  content: { padding: 16 },
  liveRow: { flexDirection: 'row', alignItems: 'center', gap: 9, marginBottom: 14 },
  livePill: { backgroundColor: '#FCE8E8', borderRadius: 12, paddingHorizontal: 9, paddingVertical: 5, flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E5484D' },
  liveText: { color: '#C53030', fontSize: 10, fontWeight: '900' },
  listenerSummary: { fontSize: 12, fontWeight: '400', flex: 1 },
  coinBalance: { fontSize: 13, fontWeight: '600' },
  audioNotice: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  audioNoticeText: { flex: 1, fontSize: 12, lineHeight: 17, fontWeight: '400' },
  feedback: { borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 11, paddingVertical: 9, marginBottom: 14 },
  feedbackText: { fontSize: 12, fontWeight: '500' },
  sectionTitle: { fontSize: 17, lineHeight: 22, fontWeight: '600', marginTop: 8, marginBottom: 11 },
  stageGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  speakerCard: { width: '31%', minWidth: 98, alignItems: 'center', paddingVertical: 11, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth },
  speakerCardSelected: { borderWidth: 2 },
  avatarRing: { borderRadius: 34, padding: 3, borderWidth: 2, borderColor: '#D9E2FF' },
  speakerName: { fontSize: 12, fontWeight: '600', marginTop: 7, maxWidth: 88 },
  speakerRole: { fontSize: 10, fontWeight: '400', marginBottom: 4 },
  noSpeakers: { fontSize: 13, lineHeight: 19, padding: 16, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth },
  moderationPanel: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 13, marginTop: 17 },
  panelTitle: { fontSize: 13, fontWeight: '600', marginBottom: 8 },
  controlRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 6 },
  controlName: { flex: 1, fontSize: 12, fontWeight: '500' },
  smallAction: { borderRadius: 15, paddingHorizontal: 11, paddingVertical: 7 },
  smallActionText: { fontSize: 11, fontWeight: '600' },
  mutedNote: { fontSize: 12, fontWeight: '400', paddingVertical: 7 },
  listenerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 13, alignItems: 'flex-start' },
  listener: { alignItems: 'center', width: 52 },
  listenerName: { fontSize: 10, fontWeight: '500', marginTop: 4, maxWidth: 52 },
  roomActions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 24 },
  actionButton: { flexBasis: '31%', minWidth: 104, flexGrow: 1, minHeight: 52, borderRadius: 15, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', gap: 3 },
  actionButtonActive: { borderWidth: 0 },
  actionText: { fontSize: 10, fontWeight: '600' },
  leaveBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 16, paddingTop: 9 },
  leaveButton: { minHeight: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  leaveText: { fontWeight: '600' },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalShadeRoot: { flex: 1, justifyContent: 'flex-end' },
  modalShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  chatSheet: { height: '76%', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 16 },
  giftSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sheetTitle: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  sheetHint: { fontSize: 12, lineHeight: 17, marginBottom: 15 },
  messageList: { gap: 10, paddingBottom: 10 },
  message: { borderRadius: 13, padding: 10 },
  messageAuthor: { fontSize: 11, fontWeight: '600', marginBottom: 3 },
  messageText: { fontSize: 13, lineHeight: 18 },
  messageComposer: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingTop: 10 },
  messageInput: { flex: 1, minHeight: 44, borderRadius: 22, paddingHorizontal: 15 },
  sendButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  giftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  giftItem: { width: '18%', minWidth: 62, alignItems: 'center', paddingVertical: 10, borderRadius: 13, backgroundColor: '#fff' },
  giftLabel: { fontSize: 10, fontWeight: '600', marginTop: 5 },
  giftCost: { fontSize: 10, marginTop: 3, fontWeight: '400' },
  walletLink: { alignItems: 'center', paddingTop: 19 },
  walletLinkText: { fontSize: 12, fontWeight: '600' },
  walletBalance: { textAlign: 'center', fontSize: 12, paddingTop: 18 },
  packRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderRadius: 14, padding: 13, marginTop: 8 },
  packName: { fontSize: 14, fontWeight: '600' },
  packCoins: { fontSize: 12, marginTop: 3 },
  comingSoon: { fontSize: 11, fontWeight: '500' },
  peopleHeading: { marginTop: 8, marginBottom: 6, fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  verifyShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  verifyCard: { width: '100%', maxWidth: 360, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, padding: 18 },
  verifyTitle: { fontSize: 18, fontWeight: '700' },
  verifyText: { fontSize: 13, lineHeight: 19, marginTop: 7 },
  verifyActions: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  verifyActionText: { fontSize: 13, fontWeight: '600' },
  verifyButton: { minHeight: 40, paddingHorizontal: 14, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  verifyButtonText: { fontSize: 13, fontWeight: '700' },
});