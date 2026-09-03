import { Ionicons } from '@expo/vector-icons';
import {
  createCurrentEventRoom,
  getCurrentEventRooms,
  type CurrentEventRoom,
  type CurrentEventTopic,
} from '@workspace/api-client-react';
import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
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

export default function CurrentEventsHome({
  colors,
  onBack,
  onOpenRoom,
  onRoomCreated,
  onRoomsChanged,
}: {
  colors: Colors;
  onBack: () => void;
  onOpenRoom: (room: CurrentEventRoom) => void;
  onRoomCreated: (room: CurrentEventRoom) => void;
  onRoomsChanged: (rooms: CurrentEventRoom[]) => void;
}) {
  const insets = useSafeAreaInsets();
  const [topic, setTopic] = useState<CurrentEventTopic>('for-you');
  const [rooms, setRooms] = useState<CurrentEventRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [hostOpen, setHostOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [hostTopic, setHostTopic] = useState<CurrentEventTopic>('for-you');
  const [isOpen, setIsOpen] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const loadRooms = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await getCurrentEventRooms(topic === 'for-you' ? undefined : { topic });
      setRooms(result.items);
      onRoomsChanged(result.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Current Events are unavailable right now.');
    } finally {
      setLoading(false);
    }
  }, [onRoomsChanged, topic]);

  useEffect(() => {
    void loadRooms();
    const interval = setInterval(() => void loadRooms(), 15_000);
    return () => clearInterval(interval);
  }, [loadRooms]);

  async function hostRoom() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const room = await createCurrentEventRoom({
        title: title.trim(),
        topic: hostTopic,
        isOpen,
      });
      setHostOpen(false);
      setTitle('');
      onRoomCreated(room);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not start this room.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { minHeight: insets.top + 60, paddingTop: insets.top, backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <Pressable onPress={onBack} accessibilityRole="button" accessibilityLabel="Back to Map" style={styles.headerButton}>
          <Ionicons name="arrow-back" size={23} color={colors.foreground} />
        </Pressable>
        <View pointerEvents="none" style={styles.headerTitleSlot}>
          <Text style={[typography.navigationTitle, styles.headerTitle, { color: colors.foreground }]}>Current Events</Text>
        </View>
        <Pressable onPress={() => setNotificationsOpen(true)} accessibilityRole="button" accessibilityLabel="Open Current Events notifications" style={styles.headerButton}>
          <Ionicons name="notifications-outline" size={22} color={colors.foreground} />
          {rooms.length > 0 ? <View style={styles.notificationDot} /> : null}
        </Pressable>
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
          data={rooms}
          keyExtractor={(room) => String(room.id)}
          contentContainerStyle={styles.roomList}
          showsVerticalScrollIndicator={false}
          scrollEnabled={rooms.length > 0}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Ionicons name="mic-outline" size={34} color={colors.primary} />
              <Text style={[styles.emptyTitle, { color: colors.foreground }]}>No live rooms yet</Text>
              <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Start a room and bring people into the conversation.</Text>
            </View>
          }
          renderItem={({ item }) => (
            <Pressable
              onPress={() => onOpenRoom(item)}
              accessibilityRole="button"
              accessibilityLabel={`Join ${item.title}`}
              style={({ pressed }) => [styles.roomCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.82 : 1 }]}
            >
              <View style={styles.roomCardTop}>
                <Text style={[styles.roomClub, { color: colors.mutedForeground }]}>{item.clubName.toUpperCase()}</Text>
                <View style={styles.liveLabel}><View style={styles.liveDot} /><Text style={styles.liveText}>LIVE</Text></View>
              </View>
              <Text style={[styles.roomTitle, { color: colors.foreground }]} numberOfLines={2}>{item.title}</Text>
              <View style={styles.roomMeta}>
                <View style={styles.avatarStack}>
                  {item.participants.slice(0, 4).map((participant, index) => (
                    <View key={participant.id} style={{ marginLeft: index === 0 ? 0 : -9 }}>
                      <Avatar name={participant.user.name} size={30} color={index % 2 === 0 ? colors.primary : colors.foreground} />
                    </View>
                  ))}
                </View>
                <Text style={[styles.countText, { color: colors.mutedForeground }]}>{item.counts.speakers} speaking · {item.counts.listeners} listening</Text>
                <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
              </View>
            </Pressable>
          )}
        />
      )}

      <Pressable onPress={() => setHostOpen(true)} style={[styles.hostButton, { backgroundColor: colors.primary }]} accessibilityRole="button" accessibilityLabel="Host a Current Event room">
        <Ionicons name="add" size={20} color={colors.primaryForeground} />
        <Text style={styles.hostButtonText}>host a room</Text>
      </Pressable>

      <Modal visible={notificationsOpen} transparent animationType="slide" onRequestClose={() => setNotificationsOpen(false)}>
        <View style={styles.modalShade}>
          <View style={[styles.notificationsSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.notificationsHeader, { borderBottomColor: colors.border }]}>
              <View>
                <Text style={[styles.notificationsEyebrow, { color: colors.mutedForeground }]}>CURRENT EVENTS</Text>
                <Text style={[styles.notificationsTitle, { color: colors.foreground }]}>Notifications</Text>
              </View>
              <Pressable onPress={() => setNotificationsOpen(false)} accessibilityRole="button" accessibilityLabel="Close notifications" style={[styles.closeButton, { backgroundColor: colors.muted }]}>
                <Ionicons name="close" size={22} color={colors.foreground} />
              </Pressable>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.notificationsList}>
              {rooms.length === 0 ? (
                <View style={styles.notificationsEmpty}>
                  <Ionicons name="notifications-off-outline" size={34} color={colors.mutedForeground} />
                  <Text style={[styles.emptyTitle, { color: colors.foreground }]}>You’re all caught up</Text>
                  <Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Live room updates will appear here.</Text>
                </View>
              ) : rooms.map((room) => (
                <Pressable
                  key={room.id}
                  onPress={() => {
                    setNotificationsOpen(false);
                    onOpenRoom(room);
                  }}
                  accessibilityRole="button"
                  accessibilityLabel={`Open notification for ${room.title}`}
                  style={[styles.notificationRow, { borderBottomColor: colors.border }]}
                >
                  <View style={styles.notificationIcon}>
                    <Ionicons name="radio-outline" size={20} color="#FFFFFF" />
                  </View>
                  <View style={styles.notificationCopy}>
                    <Text style={[styles.notificationRoomTitle, { color: colors.foreground }]} numberOfLines={2}>{room.title}</Text>
                    <Text style={[styles.notificationRoomMeta, { color: colors.mutedForeground }]}>{room.clubName} is live now · {room.counts.listeners} listening</Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} />
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      <Modal visible={hostOpen} transparent animationType="slide" onRequestClose={() => setHostOpen(false)}>
        <View style={styles.modalShade}>
          <View style={[styles.hostSheet, { backgroundColor: colors.card }]}>
            <View style={[styles.grabber, { backgroundColor: colors.border }]} />
            <Text style={[typography.sheetTitle, { color: colors.foreground }]}>Start a Current Event</Text>
            <TextInput
              value={title}
              onChangeText={setTitle}
              placeholder="What are you talking about?"
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
            <View style={styles.openRow}>
              <View style={{ flex: 1 }}>
                <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 0 }]}>Open to everyone</Text>
                <Text style={{ color: colors.mutedForeground, fontSize: 12, marginTop: 3 }}>Anyone can join as a listener.</Text>
              </View>
              <Switch value={isOpen} onValueChange={setIsOpen} trackColor={{ false: colors.border, true: colors.primary }} />
            </View>
            <View style={styles.sheetActions}>
              <Pressable onPress={() => setHostOpen(false)}><Text style={{ color: colors.mutedForeground, fontWeight: '700' }}>Cancel</Text></Pressable>
              <Pressable disabled={!title.trim() || saving} onPress={() => void hostRoom()} style={[styles.startButton, { backgroundColor: colors.primary, opacity: !title.trim() || saving ? 0.45 : 1 }]}>
                {saving ? <ActivityIndicator color={colors.primaryForeground} /> : <Text style={[styles.startButtonText, { color: colors.primaryForeground }]}>Start room</Text>}
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
  notificationDot: { position: 'absolute', top: 8, right: 8, width: 8, height: 8, borderRadius: 4, backgroundColor: '#F46A3D', borderWidth: 1.5, borderColor: '#FFFFFF' },
  topicScroller: { flexGrow: 0, maxHeight: 60 },
  topicRail: { gap: 8, paddingHorizontal: 16, paddingVertical: 12, alignItems: 'center' },
  topicChip: { borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, paddingVertical: 8 },
  topicText: { fontSize: 13, fontWeight: '500' },
  roomList: { paddingHorizontal: 16, paddingBottom: 150, gap: 12 },
  roomCard: { borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, padding: 15 },
  roomCardTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  roomClub: { fontSize: 11, fontWeight: '600', letterSpacing: 0.8 },
  liveLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#E5484D' },
  liveText: { color: '#E5484D', fontSize: 10, fontWeight: '600' },
  roomTitle: { fontSize: 16, lineHeight: 22, fontWeight: '600', marginTop: 9 },
  roomMeta: { flexDirection: 'row', alignItems: 'center', marginTop: 16, gap: 9 },
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
  notificationsSheet: { maxHeight: '72%', minHeight: 330, borderTopLeftRadius: 24, borderTopRightRadius: 24, overflow: 'hidden' },
  notificationsHeader: { minHeight: 78, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth },
  notificationsEyebrow: { fontSize: 10, fontWeight: '700', letterSpacing: 1.1 },
  notificationsTitle: { fontSize: 24, lineHeight: 30, fontWeight: '700', marginTop: 2 },
  closeButton: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  notificationsList: { paddingHorizontal: 18, paddingBottom: 28 },
  notificationsEmpty: { alignItems: 'center', paddingHorizontal: 24, paddingTop: 54 },
  notificationRow: { minHeight: 82, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  notificationIcon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: '#3559C7' },
  notificationCopy: { flex: 1 },
  notificationRoomTitle: { fontSize: 15, lineHeight: 20, fontWeight: '700' },
  notificationRoomMeta: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  hostSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20, paddingBottom: 30 },
  grabber: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 },
  sheetTitle: { fontSize: 22, lineHeight: 28, fontWeight: '600' },
  titleInput: { borderWidth: 1, borderRadius: 12, minHeight: 52, paddingHorizontal: 14, marginTop: 18, fontSize: 16 },
  fieldLabel: { fontSize: 14, fontWeight: '500', marginTop: 18 },
  sheetTopics: { gap: 8, paddingTop: 9 },
  sheetChip: { borderWidth: 1, borderRadius: 18, paddingHorizontal: 12, paddingVertical: 8 },
  openRow: { flexDirection: 'row', alignItems: 'center', marginTop: 20 },
  sheetActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 25 },
  startButton: { minHeight: 44, minWidth: 112, borderRadius: 22, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 17 },
  startButtonText: { fontWeight: '600' },
});