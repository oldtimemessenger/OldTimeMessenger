import { Ionicons } from '@expo/vector-icons';
import { createHub, getHubs, joinHub, leaveHub, type Hub } from '@/lib/api-client-react';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Modal, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Pill, SectionLabel } from '@/components/OldTimeUi';
import { useColors } from '@/hooks/useColors';
import { TAB_BAR_CONTENT_CLEARANCE } from '@/constants/layout';
import { useOldTime } from '@/context/OldTimeContext';

const categories = ['Fitness', 'Music', 'Food', 'Photography', 'Technology', 'Travel', 'Local'];
const hubIcons: Array<keyof typeof Ionicons.glyphMap> = ['people-outline', 'walk-outline', 'musical-notes-outline', 'restaurant-outline', 'camera-outline', 'laptop-outline', 'location-outline'];

function HubGlyph({ hub, size = 22 }: { hub: Hub; size?: number }) {
  const colors = useColors();
  const icon = hubIcons[categories.findIndex((category) => category.toLowerCase() === hub.category.toLowerCase()) + 1] ?? 'people-outline';
  return <View style={[styles.hubGlyph, { backgroundColor: colors.secondary }]}><Ionicons name={icon} size={size} color={colors.primary} /></View>;
}

function HubRow({ hub, onRefresh }: { hub: Hub; onRefresh: () => Promise<void> }) {
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

  return (
    <Pressable onPress={() => router.push({ pathname: '/hub/[hubId]', params: { hubId: hub.id } })} style={({ pressed }) => [styles.hubRow, { borderBottomColor: colors.border, opacity: pressed ? 0.72 : 1 }]}>
      <HubGlyph hub={hub} />
      <View style={styles.hubCopy}>
        <View style={styles.hubNameLine}>
          <Text numberOfLines={1} style={[styles.hubName, { color: colors.foreground }]}>{hub.name}</Text>
          {hub.visibility === 'private' ? <Ionicons name="lock-closed-outline" size={13} color={colors.mutedForeground} /> : null}
        </View>
        <Text numberOfLines={2} style={[styles.hubDescription, { color: colors.mutedForeground }]}>{hub.description || `A focused place for ${hub.category.toLowerCase()}.`}</Text>
        <Text style={[styles.hubMeta, { color: colors.mutedForeground }]}>{hub.membersCount.toLocaleString()} {hub.membersCount === 1 ? 'member' : 'members'} · {hub.postsCount.toLocaleString()} {hub.postsCount === 1 ? 'post' : 'posts'}</Text>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={isPending ? `${hub.name} pending review` : hub.isMember ? `Leave ${hub.name}` : `Join ${hub.name}`} disabled={busy || isPending} onPress={(event) => { event.stopPropagation(); void toggleMembership(); }} style={[styles.joinButton, { borderColor: hub.isMember ? colors.border : colors.primary, backgroundColor: hub.isMember ? colors.card : colors.primary, opacity: busy || isPending ? 0.55 : 1 }]}>
        <Text style={{ color: hub.isMember ? colors.foreground : colors.primaryForeground, fontSize: 11, fontWeight: '800' }}>{isPending ? 'Reviewing' : hub.isMember ? 'Joined' : 'Join'}</Text>
      </Pressable>
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
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}><View><Text style={[styles.sheetEyebrow, { color: colors.primary }]}>NEW COMMUNITY</Text><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Create a Hub</Text></View><Pressable onPress={close} accessibilityRole="button" accessibilityLabel="Close"><Ionicons name="close" size={23} color={colors.foreground} /></Pressable></View>
          <TextInput value={name} onChangeText={setName} placeholder="Hub name" placeholderTextColor={colors.mutedForeground} style={[styles.formInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} maxLength={80} />
          <TextInput value={description} onChangeText={setDescription} multiline placeholder="What belongs here?" placeholderTextColor={colors.mutedForeground} style={[styles.formInput, styles.descriptionInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} maxLength={240} />
          <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.categoryRail}>{categories.map((item) => <Pill key={item} active={category === item} onPress={() => setCategory(item)}>{item}</Pill>)}</ScrollView>
          <Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Visibility</Text>
          <View style={[styles.visibilityRail, { backgroundColor: colors.muted }]}><Pressable onPress={() => setVisibility('public')} style={[styles.visibilityOption, visibility === 'public' && { backgroundColor: colors.card }]}><Ionicons name="globe-outline" size={16} color={visibility === 'public' ? colors.primary : colors.mutedForeground} /><Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 12 }}>Public</Text></Pressable><Pressable onPress={() => setVisibility('private')} style={[styles.visibilityOption, visibility === 'private' && { backgroundColor: colors.card }]}><Ionicons name="lock-closed-outline" size={16} color={visibility === 'private' ? colors.primary : colors.mutedForeground} /><Text style={{ color: colors.foreground, fontWeight: '700', fontSize: 12 }}>Private</Text></Pressable></View>
          <Text style={[styles.sheetNote, { color: colors.mutedForeground }]}>New Hubs are reviewed before they appear in discovery. You become the owner and first member.</Text>
          <Pressable disabled={name.trim().length < 2 || isSaving} onPress={() => void submit()} style={[styles.primaryButton, { backgroundColor: colors.action, opacity: name.trim().length < 2 || isSaving ? 0.5 : 1 }]}><Text style={{ color: colors.primaryForeground, fontWeight: '800' }}>{isSaving ? 'Submitting…' : 'Submit Hub for review'}</Text></Pressable>
        </View>
      </View>
    </Modal>
  );
}

export default function DiscoverScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { profile } = useOldTime();
  const [hubs, setHubs] = useState<Hub[]>([]);
  const [search, setSearch] = useState('');
  const [section, setSection] = useState<'forYou' | 'following' | 'latest'>('forYou');
  const [refreshing, setRefreshing] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);

  const load = async (nextSearch = search, nextSection = section) => {
    const data = await getHubs(nextSection === 'following' ? { mine: true, q: nextSearch.trim() || undefined } : { q: nextSearch.trim() || undefined });
    setHubs(data.items);
  };

  useEffect(() => {
    const timer = setTimeout(() => { void load().catch(() => setHubs([])); }, 220);
    return () => clearTimeout(timer);
  }, [search, section]);

  const sortedHubs = useMemo(() => section === 'latest' ? [...hubs].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)) : hubs, [hubs, section]);
  const refresh = async () => {
    setRefreshing(true);
    try { await load(); } finally { setRefreshing(false); }
  };

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: TAB_BAR_CONTENT_CLEARANCE }]} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => void refresh()} tintColor={colors.primary} />} showsVerticalScrollIndicator={false}>
        <View style={styles.header}><View style={styles.titleCopy}><Text style={[styles.title, { color: colors.foreground }]}>Community</Text></View><Pressable onPress={() => setCreateOpen(true)} accessibilityRole="button" accessibilityLabel="Create a Hub" style={[styles.headerCreate, { backgroundColor: colors.primary }]}><Ionicons name="add" size={20} color={colors.primaryForeground} /></Pressable></View>
        <View style={[styles.searchBox, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="search-outline" size={18} color={colors.mutedForeground} /><TextInput value={search} onChangeText={setSearch} placeholder="Search Hubs, topics, or aliases" placeholderTextColor={colors.mutedForeground} style={[styles.searchInput, { color: colors.foreground }]} /></View>
        <View style={[styles.sectionTabs, { borderBottomColor: colors.border }]}>{([{ key: 'forYou', label: 'For you' }, { key: 'following', label: 'My Hubs' }, { key: 'latest', label: 'Latest' }] as const).map((item) => <Pressable key={item.key} onPress={() => setSection(item.key)} style={styles.sectionTab}><Text style={[styles.sectionTabText, { color: section === item.key ? colors.foreground : colors.mutedForeground }]}>{item.label}</Text><View style={[styles.sectionLine, { backgroundColor: section === item.key ? colors.primary : 'transparent' }]} /></Pressable>)}</View>
        <View style={styles.introRow}><View><Text style={[styles.sectionHeading, { color: colors.foreground }]}>{section === 'following' ? 'Your communities' : search ? 'Matching Hubs' : 'Find your people'}</Text><Text style={[styles.sectionSubheading, { color: colors.mutedForeground }]}>{search ? 'Search by name, category, or topic.' : 'Focused places for the conversations you want to keep.'}</Text></View><Ionicons name="people-outline" size={22} color={colors.primary} /></View>
        <Pressable onPress={() => router.push('/access')} accessibilityRole="button" accessibilityLabel="Open Access live rooms" style={({ pressed }) => [styles.accessCard, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.74 : 1 }]}>
          <View style={[styles.accessGlyph, { backgroundColor: colors.secondary }]}><Ionicons name="mic-outline" size={22} color={colors.primary} /></View>
          <View style={styles.accessCopy}><Text style={[styles.accessTitle, { color: colors.foreground }]}>Access</Text><Text style={[styles.accessBody, { color: colors.mutedForeground }]}>Join live conversations happening now.</Text></View>
          <View style={[styles.accessButton, { backgroundColor: colors.primary }]}><Text style={{ color: colors.primaryForeground, fontSize: 11, fontWeight: '800' }}>Open</Text></View>
        </Pressable>
        {sortedHubs.length ? <View style={[styles.hubList, { backgroundColor: colors.card, borderColor: colors.border }]}>{sortedHubs.map((hub) => <HubRow key={hub.id} hub={hub} onRefresh={refresh} />)}</View> : <View style={styles.empty}><Ionicons name={search ? 'search-outline' : 'people-outline'} size={34} color={colors.primary} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>{section === 'following' ? 'You have not joined a Hub yet.' : search ? 'No Hubs found.' : 'No Hubs are ready yet.'}</Text><Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>{section === 'following' ? 'Join a public Hub or create one for your people.' : 'Create the first focused community and it will enter moderation review.'}</Text><Pressable onPress={() => setCreateOpen(true)} style={[styles.primaryButton, { backgroundColor: colors.action }]}><Text style={{ color: colors.primaryForeground, fontWeight: '800' }}>Create a Hub</Text></Pressable></View>}
        {profile ? <View style={[styles.principleCard, { backgroundColor: colors.secondary }]}><Ionicons name="chatbubble-ellipses-outline" size={18} color={colors.primary} /><Text style={[styles.principleText, { color: colors.foreground }]}>Hubs organize Community posts. They do not replace Access rooms or private chats.</Text></View> : null}
      </ScrollView>
      <CreateHubSheet visible={createOpen} onClose={() => setCreateOpen(false)} onCreated={(hub) => { setCreateOpen(false); setHubs((current) => [hub, ...current]); }} />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  titleCopy: { flex: 1, minWidth: 0 },
  eyebrow: { fontFamily: 'Outfit_700Bold', textTransform: 'uppercase', letterSpacing: 1.2, fontSize: 11, marginBottom: 4 },
  title: { fontFamily: 'Fraunces_900Black', fontSize: 36, letterSpacing: -1.2 },
  headerCreate: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', marginLeft: 12 },
  searchBox: { height: 52, borderWidth: 1, borderRadius: 18, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 10 },
  searchInput: { flex: 1, fontFamily: 'Outfit_500Medium', fontSize: 15 },
  sectionTabs: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, marginTop: 20 },
  sectionTab: { flex: 1, alignItems: 'center' },
  sectionTabText: { fontFamily: 'Outfit_700Bold', fontSize: 15, paddingVertical: 14 },
  sectionLine: { height: 3, width: 36, borderRadius: 3 },
  introRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 24, marginBottom: 16 },
  sectionHeading: { fontFamily: 'Fraunces_700Bold', fontSize: 22 },
  sectionSubheading: { fontFamily: 'Outfit_400Regular', fontSize: 14, marginTop: 4 },
  accessCard: { minHeight: 82, borderWidth: 1, borderRadius: 20, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 20 },
  accessGlyph: { width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  accessCopy: { flex: 1, minWidth: 0 },
  accessTitle: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  accessBody: { fontFamily: 'Outfit_400Regular', fontSize: 13, marginTop: 4 },
  accessButton: { minWidth: 60, minHeight: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  hubList: { borderWidth: 1, borderRadius: 22, paddingHorizontal: 16 },
  hubRow: { minHeight: 116, flexDirection: 'row', alignItems: 'center', paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, gap: 12 },
  hubGlyph: { width: 52, height: 52, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  hubCopy: { flex: 1, minWidth: 0 },
  hubNameLine: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hubName: { flexShrink: 1, fontFamily: 'Outfit_700Bold', fontSize: 16 },
  hubDescription: { fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 18, marginTop: 5 },
  hubMeta: { fontFamily: 'Outfit_500Medium', fontSize: 12, marginTop: 6 },
  joinButton: { minWidth: 64, minHeight: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 12 },
  empty: { alignItems: 'center', paddingHorizontal: 28, paddingTop: 52, paddingBottom: 36 },
  emptyTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 20, marginTop: 16, textAlign: 'center' },
  emptyBody: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 22, textAlign: 'center', marginTop: 8, maxWidth: 300 },
  primaryButton: { minHeight: 52, borderRadius: 26, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24, marginTop: 22 },
  principleCard: { flexDirection: 'row', alignItems: 'flex-start', gap: 12, borderRadius: 18, padding: 16, marginTop: 24 },
  principleText: { flex: 1, fontFamily: 'Outfit_500Medium', fontSize: 13, lineHeight: 19 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(28,22,20,0.52)' },
  sheet: { borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 20, paddingTop: 12 },
  sheetHandle: { alignSelf: 'center', width: 48, height: 5, borderRadius: 3, backgroundColor: '#E3DDD1', marginBottom: 14 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 },
  sheetEyebrow: { fontFamily: 'Outfit_700Bold', fontSize: 11, letterSpacing: 1.2, marginBottom: 6 },
  sheetTitle: { fontFamily: 'Fraunces_900Black', fontSize: 26 },
  formInput: { minHeight: 52, borderWidth: 1, borderRadius: 16, paddingHorizontal: 16, fontFamily: 'Outfit_400Regular', fontSize: 15, marginBottom: 12 },
  descriptionInput: { minHeight: 84, paddingTop: 14, textAlignVertical: 'top' },
  formLabel: { fontFamily: 'Outfit_700Bold', fontSize: 12, marginTop: 6, marginBottom: 10 },
  categoryRail: { gap: 8, paddingBottom: 6 },
  visibilityRail: { flexDirection: 'row', borderRadius: 16, padding: 5, marginBottom: 8 },
  visibilityOption: { flex: 1, minHeight: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 8 },
  sheetNote: { fontFamily: 'Outfit_400Regular', fontSize: 13, lineHeight: 19, marginTop: 14 },
});