import { Ionicons } from '@expo/vector-icons';
import {
  createCurrentEventRoom,
  getCurrentEventRooms,
  type CurrentEventRoom,
  type CurrentEventTopic,
} from '@workspace/api-client-react';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/ui';
import { typography } from '@/constants/typography';

const topicLabels: Array<{ key: CurrentEventTopic; label: string }> = [
  { key: 'for-you', label: 'For you' },
  { key: 'politics', label: 'Politics' },
  { key: 'markets', label: 'Markets' },
  { key: 'tech', label: 'Tech' },
  { key: 'culture', label: 'Culture' },
  { key: 'sports', label: 'Sports' },
  { key: 'world', label: 'World' },
];

const roomTypes = [
  { key: 'public', label: 'Public' },
  { key: 'friends', label: 'Friends' },
  { key: 'friends-of-friends', label: 'Friends of Friends' },
  { key: 'private', label: 'Private' },
  { key: 'community', label: 'Space Room' },
] as const;

const accessDurations = ['15 min', '30 min', '1 hour', '2 hours', '4 hours', 'Custom'] as const;

const ACCESS_META_PREFIX = 'ACCESS|';

type Colors = {
  background: string;
  foreground: string;
  card: string;
  muted: string;
  mutedForeground: string;
  border: string;
  primary: string;
  primaryForeground: string;
  destructive: string;
};

type RoomType = typeof roomTypes[number]['key'];

function parseRoomMeta(room: CurrentEventRoom): { roomType: RoomType; coins: number; duration: string } {
  const clubName = room.clubName ?? '';
  const payload = clubName.startsWith(ACCESS_META_PREFIX) ? clubName.slice(ACCESS_META_PREFIX.length) : '';
  const segments = payload.split('|').filter(Boolean);
  const rawRoomType = segments.find((item) => item.startsWith('TYPE='))?.replace('TYPE=', '') ?? (room.isOpen ? 'public' : 'private');
  const roomType: RoomType = rawRoomType === 'friends' || rawRoomType === 'friends-of-friends' || rawRoomType === 'private' || rawRoomType === 'community' ? rawRoomType : 'public';
  const coins = Number(segments.find((item) => item.startsWith('COINS='))?.replace('COINS=', '') ?? 0);
  const duration = segments.find((item) => item.startsWith('DUR='))?.replace('DUR=', '') ?? '';
  return {
    roomType,
    coins: Number.isFinite(coins) && coins > 0 ? coins : 0,
    duration,
  };
}

function encodeRoomMeta(roomType: RoomType, paid: boolean, coins: string, duration: string) {
  const parts = [`TYPE=${roomType}`];
  if (paid) {
    const value = Number(coins);
    if (Number.isFinite(value) && value > 0) parts.push(`COINS=${Math.floor(value)}`);
    if (duration.trim()) parts.push(`DUR=${duration.trim().replace(/\|/g, '-')}`);
  }
  return `${ACCESS_META_PREFIX}${parts.join('|')}`;
}

function roomTypeLabel(type: RoomType) {
  return roomTypes.find((item) => item.key === type)?.label ?? 'Public';
}

export default function CurrentEventsHome({
  colors,
  onBack,
  onOpenRoom,
  onRoomCreated,
  onRoomsChanged,
  currentUserId,
}: {
  colors: Colors;
  onBack: () => void;
  onOpenRoom: (room: CurrentEventRoom) => void;
  onRoomCreated: (room: CurrentEventRoom) => void;
  onRoomsChanged: (rooms: CurrentEventRoom[]) => void;
  currentUserId: number;
}) {
  const insets = useSafeAreaInsets();
  const [topic, setTopic] = useState<CurrentEventTopic>('for-you');
  const [rooms, setRooms] = useState<CurrentEventRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [hostOpen, setHostOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [hostTopic, setHostTopic] = useState<CurrentEventTopic>('for-you');
  const [roomType, setRoomType] = useState<RoomType>('public');
  const [paidRoom, setPaidRoom] = useState(false);
  const [entryCoins, setEntryCoins] = useState('1200');
  const [duration, setDuration] = useState<(typeof accessDurations)[number]>('2 hours');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getCurrentEventRooms(topic === 'for-you' ? undefined : { topic });
      setRooms(result.items);
      onRoomsChanged(result.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Access is unavailable right now.');
    } finally {
      setLoading(false);
    }
  }, [onRoomsChanged, topic]);

  useEffect(() => {
    void loadRooms();
    const interval = setInterval(() => void loadRooms(), 15_000);
    return () => clearInterval(interval);
  }, [loadRooms]);

  const sections = useMemo(() => {
    const sorted = [...rooms].sort((left, right) => (right.counts.listeners + right.counts.speakers) - (left.counts.listeners + left.counts.speakers));
    return [
      { key: 'live', title: 'LIVE NOW', items: sorted },
      { key: 'friends', title: 'FRIENDS ARE TALKING', items: sorted.filter((room) => room.counts.speakers >= 2).slice(0, 4) },
      { key: 'trending', title: 'TRENDING', items: sorted.slice(0, 6) },
      { key: 'for-you', title: 'FOR YOU', items: sorted.filter((room) => room.topic === topic || topic === 'for-you').slice(0, 6) },
      { key: 'my-access', title: 'MY ACCESS', items: sorted.filter((room) => room.hostId === currentUserId).slice(0, 4) },
    ].filter((section) => section.items.length > 0);
  }, [currentUserId, rooms, topic]);

  async function hostRoom() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const room = await createCurrentEventRoom({
        title: title.trim(),
        topic: hostTopic,
        isOpen: roomType !== 'private',
        clubName: encodeRoomMeta(roomType, paidRoom, entryCoins, duration),
      });
      setHostOpen(false);
      setTitle('');
      onRoomCreated(room);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not start this Access room.');
    } finally {
      setSaving(false);
    }
  }

  const flatRooms = useMemo(() => {
    const rows: Array<{ type: 'section'; key: string; title: string } | { type: 'room'; key: string; room: CurrentEventRoom }> = [];
    const seen = new Set<number>();
    for (const section of sections) {
      const uniqueRooms = section.items.filter((room) => !seen.has(room.id));
      if (uniqueRooms.length === 0) continue;
      rows.push({ type: 'section', key: `section-${section.key}`, title: section.title });
      for (const room of uniqueRooms) {
        seen.add(room.id);
        rows.push({ type: 'room', key: `${section.key}-${room.id}`, room });
      }
    }
    return rows;
  }, [sections]);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { minHeight: insets.top + 60, paddingTop: insets.top, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to Map" style={styles.headerButton}>
          <Ionicons name="arrow-back" size={23} color={colors.foreground} />
        </Pressable>
        <View pointerEvents="none" style={styles.headerTitleSlot}>
          <Text style={[typography.navigationTitle, styles.headerTitle, { color: colors.foreground }]}>Access</Text>
        </View>
        <View style={styles.headerButton} />
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topicScroller} contentContainerStyle={styles.topicRail}>
        {topicLabels.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setTopic(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: topic === item.key }}
            style={[styles.topicChip, { backgroundColor: topic === item.key ? colors.primary : colors.muted, borderColor: topic === item.key ? colors.primary : colors.border }]}
          >
            <Text style={[styles.topicText, { color: topic === item.key ? colors.primaryForeground : colors.mutedForeground }]}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      {error ? (
        <Pressable onPress={() => void loadRooms()} style={styles.error}>
          <Ionicons name="cloud-offline-outline" size={18} color={colors.destructive} />
          <Text style={[styles.errorText, { color: colors.destructive }]}>{error} Tap to retry.</Text>
        </Pressable>
      ) : null}

      {loading && rooms.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={flatRooms}
          keyExtractor={(item) => item.key}
          contentContainerStyle={styles.roomList}
          showsVerticalScrollIndicator={false}
          scrollEnabled
          ListEmptyComponent={
            error ? null : (
              <View style={styles.empty}>
                <Ionicons name="radio-outline" size={34} color={colors.primary} />
                <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No live rooms right now</Text>
                <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Explore topics, browse Spaces, check upcoming events, or start a room.</Text>
              </View>
            )
          }
          renderItem={({ item }) => {
            if (item.type === 'section') {
              return <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{item.title}</Text>;
            }
            const room = item.room;
            const meta = parseRoomMeta(room);
            const host = room.participants.find((participant) => participant.role === 'host');
            const coHosts = room.participants.filter((participant) => participant.role === 'moderator').slice(0, 2);
            const speakers = room.participants.filter((participant) => ['host', 'moderator', 'speaker'].includes(participant.role));
            return (
              <Pressable
                onPress={() => onOpenRoom(room)}
                accessibilityRole="button"
                accessibilityLabel={`Join ${room.title}`}
                style={({ pressed }) => [styles.roomCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.82 : 1 }]}
              >
                <View style={styles.roomCardTop}>
                  <View style={styles.liveLabel}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
                  <View style={styles.badgeRow}>
                    <Text style={[styles.roomTypeBadge, { backgroundColor: colors.muted, color: colors.foreground }]}>{roomTypeLabel(meta.roomType)}</Text>
                    {meta.coins > 0 ? <Text style={[styles.paidBadge, { backgroundColor: colors.foreground, color: colors.background }]}>🔒 {meta.coins.toLocaleString()} coins</Text> : <Text style={[styles.roomTypeBadge, { backgroundColor: colors.muted, color: colors.foreground }]}>FREE</Text>}
                  </View>
                </View>
                <Text style={[styles.roomTitle, { color: colors.foreground }]} numberOfLines={2}>{room.title}</Text>
                <Text style={[styles.metaText, { color: colors.mutedForeground }]}>Host: {host?.user.name ?? 'Host'} {coHosts.length ? `· Co-hosts: ${coHosts.map((item) => item.user.name).join(', ')}` : ''}</Text>
                <View style={styles.roomMeta}>
                  <View style={styles.avatarStack}>
                    {speakers.slice(0, 4).map((participant, index) => (
                      <View key={participant.id} style={{ marginLeft: index === 0 ? 0 : -9 }}>
                        <Avatar name={participant.user.name} size={30} color={index % 2 === 0 ? colors.primary : colors.foreground} />
                      </View>
                    ))}
                  </View>
                  <Text style={[styles.countText, { color: colors.mutedForeground }]}>{room.counts.listeners} listeners · {topicLabels.find((entry) => entry.key === room.topic)?.label ?? 'Topic'}</Text>
                  <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                </View>
                <View style={styles.roomSignals}>
                  <Text style={[styles.signalText, { color: colors.mutedForeground }]}>Live conversation</Text>
                  {meta.duration ? <Text style={[styles.signalText, { color: colors.mutedForeground }]}>Access {meta.duration}</Text> : null}
                </View>
              </Pressable>
            );
          }}
        />
      )}

      <Pressable onPress={() => setHostOpen(true)} style={[styles.hostButton, { backgroundColor: colors.primary }]} accessibilityRole="button" accessibilityLabel="Create Access room">
        <Ionicons name="mic" size={20} color={colors.primaryForeground} />
        <Text style={styles.hostButtonText}>create access</Text>
      </Pressable>

      <Modal visible={hostOpen} transparent animationType="slide" onRequestClose={() => setHostOpen(false)}>
        <View style={styles.modalShade}>
          <View style={[styles.hostSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            <Text style={[typography.sheetTitle, { color: colors.foreground }]}>Create Access Room</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="Room title"
              placeholderTextColor={colors.mutedForeground}
              maxLength={120}
              autoFocus
              style={[styles.titleInput, { borderColor: colors.border, color: colors.foreground }]}
            />
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Topic</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sheetTopics}>
              {topicLabels.slice(1).map((item) => (
                <Pressable key={item.key} onPress={() => setHostTopic(item.key)} style={[styles.sheetChip, { borderColor: hostTopic === item.key ? colors.primary : colors.border, backgroundColor: hostTopic === item.key ? `${colors.primary}15` : 'transparent' }]}>
                  <Text style={{ color: colors.foreground, fontWeight: '500' }}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Who can join</Text>
            <View style={styles.roomTypeRail}>
              {roomTypes.map((item) => (
                <Pressable key={item.key} onPress={() => setRoomType(item.key)} style={[styles.roomTypeChip, { borderColor: roomType === item.key ? colors.primary : colors.border, backgroundColor: roomType === item.key ? `${colors.primary}16` : 'transparent' }]}>
                  <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600' }}>{item.label}</Text>
                </Pressable>
              ))}
            </View>
            <View style={styles.featureList}>
              <Text style={[styles.featureItem, { color: colors.mutedForeground }]}>Chat, reactions, replay, clips, and scheduling are visible in Access and can be managed after room start.</Text>
            </View>
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Room pricing</Text>
            <View style={styles.roomTypeRail}>
              <Pressable onPress={() => setPaidRoom(false)} style={[styles.roomTypeChip, { borderColor: paidRoom ? colors.border : colors.primary, backgroundColor: paidRoom ? 'transparent' : `${colors.primary}16` }]}>
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600' }}>Free room</Text>
              </Pressable>
              <Pressable onPress={() => setPaidRoom(true)} style={[styles.roomTypeChip, { borderColor: paidRoom ? colors.primary : colors.border, backgroundColor: paidRoom ? `${colors.primary}16` : 'transparent' }]}>
                <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '600' }}>Paid room</Text>
              </Pressable>
            </View>
            {paidRoom ? (
              <View style={[styles.paidPanel, { backgroundColor: colors.muted, borderColor: colors.border }]}>
                <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 0 }]}>Entry price (coins)</Text>
                <TextInput
                  keyboardType="number-pad"
                  value={entryCoins}
                  onChangeText={setEntryCoins}
                  placeholder="1200"
                  placeholderTextColor={colors.mutedForeground}
                  style={[styles.priceInput, { backgroundColor: colors.card, color: colors.foreground, borderColor: colors.border }]}
                />
                <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Access duration</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sheetTopics}>
                  {accessDurations.map((item) => (
                    <Pressable key={item} onPress={() => setDuration(item)} style={[styles.sheetChip, { borderColor: duration === item ? colors.primary : colors.border, backgroundColor: duration === item ? `${colors.primary}15` : 'transparent' }]}>
                      <Text style={{ color: colors.foreground, fontWeight: '500' }}>{item}</Text>
                    </Pressable>
                  ))}
                </ScrollView>
                <Text style={[styles.summaryText, { color: colors.mutedForeground }]}>Listeners pay ◈ {Number(entryCoins || '0').toLocaleString()} to enter. Estimated proceeds: 75%.</Text>
              </View>
            ) : null}
            <View style={styles.sheetActions}>
              <Pressable onPress={() => setHostOpen(false)}><Text style={{ color: colors.mutedForeground, fontWeight: '700' }}>Cancel</Text></Pressable>
              <Pressable disabled={!title.trim() || saving} onPress={() => void hostRoom()} style={[styles.startButton, { backgroundColor: colors.primary, opacity: !title.trim() || saving ? 0.45 : 1 }]}>
                {saving ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.startButtonText, { color: colors.primaryForeground }]}>Start Access</Text>}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth },
  headerButton: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  headerTitleSlot: { position: 'absolute', left: 58, right: 58, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 21, textAlign: 'center' },
  topicScroller: { flexGrow: 0, maxHeight: 60 },
  topicRail: { gap: 8, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center' },
  topicChip: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 8 },
  topicText: { fontSize: 13, fontWeight: '500' },
  roomList: { paddingHorizontal: 16, paddingBottom: 150, gap: 12 },
  sectionTitle: { marginTop: 8, marginBottom: 2, fontSize: 12, fontWeight: '800', letterSpacing: 1 },
  roomCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 15 },
  roomCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  roomTypeBadge: { fontSize: 10, fontWeight: '700', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  paidBadge: { fontSize: 10, fontWeight: '800', paddingHorizontal: 8, paddingVertical: 5, borderRadius: 10 },
  metaText: { marginTop: 8, fontSize: 12, lineHeight: 17 },
  liveLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E5484D' },
  liveText: { color: '#E5484D', fontSize: 10, fontWeight: '600' },
  roomTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600', marginTop: 9 },
  roomMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 14, gap: 9 },
  roomSignals: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  signalText: { fontSize: 11, fontWeight: '500' },
  avatarStack: { flexDirection: 'row', width: 96, flexShrink: 0 },
  countText: { flex: 1, fontSize: 12, fontWeight: '400' },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  empty: { alignItems: 'center', paddingHorizontal: 30, paddingTop: 90 },
  emptyTitle: { fontSize: 17, fontWeight: '600', marginTop: 12 },
  emptyText: { fontSize: 14, textAlign: 'center', lineHeight: 19, marginTop: 5 },
  error: { marginHorizontal: 16, marginBottom: 10, borderRadius: 12, padding: 11, flexDirection: 'row', alignItems: 'center', gap: 7 },
  errorText: { flex: 1, fontSize: 12, fontWeight: '500' },
  hostButton: { position: 'absolute', bottom: 22, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6, minHeight: 48, borderRadius: 25, paddingHorizontal: 20 },
  hostButtonText: { color: '#fff', fontSize: 15, fontWeight: '600' },
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.35)' },
  hostSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30, maxHeight: '92%' },
  grabber: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  titleInput: { borderWidth: 1, borderRadius: 12, minHeight: 52, paddingHorizontal: 14, marginTop: 18, fontSize: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '500', marginTop: 18 },
  sheetTopics: { gap: 8, paddingTop: 9 },
  sheetChip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  roomTypeRail: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  roomTypeChip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  featureList: { marginTop: 14, borderRadius: 12, padding: 12 },
  featureItem: { fontSize: 12, lineHeight: 17 },
  paidPanel: { marginTop: 14, borderWidth: StyleSheet.hairlineWidth, borderRadius: 14, padding: 12 },
  priceInput: { marginTop: 9, minHeight: 44, borderRadius: 12, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, fontSize: 16 },
  summaryText: { marginTop: 9, fontSize: 12, lineHeight: 17 },
  sheetActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25 },
  startButton: { minHeight: 44, minWidth: 120, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 17 },
  startButtonText: { fontWeight: '600' },
});
