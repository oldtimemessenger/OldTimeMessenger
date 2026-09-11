import { Ionicons } from '@expo/vector-icons';
import { getCurrentEventWallet, sendCurrentEventGift, type CurrentEventMessage, type CurrentEventParticipant, type CurrentEventParticipantAction, type CurrentEventRoom, type CurrentEventWallet, type CurrentEventGiftInput } from '@workspace/api-client-react';
import { useOldTime } from '@/context/OldTimeContext';
import { KeyboardAvoidingView } from 'react-native-keyboard-controller';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Animated, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/OldTimeUi';
import { useColors } from '@/hooks/useColors';
import type { CurrentEventGiftEvent } from '@/hooks/useAccessRoomController';
import { loadCoinPacks, purchaseCoinPack, restoreCoinPurchases, type CoinPack } from '@/lib/revenuecat';

const topicLabels: Record<string, string> = {
  politics: 'Politics',
  markets: 'Markets',
  tech: 'Tech',
  culture: 'Culture',
  sports: 'Sports',
  world: 'World',
};

type GiftMotion = 'float' | 'pulse' | 'beat' | 'shimmer' | 'broadcast' | 'video';

const gifts: Array<{ gift: CurrentEventGiftInput['gift']; name: string; cost: number; image: number; video?: number; motion: GiftMotion; benefit: string; colorKey: 'primary' | 'secondary' | 'accent' | 'destructive' }> = [
  { gift: 'coffee', name: 'Coffee', cost: 25, image: require('@/assets/gifts/coffee.png'), motion: 'float', benefit: '+1 min LIVE', colorKey: 'primary' },
  { gift: 'idea', name: 'Idea', cost: 100, image: require('@/assets/gifts/idea.png'), motion: 'pulse', benefit: '+5 min LIVE', colorKey: 'secondary' },
  { gift: 'heart', name: 'Heart', cost: 200, image: require('@/assets/gifts/heart.png'), motion: 'beat', benefit: '+15 min LIVE', colorKey: 'destructive' },
  { gift: 'gem', name: 'Gem', cost: 500, image: require('@/assets/gifts/gem.png'), motion: 'shimmer', benefit: '+30 min LIVE', colorKey: 'accent' },
  { gift: 'studio', name: 'Studio', cost: 1000, image: require('@/assets/gifts/studio.png'), motion: 'broadcast', benefit: '30 days camera access', colorKey: 'secondary' },
  { gift: 'time_is_up', name: 'Time is up', cost: 10000, image: require('@/assets/gifts/time-is-up.png'), video: require('@/assets/gifts/time-is-up.mp4'), motion: 'video', benefit: '+60 min LIVE', colorKey: 'primary' },
];

type Props = {
  room: CurrentEventRoom;
  messages: CurrentEventMessage[];
  giftEvents: CurrentEventGiftEvent[];
  audioConnected: boolean;
  micEnabled: boolean;
  onSendMessage: (body: string) => Promise<void>;
  onToggleMic: () => void;
  onLeave: () => void;
  onParticipantAction: (participantId: number, action: CurrentEventParticipantAction['action']) => Promise<void>;
};

function participantSource(_participant: CurrentEventParticipant) {
  return undefined;
}

function RoleLabel({ participant, light = false }: { participant: CurrentEventParticipant; light?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.roleLabel}>
      {participant.role === 'host' ? <View style={[styles.roleDot, { backgroundColor: colors.primary }]} /> : null}
      <Text style={[styles.roleText, { color: light ? colors.homeMutedForeground : colors.mutedForeground }]}>
        {participant.role === 'host' ? 'Host' : participant.role === 'moderator' ? 'Moderator' : 'Speaker'}
      </Text>
    </View>
  );
}

function StageCard({ participant, featured, selected, onSelect }: { participant: CurrentEventParticipant; featured?: boolean; selected: boolean; onSelect: () => void }) {
  const colors = useColors();
  const accent = participant.role === 'host' ? colors.primary : participant.role === 'moderator' ? colors.accent : colors.secondary;
  return (
    <Pressable onPress={onSelect} accessibilityRole="button" accessibilityLabel={`View ${participant.user.name}`} style={[featured ? styles.featuredSpeaker : styles.stageCard, { backgroundColor: featured ? colors.homeBorder : colors.card, borderColor: selected ? colors.primary : featured ? colors.homeBorder : colors.border }]}>
      <View style={[styles.avatarRing, { borderColor: accent }, featured && styles.featuredRing]}>
        <Avatar source={participantSource(participant)} size={featured ? 78 : 54} accent={accent} />
        {participant.muted ? <View style={[styles.muteBadge, { backgroundColor: colors.homeBackground, borderColor: colors.homeBackground }]}><Ionicons name="mic-off" size={11} color={colors.homeForeground} /></View> : null}
      </View>
      <Text numberOfLines={1} style={[featured ? styles.featuredName : styles.stageName, { color: colors.homeForeground }]}>{participant.user.name}</Text>
      <RoleLabel participant={participant} light />
      {!featured ? <Ionicons name={participant.muted ? 'mic-off' : 'mic'} size={13} color={participant.muted ? colors.homeMutedForeground : colors.primary} /> : null}
    </Pressable>
  );
}

function colorForGift(gift: (typeof gifts)[number], colors: ReturnType<typeof useColors>) {
  if (gift.colorKey === 'secondary') return colors.secondary;
  if (gift.colorKey === 'accent') return colors.accent;
  if (gift.colorKey === 'destructive') return colors.destructive;
  return colors.primary;
}

function giftBenefitText(event: CurrentEventGiftEvent) {
  return event.benefit.type === 'live_time'
    ? `Added ${event.benefit.minutes} ${event.benefit.minutes === 1 ? 'minute' : 'minutes'} to this LIVE`
    : `Unlocked camera access for ${event.benefit.days} days`;
}

function createGiftRequestKey() {
  return `gift-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function GiftMedia({ gift, large = false }: { gift: (typeof gifts)[number]; large?: boolean }) {
  const player = useVideoPlayer(gift.video ?? null, (instance) => {
    if (!gift.video) return;
    instance.loop = !large;
    instance.muted = !large;
    instance.play();
  });

  if (gift.video) {
    return <VideoView player={player} style={large ? styles.giftCelebrationVideo : styles.giftImage} contentFit="contain" nativeControls={false} />;
  }
  return <Image source={gift.image} contentFit="contain" style={large ? styles.giftCelebrationImage : styles.giftImage} />;
}

function AnimatedGiftMedia({ gift }: { gift: (typeof gifts)[number] }) {
  const progress = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (gift.motion === 'video') return;
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(progress, { toValue: 1, duration: gift.motion === 'beat' ? 340 : 700, useNativeDriver: true }),
        Animated.timing(progress, { toValue: 0, duration: gift.motion === 'beat' ? 340 : 700, useNativeDriver: true }),
      ]),
    );
    animation.start();
    return () => animation.stop();
  }, [gift.motion, progress]);

  const translateY = gift.motion === 'float'
    ? progress.interpolate({ inputRange: [0, 1], outputRange: [8, -10] })
    : 0;
  const scale = gift.motion === 'beat'
    ? progress.interpolate({ inputRange: [0, 1], outputRange: [0.92, 1.12] })
    : gift.motion === 'pulse' || gift.motion === 'broadcast'
      ? progress.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1.08] })
      : 1;
  const rotate = gift.motion === 'shimmer'
    ? progress.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '7deg'] })
    : '0deg';

  return (
    <Animated.View style={{ transform: [{ translateY }, { scale }, { rotate }] }}>
      <GiftMedia gift={gift} large />
    </Animated.View>
  );
}

export function AccessRoomUi({ room, messages, giftEvents, audioConnected, micEnabled, onSendMessage, onToggleMic, onLeave, onParticipantAction }: Props) {
  const colors = useColors();
  const { currentUserId } = useOldTime();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [chatOpen, setChatOpen] = useState(false);
  const [peopleOpen, setPeopleOpen] = useState(false);
  const [giftOpen, setGiftOpen] = useState(false);
  const [message, setMessage] = useState('');
  const [selectedParticipant, setSelectedParticipant] = useState<number | null>(null);
  const [selectedGift, setSelectedGift] = useState<CurrentEventGiftInput['gift']>('coffee');
  const [wallet, setWallet] = useState<CurrentEventWallet | null>(null);
  const [walletLoading, setWalletLoading] = useState(false);
  const [walletSyncing, setWalletSyncing] = useState(false);
  const [coinPacks, setCoinPacks] = useState<CoinPack[]>([]);
  const [coinPacksLoading, setCoinPacksLoading] = useState(false);
  const [coinPacksError, setCoinPacksError] = useState<string | null>(null);
  const [purchasingPack, setPurchasingPack] = useState<string | null>(null);
  const [giftSending, setGiftSending] = useState(false);
  const [giftError, setGiftError] = useState<string | null>(null);
  const [giftNotice, setGiftNotice] = useState<string | null>(null);
  const [giftQueue, setGiftQueue] = useState<CurrentEventGiftEvent[]>([]);
  const queuedGiftIds = useRef(new Set<number>());
  const [sending, setSending] = useState(false);
  const speakers = useMemo(() => room.participants.filter((participant) => participant.role === 'host' || participant.role === 'speaker' || participant.role === 'moderator'), [room.participants]);
  const listeners = useMemo(() => room.participants.filter((participant) => participant.role === 'listener'), [room.participants]);
  const giftRecipients = useMemo(
    () => room.participants.filter((participant) => String(participant.user.id) !== String(currentUserId)),
    [currentUserId, room.participants],
  );
  const canModerate = room.viewer.role === 'host' || room.viewer.role === 'moderator';
  const chosenGift = gifts.find((gift) => gift.gift === selectedGift) ?? gifts[0];
  const chosenRecipient = giftRecipients.find((participant) => participant.id === selectedParticipant) ?? giftRecipients[0];
  const leadSpeaker = speakers[0];
  const celebrationEvent = giftQueue[0] ?? null;
  const celebrationGift = celebrationEvent ? gifts.find((gift) => gift.gift === celebrationEvent.gift) ?? null : null;

  useEffect(() => {
    const incoming = giftEvents.filter((event) => !queuedGiftIds.current.has(event.id));
    if (incoming.length === 0) return;
    incoming.forEach((event) => queuedGiftIds.current.add(event.id));
    setGiftQueue((current) => [...current, ...incoming]);
  }, [giftEvents]);

  useEffect(() => {
    if (!celebrationEvent || !celebrationGift) return;
    const timeout = setTimeout(
      () => setGiftQueue((current) => current.filter((event) => event.id !== celebrationEvent.id)),
      celebrationGift.video ? 4_300 : 2_800,
    );
    return () => clearTimeout(timeout);
  }, [celebrationEvent, celebrationGift]);

  const openGiftPicker = () => {
    setGiftError(null);
    setGiftNotice(null);
    setGiftOpen(true);
    setWalletLoading(true);
    void getCurrentEventWallet().then(setWallet).catch((error) => {
      setGiftError(error instanceof Error ? error.message : 'Coin balance could not be loaded.');
    }).finally(() => setWalletLoading(false));
    setCoinPacksLoading(true);
    setCoinPacksError(null);
    void loadCoinPacks(currentUserId || undefined).then((packs) => {
      setCoinPacks(packs);
      if (packs.length === 0) setCoinPacksError('No Coin packs are currently available from the App Store.');
    }).catch((error) => {
      setCoinPacks([]);
      setCoinPacksError(error instanceof Error ? error.message : 'App Store products could not be loaded.');
    }).finally(() => setCoinPacksLoading(false));
  };

  const restorePurchases = async () => {
    if (walletSyncing) return;
    setWalletSyncing(true);
    setGiftError(null);
    setGiftNotice(null);
    try {
      const result = await restoreCoinPurchases(currentUserId || undefined);
      setWallet(result.wallet);
      setGiftNotice(result.creditedCoins > 0 ? `${result.creditedCoins.toLocaleString()} Coins restored.` : 'No new purchases found.');
    } catch (error) {
      setGiftError(error instanceof Error ? error.message : 'Purchases could not be restored.');
    } finally {
      setWalletSyncing(false);
    }
  };

  const buyCoinPack = async (pack: CoinPack) => {
    if (purchasingPack) return;
    setPurchasingPack(pack.identifier);
    setGiftError(null);
    setGiftNotice(null);
    try {
      const result = await purchaseCoinPack(currentUserId || undefined, pack.identifier);
      setWallet(result.wallet);
      setGiftNotice(result.creditedCoins > 0 ? `${result.creditedCoins.toLocaleString()} Coins added.` : 'Purchase completed. Coins are already up to date.');
    } catch (error) {
      setGiftError(error instanceof Error ? error.message : 'Coin purchase could not be completed.');
    } finally {
      setPurchasingPack(null);
    }
  };

  const sendGift = async () => {
    if (!chosenRecipient || !chosenGift || giftSending) return;
    if (wallet && wallet.coins < chosenGift.cost) {
      setGiftError('You do not have enough Coins for this gift.');
      return;
    }
    setGiftSending(true);
    setGiftError(null);
    setGiftNotice(null);
    try {
      const requestKey = createGiftRequestKey();
      const send = () => sendCurrentEventGift(
        room.id,
        { gift: chosenGift.gift, recipientId: chosenRecipient.id },
        { headers: { 'Idempotency-Key': requestKey } },
      );
      let receipt;
      try {
        receipt = await send();
      } catch (firstError) {
        const message = firstError instanceof Error ? firstError.message.toLowerCase() : '';
        if (!message.includes('network') && !message.includes('connection') && !message.includes('timed out')) throw firstError;
        await new Promise((resolve) => setTimeout(resolve, 350));
        receipt = await send();
      }
      try {
        const refreshedWallet = await getCurrentEventWallet();
        setWallet(refreshedWallet);
      } catch {
        setWallet((current) => current ? { ...current, coins: receipt.coinsRemaining } : current);
        setGiftError('Gift sent, but your Coin balance could not refresh.');
      }
      setGiftOpen(false);
      setGiftNotice(`${chosenGift.name} sent to ${chosenRecipient.user.name}.`);
    } catch (error) {
      setGiftError(error instanceof Error ? error.message : 'This gift could not be sent.');
    } finally {
      setGiftSending(false);
    }
  };

  const sendMessage = async () => {
    if (!message.trim() || sending) return;
    setSending(true);
    try {
      await onSendMessage(message);
      setMessage('');
    } finally {
      setSending(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.homeBackground, paddingTop: insets.top }]}>
      <View style={[styles.header, { backgroundColor: colors.homeBackground, borderBottomColor: colors.homeBorder }]}>
        <Pressable onPress={onLeave} accessibilityRole="button" accessibilityLabel={room.viewer.role === 'host' ? 'End Access room' : 'Leave Access room'} style={styles.headerButton}>
          <Ionicons name="chevron-down" size={25} color={colors.homeForeground} />
        </Pressable>
        <View style={styles.headerCenter}>
          <View style={styles.headerLive}><View style={[styles.liveDot, { backgroundColor: colors.destructive }]} /><Text style={[styles.headerKicker, { color: colors.homeMutedForeground }]}>LIVE ROOM</Text></View>
          <Text numberOfLines={1} style={[styles.headerTitle, { color: colors.homeForeground }]}>{room.title}</Text>
        </View>
        <Pressable onPress={() => setPeopleOpen(true)} accessibilityRole="button" accessibilityLabel="Open Access people" style={styles.headerButton}>
          <Ionicons name="people-outline" size={22} color={colors.homeForeground} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 112 }]} showsVerticalScrollIndicator={false}>
        <View style={styles.roomIntro}>
          <View style={[styles.livePill, { backgroundColor: colors.homeBorder }]}><View style={[styles.liveDot, { backgroundColor: colors.destructive }]} /><Text style={[styles.liveText, { color: colors.homeForeground }]}>LIVE</Text></View>
          <Text style={[styles.summary, { color: colors.homeMutedForeground }]}>{room.counts.speakers} speaking · {room.counts.listeners} listening</Text>
          {!audioConnected ? <ActivityIndicator color={colors.primary} size="small" /> : <View style={styles.connected}><View style={[styles.connectedDot, { backgroundColor: colors.primary }]} /><Text style={[styles.connectedText, { color: colors.homeMutedForeground }]}>Audio connected</Text></View>}
        </View>
        <Text style={[styles.topic, { color: colors.homeMutedForeground }]}>{topicLabels[room.topic] ?? room.topic} · room chat is open to everyone</Text>

        <View style={styles.stageHeader}>
          <View>
            <Text style={[styles.stageEyebrow, { color: colors.primary }]}>THE STAGE</Text>
            <Text style={[styles.stageTitle, { color: colors.homeForeground }]}>In the room</Text>
          </View>
          <Text style={[styles.stageCount, { color: colors.homeMutedForeground }]}>{speakers.length}/10</Text>
        </View>

        <View style={[styles.stage, { backgroundColor: colors.homeBackground, borderColor: colors.homeBorder }]}>
          {leadSpeaker ? (
            <StageCard participant={leadSpeaker} featured selected={selectedParticipant === leadSpeaker.id} onSelect={() => setSelectedParticipant(leadSpeaker.id)} />
          ) : (
            <View style={styles.emptyStage}>
              <Ionicons name="mic-outline" size={25} color={colors.primary} />
              <Text style={[styles.emptyStageTitle, { color: colors.homeForeground }]}>The stage is opening.</Text>
              <Text style={[styles.emptyStageBody, { color: colors.homeMutedForeground }]}>Stay close. The first voice is on its way.</Text>
            </View>
          )}
          {speakers.length > 1 ? (
            <View style={styles.otherSpeakers}>
              {speakers.slice(1, 7).map((participant) => (
                <StageCard key={participant.id} participant={participant} selected={selectedParticipant === participant.id} onSelect={() => setSelectedParticipant(participant.id)} />
              ))}
            </View>
          ) : null}
        </View>

        {canModerate ? (
          <View style={[styles.hostPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <View style={styles.panelHeader}><Text style={[styles.panelTitle, { color: colors.foreground }]}>Moderation desk</Text><Text style={[styles.panelMeta, { color: colors.mutedForeground }]}>{Math.max(0, 10 - speakers.length)} stage slots</Text></View>
            {listeners.slice(0, 12).map((participant) => (
              <View key={participant.id} style={styles.personRow}>
                <Avatar source={participantSource(participant)} size={34} accent={colors.secondary} />
                <Text numberOfLines={1} style={[styles.personName, { color: colors.foreground }]}>{participant.user.name}</Text>
                <Pressable onPress={() => void onParticipantAction(participant.id, 'promote')} disabled={speakers.length >= 10} style={[styles.personAction, { backgroundColor: colors.muted, opacity: speakers.length >= 10 ? 0.45 : 1 }]}><Text style={[styles.personActionText, { color: colors.primary }]}>Invite to stage</Text></Pressable>
                {room.viewer.role === 'host' ? <Pressable onPress={() => void onParticipantAction(participant.id, participant.role === 'moderator' ? 'demote' : 'promote')} style={[styles.personAction, { backgroundColor: colors.muted }]}><Text style={[styles.personActionText, { color: colors.secondary }]}>{participant.role === 'moderator' ? 'Remove mod' : 'Make mod'}</Text></Pressable> : null}
                <Pressable onPress={() => void onParticipantAction(participant.id, 'remove')} style={[styles.personAction, { backgroundColor: colors.muted }]}><Text style={[styles.personActionText, { color: colors.destructive }]}>Remove</Text></Pressable>
              </View>
            ))}
            {listeners.length === 0 ? <Text style={[styles.note, { color: colors.mutedForeground }]}>Listeners will appear here as people join.</Text> : null}
          </View>
        ) : null}

        <View style={styles.audienceHeader}>
          <Text style={[styles.sectionTitle, { color: colors.homeForeground }]}>Audience</Text>
          <Text style={[styles.audienceCount, { color: colors.homeMutedForeground }]}>{listeners.length} listening</Text>
        </View>
        <View style={[styles.audience, { borderTopColor: colors.homeBorder }]}>
          {listeners.slice(0, 28).map((participant) => (
            <View key={participant.id} style={styles.listener}>
              <Avatar source={participantSource(participant)} size={39} accent={participant.role === 'moderator' ? colors.secondary : colors.foreground} />
              <Text numberOfLines={1} style={[styles.listenerName, { color: colors.homeMutedForeground }]}>{participant.user.name}</Text>
            </View>
          ))}
          {listeners.length > 28 ? <Text style={[styles.note, { color: colors.homeMutedForeground }]}>+{listeners.length - 28} more listening</Text> : null}
          {listeners.length === 0 ? <Text style={[styles.note, { color: colors.homeMutedForeground }]}>The audience will appear here as people enter.</Text> : null}
        </View>
      </ScrollView>

      {giftNotice ? <View style={[styles.notice, { backgroundColor: colors.secondary }]}><Ionicons name="checkmark-circle-outline" size={16} color={colors.primary} /><Text style={[styles.noticeText, { color: colors.foreground }]}>{giftNotice}</Text></View> : null}
      <View style={[styles.actionBar, { backgroundColor: colors.homeBackground, borderTopColor: colors.homeBorder, paddingBottom: insets.bottom + 10 }]}>
        {room.viewer.role !== 'listener' ? <Pressable onPress={onToggleMic} accessibilityRole="button" accessibilityLabel={micEnabled ? 'Mute microphone' : 'Unmute microphone'} style={[styles.trayButton, { backgroundColor: micEnabled ? colors.primary : colors.card, borderColor: micEnabled ? colors.primary : colors.border }]}><Ionicons name={micEnabled ? 'mic' : 'mic-off'} size={20} color={micEnabled ? colors.primaryForeground : colors.homeForeground} /><Text style={[styles.trayLabel, { color: micEnabled ? colors.primaryForeground : colors.homeForeground }]}>{micEnabled ? 'Mic on' : 'Muted'}</Text></Pressable> : null}
        <Pressable onPress={() => setChatOpen(true)} accessibilityRole="button" accessibilityLabel="Open Access chat" style={[styles.trayButton, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="chatbubbles-outline" size={20} color={colors.homeForeground} /><Text style={[styles.trayLabel, { color: colors.homeForeground }]}>Chat</Text></Pressable>
        <Pressable onPress={openGiftPicker} accessibilityRole="button" accessibilityLabel="Send a gift" style={[styles.trayButton, { backgroundColor: colors.secondary, borderColor: colors.secondary }]}><Ionicons name="gift-outline" size={20} color={colors.homeForeground} /><Text style={[styles.trayLabel, { color: colors.homeForeground }]}>Gift</Text></Pressable>
        <Pressable onPress={onLeave} accessibilityRole="button" accessibilityLabel={room.viewer.role === 'host' ? 'End Access room' : 'Leave Access room'} style={[styles.leaveButton, { backgroundColor: colors.destructive }]}><Ionicons name="exit-outline" size={20} color={colors.destructiveForeground} /><Text style={[styles.trayLabel, { color: colors.destructiveForeground }]}>{room.viewer.role === 'host' ? 'End' : 'Leave'}</Text></Pressable>
      </View>

      <Modal visible={chatOpen} transparent animationType="slide" onRequestClose={() => setChatOpen(false)}>
        <KeyboardAvoidingView behavior="padding" style={styles.modalRoot}>
          <Pressable onPress={() => setChatOpen(false)} style={styles.modalShade} accessibilityRole="button" accessibilityLabel="Close Access chat" />
          <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 10 }]}>
            <View style={styles.sheetHeader}><View><Text style={[styles.sheetEyebrow, { color: colors.primary }]}>LIVE ROOM</Text><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Room chat</Text></View><Pressable onPress={() => setChatOpen(false)} accessibilityRole="button" accessibilityLabel="Close Access chat" style={styles.closeButton}><Ionicons name="close" size={24} color={colors.foreground} /></Pressable></View>
            <FlatList data={[...messages].reverse()} inverted keyExtractor={(item) => String(item.id)} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.messageList} renderItem={({ item }) => <View style={[styles.message, { backgroundColor: colors.muted }]}><Text style={[styles.messageAuthor, { color: colors.primary }]}>{item.sender.name}</Text><Text style={[styles.messageBody, { color: colors.foreground }]}>{item.content}</Text></View>} ListEmptyComponent={<Text style={[styles.note, { color: colors.mutedForeground }]}>Start the conversation.</Text>} />
            <View style={styles.composer}><TextInput value={message} onChangeText={setMessage} placeholder="Say something…" placeholderTextColor={colors.mutedForeground} style={[styles.input, { backgroundColor: colors.muted, color: colors.foreground }]} onSubmitEditing={() => void sendMessage()} returnKeyType="send" /><Pressable onPress={() => void sendMessage()} disabled={sending} accessibilityRole="button" accessibilityLabel="Send chat message" style={[styles.send, { backgroundColor: colors.primary, opacity: sending ? 0.55 : 1 }]}><Ionicons name="arrow-up" size={19} color={colors.primaryForeground} /></Pressable></View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      <Modal visible={peopleOpen} transparent animationType="slide" onRequestClose={() => setPeopleOpen(false)}>
        <View style={styles.modalRoot}><Pressable onPress={() => setPeopleOpen(false)} style={styles.modalShade} accessibilityRole="button" accessibilityLabel="Close Access people" /><View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 10 }]}><View style={styles.sheetHeader}><View><Text style={[styles.sheetEyebrow, { color: colors.primary }]}>LIVE ROOM</Text><Text style={[styles.sheetTitle, { color: colors.foreground }]}>People here</Text></View><Pressable onPress={() => setPeopleOpen(false)} accessibilityRole="button" accessibilityLabel="Close Access people" style={styles.closeButton}><Ionicons name="close" size={24} color={colors.foreground} /></Pressable></View><ScrollView><Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>ON STAGE · {speakers.length}/10</Text>{speakers.map((participant) => <View key={participant.id} style={styles.personRow}><Avatar source={participantSource(participant)} size={34} accent={colors.primary} /><View style={styles.personNameBlock}><Text numberOfLines={1} style={[styles.personName, { color: colors.foreground }]}>{participant.user.name}</Text><RoleLabel participant={participant} /></View>{canModerate && participant.role !== 'host' ? <Pressable onPress={() => void onParticipantAction(participant.id, participant.muted ? 'unmute' : 'mute')} style={[styles.personAction, { backgroundColor: colors.muted }]}><Text style={[styles.personActionText, { color: colors.primary }]}>{participant.muted ? 'Unmute' : 'Mute'}</Text></Pressable> : null}</View>)}<Text style={[styles.groupLabel, { color: colors.mutedForeground }]}>AUDIENCE · {listeners.length}</Text>{listeners.map((participant) => <View key={participant.id} style={styles.personRow}><Avatar source={participantSource(participant)} size={34} accent={participant.role === 'moderator' ? colors.secondary : colors.foreground} /><View style={styles.personNameBlock}><Text numberOfLines={1} style={[styles.personName, { color: colors.foreground }]}>{participant.user.name}</Text>{participant.role === 'moderator' ? <Text style={[styles.roleText, { color: colors.mutedForeground }]}>Moderator</Text> : null}</View>{canModerate ? <Pressable onPress={() => void onParticipantAction(participant.id, 'promote')} disabled={speakers.length >= 10} style={[styles.personAction, { backgroundColor: colors.muted, opacity: speakers.length >= 10 ? 0.45 : 1 }]}><Text style={[styles.personActionText, { color: colors.primary }]}>Stage</Text></Pressable> : null}</View>)}</ScrollView></View></View>
      </Modal>

      <Modal visible={giftOpen} transparent animationType="slide" onRequestClose={() => setGiftOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable onPress={() => setGiftOpen(false)} style={styles.modalShade} accessibilityRole="button" accessibilityLabel="Close gift picker" />
          <View style={[styles.giftSheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 12 }]}>
            <View style={styles.sheetHeader}>
              <View><Text style={[styles.sheetEyebrow, { color: colors.primary }]}>SUPPORT THE ROOM</Text><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Send a gift</Text></View>
              <Pressable onPress={() => setGiftOpen(false)} accessibilityRole="button" accessibilityLabel="Close gift picker" style={styles.closeButton}><Ionicons name="close" size={24} color={colors.foreground} /></Pressable>
            </View>
            <View style={[styles.balanceRow, { backgroundColor: colors.muted }]}>
              <Pressable onPress={() => router.push('/wallet' as never)} accessibilityRole="button" accessibilityLabel="Open wallet" style={[styles.balanceIcon, { backgroundColor: colors.homeBorder }]}><Image source={require('@/assets/coins/coin-stack.png')} contentFit="contain" style={styles.balanceImage} /></Pressable>
              <Pressable onPress={() => router.push('/wallet' as never)} accessibilityRole="button" accessibilityLabel="Open wallet" style={styles.balanceCopy}><Text style={[styles.balanceLabel, { color: colors.mutedForeground }]}>CURRENT BALANCE</Text><Text style={[styles.balanceValue, { color: colors.foreground }]}>{walletLoading ? 'Loading' : `${(wallet?.coins ?? 0).toLocaleString()} Coins`}</Text></Pressable>
              <Pressable onPress={() => void restorePurchases()} disabled={walletSyncing} accessibilityRole="button" accessibilityLabel="Restore Coin purchases" style={[styles.restoreButton, { borderColor: colors.border, opacity: walletSyncing ? 0.55 : 1 }]}>{walletSyncing ? <ActivityIndicator color={colors.primary} size="small" /> : <><Ionicons name="refresh" size={14} color={colors.primary} /><Text style={[styles.restoreText, { color: colors.primary }]}>Restore</Text></>}</Pressable>
            </View>
             {coinPacks.length > 0 ? (
               <View style={styles.rechargeBlock}>
                 <View style={styles.rechargeHeader}>
                   <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 0, marginBottom: 0 }]}>Recharge Coins</Text>
                   <Text style={[styles.rechargeMeta, { color: colors.mutedForeground }]}>Secure App Store purchase</Text>
                 </View>
                 <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.packRail}>
                   {coinPacks.map((pack) => (
                     <Pressable key={pack.identifier} onPress={() => void buyCoinPack(pack)} disabled={Boolean(purchasingPack)} style={[styles.pack, { backgroundColor: colors.secondary, borderColor: colors.border, opacity: purchasingPack && purchasingPack !== pack.identifier ? 0.5 : 1 }]}>
                       {purchasingPack === pack.identifier ? <ActivityIndicator color={colors.primary} size="small" /> : <Text style={[styles.packTitle, { color: colors.foreground }]}>{pack.coins ? `${pack.coins.toLocaleString()} Coins` : pack.title}</Text>}
                       <Text style={[styles.packPrice, { color: colors.primary }]}>{pack.price}</Text>
                     </Pressable>
                   ))}
                 </ScrollView>
               </View>
              ) : coinPacksLoading ? <View style={styles.rechargeLoading}><ActivityIndicator color={colors.primary} /><Text style={[styles.note, { color: colors.mutedForeground }]}>Loading Coin packs…</Text></View> : <View style={styles.rechargeLoading}><Ionicons name="alert-circle-outline" size={18} color={colors.mutedForeground} /><Text style={[styles.note, { color: colors.mutedForeground }]}>Purchases unavailable. {coinPacksError}</Text></View>}
            {giftError ? <View style={[styles.giftError, { backgroundColor: colors.muted }]}><Ionicons name="alert-circle-outline" size={17} color={colors.destructive} /><Text style={[styles.giftErrorText, { color: colors.destructive }]}>{giftError}</Text></View> : null}
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Choose a gift</Text>
            <View style={styles.giftGrid}>
              {gifts.map((gift) => {
                const active = selectedGift === gift.gift;
                const giftColor = colorForGift(gift, colors);
                  return <Pressable key={gift.gift} onPress={() => { setSelectedGift(gift.gift); setGiftError(null); }} accessibilityRole="button" accessibilityState={{ selected: active }} style={[styles.giftCard, { backgroundColor: active ? colors.secondary : colors.muted, borderColor: active ? colors.primary : colors.border }]}><View style={[styles.giftIcon, { backgroundColor: giftColor }]}><GiftMedia gift={gift} /></View><Text style={[styles.giftName, { color: colors.foreground }]}>{gift.name}</Text><Text style={[styles.giftCost, { color: colors.mutedForeground }]}>{gift.cost.toLocaleString()} Coins</Text><Text style={[styles.giftBenefit, { color: colors.primary }]}>{gift.benefit}</Text></Pressable>;
              })}
            </View>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Send to</Text>
            {giftRecipients.length === 0 ? <Text style={[styles.note, { color: colors.mutedForeground }]}>There is no one else in this LIVE room yet.</Text> : <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.recipientRail}>{giftRecipients.map((participant) => { const active = chosenRecipient?.id === participant.id; return <Pressable key={participant.id} onPress={() => setSelectedParticipant(participant.id)} style={[styles.recipient, { borderColor: active ? colors.primary : colors.border, backgroundColor: active ? colors.secondary : colors.muted }]}><Avatar source={participantSource(participant)} size={34} accent={participant.role === 'host' ? colors.primary : colors.secondary} /><Text numberOfLines={1} style={[styles.recipientName, { color: colors.foreground }]}>{participant.user.name}</Text><Text style={[styles.recipientRole, { color: colors.mutedForeground }]}>{participant.role === 'host' ? 'Host' : participant.role === 'moderator' ? 'Moderator' : participant.role === 'speaker' ? 'Speaker' : 'Listener'}</Text></Pressable>; })}</ScrollView>}
            <Pressable onPress={() => void sendGift()} disabled={!chosenRecipient || giftSending || walletLoading} accessibilityRole="button" accessibilityLabel={`Send ${chosenGift.name} gift`} style={[styles.sendGift, { backgroundColor: colors.primary, opacity: !chosenRecipient || giftSending || walletLoading ? 0.5 : 1 }]}>{giftSending ? <ActivityIndicator color={colors.primaryForeground} /> : <><Ionicons name="gift-outline" size={18} color={colors.primaryForeground} /><Text style={{ color: colors.primaryForeground, fontWeight: '900' }}>Send {chosenGift.name} · {chosenGift.cost.toLocaleString()} Coins</Text></>}</Pressable>
          </View>
        </View>
      </Modal>
      <Modal visible={Boolean(celebrationEvent && celebrationGift)} transparent animationType="fade" onRequestClose={() => setGiftQueue((current) => current.slice(1))}>
        <View style={styles.giftCelebrationRoot}>
          {celebrationEvent && celebrationGift ? (
            <Pressable onPress={() => setGiftQueue((current) => current.slice(1))} style={[styles.giftCelebration, { backgroundColor: colors.card, borderColor: colors.primary }]} accessibilityRole="button" accessibilityLabel={`Close ${celebrationGift.name} gift animation`}>
              <View style={[styles.giftCelebrationMedia, { backgroundColor: colorForGift(celebrationGift, colors) }]}><AnimatedGiftMedia gift={celebrationGift} /></View>
              <Text style={[styles.giftCelebrationTitle, { color: colors.foreground }]}>{celebrationGift.name}</Text>
              <Text style={[styles.giftCelebrationBody, { color: colors.foreground }]}>{celebrationEvent.sender.name} sent this to {celebrationEvent.recipient.name}</Text>
              <Text style={[styles.giftCelebrationBenefit, { color: colors.primary }]}>{giftBenefitText(celebrationEvent)}</Text>
            </Pressable>
          ) : null}
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { height: 72, paddingHorizontal: 14, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  headerCenter: { position: 'absolute', left: 60, right: 60, alignItems: 'center' },
  headerLive: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  headerKicker: { fontFamily: 'Outfit_700Bold', fontSize: 10, letterSpacing: 1.5 },
  headerTitle: { fontFamily: 'Fraunces_900Black', fontSize: 18, marginTop: 4 },
  content: { padding: 18 },
  roomIntro: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  livePill: { borderRadius: 16, paddingHorizontal: 10, paddingVertical: 6, flexDirection: 'row', alignItems: 'center', gap: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontFamily: 'Outfit_700Bold', fontSize: 11, letterSpacing: 1 },
  summary: { flex: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 13 },
  connected: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  connectedDot: { width: 6, height: 6, borderRadius: 3 },
  connectedText: { fontFamily: 'Outfit_500Medium', fontSize: 11 },
  topic: { fontFamily: 'Outfit_500Medium', fontSize: 13, marginTop: 10 },
  stageHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 28, marginBottom: 12 },
  stageEyebrow: { fontFamily: 'Outfit_700Bold', fontSize: 11, letterSpacing: 1.5 },
  stageTitle: { fontFamily: 'Fraunces_900Black', fontSize: 26, letterSpacing: -0.6, marginTop: 4 },
  stageCount: { fontFamily: 'Outfit_700Bold', fontSize: 13 },
  stage: { borderRadius: 24, borderWidth: 1, padding: 16, minHeight: 300 },
  featuredSpeaker: { minHeight: 196, borderRadius: 20, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 16 },
  avatarRing: { borderWidth: 2, borderRadius: 40, padding: 4, position: 'relative' },
  featuredRing: { borderRadius: 52, padding: 5 },
  muteBadge: { position: 'absolute', right: -4, bottom: -2, width: 26, height: 26, borderRadius: 13, alignItems: 'center', justifyContent: 'center', borderWidth: 2 },
  stageName: { fontFamily: 'Outfit_700Bold', fontSize: 12, marginTop: 8, maxWidth: 90 },
  featuredName: { fontFamily: 'Fraunces_700Bold', fontSize: 18, marginTop: 10, maxWidth: 190 },
  roleLabel: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4 },
  roleDot: { width: 6, height: 6, borderRadius: 3 },
  roleText: { fontFamily: 'Outfit_600SemiBold', fontSize: 11 },
  otherSpeakers: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 10 },
  stageCard: { width: '31.5%', minWidth: 92, borderRadius: 16, borderWidth: 1, paddingVertical: 10, alignItems: 'center' },
  emptyStage: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 50 },
  emptyStageTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 18, marginTop: 12 },
  emptyStageBody: { fontFamily: 'Outfit_500Medium', fontSize: 13, marginTop: 6 },
  hostPanel: { borderWidth: 1, borderRadius: 20, padding: 14, marginTop: 20 },
  panelHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 },
  panelTitle: { fontFamily: 'Outfit_700Bold', fontSize: 15 },
  panelMeta: { fontFamily: 'Outfit_500Medium', fontSize: 12 },
  personRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8 },
  personNameBlock: { flex: 1 },
  personName: { flex: 1, fontFamily: 'Outfit_700Bold', fontSize: 13 },
  personAction: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8 },
  personActionText: { fontFamily: 'Outfit_700Bold', fontSize: 11 },
  note: { fontFamily: 'Outfit_500Medium', fontSize: 13, lineHeight: 18, paddingVertical: 8 },
  audienceHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 28, marginBottom: 12 },
  sectionTitle: { fontFamily: 'Fraunces_900Black', fontSize: 20 },
  audienceCount: { fontFamily: 'Outfit_700Bold', fontSize: 12 },
  audience: { borderTopWidth: 1, paddingTop: 16, flexDirection: 'row', flexWrap: 'wrap', gap: 14 },
  listener: { width: 56, alignItems: 'center' },
  listenerName: { fontFamily: 'Outfit_500Medium', fontSize: 10, marginTop: 6, maxWidth: 56, textAlign: 'center' },
  notice: { position: 'absolute', left: 18, right: 18, bottom: 94, borderRadius: 16, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 8 },
  noticeText: { flex: 1, fontFamily: 'Outfit_700Bold', fontSize: 13 },
  actionBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: 14, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', gap: 8 },
  trayButton: { flex: 1, minHeight: 56, borderRadius: 18, borderWidth: 1, alignItems: 'center', justifyContent: 'center', gap: 4 },
  leaveButton: { flex: 1, minHeight: 56, borderRadius: 18, alignItems: 'center', justifyContent: 'center', gap: 4 },
  trayLabel: { fontFamily: 'Outfit_700Bold', fontSize: 11 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,22,20,0.64)' },
  sheet: { maxHeight: '82%', minHeight: 340, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 20 },
  giftSheet: { maxHeight: '92%', borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 20 },
  sheetHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 },
  sheetEyebrow: { fontFamily: 'Outfit_700Bold', fontSize: 11, letterSpacing: 1.3 },
  sheetTitle: { fontFamily: 'Fraunces_900Black', fontSize: 25, marginTop: 4 },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  messageList: { gap: 10, paddingBottom: 10 },
  message: { borderRadius: 16, padding: 12 },
  messageAuthor: { fontFamily: 'Outfit_700Bold', fontSize: 11, marginBottom: 4 },
  messageBody: { fontFamily: 'Outfit_400Regular', fontSize: 14, lineHeight: 20 },
  composer: { flexDirection: 'row', gap: 10, alignItems: 'center', paddingTop: 12 },
  input: { flex: 1, minHeight: 48, borderRadius: 24, paddingHorizontal: 16, fontFamily: 'Outfit_400Regular' },
  send: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  groupLabel: { fontFamily: 'Outfit_700Bold', fontSize: 11, letterSpacing: 1, marginTop: 10, marginBottom: 6 },
  balanceRow: { borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  balanceIcon: { width: 42, height: 42, borderRadius: 18, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  balanceImage: { width: 42, height: 42 },
  balanceCopy: { flex: 1 },
  balanceLabel: { fontFamily: 'Outfit_700Bold', fontSize: 10, letterSpacing: 1 },
  balanceValue: { fontFamily: 'Fraunces_700Bold', fontSize: 17, marginTop: 2 },
  restoreButton: { minHeight: 36, borderRadius: 18, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  restoreText: { fontFamily: 'Outfit_700Bold', fontSize: 12 },
  rechargeBlock: { marginTop: 16 },
  rechargeHeader: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  rechargeMeta: { fontFamily: 'Outfit_600SemiBold', fontSize: 10 },
  packRail: { gap: 10, paddingTop: 10 },
  pack: { minWidth: 124, minHeight: 68, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 10, justifyContent: 'center' },
  packTitle: { fontFamily: 'Outfit_700Bold', fontSize: 12 },
  packPrice: { fontFamily: 'Fraunces_700Bold', fontSize: 14, marginTop: 6 },
  rechargeLoading: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 14 },
  giftError: { borderRadius: 14, padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center', marginTop: 12 },
  giftErrorText: { flex: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 12, lineHeight: 17 },
  fieldLabel: { fontFamily: 'Outfit_700Bold', fontSize: 14, marginTop: 16, marginBottom: 10 },
  giftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  giftCard: { width: '31.5%', minHeight: 128, borderRadius: 16, borderWidth: 1, padding: 10, alignItems: 'center' },
  giftIcon: { width: 46, height: 46, borderRadius: 16, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  giftImage: { width: 46, height: 46 },
  giftCelebrationRoot: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28, backgroundColor: 'rgba(28,22,20,0.48)' },
  giftCelebration: { width: '100%', maxWidth: 360, borderRadius: 28, borderWidth: 1, padding: 20, alignItems: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  giftCelebrationMedia: { width: 142, height: 142, borderRadius: 46, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  giftCelebrationImage: { width: 142, height: 142 },
  giftCelebrationVideo: { width: 142, height: 142 },
  giftCelebrationTitle: { fontFamily: 'Fraunces_900Black', fontSize: 22, marginTop: 12 },
  giftCelebrationBody: { fontFamily: 'Outfit_600SemiBold', fontSize: 12, marginTop: 5, textAlign: 'center' },
  giftCelebrationBenefit: { fontFamily: 'Outfit_700Bold', fontSize: 13, marginTop: 8, textAlign: 'center' },
  giftName: { fontFamily: 'Outfit_700Bold', fontSize: 12, marginTop: 8 },
  giftCost: { fontFamily: 'Outfit_600SemiBold', fontSize: 10, marginTop: 4, textAlign: 'center' },
  giftBenefit: { fontFamily: 'Outfit_700Bold', fontSize: 9, lineHeight: 12, marginTop: 4, textAlign: 'center' },
  recipientRail: { gap: 10 },
  recipient: { width: 88, minHeight: 88, borderRadius: 16, borderWidth: 1, alignItems: 'center', padding: 10 },
  recipientName: { fontFamily: 'Outfit_700Bold', fontSize: 11, marginTop: 6, maxWidth: 74 },
  recipientRole: { fontFamily: 'Outfit_500Medium', fontSize: 10, marginTop: 3 },
  sendGift: { minHeight: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 10, marginTop: 20 },
});