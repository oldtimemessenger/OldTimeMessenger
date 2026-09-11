import { Ionicons } from '@expo/vector-icons';
import { getHub, joinHub, leaveHub, type Hub, type Post } from '@/lib/api-client-react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, IconButton } from '@/components/OldTimeUi';
import { useColors } from '@/hooks/useColors';
import { useOldTime } from '@/context/OldTimeContext';
import { TAB_BAR_CONTENT_CLEARANCE } from '@/constants/layout';
import { resolveRemoteMediaUrl } from '@/lib/api';

function HubPostCard({ post }: { post: Post }) {
  const colors = useColors();
  const { toggleLike } = useOldTime();
  const isQuote = post.mediaType === 'quote';
  return (
    <View style={[styles.postCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.postHeader}><Avatar source={post.author.avatarUrl ? { uri: post.author.avatarUrl } : undefined} size={38} accent={post.author.accent} /><View style={styles.postAuthor}><Text style={[styles.authorName, { color: colors.foreground }]}>{post.author.displayName}</Text><Text style={[styles.authorMeta, { color: colors.mutedForeground }]}>@{post.author.handle} · {new Date(post.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric' })}</Text></View><Ionicons name="ellipsis-horizontal" size={19} color={colors.mutedForeground} /></View>
      {isQuote ? <View style={[styles.quote, { backgroundColor: colors.secondary }]}><Text style={[styles.quoteMark, { color: colors.primary }]}>“</Text><Text style={[styles.quoteText, { color: colors.foreground }]}>{post.caption}</Text></View> : post.mediaUrl ? <View style={styles.media}><Image source={{ uri: resolveRemoteMediaUrl(post.mediaUrl) }} style={styles.mediaImage} resizeMode="cover" /></View> : null}
      {!isQuote && post.caption ? <Text style={[styles.caption, { color: colors.foreground }]}>{post.caption}</Text> : null}
      <View style={styles.postActions}><Pressable onPress={() => void toggleLike(post.id)} style={styles.postAction}><Ionicons name={post.likedByMe ? 'heart' : 'heart-outline'} size={21} color={post.likedByMe ? colors.softRed : colors.foreground} /><Text style={[styles.actionText, { color: colors.mutedForeground }]}>{post.likesCount}</Text></Pressable><View style={styles.postAction}><Ionicons name="chatbubble-ellipses-outline" size={20} color={colors.foreground} /><Text style={[styles.actionText, { color: colors.mutedForeground }]}>{post.commentsCount}</Text></View><Ionicons name="arrow-redo-outline" size={21} color={colors.foreground} /></View>
    </View>
  );
}

export default function HubDetailScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { hubId } = useLocalSearchParams<{ hubId: string }>();
  const { refreshFromServer } = useOldTime();
  const [hub, setHub] = useState<Hub | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [tab, setTab] = useState<'posts' | 'latest' | 'media'>('posts');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = async () => {
    if (!hubId) return;
    try {
      const detail = await getHub(hubId);
      setHub(detail.hub);
      setPosts(detail.posts);
    } catch (error) {
      Alert.alert('Hub unavailable', error instanceof Error ? error.message : 'This Hub could not be opened.', [{ text: 'Go back', onPress: () => router.back() }]);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { void load(); }, [hubId]);

  const visiblePosts = useMemo(() => {
    if (tab === 'media') return posts.filter((post) => post.mediaType !== 'quote');
    if (tab === 'latest') return [...posts].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    return posts;
  }, [posts, tab]);

  const toggleMembership = async () => {
    if (!hub || busy) return;
    setBusy(true);
    try {
      const updated = hub.isMember ? await leaveHub(hub.id) : await joinHub(hub.id);
      setHub(updated);
      await refreshFromServer();
    } catch (error) {
      Alert.alert('Could not update Hub', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  if (loading || !hub) return <View style={[styles.center, { backgroundColor: colors.background }]}><Ionicons name="people-outline" size={30} color={colors.primary} /><Text style={[styles.centerText, { color: colors.mutedForeground }]}>Opening Hub…</Text></View>;

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={{ paddingBottom: TAB_BAR_CONTENT_CLEARANCE }} showsVerticalScrollIndicator={false}>
        <View style={[styles.topBar, { paddingTop: insets.top + 5, borderBottomColor: colors.border, backgroundColor: colors.background }]}><IconButton icon="chevron-back" onPress={() => router.back()} accessibilityLabel="Back" /><Text numberOfLines={1} style={[styles.topTitle, { color: colors.foreground }]}>{hub.name}</Text><View style={styles.topSpacer} /></View>
        <View style={styles.hero}><View style={[styles.heroGlyph, { backgroundColor: colors.secondary }]}><Ionicons name="people-outline" size={28} color={colors.primary} /></View><View style={styles.heroCopy}><View style={styles.heroNameLine}><Text style={[styles.heroName, { color: colors.foreground }]}>{hub.name}</Text>{hub.visibility === 'private' ? <Ionicons name="lock-closed-outline" size={14} color={colors.mutedForeground} /> : null}</View><Text style={[styles.heroMeta, { color: colors.mutedForeground }]}>{hub.category} · {hub.membersCount.toLocaleString()} members</Text></View><Pressable onPress={() => void toggleMembership()} disabled={busy || hub.status !== 'active' || hub.isOwner} style={[styles.heroButton, { borderColor: hub.isMember ? colors.border : colors.primary, backgroundColor: hub.isMember ? colors.card : colors.primary, opacity: busy || hub.status !== 'active' || hub.isOwner ? 0.6 : 1 }]}><Text style={{ color: hub.isMember ? colors.foreground : colors.primaryForeground, fontSize: 12, fontWeight: '800' }}>{hub.isOwner ? 'Owner' : hub.isMember ? 'Joined' : 'Join'}</Text></Pressable></View>
        <Text style={[styles.description, { color: colors.foreground }]}>{hub.description || `A focused place for ${hub.category.toLowerCase()}.`}</Text>
        {hub.status === 'pending' ? <View style={[styles.pendingNote, { backgroundColor: colors.secondary }]}><Ionicons name="time-outline" size={16} color={colors.primary} /><Text style={[styles.pendingText, { color: colors.foreground }]}>This Hub is pending moderation review. It is visible to you as the owner.</Text></View> : null}
        <Pressable onPress={() => router.push({ pathname: '/(tabs)/create', params: { hubId: hub.id, hubName: hub.name } })} disabled={!hub.isMember || hub.status !== 'active'} style={[styles.composer, { borderColor: colors.border, backgroundColor: colors.card, opacity: !hub.isMember || hub.status !== 'active' ? 0.6 : 1 }]}><Avatar size={30} /><Text style={[styles.composerText, { color: colors.mutedForeground }]}>{hub.isMember ? `Post to ${hub.name}` : 'Join to post in this Hub'}</Text><Ionicons name="create-outline" size={19} color={colors.primary} /></Pressable>
        <View style={[styles.tabs, { borderBottomColor: colors.border }]}>{([{ key: 'posts', label: 'Posts' }, { key: 'latest', label: 'Latest' }, { key: 'media', label: 'Media' }] as const).map((item) => <Pressable key={item.key} onPress={() => setTab(item.key)} style={styles.tab}><Text style={[styles.tabText, { color: tab === item.key ? colors.foreground : colors.mutedForeground }]}>{item.label}</Text><View style={[styles.tabLine, { backgroundColor: tab === item.key ? colors.primary : 'transparent' }]} /></Pressable>)}</View>
        <View style={styles.feed}>{visiblePosts.length ? visiblePosts.map((post) => <HubPostCard key={post.id} post={post} />) : <View style={styles.empty}><Ionicons name="chatbubbles-outline" size={32} color={colors.primary} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No posts here yet.</Text><Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>Be the first person to share something with this community.</Text></View>}</View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  centerText: { fontFamily: 'Outfit_500Medium', fontSize: 14, marginTop: 12 },
  topBar: { minHeight: 64, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12 },
  topTitle: { flex: 1, textAlign: 'center', fontFamily: 'Fraunces_900Black', fontSize: 20 },
  topSpacer: { width: 44 },
  hero: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingTop: 26, gap: 14 },
  heroGlyph: { width: 68, height: 68, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  heroCopy: { flex: 1, minWidth: 0 },
  heroNameLine: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heroName: { flexShrink: 1, fontFamily: 'Fraunces_900Black', fontSize: 24 },
  heroMeta: { fontFamily: 'Outfit_500Medium', fontSize: 13, marginTop: 4, textTransform: 'capitalize' },
  heroButton: { minWidth: 72, minHeight: 40, borderWidth: 1, borderRadius: 20, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16 },
  description: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 22, paddingHorizontal: 20, marginTop: 20 },
  pendingNote: { flexDirection: 'row', gap: 10, borderRadius: 16, marginHorizontal: 20, marginTop: 18, padding: 14 },
  pendingText: { flex: 1, fontFamily: 'Outfit_500Medium', fontSize: 13, lineHeight: 18 },
  composer: { minHeight: 56, borderWidth: 1, borderRadius: 20, marginHorizontal: 20, marginTop: 22, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  composerText: { flex: 1, fontFamily: 'Outfit_500Medium', fontSize: 14 },
  tabs: { flexDirection: 'row', marginTop: 24, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  tab: { flex: 1, alignItems: 'center' },
  tabText: { fontFamily: 'Outfit_700Bold', fontSize: 14, paddingVertical: 14 },
  tabLine: { width: 32, height: 3, borderRadius: 3 },
  feed: { padding: 16 },
  postCard: { borderWidth: 1, borderRadius: 24, overflow: 'hidden', marginBottom: 16 },
  postHeader: { flexDirection: 'row', alignItems: 'center', padding: 14, gap: 12 },
  postAuthor: { flex: 1 },
  authorName: { fontFamily: 'Outfit_700Bold', fontSize: 14 },
  authorMeta: { fontFamily: 'Outfit_500Medium', fontSize: 12, marginTop: 2 },
  media: { height: 280, backgroundColor: '#2f2522' },
  mediaImage: { width: '100%', height: '100%' },
  quote: { minHeight: 210, padding: 28, justifyContent: 'center' },
  quoteMark: { fontFamily: 'Fraunces_900Black', fontSize: 52, lineHeight: 48 },
  quoteText: { fontFamily: 'Fraunces_700Bold', fontSize: 24, lineHeight: 32 },
  caption: { fontFamily: 'Outfit_400Regular', fontSize: 15, lineHeight: 22, paddingHorizontal: 16, paddingTop: 14 },
  postActions: { flexDirection: 'row', alignItems: 'center', gap: 24, padding: 16 },
  postAction: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  actionText: { fontFamily: 'Outfit_700Bold', fontSize: 13 },
  empty: { alignItems: 'center', padding: 48 },
  emptyTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 18, marginTop: 14 },
  emptyBody: { fontFamily: 'Outfit_500Medium', fontSize: 14, lineHeight: 20, textAlign: 'center', marginTop: 6, maxWidth: 280 },
});