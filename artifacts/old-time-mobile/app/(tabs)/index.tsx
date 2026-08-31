import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { getGetInboxQueryKey, getListUsersQueryKey, useCreateChat, useGetInbox, useListUsers, type InboxItem, type User } from '@workspace/api-client-react';
import { Avatar, EmptyState, IconButton, LoadingState, Screen } from '@/components/ui';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';

function timeLabel(timestamp?: number) {
  if (!timestamp) return '';
  return new Date(timestamp < 100000000000 ? timestamp * 1000 : timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function ChatsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { session } = useApp();
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const inbox = useGetInbox(session?.id ?? 0, { query: { enabled: Boolean(session), refetchInterval: 6000, queryKey: getGetInboxQueryKey(session?.id ?? 0) } });
  const users = useListUsers({ viewerId: session?.id ?? 0 }, { query: { enabled: Boolean(session), staleTime: 15000, queryKey: getListUsersQueryKey({ viewerId: session?.id ?? 0 }) } });
  const createChat = useCreateChat();
  const items = useMemo(() => (inbox.data ?? []).filter((item) => `${item.contact.name} ${item.lastMessage?.content ?? ''}`.toLowerCase().includes(search.toLowerCase())), [inbox.data, search]);

  if (inbox.isLoading) return <Screen title="Chats"><LoadingState /></Screen>;

  function startChat(user: User) {
    if (!session) return;
    createChat.mutate({ data: { userIds: [session.id, user.id] } }, { onSuccess: (chat) => { setShowNew(false); router.push(`/chat/${chat.id}`); } });
  }

  const renderChatItem = ({ item }: { item: InboxItem }) => (
    <Pressable onPress={() => router.push(`/chat/${item.chat.id}`)} style={({ pressed }) => [styles.chatRow, { borderBottomColor: colors.border, opacity: pressed ? 0.7 : 1 }]}>
      <Avatar name={item.contact.name} />
      <View style={styles.chatBody}>
        <View style={styles.chatTop}>
          <Text style={[styles.chatName, { color: colors.foreground }]} numberOfLines={1}>{item.contact.name}</Text>
          <Text style={[styles.time, { color: colors.mutedForeground }]}>{timeLabel(item.lastMessage?.timestamp)}</Text>
        </View>
        <View style={styles.chatBottom}>
          <Text style={[styles.preview, { color: colors.mutedForeground }]} numberOfLines={1}>{item.lastMessage?.content ?? 'Start a conversation'}</Text>
          {item.unreadCount > 0 ? <View style={[styles.badge, { backgroundColor: colors.primary }]}><Text style={styles.badgeText}>{item.unreadCount}</Text></View> : null}
        </View>
      </View>
    </Pressable>
  );

  return <Screen title="Chats" right={<IconButton name="create-outline" label="New message" onPress={() => setShowNew(true)} />}>
    <View style={[styles.search, { backgroundColor: colors.muted }]}>
      <Ionicons name="search" size={18} color={colors.mutedForeground} />
      <TextInput value={search} onChangeText={setSearch} placeholder="Search chats" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} />
    </View>
    {inbox.isError ? <EmptyState icon="cloud-offline-outline" title="Could not load chats" description="Check your connection and pull to refresh." action={<Pressable onPress={() => inbox.refetch()}><Text style={{ color: colors.primary, fontWeight: '700' }}>Try again</Text></Pressable>} /> : items.length === 0 ? <EmptyState icon="chatbubble-ellipses-outline" title="No chats yet" description="Start a conversation with someone from your Old Time contacts." action={<Pressable onPress={() => setShowNew(true)}><Text style={{ color: colors.primary, fontWeight: '700' }}>New message</Text></Pressable>} /> : <FlatList data={items} keyExtractor={(item) => String(item.chat.id)} contentContainerStyle={{ paddingBottom: 100 }} renderItem={renderChatItem} />}
    <Modal visible={showNew} transparent animationType="slide" onRequestClose={() => setShowNew(false)}>
      <View style={styles.modalShade}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={styles.sheetHeader}><Text style={[styles.sheetTitle, { color: colors.foreground }]}>New message</Text><IconButton name="close" onPress={() => setShowNew(false)} /></View>
           {users.isLoading ? <LoadingState /> : (users.data ?? []).filter((user) => user.id !== session?.id).map((user) => (
            <Pressable key={user.id} onPress={() => startChat(user)} style={[styles.person, { borderBottomColor: colors.border }]}>
               <Avatar name={user.name} size={42} />
              <View style={{ flex: 1 }}><Text style={[styles.personName, { color: colors.foreground }]}>{user.name}</Text><Text style={[styles.personPhone, { color: colors.mutedForeground }]}>{user.online ? 'Online now' : user.lastSeen ? `Last seen ${new Date(user.lastSeen).toLocaleString()}` : 'Offline'}</Text></View>
              <Ionicons name="arrow-forward-circle-outline" size={22} color={colors.primary} />
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>
  </Screen>;
}

const styles = StyleSheet.create({
  search: { minHeight: 44, borderRadius: 9, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 13, marginBottom: 5 },
  searchInput: { flex: 1, fontSize: 15 },
  chatRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10, paddingHorizontal: 2 },
  chatBody: { flex: 1 },
  chatTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  chatName: { fontSize: 15, fontWeight: '700', flex: 1 },
  time: { fontSize: 11 },
  chatBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  preview: { fontSize: 13, flex: 1 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 11, fontWeight: '800' },
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '78%', borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 18 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sheetTitle: { fontSize: 20, fontWeight: '800' },
  person: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  personName: { fontSize: 15, fontWeight: '700' },
  personPhone: { fontSize: 12, marginTop: 2 },
});
