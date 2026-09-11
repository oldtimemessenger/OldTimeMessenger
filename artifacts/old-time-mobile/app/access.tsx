import { Ionicons } from '@expo/vector-icons';
import { createCurrentEventRoom, getCurrentEventRooms, type CurrentEventRoom, type CurrentEventRoomInput, type CurrentEventTopic } from '@workspace/api-client-react';
import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar } from '@/components/OldTimeUi';
import { useColors } from '@/hooks/useColors';
import { TAB_BAR_CONTENT_CLEARANCE } from '@/constants/layout';

const topics: Array<{ key: CurrentEventTopic | 'all'; label: string }> = [
  { key: 'all', label: 'All rooms' },
  { key: 'politics', label: 'Politics' },
  { key: 'markets', label: 'Markets' },
  { key: 'tech', label: 'Tech' },
  { key: 'culture', label: 'Culture' },
  { key: 'sports', label: 'Sports' },
  { key: 'world', label: 'World' },
];

const topicLabels: Record<string, string> = {
  politics: 'Politics',
  markets: 'Markets',
  tech: 'Tech',
  culture: 'Culture',
  sports: 'Sports',
  world: 'World',
};

function MicrophoneMark({ color, backgroundColor }: { color: string; backgroundColor: string }) {
  return (
    <View style={[styles.mark, { backgroundColor }]}>
      <View style={[styles.markStem, { borderColor: color }]}>
        <Ionicons name="mic" size={28} color={color} />
      </View>
      <View style={[styles.markArc, { borderColor: color }]} />
      <View style={[styles.markLine, { backgroundColor: color }]} />
    </View>
  );
}

export default function AccessScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [topic, setTopic] = useState<typeof topics[number]['key']>('all');
  const [rooms, setRooms] = useState<CurrentEventRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [hostTopic, setHostTopic] = useState<CurrentEventTopic>('culture');
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await getCurrentEventRooms(topic === 'all' ? undefined : { topic });
      setRooms(result.items);
      setError(null);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Access is unavailable right now.');
    } finally {
      setLoading(false);
    }
  }, [topic]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 8_000);
    return () => clearInterval(timer);
  }, [load]);

  const activeRoomCount = useMemo(() => rooms.length, [rooms.length]);

  const startRoom = async () => {
    if (!title.trim() || saving) return;
    setSaving(true);
    try {
      const input: CurrentEventRoomInput = { title: title.trim(), topic: hostTopic, isOpen: true };
      const room = await createCurrentEventRoom(input);
      setCreateOpen(false);
      setTitle('');
       router.push({ pathname: '/access-room', params: { roomId: String(room.id) } });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not start this Access room.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.background }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Back to Community" style={styles.headerButton}>
          <Ionicons name="arrow-back" size={22} color={colors.foreground} />
        </Pressable>
        <View style={styles.headerBrand}>
          <View style={[styles.brandMark, { backgroundColor: colors.primary }]}>
            <Ionicons name="mic" size={14} color={colors.primaryForeground} />
          </View>
          <Text style={[styles.brand, { color: colors.foreground }]}>ACCESS</Text>
        </View>
        <Pressable onPress={() => setCreateOpen(true)} accessibilityRole="button" accessibilityLabel="Start an Access room" style={[styles.headerButton, styles.startHeaderButton, { backgroundColor: colors.primary }]}>
          <Ionicons name="add" size={24} color={colors.primaryForeground} />
        </Pressable>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topicRail}>
        {topics.map((item) => (
          <Pressable
            key={item.key}
            onPress={() => setTopic(item.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: topic === item.key }}
            style={[styles.topicChip, { backgroundColor: topic === item.key ? colors.foreground : colors.muted, borderColor: topic === item.key ? colors.foreground : colors.border }]}
          >
            <Text style={{ color: topic === item.key ? colors.background : colors.mutedForeground, fontSize: 12, fontWeight: '800' }}>{item.label}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: TAB_BAR_CONTENT_CLEARANCE }]} showsVerticalScrollIndicator={false}>
          <View style={[styles.hero, { backgroundColor: colors.secondary }]}>
          <View style={styles.heroCopy}>
            <Text style={[styles.overline, { color: colors.primary }]}>LIVE CONVERSATIONS</Text>
            <Text style={[styles.heroTitle, { color: colors.foreground }]}>Be there when the room opens.</Text>
            <Text style={[styles.heroBody, { color: colors.mutedForeground }]}>Listen closely, share a thought, or step onto the stage.</Text>
          </View>
          <MicrophoneMark color={colors.primaryForeground} backgroundColor={colors.secondary} />
        </View>

        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionKicker, { color: colors.mutedForeground }]}>RIGHT NOW</Text>
            <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Rooms in motion</Text>
          </View>
          <View style={[styles.roomCount, { backgroundColor: colors.muted }]}>
            <View style={[styles.countDot, { backgroundColor: colors.destructive }]} />
            <Text style={[styles.countText, { color: colors.foreground }]}>{activeRoomCount} live</Text>
          </View>
        </View>

        {loading && rooms.length === 0 ? (
          <View style={styles.loadingState}>
            <ActivityIndicator color={colors.primary} />
            <Text style={[styles.stateText, { color: colors.mutedForeground }]}>Finding live rooms</Text>
          </View>
        ) : null}
        {error ? (
          <Pressable onPress={() => void load()} accessibilityRole="button" accessibilityLabel="Retry loading Access rooms" style={[styles.error, { backgroundColor: colors.muted, borderColor: colors.border }]}>
            <Ionicons name="cloud-offline-outline" size={18} color={colors.destructive} />
            <View style={styles.errorCopy}>
              <Text style={[styles.errorTitle, { color: colors.foreground }]}>Could not load live rooms</Text>
              <Text style={[styles.errorText, { color: colors.destructive }]}>{error}</Text>
            </View>
            <Ionicons name="refresh" size={18} color={colors.destructive} />
          </Pressable>
        ) : null}
        {!loading && !error && rooms.length === 0 ? (
          <View style={[styles.empty, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.secondary }]}>
              <Ionicons name="mic-outline" size={24} color={colors.primary} />
            </View>
            <Text style={[styles.emptyTitle, { color: colors.foreground }]}>The room is quiet.</Text>
            <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>Start a conversation and give people a reason to lean in.</Text>
            <Pressable onPress={() => setCreateOpen(true)} style={[styles.emptyAction, { backgroundColor: colors.primary }]}>
              <Text style={{ color: colors.primaryForeground, fontWeight: '800' }}>Start a room</Text>
            </Pressable>
          </View>
        ) : null}

        {rooms.map((room, index) => {
          const speakers = room.participants.filter((participant) => participant.role !== 'listener').slice(0, 4);
          return (
            <Pressable
              key={room.id}
               onPress={() => router.push({ pathname: '/access-room', params: { roomId: String(room.id) } })}
              accessibilityRole="button"
              accessibilityLabel={`Enter live room ${room.title}`}
              style={({ pressed }) => [styles.roomCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.78 : 1 }, index === 0 && styles.featuredRoom]}
            >
              <View style={[styles.roomAccent, { backgroundColor: colors.primary }]} />
              <View style={styles.roomTop}>
                <View style={styles.liveLabel}>
                  <View style={[styles.liveDot, { backgroundColor: colors.destructive }]} />
                  <Text style={[styles.liveText, { color: colors.destructive }]}>LIVE</Text>
                </View>
                <Text style={[styles.topicLabel, { color: colors.mutedForeground }]}>{topicLabels[room.topic] ?? room.topic}</Text>
              </View>
              <Text numberOfLines={3} style={[styles.roomTitle, { color: colors.foreground }]}>{room.title}</Text>
              <View style={styles.roomBottom}>
                <View style={styles.avatarStack}>
                  {speakers.map((participant, speakerIndex) => (
                    <View key={participant.id} style={{ marginLeft: speakerIndex ? -10 : 0 }}>
                      <Avatar size={32} accent={speakerIndex % 2 ? colors.secondary : colors.primary} />
                    </View>
                  ))}
                  {speakers.length === 0 ? <View style={[styles.noSpeakers, { backgroundColor: colors.muted }]}><Ionicons name="mic-outline" size={15} color={colors.mutedForeground} /></View> : null}
                </View>
                <Text style={[styles.roomMeta, { color: colors.mutedForeground }]}>{room.counts.speakers} speaking · {room.counts.listeners} listening</Text>
                <Ionicons name="arrow-forward" size={18} color={colors.foreground} />
              </View>
            </Pressable>
          );
        })}
      </ScrollView>

      <Pressable onPress={() => setCreateOpen(true)} style={[styles.startButton, { backgroundColor: colors.primary, bottom: insets.bottom + 18 }]} accessibilityRole="button" accessibilityLabel="Start an Access room">
        <Ionicons name="mic" size={18} color={colors.primaryForeground} />
        <Text style={{ color: colors.primaryForeground, fontWeight: '900' }}>Open a room</Text>
      </Pressable>

      <Modal visible={createOpen} transparent animationType="slide" onRequestClose={() => setCreateOpen(false)}>
        <View style={styles.modalRoot}>
          <Pressable onPress={() => setCreateOpen(false)} style={styles.modalShade} accessibilityRole="button" accessibilityLabel="Close start room" />
          <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 22 }]}>
            <View style={styles.sheetHeader}>
              <View>
                <Text style={[styles.sheetEyebrow, { color: colors.primary }]}>HOST AN ACCESS ROOM</Text>
                <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Set the tone.</Text>
              </View>
              <Pressable onPress={() => setCreateOpen(false)} accessibilityRole="button" accessibilityLabel="Close start room" style={styles.closeButton}>
                <Ionicons name="close" size={22} color={colors.foreground} />
              </Pressable>
            </View>
            <TextInput value={title} onChangeText={setTitle} autoFocus maxLength={120} placeholder="What should people talk about?" placeholderTextColor={colors.mutedForeground} style={[styles.titleInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.muted }]} />
            <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Choose a topic</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sheetTopics}>
              {topics.slice(1).map((item) => (
                <Pressable key={item.key} onPress={() => setHostTopic(item.key as CurrentEventTopic)} style={[styles.sheetChip, { backgroundColor: hostTopic === item.key ? colors.secondary : colors.muted, borderColor: hostTopic === item.key ? colors.primary : colors.border }]}>
                  {hostTopic === item.key ? <View style={[styles.selectedDot, { backgroundColor: colors.primary }]} /> : null}
                  <Text style={{ color: colors.foreground, fontSize: 12, fontWeight: '800' }}>{item.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>Your room starts public. Invite people onto the stage as the conversation finds its rhythm.</Text>
            <Pressable disabled={!title.trim() || saving} onPress={() => void startRoom()} style={[styles.confirm, { backgroundColor: colors.primary, opacity: !title.trim() || saving ? 0.5 : 1 }]}>
              {saving ? <ActivityIndicator color={colors.primaryForeground} /> : <><Ionicons name="mic" size={18} color={colors.primaryForeground} /><Text style={{ color: colors.primaryForeground, fontWeight: '900' }}>Go live</Text></>}
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: { minHeight: 84, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  startHeaderButton: { borderRadius: 16 },
  headerBrand: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  brandMark: { width: 28, height: 28, borderRadius: 10, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-7deg' }] },
  brand: { fontFamily: 'Outfit_700Bold', fontSize: 16, letterSpacing: 2.5 },
  topicRail: { gap: 10, paddingHorizontal: 18, paddingBottom: 16 },
  topicChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 16, paddingVertical: 10 },
  content: { paddingHorizontal: 18, gap: 14 },
  hero: { minHeight: 180, borderRadius: 24, padding: 22, flexDirection: 'row', alignItems: 'center', overflow: 'hidden' },
  heroCopy: { flex: 1, paddingRight: 10 },
  overline: { fontFamily: 'Outfit_700Bold', fontSize: 11, letterSpacing: 1.5 },
  heroTitle: { fontFamily: 'Fraunces_900Black', fontSize: 30, lineHeight: 34, letterSpacing: -1.1, marginTop: 10 },
  heroBody: { fontFamily: 'Outfit_500Medium', fontSize: 14, lineHeight: 20, marginTop: 10, maxWidth: 220 },
  mark: { width: 84, height: 116, borderRadius: 42, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '8deg' }] },
  markStem: { width: 48, height: 61, borderWidth: 2, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  markArc: { position: 'absolute', width: 58, height: 72, borderWidth: 2, borderTopColor: 'transparent', borderLeftColor: 'transparent', borderRightColor: 'transparent', borderRadius: 30, bottom: 20 },
  markLine: { position: 'absolute', width: 2, height: 13, bottom: 8 },
  sectionHeader: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 14, marginBottom: 2 },
  sectionKicker: { fontFamily: 'Outfit_700Bold', fontSize: 11, letterSpacing: 1.3 },
  sectionTitle: { fontFamily: 'Fraunces_900Black', fontSize: 24, letterSpacing: -0.5, marginTop: 4 },
  roomCount: { borderRadius: 16, paddingHorizontal: 12, paddingVertical: 8, flexDirection: 'row', alignItems: 'center', gap: 8 },
  countDot: { width: 8, height: 8, borderRadius: 4 },
  countText: { fontFamily: 'Outfit_700Bold', fontSize: 12 },
  loadingState: { alignItems: 'center', paddingVertical: 64, gap: 14 },
  stateText: { fontFamily: 'Outfit_600SemiBold', fontSize: 13 },
  error: { borderRadius: 18, borderWidth: 1, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' },
  errorCopy: { flex: 1 },
  errorTitle: { fontFamily: 'Outfit_700Bold', fontSize: 14 },
  errorText: { fontFamily: 'Outfit_500Medium', fontSize: 13, lineHeight: 18, marginTop: 4 },
  empty: { alignItems: 'center', padding: 32, borderWidth: 1, borderRadius: 24 },
  emptyIcon: { width: 60, height: 60, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 20, marginTop: 16 },
  emptyBody: { fontFamily: 'Outfit_400Regular', textAlign: 'center', fontSize: 14, lineHeight: 22, marginTop: 8, maxWidth: 280 },
  emptyAction: { paddingHorizontal: 20, paddingVertical: 14, borderRadius: 20, marginTop: 20 },
  roomCard: { position: 'relative', borderRadius: 24, borderWidth: 1, padding: 20, overflow: 'hidden' },
  featuredRoom: { paddingTop: 22 },
  roomAccent: { position: 'absolute', left: 0, top: 0, bottom: 0, width: 6 },
  roomTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  liveLabel: { flexDirection: 'row', gap: 8, alignItems: 'center' },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  liveText: { fontFamily: 'Outfit_700Bold', fontSize: 11, letterSpacing: 1.2 },
  topicLabel: { fontFamily: 'Outfit_700Bold', fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.8 },
  roomTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 20, lineHeight: 26, marginTop: 14, paddingRight: 14 },
  roomBottom: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 20 },
  avatarStack: { flexDirection: 'row', width: 84, alignItems: 'center' },
  noSpeakers: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  roomMeta: { flex: 1, fontFamily: 'Outfit_600SemiBold', fontSize: 13 },
  startButton: { position: 'absolute', alignSelf: 'center', minHeight: 56, borderRadius: 28, paddingHorizontal: 24, flexDirection: 'row', alignItems: 'center', gap: 10 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,22,20,0.52)' },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  sheetEyebrow: { fontFamily: 'Outfit_700Bold', fontSize: 11, letterSpacing: 1.3 },
  sheetTitle: { fontFamily: 'Fraunces_900Black', fontSize: 28, marginTop: 6 },
  closeButton: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  titleInput: { minHeight: 56, borderRadius: 18, borderWidth: 1, paddingHorizontal: 16, marginTop: 24, fontFamily: 'Outfit_500Medium', fontSize: 16 },
  fieldLabel: { fontFamily: 'Outfit_700Bold', fontSize: 14, marginTop: 24 },
  sheetTopics: { gap: 10, paddingTop: 12 },
  sheetChip: { borderRadius: 20, borderWidth: 1, paddingHorizontal: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', gap: 8 },
  selectedDot: { width: 8, height: 8, borderRadius: 4 },
  hint: { fontFamily: 'Outfit_400Regular', fontSize: 14, lineHeight: 22, marginTop: 24 },
  confirm: { minHeight: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center', marginTop: 26, flexDirection: 'row', gap: 10 },
});