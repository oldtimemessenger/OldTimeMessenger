import { Ionicons } from '@expo/vector-icons';
import { createHub, getHubs, joinHub, leaveHub, type Hub } from '@/lib/api-client-react';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, FlatList, Modal, Pressable, RefreshControl, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Pill } from '@/components/OldTimeUi';
import { useColors } from '@/hooks/useColors';
import { TAB_BAR_CONTENT_CLEARANCE } from '@/constants/layout';
import { useOldTime, type User, type Post } from '@/context/OldTimeContext';
import { CommentsModal, PostCard } from '@/components/PostCard';

const categories = ['Fitness', 'Music', 'Food', 'Photography', 'Technology', 'Travel', 'Local'];
const hubIcons: Array<keyof typeof Ionicons.glyphMap> = ['people-outline', 'walk-outline', 'musical-notes-outline', 'restaurant-outline', 'camera-outline', 'laptop-outline', 'location-outline'];

function HubCard({ hub, onRefresh, width = 160 }: { hub: Hub; onRefresh: () => Promise<void>; width?: number }) {
  const colors = useColors();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const isPending = hub.status === 'pending';

  const toggleMembership = async () => {
    if (busy || isPending) return;
    setBusy(true);
    try {
      if (hub.isMember) await leaveHub(hub.id);
      else await joinHub(hub.id);
      await onRefresh();
    } catch (error) {
      Alert.alert('Could not update Hub', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const iconIndex = categories.findIndex((category) => category.toLowerCase() === hub.category.toLowerCase()) + 1;
  const icon = hubIcons[iconIndex] ?? 'people-outline';

  return (
    <Pressable onPress={() => router.push({ pathname: '/hub/[hubId]', params: { hubId: hub.id } })} style={[styles.hubCard, { width, backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={[styles.hubCover, { backgroundColor: colors.secondary }]}>
        <Ionicons name={icon} size={28} color={colors.foreground} style={{ opacity: 0.8 }} />
        {hub.visibility === 'private' && (
          <View style={[styles.privateBadge, { backgroundColor: colors.card }]}>
            <Ionicons name="lock-closed" size={10} color={colors.foreground} />
          </View>
        )}
      </View>
      <View style={styles.hubCardBody}>
        <View>
          <Text numberOfLines={1} style={[styles.hubCardName, { color: colors.foreground }]}>{hub.name}</Text>
          <Text style={[styles.hubCardMeta, { color: colors.mutedForeground }]}>{hub.membersCount} {hub.membersCount === 1 ? 'member' : 'members'}</Text>
        </View>
        <Pressable 
          accessibilityRole="button" 
          disabled={busy || isPending} 
          onPress={(event) => { event.stopPropagation(); void toggleMembership(); }} 
          style={[styles.hubJoinBtn, { 
            backgroundColor: hub.isMember ? colors.secondary : colors.foreground,
            opacity: busy || isPending ? 0.6 : 1
          }]}
        >
          <Text style={[styles.hubJoinBtnText, { color: hub.isMember ? colors.foreground : colors.background }]}>
            {isPending ? 'Reviewing' : hub.isMember ? 'Joined' : 'Join'}
          </Text>
        </Pressable>
      </View>
    </Pressable>
  );
}

function CreateHubSheet({ visible, onClose, onCreated }: { visible: boolean; onClose: () => void; onCreated: (hub: Hub) => void }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState(categories[0]);
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [isSaving, setIsSaving] = useState(false);

  const reset = () => {
    setName('');
    setDescription('');
    setCategory(categories[0]);
    setVisibility('public');
  };
  const close = () => {
    if (isSaving) return;
    reset();
    onClose();
  };
  const submit = async () => {
    if (name.trim().length < 2 || isSaving) return;
    setIsSaving(true);
    try {
      const hub = await createHub({ name: name.trim(), description: description.trim(), category, icon: 'people-outline', coverImageUrl: null, parentHubId: null, visibility });
      reset();
      onCreated(hub);
    } catch (error) {
      Alert.alert('Could not create Hub', error instanceof Error ? error.message : 'Please try another name.');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={close}>
      <View style={styles.modalRoot}>
        <Pressable onPress={close} style={styles.modalShade} accessibilityRole="button" accessibilityLabel="Close create Hub" />
        <View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={[styles.sheetHandle, { backgroundColor: colors.border }]} />
          <View style={styles.sheetHeader}>
            <View>
              <Text style={[styles.sheetEyebrow, { color: colors.action }]}>NEW COMMUNITY</Text>
              <Text style={[styles.sheetTitle, { color: colors.foreground }]}>Create a Hub</Text>
            </View>
            <Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={28} color={colors.foreground} /></Pressable>
          </View>
          <TextInput value={name} onChangeText={setName} placeholder="Hub name" placeholderTextColor={colors.mutedForeground} style={[styles.formInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} maxLength={80} />
          <TextInput value={description} onChangeText={setDescription} multiline placeholder="What belongs here?" placeholderTextColor={colors.mutedForeground} style={[styles.formInput, styles.descriptionInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} maxLength={240} />
          
          <Text style={[styles.formLabel, { color: colors.foreground }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryPickerRail}>
            {categories.map((item) => <Pill key={item} active={category === item} onPress={() => setCategory(item)}>{item}</Pill>)}
          </ScrollView>
          
          <Text style={[styles.formLabel, { color: colors.foreground }]}>Visibility</Text>
          <View style={[styles.visibilityRail, { backgroundColor: colors.secondary }]}>
            <Pressable onPress={() => setVisibility('public')} style={[styles.visibilityOption, visibility === 'public' && { backgroundColor: colors.card }]}>
              <Ionicons name="globe-outline" size={18} color={visibility === 'public' ? colors.foreground : colors.mutedForeground} />
              <Text style={{ color: visibility === 'public' ? colors.foreground : colors.mutedForeground, fontFamily: 'NunitoSans_700Bold', fontSize: 13 }}>Public</Text>
            </Pressable>
            <Pressable onPress={() => setVisibility('private')} style={[styles.visibilityOption, visibility === 'private' && { backgroundColor: colors.card }]}>
              <Ionicons name="lock-closed-outline" size={18} color={visibility === 'private' ? colors.foreground : colors.mutedForeground} />
              <Text style={{ color: visibility === 'private' ? colors.foreground : colors.mutedForeground, fontFamily: 'NunitoSans_700Bold', fontSize: 13 }}>Private</Text>
            </Pressable>
          </View>
          
          <Text style={[styles.sheetNote, { color: colors.mutedForeground }]}>New Hubs are reviewed before they appear in discovery. You become the owner and first member.</Text>
          <Pressable disabled={name.trim().length < 2 || isSaving} onPress={() => void submit()} style={[styles.primaryButton, { backgroundColor: colors.action, opacity: name.trim().length < 2 || isSaving ? 0.5 : 1 }]}>
            <Text style={{ color: '#fff', fontFamily: 'NunitoSans_900Black', fontSize: 16 }}>{isSaving ? 'Submitting…' : 'Submit Hub for review'}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function DiscoverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { users, posts, currentUserId, toggleFollow, reportPost, searchUsers, refreshFromServer } = useOldTime();

  const [hubs, setHubs] = useState<Hub[]>([]);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<{ hubs: Hub[], users: User[] }>({ hubs: [], users: [] });
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [dismissedUsers, setDismissedUsers] = useState<Set<string>>(new Set());
  const [initialSuggested, setInitialSuggested] = useState<User[]>([]);
  const [selectedPostId, setSelectedPostId] = useState<string | null>(null);

  useEffect(() => {
    if (users.length && !initialSuggested.length) {
      setInitialSuggested(users.filter(u => u.id !== currentUserId && !u.isFollowing));
    }
  }, [users, currentUserId, initialSuggested.length]);

  const suggestedUsers = useMemo(() => {
    return initialSuggested
      .filter(u => !dismissedUsers.has(u.id))
      .map(u => users.find(latest => latest.id === u.id) || u);
  }, [initialSuggested, dismissedUsers, users]);

  const loadHubs = async () => {
    try {
      const data = await getHubs({});
      setHubs(data.items);
    } catch {
      setHubs([]);
    }
  };

  useEffect(() => {
    void loadHubs();
  }, []);

  const refresh = async () => {
    setRefreshing(true);
    try { await Promise.all([loadHubs(), refreshFromServer()]); } finally { setRefreshing(false); }
  };

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    if (!debouncedSearch.trim()) {
      setSearchResults({ hubs: [], users: [] });
      setIsSearching(false);
      return;
    }
    setIsSearching(true);
    let isCancelled = false;
    Promise.all([
      getHubs({ q: debouncedSearch.trim() }).catch(() => ({ items: [] as Hub[] })),
      searchUsers(debouncedSearch.trim()).catch(() => [] as User[])
    ]).then(([hubsRes, usersRes]) => {
      if (!isCancelled) {
        setSearchResults({ hubs: hubsRes.items, users: usersRes });
        setIsSearching(false);
      }
    });
    return () => { isCancelled = true; };
  }, [debouncedSearch, searchUsers]);

  const sharePostAction = async (post: Post) => {
    const message = post.mediaType === 'quote'
      ? `“${post.caption}”\n— @${post.handle} on Old Time`
      : `${post.caption ? `${post.caption}\n` : ''}Shared by @${post.handle} on Old Time`;
    try {
      await Share.share({ message });
    } catch {
      Alert.alert('Could not share', 'Please try again.');
    }
  };

  const reportPostFromFeed = (post: Post) => {
    Alert.alert('Report this post?', 'Choose a reason to send this to the Old Time moderation queue.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Spam', onPress: () => void reportPost(post.id, 'spam') },
      { text: 'Harassment', onPress: () => void reportPost(post.id, 'harassment') },
      { text: 'Other', onPress: () => void reportPost(post.id, 'other') },
    ]);
  };

  const selectedPost = posts.find((post) => post.id === selectedPostId);

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <FlatList
        data={search ? [] : posts}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: TAB_BAR_CONTENT_CLEARANCE }]}
        renderItem={({ item }) => <PostCard post={item} onComments={() => setSelectedPostId(item.id)} onShare={() => void sharePostAction(item)} onReport={() => reportPostFromFeed(item)} />}
        ListHeaderComponent={
          <>
            <View style={styles.header}>
              <Text style={[styles.title, { color: colors.foreground }]}>Community</Text>
              <Pressable onPress={() => router.push('/(tabs)/create')} accessibilityRole="button" style={[styles.headerCreate, { backgroundColor: colors.action }]}>
                <Ionicons name="add" size={24} color="#fff" />
              </Pressable>
            </View>

            <View style={[styles.searchBox, { backgroundColor: colors.secondary }]}>
              <Ionicons name="search-outline" size={20} color={colors.mutedForeground} />
              <TextInput value={search} onChangeText={setSearch} placeholder="Search people or Hubs..." placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} />
              {search ? (
                <Pressable onPress={() => setSearch('')}>
                  <Ionicons name="close-circle" size={18} color={colors.mutedForeground} />
                </Pressable>
              ) : null}
            </View>

            {!search ? (
              <>
                <View style={styles.quickNav}>
                  <Pressable style={[styles.navCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push('/routes')}>
                    <View style={[styles.navIconBox, { backgroundColor: colors.secondary }]}>
                      <Ionicons name="location-outline" size={24} color={colors.foreground} />
                    </View>
                    <View style={styles.navTextWrap}>
                      <Text style={[styles.navTitle, { color: colors.foreground }]}>Places</Text>
                      <Text style={[styles.navSub, { color: colors.mutedForeground }]}>Map & locations</Text>
                    </View>
                  </Pressable>
                  <Pressable style={[styles.navCard, { backgroundColor: colors.card, borderColor: colors.border }]} onPress={() => router.push('/access')}>
                    <View style={[styles.navIconBox, { backgroundColor: colors.action + '20' }]}>
                      <Ionicons name="mic-outline" size={24} color={colors.action} />
                    </View>
                    <View style={styles.navTextWrap}>
                      <Text style={[styles.navTitle, { color: colors.foreground }]}>Access</Text>
                      <Text style={[styles.navSub, { color: colors.mutedForeground }]}>Live audio rooms</Text>
                    </View>
                  </Pressable>
                </View>

                {suggestedUsers.length > 0 && (
                  <View style={styles.peopleSection}>
                    <Text style={[styles.sectionTitle, { color: colors.foreground, paddingHorizontal: 16 }]}>Discover People</Text>
                    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.peopleRail}>
                      {suggestedUsers.map(user => (
                        <View key={user.id} style={[styles.personCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
                          <Pressable onPress={() => setDismissedUsers(prev => new Set(prev).add(user.id))} style={[styles.dismissPerson, { backgroundColor: colors.secondary }]}>
                            <Ionicons name="close" size={16} color={colors.mutedForeground} />
                          </Pressable>
                          <Avatar source={user.avatar} name={user.name} size={64} />
                          <Text numberOfLines={1} style={[styles.personName, { color: colors.foreground }]}>{user.name}</Text>
                          <Text numberOfLines={1} style={[styles.personHandle, { color: colors.mutedForeground }]}>@{user.handle}</Text>
                          <Pressable
                            onPress={() => toggleFollow(user.id)}
                            style={[styles.followBtn, { backgroundColor: user.isFollowing ? colors.secondary : colors.foreground }]}
                          >
                            <Text style={[styles.followBtnText, { color: user.isFollowing ? colors.foreground : colors.background }]}>
                              {user.isFollowing ? 'Following' : 'Follow'}
                            </Text>
                          </Pressable>
                        </View>
                      ))}
                    </ScrollView>
                  </View>
                )}

                <View style={styles.hubsSection}>
                  <Text style={[styles.sectionTitle, { color: colors.foreground, paddingHorizontal: 16 }]}>Community Hubs</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hubsRail}>
                    <Pressable onPress={() => setCreateOpen(true)} style={[styles.createHubCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                      <View style={[styles.createHubIcon, { backgroundColor: colors.card }]}>
                        <Ionicons name="add" size={24} color={colors.foreground} />
                      </View>
                      <Text style={[styles.createHubText, { color: colors.foreground }]}>Create a Hub</Text>
                    </Pressable>
                    {hubs.map(hub => <HubCard key={hub.id} hub={hub} onRefresh={refresh} width={150} />)}
                  </ScrollView>
                </View>

                {posts.length > 0 && <Text style={[styles.sectionTitle, { color: colors.foreground, paddingHorizontal: 16, marginTop: 12, marginBottom: 12 }]}>Recent Posts</Text>}
              </>
            ) : (
              <View style={styles.searchResults}>
                {isSearching ? <Text style={[styles.searchNote, { color: colors.mutedForeground }]}>Searching...</Text> : (
                  <>
                    {searchResults.users.length > 0 && (
                      <View style={styles.searchSection}>
                        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>People</Text>
                        {searchResults.users.map(user => (
                          <View key={user.id} style={[styles.searchUserRow, { borderBottomColor: colors.border }]}>
                            <Avatar source={user.avatar} name={user.name} size={44} />
                            <View style={styles.searchUserInfo}>
                              <Text style={[styles.personNameList, { color: colors.foreground }]}>{user.name}</Text>
                              <Text style={[styles.personHandleList, { color: colors.mutedForeground }]}>@{user.handle}</Text>
                            </View>
                            <Pressable
                              onPress={() => toggleFollow(user.id)}
                              style={[styles.searchFollowBtn, { backgroundColor: user.isFollowing ? colors.secondary : colors.foreground }]}
                            >
                              <Text style={[styles.followBtnText, { color: user.isFollowing ? colors.foreground : colors.background }]}>
                                {user.isFollowing ? 'Following' : 'Follow'}
                              </Text>
                            </Pressable>
                          </View>
                        ))}
                      </View>
                    )}

                    {searchResults.hubs.length > 0 && (
                      <View style={styles.searchSection}>
                        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Hubs</Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hubsRail}>
                          {searchResults.hubs.map(hub => <HubCard key={hub.id} hub={hub} onRefresh={refresh} width={150} />)}
                        </ScrollView>
                      </View>
                    )}

                    {searchResults.users.length === 0 && searchResults.hubs.length === 0 && (
                      <Text style={[styles.searchNote, { color: colors.mutedForeground }]}>No results found.</Text>
                    )}
                  </>
                )}
              </View>
            )}
          </>
        }
      />
      
      <CreateHubSheet visible={createOpen} onClose={() => setCreateOpen(false)} onCreated={(hub) => { setCreateOpen(false); setHubs((current) => [hub, ...current]); }} />
      {selectedPost ? <CommentsModal post={selectedPost} onClose={() => setSelectedPostId(null)} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, paddingHorizontal: 16 },
  title: { fontFamily: 'NunitoSans_900Black', fontSize: 32 },
  headerCreate: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  
  searchBox: { height: 52, borderRadius: 16, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10, marginHorizontal: 16, marginBottom: 24 },
  searchInput: { flex: 1, fontFamily: 'NunitoSans_600SemiBold', fontSize: 16 },

  quickNav: { flexDirection: 'row', paddingHorizontal: 16, gap: 12, marginBottom: 32 },
  navCard: { flex: 1, flexDirection: 'row', alignItems: 'center', padding: 14, borderRadius: 20, borderWidth: 1, gap: 12 },
  navIconBox: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  navTextWrap: { flex: 1 },
  navTitle: { fontFamily: 'NunitoSans_700Bold', fontSize: 16, marginBottom: 2 },
  navSub: { fontFamily: 'NunitoSans_400Regular', fontSize: 12 },

  peopleSection: { marginBottom: 32 },
  peopleRail: { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  personCard: { width: 140, padding: 16, borderRadius: 20, borderWidth: 1, alignItems: 'center', position: 'relative' },
  dismissPerson: { position: 'absolute', top: 10, right: 10, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  personName: { fontFamily: 'NunitoSans_700Bold', fontSize: 15, marginTop: 12, textAlign: 'center' },
  personHandle: { fontFamily: 'NunitoSans_400Regular', fontSize: 13, marginBottom: 12, textAlign: 'center' },
  followBtn: { width: '100%', paddingVertical: 8, borderRadius: 16, alignItems: 'center' },
  followBtnText: { fontFamily: 'NunitoSans_700Bold', fontSize: 13 },

  hubsSection: { marginBottom: 32 },
  hubsRail: { paddingHorizontal: 16, gap: 12, paddingBottom: 8 },
  createHubCard: { width: 150, height: 160, borderRadius: 20, borderWidth: 1, borderStyle: 'dashed', alignItems: 'center', justifyContent: 'center', gap: 12 },
  createHubIcon: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  createHubText: { fontFamily: 'NunitoSans_700Bold', fontSize: 15 },
  
  hubCard: { height: 160, borderRadius: 20, borderWidth: 1, overflow: 'hidden' },
  hubCover: { height: 64, alignItems: 'center', justifyContent: 'center', position: 'relative' },
  privateBadge: { position: 'absolute', top: 8, right: 8, width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  hubCardBody: { padding: 12, flex: 1, justifyContent: 'space-between' },
  hubCardName: { fontFamily: 'NunitoSans_700Bold', fontSize: 15, marginBottom: 2 },
  hubCardMeta: { fontFamily: 'NunitoSans_400Regular', fontSize: 13 },
  hubJoinBtn: { paddingVertical: 8, borderRadius: 14, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  hubJoinBtnText: { fontFamily: 'NunitoSans_700Bold', fontSize: 13 },

  searchResults: { paddingHorizontal: 16, paddingBottom: 40 },
  searchNote: { fontFamily: 'NunitoSans_400Regular', fontSize: 15, textAlign: 'center', marginTop: 24 },
  searchSection: { marginBottom: 32 },
  searchUserRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  searchUserInfo: { flex: 1, marginLeft: 12 },
  searchFollowBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 16 },
  personNameList: { fontFamily: 'NunitoSans_700Bold', fontSize: 16 },
  personHandleList: { fontFamily: 'NunitoSans_400Regular', fontSize: 14, marginTop: 2 },
  
  sectionTitle: { fontFamily: 'NunitoSans_900Black', fontSize: 20, marginBottom: 16 },

  primaryButton: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 28 },
  
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingTop: 12 },
  sheetHandle: { alignSelf: 'center', width: 48, height: 5, borderRadius: 3, marginBottom: 16 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  sheetEyebrow: { fontFamily: 'NunitoSans_900Black', fontSize: 11, letterSpacing: 1.2, marginBottom: 4 },
  sheetTitle: { fontFamily: 'NunitoSans_900Black', fontSize: 26 },
  formInput: { minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, fontFamily: 'NunitoSans_600SemiBold', fontSize: 16, marginBottom: 16 },
  descriptionInput: { minHeight: 84, paddingTop: 16, textAlignVertical: 'top' },
  formLabel: { fontFamily: 'NunitoSans_700Bold', fontSize: 14, marginBottom: 12 },
  categoryPickerRail: { gap: 8, paddingBottom: 16 },
  visibilityRail: { flexDirection: 'row', borderRadius: 18, padding: 6, marginBottom: 16 },
  visibilityOption: { flex: 1, minHeight: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  sheetNote: { fontFamily: 'NunitoSans_400Regular', fontSize: 14, lineHeight: 20, marginBottom: 24 },
});
