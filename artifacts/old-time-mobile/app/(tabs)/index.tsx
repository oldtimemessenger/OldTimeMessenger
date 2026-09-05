import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as Contacts from 'expo-contacts';
import * as Crypto from 'expo-crypto';
import { Image } from 'expo-image';
import { getGetInboxQueryKey, getListUsersQueryKey, useCreateChat, useGetInbox, useListUsers, useLogout, type InboxItem, type User } from '@workspace/api-client-react';
import { Avatar, EmptyState, IconButton, LoadingState, Screen, StoryAvatar } from '@/components/ui';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';
import { typography } from '@/constants/typography';
import { useQueryClient } from '@tanstack/react-query';
import { discoverContacts as discoverServerContacts, getStories, type Story } from '@/lib/social-api';
import { presenceLabel } from '@/lib/presence';
import { ServerStoryViewer } from '@/components/server-story-viewer';
import { buildStoryViewerItems } from '@/lib/story-viewer-sequence';
import { userStoryViewerItemId } from '@/components/story-viewer-content';

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
  const [newMessageSearch, setNewMessageSearch] = useState('');
  const [contactMatches, setContactMatches] = useState<User[]>([]);
  const [unmatchedContacts, setUnmatchedContacts] = useState<string[]>([]);
  const [contactDiscoveryState, setContactDiscoveryState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [pendingMedia, setPendingMedia] = useState<{ uri: string; type: 'image' | 'video'; fit?: 'contain' | 'cover' } | null>(null);
  const [startingChatUserId, setStartingChatUserId] = useState<number | null>(null);
  const [showProfile, setShowProfile] = useState(false);
  const [storyOpen, setStoryOpen] = useState<Story | null>(null);
  const [contactsPermission, setContactsPermission] = useState<{ granted: boolean; status: string; canAskAgain: boolean } | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const inbox = useGetInbox(session?.id ?? 0, { query: { enabled: Boolean(session), refetchInterval: 6000, queryKey: getGetInboxQueryKey(session?.id ?? 0) } });
  const users = useListUsers({ viewerId: session?.id ?? 0 }, { query: { enabled: Boolean(session), staleTime: 15000, queryKey: getListUsersQueryKey({ viewerId: session?.id ?? 0 }) } });
  const createChat = useCreateChat();
  const logout = useLogout();
  const items = useMemo(() => (inbox.data ?? []).filter((item) => `${item.contact.name} ${item.lastMessage?.content ?? ''}`.toLowerCase().includes(search.toLowerCase())), [inbox.data, search]);
  const directoryUsers = useMemo(() => (users.data ?? [])
    .filter((user) => user.id !== session?.id)
    .filter((user) => `${user.name} ${user.username}`.toLowerCase().includes(newMessageSearch.trim().toLowerCase())), [newMessageSearch, session?.id, users.data]);

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
    const media = pendingMedia;
    const openChat = (chatId: number) => {
      setStartingChatUserId(null);
      setShowNew(false);
      setPendingMedia(null);
      setNewMessageSearch('');
      router.push(media
        ? {
            pathname: '/chat/[id]',
            params: {
              id: String(chatId),
              mediaUri: media.uri,
              mediaType: media.type,
              mediaFit: media.fit,
            },
          }
        : `/chat/${chatId}`);
    };
    const existing = inbox.data?.find((item) => item.contact.id === user.id);
    if (existing) {
      openChat(existing.chat.id);
      return;
    }
    if (createChat.isPending) return;
    setStartingChatUserId(user.id);
    createChat.mutate({ data: { userIds: [session.id, user.id] } }, {
      onSuccess: (chat) => {
        openChat(chat.id);
      },
      onError: (error) => {
        setStartingChatUserId(null);
        Alert.alert('Chat unavailable', error instanceof Error ? error.message : `You cannot start a chat with ${user.name} yet.`);
      },
    });
  }

  function openStory(story: Story) {
    setStoryOpen(story);
  }

  function openStories() {
    const firstStory = stories[0];
    if (firstStory) {
      openStory(firstStory);
      return;
    }
    router.navigate('/(tabs)/updates');
  }

  function openMyStory() {
    const ownStory = stories.find((story) => story.viewer.isOwner);
    if (ownStory) {
      openStory(ownStory);
      return;
    }
    router.navigate({ pathname: '/(tabs)/updates', params: { composeType: 'status' } });
  }

  function normalizePhone(value?: string) {
    const raw = (value ?? '').trim();
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 10) return `+1${digits}`;
    if (digits.length === 11 && digits.startsWith('1')) return `+${digits}`;
    return raw.startsWith('+') && digits.length >= 8 && digits.length <= 15 ? `+${digits}` : '';
  }

  async function discoverContacts() {
    if (Platform.OS === 'web') {
      Alert.alert('Contact discovery is mobile-only', 'Use the Old Time app on iPhone or Android to match your phone contacts privately.');
      return;
    }
    let permission = contactsPermission ?? await Contacts.getPermissionsAsync();
    if (!permission?.granted) {
      permission = await Contacts.requestPermissionsAsync();
      setContactsPermission(permission);
    }
    if (!permission.granted) {
      Alert.alert(
        permission.canAskAgain ? 'Allow contact access?' : 'Contacts permission is off',
        permission.canAskAgain
          ? 'Allow Contacts so Old Time can show which of your phone contacts already use the app. Your address book stays on this device.'
          : 'Enable Contacts in device settings to find friends who already use Old Time.',
        permission.canAskAgain
          ? [{ text: 'Not now', style: 'cancel' }, { text: 'Try again', onPress: () => { void discoverContacts(); } }]
          : [{ text: 'Not now', style: 'cancel' }, { text: 'Open Settings', onPress: () => { void Linking.openSettings(); } }],
      );
      return;
    }
    setContactDiscoveryState('loading');
    try {
      const result = await Contacts.getContactsAsync({ fields: [Contacts.Fields.PhoneNumbers] });
      if (!session?.authToken) throw new Error('Sign in to find contacts.');
      const phoneToHash = new Map<string, string>();
      const localNamesByHash = new Map<string, string>();
      for (const contact of result.data) {
        for (const phone of (contact.phoneNumbers ?? []).map((entry) => normalizePhone(entry.number)).filter(Boolean)) {
          const hash = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, phone);
          phoneToHash.set(phone, hash);
          if (contact.name) localNamesByHash.set(hash, contact.name);
        }
      }
      const hashes = [...new Set(phoneToHash.values())];
      const pages = await Promise.all(Array.from({ length: Math.ceil(hashes.length / 500) }, (_, index) =>
        discoverServerContacts(session.authToken, hashes.slice(index * 500, index * 500 + 500))));
      const matches = pages.flatMap((page) => page.matches);
      const matched = matches.map((match) => ({
        ...match.user,
        name: localNamesByHash.get(match.phoneHash) ?? match.user.name,
      })) as User[];
      const matchedHashes = new Set(matches.map((match) => match.phoneHash));
      const notOnApp = result.data
        .filter((contact) => contact.name && (contact.phoneNumbers ?? []).some((phone) => {
          const normalized = normalizePhone(phone.number);
          return normalized && !matchedHashes.has(phoneToHash.get(normalized) ?? '');
        }))
        .map((contact) => contact.name as string)
        .filter((name, index, names) => names.indexOf(name) === index)
        .slice(0, 8);
      setContactMatches(matched);
      setUnmatchedContacts(notOnApp);
      setContactDiscoveryState('ready');
    } catch {
      setContactDiscoveryState('error');
    }
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
      <View style={styles.avatarWrap}>
        <Avatar name={item.contact.name} />
        {item.contact.online ? <View style={[styles.onlineDot, { backgroundColor: colors.primary, borderColor: colors.card }]} /> : null}
      </View>
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

  return <Screen title="Chats" left={<IconButton name="albums-outline" label="Open stories" onPress={openStories} />} right={<View style={styles.headerActions}><IconButton name="person-add-outline" label="Start a new message" onPress={() => setShowNew(true)} /><IconButton name="person-outline" label="Open profile" onPress={() => setShowProfile(true)} /><IconButton name="add" label="Create story or send media" onPress={() => setShowCreate(true)} /></View>}>
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={[styles.storyDrawer, { borderBottomColor: colors.border, backgroundColor: colors.card }]} contentContainerStyle={styles.storyDrawerContent}>
      <Pressable onPress={openMyStory} style={styles.storyItem} accessibilityRole="button" accessibilityLabel={stories.some((story) => story.viewer.isOwner) ? 'Open your story' : 'Add your story'}>
        <StoryAvatar name={profileName} color={colors.muted} uri={profile.avatarUri} add />
        <Text style={[styles.storyName, { color: colors.foreground }]}>My Story</Text>
      </Pressable>
      {stories.filter((story) => !story.viewer.isOwner).map((story) => (
        <Pressable key={story.id} onPress={() => openStory(story)} style={styles.storyItem} accessibilityRole="button" accessibilityLabel={`Open ${story.author.name}'s story`}>
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
          <View style={styles.sheetHeader}><View><Text style={[styles.sheetTitle, { color: colors.foreground }]}>{pendingMedia ? 'Send to someone' : 'New message'}</Text><Text style={[styles.createHint, { color: colors.mutedForeground }]}>Choose someone who already has Old Time.</Text></View><IconButton name="close" onPress={() => { setShowNew(false); setPendingMedia(null); setNewMessageSearch(''); }} /></View>
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          {pendingMedia ? (
            <View style={[styles.mediaDraft, { backgroundColor: colors.muted, borderColor: colors.border }]}>
              {pendingMedia.type === 'image' ? <Image source={{ uri: pendingMedia.uri }} style={styles.mediaDraftImage} contentFit={pendingMedia.fit ?? 'contain'} /> : <View style={styles.mediaDraftVideo}><Ionicons name="videocam" size={26} color={colors.primary} /><Text style={{ color: colors.foreground, fontWeight: '600' }}>Video ready to send</Text></View>}
              <Text style={[styles.mediaDraftLabel, { color: colors.mutedForeground }]}>Choose who should receive it</Text>
            </View>
          ) : null}
          {!pendingMedia ? <View style={[styles.directorySearch, { backgroundColor: colors.muted }]}>
            <Ionicons name="search-outline" size={17} color={colors.mutedForeground} />
            <TextInput value={newMessageSearch} onChangeText={setNewMessageSearch} placeholder="Search people on Old Time" placeholderTextColor={colors.mutedForeground} style={[styles.directorySearchInput, { color: colors.foreground }]} />
          </View> : null}
          <Pressable onPress={() => void discoverContacts()} disabled={contactDiscoveryState === 'loading'} style={[styles.contactDiscovery, { backgroundColor: colors.secondary, borderColor: colors.border, opacity: contactDiscoveryState === 'loading' ? 0.6 : 1 }]} accessibilityRole="button">
            <View style={[styles.contactDiscoveryIcon, { backgroundColor: colors.primary }]}><Ionicons name="people-outline" size={18} color="#fff" /></View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.contactDiscoveryTitle, { color: colors.foreground }]}>{contactDiscoveryState === 'loading' ? 'Checking your contacts…' : contactDiscoveryState === 'ready' ? 'Refresh phone contacts' : 'Find friends from contacts'}</Text>
              <Text style={[styles.contactDiscoveryHint, { color: colors.mutedForeground }]}>Only used on this device to find people who have the app.</Text>
            </View>
            <Ionicons name={contactDiscoveryState === 'ready' ? 'refresh-outline' : 'chevron-forward'} size={18} color={colors.primary} />
          </Pressable>
          {contactDiscoveryState === 'error' ? <Text style={[styles.directoryError, { color: colors.destructive }]}>We couldn’t read your contacts. Tap the button to try again.</Text> : null}
          {users.isLoading ? <LoadingState /> : users.isError ? <EmptyState icon="cloud-offline-outline" title="Could not load people" description="Check your connection and try again." action={<Pressable onPress={() => void users.refetch()}><Text style={{ color: colors.primary, fontWeight: '600' }}>Try again</Text></Pressable>} /> : (
            <>
              {contactMatches.length > 0 ? <Text style={[styles.directoryLabel, { color: colors.mutedForeground }]}>FROM YOUR CONTACTS</Text> : null}
              {contactMatches.map((user) => (
                 <Pressable key={`contact-${user.id}`} onPress={() => startChat(user)} disabled={startingChatUserId !== null} style={[styles.person, { borderBottomColor: colors.border, opacity: startingChatUserId !== null && startingChatUserId !== user.id ? 0.5 : 1 }]}>
                  <View style={styles.avatarWrap}><Avatar name={user.name} size={42} />{user.online ? <View style={[styles.onlineDotSmall, { backgroundColor: colors.primary, borderColor: colors.card }]} /> : null}</View>
                  <View style={{ flex: 1 }}><Text style={[styles.personName, { color: colors.foreground }]}>{user.name}</Text><Text style={[styles.personPhone, { color: colors.primary }]}>On Old Time · {presenceLabel(user)}</Text></View>
                   {startingChatUserId === user.id ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="chatbubble-ellipses-outline" size={21} color={colors.primary} />}
                </Pressable>
              ))}
              <Text style={[styles.directoryLabel, { color: colors.mutedForeground }]}>ON OLD TIME</Text>
              {directoryUsers.length ? directoryUsers.map((user) => (
                 <Pressable key={user.id} onPress={() => startChat(user)} disabled={startingChatUserId !== null} style={[styles.person, { borderBottomColor: colors.border, opacity: startingChatUserId !== null && startingChatUserId !== user.id ? 0.5 : 1 }]}>
                  <View style={styles.avatarWrap}><Avatar name={user.name} size={42} />{user.online ? <View style={[styles.onlineDotSmall, { backgroundColor: colors.primary, borderColor: colors.card }]} /> : null}</View>
                  <View style={{ flex: 1 }}><Text style={[styles.personName, { color: colors.foreground }]}>{user.name}</Text><Text style={[styles.personPhone, { color: user.online ? colors.primary : colors.mutedForeground }]}>{presenceLabel(user)}</Text></View>
                   {startingChatUserId === user.id ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="chatbubble-ellipses-outline" size={21} color={colors.primary} />}
                </Pressable>
              )) : <Text style={[styles.directoryEmpty, { color: colors.mutedForeground }]}>No people match that search.</Text>}
              {unmatchedContacts.length > 0 ? <>
                <Text style={[styles.directoryLabel, { color: colors.mutedForeground }]}>NOT ON OLD TIME YET</Text>
                <Text style={[styles.directoryEmpty, { color: colors.mutedForeground }]}>These contacts are only listed locally. Old Time never uploads your address book.</Text>
                {unmatchedContacts.map((name) => <View key={name} style={[styles.unmatchedPerson, { borderBottomColor: colors.border }]}><Ionicons name="person-outline" size={19} color={colors.mutedForeground} /><Text style={[styles.personName, { color: colors.mutedForeground }]}>{name}</Text></View>)}
              </> : null}
            </>
          )}
          </ScrollView>
        </View>
      </View>
    </Modal>

     <Modal visible={showCreate} transparent animationType="slide" onRequestClose={() => setShowCreate(false)}>
       <View style={styles.modalShade}>
         <View style={[styles.sheet, { backgroundColor: colors.card }]}>
           <View style={styles.sheetHeader}><View><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Create</Text><Text style={[styles.createHint, { color: colors.mutedForeground }]}>Stories stay in Updates. Camera is for media you send.</Text></View><IconButton name="close" onPress={() => setShowCreate(false)} /></View>
           <Pressable onPress={() => { setShowCreate(false); router.replace({ pathname: '/(tabs)/updates', params: { composeType: 'status' } }); }} style={[styles.createChoice, { borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Create a story in Updates">
             <View style={[styles.createChoiceIcon, { backgroundColor: colors.primary }]}><Ionicons name="color-wand-outline" size={22} color="#fff" /></View>
             <View style={{ flex: 1 }}><Text style={[styles.createChoiceTitle, { color: colors.foreground }]}>Create a Story</Text><Text style={[styles.createChoiceDetail, { color: colors.mutedForeground }]}>Write a text Story or add a photo/video. It stays on your social side for 24 hours.</Text></View>
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

    <Modal visible={storyOpen !== null} transparent animationType="fade" onRequestClose={() => setStoryOpen(null)}>
      {storyOpen ? (
        <ServerStoryViewer
          items={buildStoryViewerItems(stories)}
          initialItemId={userStoryViewerItemId(storyOpen.id)}
          token={session?.authToken ?? ''}
          onClose={() => setStoryOpen(null)}
        />
      ) : null}
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
  avatarWrap: { position: 'relative' },
  onlineDot: { position: 'absolute', width: 13, height: 13, borderRadius: 7, right: 0, bottom: 0, borderWidth: 2 },
  onlineDotSmall: { position: 'absolute', width: 11, height: 11, borderRadius: 6, right: -1, bottom: -1, borderWidth: 2 },
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
  directorySearch: { minHeight: 42, borderRadius: 12, flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: 12, marginBottom: 10 },
  directorySearchInput: { flex: 1, fontSize: 15, paddingVertical: 9 },
  contactDiscovery: { minHeight: 66, borderWidth: 1, borderRadius: 15, flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 11, marginBottom: 12 },
  contactDiscoveryIcon: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  contactDiscoveryTitle: { fontSize: 14, fontWeight: '700' },
  contactDiscoveryHint: { fontSize: 11, lineHeight: 15, marginTop: 2 },
  directoryError: { fontSize: 12, lineHeight: 17, marginBottom: 8 },
  directoryLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1, marginTop: 7, marginBottom: 2 },
  directoryEmpty: { fontSize: 13, lineHeight: 18, paddingVertical: 12 },
  unmatchedPerson: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 11, borderBottomWidth: StyleSheet.hairlineWidth },
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
