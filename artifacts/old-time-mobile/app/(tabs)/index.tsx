import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Image } from 'expo-image';
import { getGetInboxQueryKey, getListUsersQueryKey, useCreateChat, useGetInbox, useListUsers, useLogout, type InboxItem, type User } from '@workspace/api-client-react';
import { Avatar, EmptyState, IconButton, LoadingState, Screen, StoryAvatar } from '@/components/ui';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';
import { typography } from '@/constants/typography';
import { useQueryClient } from '@tanstack/react-query';
import { getStories, type Story } from '@/lib/social-api';
import { presenceLabel } from '@/lib/presence';

function timeLabel(timestamp?: number) {
  if (!timestamp) return '';
  return new Date(timestamp < 100000000000 ? timestamp * 1000 : timestamp).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

export default function ChatsScreen() {
  const colors = useColors();
  const router = useRouter();
  const { mediaUri, mediaType, mediaFit } = useLocalSearchParams<{
    mediaUri?: string;
    mediaType?: 'image' | 'video';
    mediaFit?: 'contain' | 'cover';
  }>();
  const queryClient = useQueryClient();
  const { profile, session, setSession } = useApp();
  const [search, setSearch] = useState('');
  const [showNew, setShowNew] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [pendingMedia, setPendingMedia] = useState<{ uri: string; type: 'image' | 'video'; fit?: 'contain' | 'cover' } | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [stories, setStories] = useState<Story[]>([]);
  const inbox = useGetInbox(session?.id ?? 0, { query: { enabled: Boolean(session), refetchInterval: 6000, queryKey: getGetInboxQueryKey(session?.id ?? 0) } });
  const users = useListUsers({ viewerId: session?.id ?? 0 }, { query: { enabled: Boolean(session), staleTime: 15000, queryKey: getListUsersQueryKey({ viewerId: session?.id ?? 0 }) } });
  const createChat = useCreateChat();
  const logout = useLogout();
  const items = useMemo(() => (inbox.data ?? []).filter((item) => `${item.contact.name} ${item.lastMessage?.content ?? ''}`.toLowerCase().includes(search.toLowerCase())), [inbox.data, search]);

  useEffect(() => {
    if (!session?.authToken) {
      setStories([]);
      return;
    }
    let active = true;
    void getStories(session.authToken)
      .then((page) => { if (active) setStories(page.items); })
      .catch(() => { if (active) setStories([]); });
    return () => { active = false; };
  }, [session?.authToken]);

  useEffect(() => {
    if (!mediaUri) return;
    setPendingMedia({ uri: mediaUri, type: mediaType === 'video' ? 'video' : 'image', fit: mediaFit });
    setShowNew(true);
    router.setParams({ mediaUri: undefined, mediaType: undefined, mediaFit: undefined });
  }, [mediaUri, mediaType, mediaFit]);

  if (inbox.isLoading) return <Screen title="Chats"><LoadingState /></Screen>;

  function startChat(user: User) {
    if (!session) return;
    createChat.mutate({ data: { userIds: [session.id, user.id] } }, {
      onSuccess: (chat) => {
        setShowNew(false);
        const media = pendingMedia;
        setPendingMedia(null);
        router.push(media
          ? { pathname: '/chat/[id]', params: { id: String(chat.id), mediaUri: media.uri, mediaType: media.type, mediaFit: media.fit } }
          : `/chat/${chat.id}`);
      },
      onError: (error) => {
        Alert.alert('Chat unavailable', error instanceof Error ? error.message : `You cannot start a chat with ${user.name} yet.`);
      },
    });
  }

  function signOut() {
    setShowProfile(false);
    logout.mutate(undefined);
    setSession(null);
    queryClient.clear();
    router.replace('/');
  }

  const profileName = session?.name ?? profile.name ?? 'Old Time User';
  const profilePhone = session?.phone ?? profile.phone;
  const profileUsername = session?.username ?? profile.username;
  const profileBio = session?.bio ?? profile.bio;

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

  return <Screen title="Chats" left={<IconButton name="albums-outline" label="Open stories" onPress={() => router.push('/(tabs)/updates-screen')} />} right={<View style={styles.headerActions}><IconButton name="person-outline" label="Open profile" onPress={() => setShowProfile(true)} /><IconButton name="add" label="Create story or send media" onPress={() => setShowCreate(true)} /></View>}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.storyDrawer, { borderBottomColor: colors.border, backgroundColor: colors.card }]} contentContainerStyle={styles.storyDrawerContent}>
      <Pressable onPress={() => router.push('/(tabs)/updates-screen')} style={styles.storyItem} accessibilityRole="button" accessibilityLabel="Add your story">
        <StoryAvatar name={profileName} color={colors.muted} uri={profile.avatarUri} add />
        <Text style={[styles.storyName, { color: colors.foreground }]}>My Story</Text>
      </Pressable>
      {stories.filter((story) => !story.viewer.isOwner).map((story) => (
        <Pressable key={story.id} onPress={() => router.push('/(tabs)/updates-screen')} style={styles.storyItem} accessibilityRole="button" accessibilityLabel={`Open ${story.author.name}'s story`}>
          <StoryAvatar name={story.author.name} color={colors.secondary} viewed={story.viewer.viewed} />
          <Text style={[styles.storyName, { color: colors.foreground }]} numberOfLines={1}>{story.author.name}</Text>
        </Pressable>
      ))}
    </ScrollView>
    <View style={styles.searchContainer}>
      <View style={[styles.search, { backgroundColor: colors.muted }]}>
        <Ionicons name="search" size={16} color={colors.mutedForeground} />
        <TextInput value={search} onChangeText={setSearch} placeholder="Search" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} clearButtonMode="while-editing" />
      </View>
    </View>
    {inbox.isError ? <EmptyState icon="cloud-offline-outline" title="Could not load chats" description="Check your connection." action={<Pressable onPress={() => inbox.refetch()}><Text style={{ color: colors.primary, fontWeight: '600', fontSize: 16 }}>Try again</Text></Pressable>} /> : items.length === 0 ? <EmptyState icon="chatbubble-ellipses-outline" title="No chats yet" description="Start a conversation." action={<Pressable onPress={() => setShowNew(true)}><Text style={{ color: colors.primary, fontWeight: '600', fontSize: 16 }}>New message</Text></Pressable>} /> : <FlatList data={items} keyExtractor={(item) => String(item.chat.id)} contentContainerStyle={{ paddingBottom: 100 }} renderItem={renderChatItem} />}
    <Modal visible={showNew} transparent animationType="slide" onRequestClose={() => setShowNew(false)}>
      <View style={styles.modalShade}>
        <View style={[styles.sheet, { backgroundColor: colors.card }]}>
          <View style={styles.sheetHeader}><Text style={[styles.sheetTitle, { color: colors.foreground }]}>{pendingMedia ? 'Send to someone' : 'New message'}</Text><IconButton name="close" onPress={() => { setShowNew(false); setPendingMedia(null); }} /></View>
          {pendingMedia ? (
            <View style={[styles.mediaDraft, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              {pendingMedia.type === 'image' ? <Image source={{ uri: pendingMedia.uri }} style={styles.mediaDraftImage} contentFit={pendingMedia.fit ?? 'contain'} /> : <View style={styles.mediaDraftVideo}><Ionicons name="videocam" size={26} color={colors.primary} /><Text style={{ color: colors.foreground, fontWeight: '600' }}>Video ready to send</Text></View>}
              <Text style={[styles.mediaDraftLabel, { color: colors.mutedForeground }]}>Choose who should receive it</Text>
            </View>
          ) : null}
           {users.isLoading ? <LoadingState /> : (users.data ?? []).filter((user) => user.id !== session?.id).map((user) => (
            <Pressable key={user.id} onPress={() => startChat(user)} style={[styles.person, { borderBottomColor: colors.border }]}>
               <Avatar name={user.name} size={42} />
               <View style={{ flex: 1 }}><Text style={[styles.personName, { color: colors.foreground }]}>{user.name}</Text><Text style={[styles.personPhone, { color: user.online ? colors.primary : colors.mutedForeground }]}>{presenceLabel(user)}</Text></View>
              <Ionicons name="arrow-forward-circle-outline" size={22} color={colors.primary} />
            </Pressable>
          ))}
        </View>
      </View>
    </Modal>

     <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
       <View style={styles.modalShade}>
         <View style={[styles.sheet, { backgroundColor: colors.card }]}>
           <View style={styles.sheetHeader}><View><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Create</Text><Text style={[styles.createHint, { color: colors.mutedForeground }]}>Camera first. You choose what happens next.</Text></View><IconButton name="close" onPress={() => setShowCreate(false)} /></View>
           <Pressable onPress={() => { setShowCreate(false); router.push({ pathname: '/camera', params: { returnTo: 'status' } }); }} style={[styles.createChoice, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Create a story from the camera">
             <View style={[styles.createChoiceIcon, { backgroundColor: colors.primary }]}><Ionicons name="add-circle-outline" size={22} color="#fff" /></View>
             <View style={{ flex: 1 }}><Text style={[styles.createChoiceTitle, { color: colors.foreground }]}>Create a story</Text><Text style={[styles.createChoiceDetail, { color: colors.mutedForeground }]}>Take a photo or video and share it for 24 hours.</Text></View>
             <Ionicons name="chevron-forward" size={19} color={colors.mutedForeground} />
           </Pressable>
           <Pressable onPress={() => { setShowCreate(false); router.push({ pathname: '/camera', params: { returnTo: 'chat' } }); }} style={[styles.createChoice, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Create media to send to someone">
             <View style={[styles.createChoiceIcon, { backgroundColor: colors.secondary }]}><Ionicons name="paper-plane-outline" size={22} color={colors.primary} /></View>
             <View style={{ flex: 1 }}><Text style={[styles.createChoiceTitle, { color: colors.foreground }]}>Send to someone</Text><Text style={[styles.createChoiceDetail, { color: colors.mutedForeground }]}>Take a photo or video, then choose a chat.</Text></View>
             <Ionicons name="chevron-forward" size={19} color={colors.mutedForeground} />
           </Pressable>
         </View>
       </View>
     </Modal>

     <Modal visible={showProfile} transparent animationType="slide" onRequestClose={() => setShowProfile(false)}>
      <View style={styles.profileOverlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={() => setShowProfile(false)} />
        <View style={[styles.profileCard, { backgroundColor: colors.card }]}>
          <View style={[styles.profileHero, { backgroundColor: colors.primary }]}>
            <Pressable onPress={() => setShowProfile(false)} style={styles.profileClose} accessibilityRole="button" accessibilityLabel="Close profile">
              <Ionicons name="close" size={22} color="#fff" />
            </Pressable>
            <Avatar name={profileName} size={72} color={`${colors.primary}CC`} uri={profile.avatarUri} />
            <Text style={styles.profileName}>{profileName}</Text>
            {profileUsername ? <Text style={styles.profileUsername}>@{profileUsername}</Text> : null}
            {profilePhone ? <Text style={styles.profilePhone}>{profilePhone}</Text> : null}
          </View>
          <View style={styles.profileBody}>
            {profileBio ? <Text style={[styles.profileBio, { color: colors.foreground }]}>{profileBio}</Text> : null}
            <Text style={[styles.profileLabel, { color: colors.mutedForeground }]}>ACCOUNT</Text>
            <View style={[styles.profileStatus, { backgroundColor: colors.muted }]}>
              <View style={[styles.profileStatusIcon, { backgroundColor: colors.card }]}>
                <Ionicons name="person-outline" size={18} color={colors.primary} />
              </View>
              <View style={styles.profileStatusCopy}>
                <Text style={[styles.profileStatusTitle, { color: colors.foreground }]}>Available</Text>
                <Text style={[styles.profileStatusDetail, { color: colors.mutedForeground }]}>Your profile is visible to contacts</Text>
              </View>
            </View>
            <Pressable onPress={() => { setShowProfile(false); router.push('/(tabs)/settings'); }} style={[styles.profileEdit, { backgroundColor: colors.secondary }]} accessibilityRole="button" accessibilityLabel="Edit profile in settings">
              <Ionicons name="create-outline" size={17} color={colors.primary} />
              <Text style={[styles.profileEditText, { color: colors.primary }]}>Edit profile</Text>
            </Pressable>
            <Pressable onPress={signOut} disabled={logout.isPending} style={({ pressed }) => [styles.profileLogout, { opacity: logout.isPending ? 0.5 : pressed ? 0.65 : 1 }]}>
              <Ionicons name="log-out-outline" size={17} color={colors.destructive} />
              <Text style={[styles.profileLogoutText, { color: colors.destructive }]}>{logout.isPending ? 'Logging out…' : 'Log out'}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  </Screen>;
}

const styles = StyleSheet.create({
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  storyDrawer: { maxHeight: 98, borderBottomWidth: StyleSheet.hairlineWidth },
  storyDrawerContent: { paddingHorizontal: 14, paddingVertical: 11, gap: 14 },
  storyItem: { width: 62, alignItems: 'center' },
  storyName: { fontSize: 10.5, fontWeight: '600', marginTop: 5, width: 62, textAlign: 'center' },
  searchContainer: { paddingHorizontal: 16, paddingVertical: 10, backgroundColor: 'transparent' },
  search: { height: 36, borderRadius: 10, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8 },
  searchInput: { ...typography.body, flex: 1 },
  chatRow: { minHeight: 74, flexDirection: 'row', alignItems: 'center', gap: 12, borderBottomWidth: StyleSheet.hairlineWidth, paddingVertical: 10, paddingHorizontal: 16 },
  chatBody: { flex: 1 },
  chatTop: { flexDirection: 'row', justifyContent: 'space-between', gap: 8 },
  chatName: { ...typography.username, flex: 1 },
  time: { ...typography.timestamp, fontSize: 13 },
  chatBottom: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 5 },
  preview: { ...typography.secondary, flex: 1 },
  badge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  badgeText: { color: '#fff', fontSize: 12, fontWeight: '600' },
  modalShade: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: { maxHeight: '78%', borderTopLeftRadius: 14, borderTopRightRadius: 14, padding: 18 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  sheetTitle: { ...typography.sheetTitle },
  createHint: { fontSize: 12, marginTop: 3, maxWidth: 250 },
  createChoice: { minHeight: 82, borderWidth: 1, borderRadius: 16, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 10 },
  createChoiceIcon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  createChoiceTitle: { fontSize: 16, fontWeight: '700' },
  createChoiceDetail: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  mediaDraft: { borderWidth: 1, borderRadius: 14, padding: 8, marginBottom: 4 },
  mediaDraftImage: { width: '100%', height: 120, borderRadius: 10 },
  mediaDraftVideo: { height: 82, alignItems: 'center', justifyContent: 'center', gap: 5 },
  mediaDraftLabel: { fontSize: 11, textAlign: 'center', marginTop: 7 },
  person: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  personName: { ...typography.username },
  personPhone: { ...typography.secondary, marginTop: 2 },
  profileOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.38)' },
  profileCard: { width: '100%', overflow: 'hidden', borderTopLeftRadius: 26, borderTopRightRadius: 26, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 18, shadowOffset: { width: 0, height: 8 }, elevation: 8 },
  profileHero: { alignItems: 'center', paddingHorizontal: 20, paddingTop: 28, paddingBottom: 24 },
  profileClose: { position: 'absolute', top: 10, right: 10, width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.14)' },
  profileName: { color: '#fff', fontSize: 22, fontWeight: '600', marginTop: 12, letterSpacing: 0.2 },
  profileUsername: { color: 'rgba(255,255,255,0.84)', fontSize: 14, marginTop: 4 },
  profilePhone: { color: 'rgba(255,255,255,0.82)', fontSize: 15, marginTop: 3 },
  profileBody: { padding: 20 },
  profileBio: { fontSize: 15, lineHeight: 21, textAlign: 'center', marginBottom: 18 },
  profileLabel: { fontSize: 12, fontWeight: '600', letterSpacing: 1, marginBottom: 10 },
  profileStatus: { flexDirection: 'row', alignItems: 'center', gap: 12, borderRadius: 14, padding: 12 },
  profileStatusIcon: { width: 38, height: 38, alignItems: 'center', justifyContent: 'center', borderRadius: 19 },
  profileStatusCopy: { flex: 1 },
  profileStatusTitle: { fontSize: 16, fontWeight: '600', letterSpacing: -0.1 },
  profileStatusDetail: { fontSize: 14, marginTop: 2 },
  profileEdit: { minHeight: 44, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, borderRadius: 12 },
  profileEditText: { fontSize: 16, fontWeight: '600' },
  profileLogout: { minHeight: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 14, borderRadius: 12 },
  profileLogoutText: { fontSize: 16, fontWeight: '600' },
});
