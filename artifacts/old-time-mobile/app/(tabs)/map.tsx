import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar, Screen } from '@/components/ui';
import SocialMap from '@/components/social-map';
import type { SocialMapRegion } from '@/components/social-map.types';
import { ServerStoryViewer } from '@/components/server-story-viewer';
import { userStoryViewerItemId } from '@/components/story-viewer-content';
import { buildStoryViewerItems } from '@/lib/story-viewer-sequence';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';
import { createMapPin, createMapPinComment, deleteMapPin, getMapPinComments, getNearbyPins, reportMapPin, setMapPinRelation, type MapComment, type MapPin, type MapVisibility } from '@/lib/map-api';
import { getNearbyStories, setUserBlocked, type Story } from '@/lib/social-api';

type Coordinate = { latitude: number; longitude: number };

export default function MapScreen() {
  const colors = useColors();
  const { session, settings } = useApp();
  const [permission, requestPermission] = Location.useForegroundPermissions();
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [region, setRegion] = useState<SocialMapRegion | null>(null);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<MapVisibility>(settings.locationAudience);
  const [expiry, setExpiry] = useState<'day' | 'week' | 'never'>('day');
  const [commentPin, setCommentPin] = useState<MapPin | null>(null);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);
  const [discoveryCoordinate, setDiscoveryCoordinate] = useState<Coordinate | null>(null);
  const [discoveryPins, setDiscoveryPins] = useState<MapPin[] | null>(null);
  const [discoveryStories, setDiscoveryStories] = useState<Story[] | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [storyOpen, setStoryOpen] = useState<Story | null>(null);
  const regionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regionCache = useRef(new Map<string, { loadedAt: number; pins: MapPin[]; stories: Story[] }>());

  useEffect(() => {
    setVisibility(settings.locationAudience === 'public' ? 'friends' : settings.locationAudience);
  }, [settings.locationAudience]);

  const loadRegion = useCallback(async (nextRegion: SocialMapRegion, force = false) => {
    if (!session?.authToken) return;
    const radiusKm = radiusForRegion(nextRegion);
    const cacheKey = `${nextRegion.latitude.toFixed(2)}:${nextRegion.longitude.toFixed(2)}:${Math.round(radiusKm)}`;
    const cached = regionCache.current.get(cacheKey);
    if (!force && cached && Date.now() - cached.loadedAt < 60_000) {
      setPins(cached.pins);
      setStories(cached.stories);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [pinPage, storyPage] = await Promise.all([
        getNearbyPins(session.authToken, nextRegion.latitude, nextRegion.longitude, radiusKm),
        getNearbyStories(session.authToken, nextRegion.latitude, nextRegion.longitude, radiusKm, 30),
      ]);
      setPins(pinPage.items);
      setStories(storyPage.items);
      regionCache.current.set(cacheKey, { loadedAt: Date.now(), pins: pinPage.items, stories: storyPage.items });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load this area.');
    } finally {
      setLoading(false);
    }
  }, [session?.authToken]);

  const discoverArea = useCallback(async (coordinate: Coordinate) => {
    if (!session?.authToken) return;
    setDiscoveryCoordinate(coordinate);
    setDiscoveryLoading(true);
    try {
      const [pinPage, storyPage] = await Promise.all([
        getNearbyPins(session.authToken, coordinate.latitude, coordinate.longitude, 5),
        getNearbyStories(session.authToken, coordinate.latitude, coordinate.longitude, 5, 20),
      ]);
      setDiscoveryPins(pinPage.items);
      setDiscoveryStories(storyPage.items);
    } catch {
      setDiscoveryPins([]);
      setDiscoveryStories([]);
    } finally {
      setDiscoveryLoading(false);
    }
  }, [session?.authToken]);

  function selectPin(pin: MapPin) {
    setSelectedPin(pin);
    setDiscoveryCoordinate(null);
    setDiscoveryPins(null);
    setDiscoveryStories(null);
  }

  async function refreshLocation() {
    setLoading(true);
    try {
      let granted = permission?.granted;
      if (!granted) {
        const result = await requestPermission();
        granted = result.granted;
        if (!granted) {
          Alert.alert('Location is off', 'Enable location access for Old Time in your device settings.');
          return;
        }
      }
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const coordinate = { latitude: result.coords.latitude, longitude: result.coords.longitude };
      const nextRegion = { ...coordinate, latitudeDelta: 0.055, longitudeDelta: 0.07 };
      setLocation(coordinate);
      setRegion(nextRegion);
      setSelectedPin(null);
      setDiscoveryCoordinate(null);
      setDiscoveryPins(null);
      setDiscoveryStories(null);
      await loadRegion(nextRegion, true);
    } catch {
      Alert.alert('Location unavailable', 'Old Time could not read your current location. Try again outdoors or check device location services.');
    } finally {
      setLoading(false);
    }
  }

  const changeRegion = useCallback((nextRegion: SocialMapRegion) => {
    setRegion(nextRegion);
    if (regionTimer.current) clearTimeout(regionTimer.current);
    regionTimer.current = setTimeout(() => void loadRegion(nextRegion), 420);
  }, [loadRegion]);

  useEffect(() => () => {
    if (regionTimer.current) clearTimeout(regionTimer.current);
  }, []);

  async function openInMaps(pin: Coordinate) {
    const url = `https://maps.google.com/?q=${pin.latitude},${pin.longitude}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  }

  async function publishPin() {
    if (!location) {
      Alert.alert('Location required', 'Turn on location access before posting a pin so Old Time knows where to place it.');
      return;
    }
    if (!session?.authToken) {
      Alert.alert('Sign in required', 'Sign in again before posting a location pin.');
      return;
    }
    try {
      const expiresAt = expiry === 'never' ? null : Date.now() + (expiry === 'day' ? 86_400_000 : 604_800_000);
      const created = await createMapPin(session.authToken, { ...location, caption: caption.trim() || undefined, visibility, expiresAt });
      setPins((items) => [created, ...items]);
      regionCache.current.clear();
      setCaption('');
      setComposerOpen(false);
    } catch (requestError) {
      Alert.alert('Pin not saved', requestError instanceof Error ? requestError.message : 'Please try again.');
    }
  }

  return (
    <Screen title="Map">
      <View style={styles.mapCanvas}>
        <SocialMap
          center={location}
          region={region}
          pins={pins}
          stories={stories}
          selectedPinId={selectedPin?.id ?? null}
          loading={loading}
          colors={colors}
          onLocate={() => void refreshLocation()}
          onCreate={() => {
            if (location) {
              setComposerOpen(true);
            } else {
              Alert.alert('Location required', 'Allow location access before posting a pin.', [
                { text: 'Not now', style: 'cancel' },
                { text: 'Enable location', onPress: () => void refreshLocation() },
              ]);
            }
          }}
          onSelectPin={selectPin}
          onSelectStory={(story) => setStoryOpen(story)}
          onAreaPress={(coordinate) => {
            setSelectedPin(null);
            void discoverArea(coordinate);
          }}
          onRegionChange={changeRegion}
        />
        {loading && region ? <View style={[styles.loadingPill, { backgroundColor: colors.card }]}><ActivityIndicator size="small" color={colors.primary} /></View> : null}
        {error ? <Pressable onPress={() => region && void loadRegion(region, true)} style={[styles.errorPill, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="cloud-offline-outline" size={17} color={colors.destructive} /><Text style={{ color: colors.foreground, fontWeight: '700' }}>Retry area</Text></Pressable> : null}
        {discoveryCoordinate ? (
          <DiscoveryPanel
            pins={discoveryPins ?? []}
            stories={discoveryStories ?? []}
            loading={discoveryLoading}
            colors={colors}
            onClose={() => {
              setDiscoveryCoordinate(null);
              setDiscoveryPins(null);
              setDiscoveryStories(null);
            }}
            onSelectPin={selectPin}
            onSelectStory={(story) => setStoryOpen(story)}
          />
        ) : null}
        {selectedPin ? <View style={styles.selectedPinPanel}><PinCard pin={selectedPin} own={selectedPin.authorId === session?.id} colors={colors} onOpen={() => void openInMaps(selectedPin)} onComment={() => setCommentPin(selectedPin)} onChanged={(pin) => { setSelectedPin(pin); setPins((all) => all.map((current) => current.id === pin.id ? pin : current)); }} onDelete={() => { setPins((all) => all.filter((pin) => pin.id !== selectedPin.id)); setSelectedPin(null); }} token={session?.authToken ?? ''} /></View> : null}
      </View>
      <PinComposer visible={composerOpen} colors={colors} caption={caption} setCaption={setCaption} visibility={visibility} setVisibility={setVisibility} expiry={expiry} setExpiry={setExpiry} onClose={() => setComposerOpen(false)} onSave={() => void publishPin()} />
      <CommentsSheet pin={commentPin} token={session?.authToken ?? ''} colors={colors} onClose={() => setCommentPin(null)} />
      <Modal visible={storyOpen !== null} transparent animationType="fade" onRequestClose={() => setStoryOpen(null)}>
        {storyOpen ? (
          <ServerStoryViewer
            items={buildStoryViewerItems([...stories.filter((item) => item.id !== storyOpen.id), storyOpen])}
            initialItemId={userStoryViewerItemId(storyOpen.id)}
            token={session?.authToken ?? ''}
            onClose={() => setStoryOpen(null)}
          />
        ) : null}
      </Modal>
    </Screen>
  );
}

function radiusForRegion(region: SocialMapRegion) {
  return Math.min(25, Math.max(1, region.latitudeDelta * 111 * 0.75));
}

function timeAgo(timestamp: number) {
  const minutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function DiscoveryPanel({ pins, stories, loading, colors, onClose, onSelectPin, onSelectStory }: { pins: MapPin[]; stories: Story[]; loading: boolean; colors: any; onClose: () => void; onSelectPin: (pin: MapPin) => void; onSelectStory: (story: Story) => void }) {
  const recentPins = [...pins].sort((left, right) => right.createdAt - left.createdAt);
  const popularPins = [...pins].filter((pin) => pin.counts.reactions + pin.counts.comments + pin.counts.saves > 0).sort((left, right) => (right.counts.reactions + right.counts.comments + right.counts.saves) - (left.counts.reactions + left.counts.comments + left.counts.saves));
  const people = new Set([...pins.map((pin) => pin.author.id), ...stories.map((story) => story.author.id)]).size;
  return (
    <View style={[styles.discoveryPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.discoveryHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.discoveryTitle, { color: colors.foreground }]}>What’s happening here?</Text>
          <Text style={[styles.discoveryMeta, { color: colors.mutedForeground }]}>{loading ? 'Looking nearby' : `${stories.length} Stories · ${recentPins.length} locations · ${people} people`}</Text>
        </View>
        {loading ? <ActivityIndicator color={colors.primary} /> : <Pressable accessibilityLabel="Close location discovery" onPress={onClose} hitSlop={10}><Ionicons name="close" size={20} color={colors.mutedForeground} /></Pressable>}
      </View>
      {!loading && stories.length === 0 && recentPins.length === 0 ? <Text style={[styles.discoveryEmpty, { color: colors.mutedForeground }]}>Nothing posted here yet.</Text> : null}
      {!loading && stories.slice(0, 2).map((story) => <Pressable key={`story-${story.id}`} onPress={() => onSelectStory(story)} style={[styles.discoveryItem, { borderTopColor: colors.border }]}>
        <Avatar name={story.author.name} size={28} color={colors.primary} />
        <View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.discoveryItemTitle, { color: colors.foreground }]}>{story.author.name}</Text><Text numberOfLines={1} style={[styles.discoveryItemText, { color: colors.mutedForeground }]}>{story.content || 'Active Story'} · {timeAgo(story.createdAt)}</Text></View>
        <Ionicons name="play" size={15} color={colors.primary} />
      </Pressable>)}
      {!loading && stories.length === 0 && (popularPins[0] ?? recentPins[0]) ? (() => {
        const pin = popularPins[0] ?? recentPins[0];
        return <Pressable onPress={() => onSelectPin(pin)} style={[styles.discoveryItem, { borderTopColor: colors.border }]}>
          <Avatar name={pin.author.name} size={28} color={colors.primary} />
          <View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.discoveryItemTitle, { color: colors.foreground }]}>{pin.author.name}</Text><Text numberOfLines={1} style={[styles.discoveryItemText, { color: colors.mutedForeground }]}>{pin.caption || 'Shared a location'} · {timeAgo(pin.createdAt)}</Text></View>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
        </Pressable>;
      })() : null}
    </View>
  );
}

function PinCard({ pin, own, colors, token, onOpen, onComment, onChanged, onDelete }: { pin: MapPin; own: boolean; colors: any; token: string; onOpen: () => void; onComment: () => void; onChanged: (pin: MapPin) => void; onDelete: () => void }) {
  const toggle = async (relation: 'reaction' | 'save') => {
    const active = relation === 'reaction' ? !pin.viewer.reacted : !pin.viewer.saved;
    const viewer = relation === 'reaction' ? { ...pin.viewer, reacted: active } : { ...pin.viewer, saved: active };
    const counts = relation === 'reaction' ? { ...pin.counts, reactions: Math.max(0, pin.counts.reactions + (active ? 1 : -1)) } : { ...pin.counts, saves: Math.max(0, pin.counts.saves + (active ? 1 : -1)) };
    onChanged({ ...pin, viewer, counts });
    try { await setMapPinRelation(token, pin.id, relation, active); } catch { onChanged(pin); Alert.alert('Action not saved', 'Please try again.'); }
  };
  const more = () => {
    if (own) {
      Alert.alert('Your pin', undefined, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete pin', style: 'destructive', onPress: () => void deleteMapPin(token, pin.id).then(onDelete).catch(() => Alert.alert('Pin not deleted', 'Please try again.')) }]);
    } else {
      Alert.alert('Pin options', 'Report inappropriate pins or block this person.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Report spam', onPress: () => void reportMapPin(token, pin.id, 'spam').then(() => Alert.alert('Report received', 'Thank you.')).catch(() => Alert.alert('Could not report', 'Please try again.')) },
        { text: 'Block user', style: 'destructive', onPress: () => void setUserBlocked(token, pin.authorId, true).then(onDelete).catch(() => Alert.alert('Could not block', 'Please try again.')) },
      ]);
    }
  };
  return <View style={[styles.pin, { backgroundColor: colors.card, borderColor: colors.border }]}>
    <View style={styles.pinHead}><View style={[styles.avatar, { backgroundColor: colors.primary }]}><Text style={styles.avatarText}>{pin.author.name.slice(0, 1).toUpperCase()}</Text></View><View style={{ flex: 1 }}><Text style={[styles.author, { color: colors.foreground }]}>{own ? 'You' : pin.author.name}</Text><Text style={[styles.meta, { color: colors.mutedForeground }]}>{pin.distanceKm.toFixed(1)} km away · {pin.visibility}</Text></View><Pressable hitSlop={10} onPress={more}><Ionicons name="ellipsis-horizontal" size={20} color={colors.mutedForeground} /></Pressable></View>
    {pin.caption ? <Text style={[styles.caption, { color: colors.foreground }]}>{pin.caption}</Text> : null}
    <Text style={[styles.expiry, { color: colors.mutedForeground }]}>{pin.expiresAt ? `Expires ${new Date(pin.expiresAt).toLocaleDateString()}` : 'No expiry'}</Text>
    <View style={[styles.pinActions, { borderTopColor: colors.border }]}><PinAction icon={pin.viewer.reacted ? 'heart' : 'heart-outline'} label={String(pin.counts.reactions)} active={pin.viewer.reacted} colors={colors} onPress={() => void toggle('reaction')} /><PinAction icon="chatbubble-outline" label={String(pin.counts.comments)} colors={colors} onPress={onComment} /><PinAction icon={pin.viewer.saved ? 'bookmark' : 'bookmark-outline'} label={String(pin.counts.saves)} active={pin.viewer.saved} colors={colors} onPress={() => void toggle('save')} /><PinAction icon="navigate-outline" label="Maps" colors={colors} onPress={onOpen} /></View>
  </View>;
}

function PinAction({ icon, label, active, colors, onPress }: { icon: keyof typeof Ionicons.glyphMap; label: string; active?: boolean; colors: any; onPress: () => void }) {
  return <Pressable onPress={onPress} style={styles.pinAction}><Ionicons name={icon} size={18} color={active ? colors.destructive : colors.mutedForeground} /><Text style={{ color: active ? colors.destructive : colors.mutedForeground, fontSize: 12 }}>{label}</Text></Pressable>;
}

function PinComposer({ visible, colors, caption, setCaption, visibility, setVisibility, expiry, setExpiry, onClose, onSave }: any) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalShade}><View style={[styles.sheet, { backgroundColor: colors.background }]}><View style={[styles.grabber, { backgroundColor: colors.border }]} /><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Post location</Text><Text style={[styles.sheetText, { color: colors.mutedForeground }]}>Only the location currently shown on your device will be posted when you tap Post.</Text><TextInput value={caption} onChangeText={setCaption} placeholder="Add a caption (optional)" placeholderTextColor={colors.mutedForeground} multiline maxLength={280} style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} /><Text style={[styles.field, { color: colors.foreground }]}>Who can see this?</Text><View style={styles.choices}>{(['public', 'friends', 'followers', 'private'] as MapVisibility[]).map((item) => <Pressable key={item} onPress={() => setVisibility(item)} style={[styles.choice, { borderColor: visibility === item ? colors.primary : colors.border, backgroundColor: visibility === item ? colors.secondary : 'transparent' }]}><Text style={{ color: colors.foreground }}>{item}</Text></Pressable>)}</View><Text style={[styles.field, { color: colors.foreground }]}>Expiry</Text><View style={styles.choices}>{(['day', 'week', 'never'] as const).map((item) => <Pressable key={item} onPress={() => setExpiry(item)} style={[styles.choice, { borderColor: expiry === item ? colors.primary : colors.border }]}><Text style={{ color: colors.foreground }}>{item === 'day' ? '24 hours' : item === 'week' ? '7 days' : 'Never'}</Text></Pressable>)}</View><View style={styles.sheetActions}><Pressable onPress={onClose}><Text style={{ color: colors.mutedForeground, fontWeight: '700' }}>Cancel</Text></Pressable><Pressable onPress={onSave} style={[styles.publish, { backgroundColor: colors.primary }]}><Text style={styles.primaryText}>Post pin</Text></Pressable></View></View></View></Modal>;
}

function CommentsSheet({ pin, token, colors, onClose }: { pin: MapPin | null; token: string; colors: any; onClose: () => void }) {
  const [comments, setComments] = useState<MapComment[]>([]);
  const [text, setText] = useState('');
  const [loadingComments, setLoadingComments] = useState(false);
  React.useEffect(() => { if (!pin) return; setLoadingComments(true); void getMapPinComments(token, pin.id).then(setComments).catch(() => Alert.alert('Could not load comments', 'Please try again.')).finally(() => setLoadingComments(false)); }, [pin?.id, token]);
  const send = async () => { if (!pin || !text.trim()) return; try { const comment = await createMapPinComment(token, pin.id, text.trim()); setComments((all) => [...all, comment]); setText(''); } catch { Alert.alert('Comment not sent', 'Please try again.'); } };
  return <Modal visible={Boolean(pin)} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalShade}><View style={[styles.commentsSheet, { backgroundColor: colors.background }]}><View style={[styles.grabber, { backgroundColor: colors.border }]} /><View style={styles.commentsTitle}><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Comments</Text><Pressable onPress={onClose}><Ionicons name="close" size={24} color={colors.foreground} /></Pressable></View>{loadingComments ? <ActivityIndicator color={colors.primary} style={{ margin: 24 }} /> : <FlatList data={comments} keyExtractor={(item) => String(item.id)} ListEmptyComponent={<Text style={[styles.emptyComments, { color: colors.mutedForeground }]}>No comments yet.</Text>} renderItem={({ item }) => <View style={[styles.comment, { borderBottomColor: colors.border }]}><Text style={{ color: colors.foreground, fontWeight: '700' }}>{item.author.name}</Text><Text style={{ color: colors.foreground }}>{item.content}</Text></View>} />}<View style={[styles.commentEntry, { borderTopColor: colors.border }]}><TextInput value={text} onChangeText={setText} placeholder="Write a comment" placeholderTextColor={colors.mutedForeground} style={{ flex: 1, color: colors.foreground }} maxLength={1000} /><Pressable onPress={() => void send()}><Text style={{ color: colors.primary, fontWeight: '700' }}>Send</Text></Pressable></View></View></View></Modal>;
}

const styles = StyleSheet.create({
  mapCanvas: { flex: 1, position: 'relative', overflow: 'hidden' },
  loadingPill: { position: 'absolute', top: 14, alignSelf: 'center', width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  errorPill: { position: 'absolute', top: 14, left: 14, minHeight: 38, borderRadius: 19, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  selectedPinPanel: { position: 'absolute', left: 10, right: 10, bottom: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  list: { padding: 16, gap: 12 },
  mapScene: { height: 455, borderRadius: 30, borderWidth: 1, overflow: 'hidden', position: 'relative', marginBottom: 12 },
  mapRoadA: { position: 'absolute', width: 620, height: 34, backgroundColor: 'rgba(255,255,255,.48)', transform: [{ rotate: '-22deg' }], top: 190, left: -120 },
  mapRoadB: { position: 'absolute', width: 520, height: 22, backgroundColor: 'rgba(255,255,255,.4)', transform: [{ rotate: '58deg' }], top: 180, left: -90 },
  mapRoadC: { position: 'absolute', width: 400, height: 14, backgroundColor: 'rgba(255,255,255,.34)', transform: [{ rotate: '8deg' }], top: 320, left: -10 },
  mapPark: { position: 'absolute', width: 160, height: 120, borderRadius: 42, right: -25, top: 95, transform: [{ rotate: '-12deg' }] },
  storyRail: { position: 'absolute', top: 14, left: 14, right: 14, flexDirection: 'row', gap: 9 },
  storyBubble: { width: 50, height: 50, borderRadius: 25, borderWidth: 3, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,255,255,.3)' },
  mapMarker: { position: 'absolute', width: 42, height: 42, borderRadius: 21, borderWidth: 3, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: .16, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 5 },
  mapControls: { position: 'absolute', right: 14, top: 14, gap: 10, alignItems: 'flex-end' },
  mapControl: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  mapCreate: { height: 44, borderRadius: 22, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 5 },
  mapCreateText: { color: '#fff', fontWeight: '900' },
  mapPrompt: { position: 'absolute', left: 18, right: 18, bottom: 18, borderRadius: 24, borderWidth: 1, padding: 16 },
  mapPromptTitle: { fontSize: 18, fontWeight: '900' }, mapPromptText: { fontSize: 12, marginVertical: 5 },
   selectedPin: { position: 'absolute', left: 14, right: 14, bottom: 14, minHeight: 68, borderRadius: 24, borderWidth: 1, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 10 },
   discoveryPanel: { position: 'absolute', left: 12, right: 12, bottom: 12, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4, shadowColor: '#000', shadowOpacity: .12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
   discoveryHeader: { flexDirection: 'row', alignItems: 'center', gap: 12 },
   discoveryTitle: { fontSize: 15, fontWeight: '900' },
   discoveryMeta: { fontSize: 11, marginTop: 3 },
   discoveryEmpty: { fontSize: 12, paddingVertical: 12 },
   discoveryItem: { minHeight: 42, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 7 },
   discoveryItemTitle: { fontSize: 12, fontWeight: '800' },
   discoveryItemText: { fontSize: 11, marginTop: 2 },
  navigate: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  privacy: { borderRadius: 22, borderWidth: 1, padding: 12, flexDirection: 'row', gap: 9, marginBottom: 12 },
  privacyText: { flex: 1, fontSize: 13, lineHeight: 18 },
  card: { borderRadius: 24, borderWidth: 1, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  locationCopy: { flex: 1 },
  title: { fontSize: 17, fontWeight: '800' },
  description: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  locate: { paddingHorizontal: 11, minHeight: 38, justifyContent: 'center', borderRadius: 10 },
  primaryText: { color: '#fff', fontWeight: '800' },
  post: { marginTop: 12, minHeight: 46, borderRadius: 12, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  postText: { fontWeight: '800' }, error: { borderRadius: 10, padding: 12, marginTop: 12 },
  pin: { borderWidth: 1, borderRadius: 24, padding: 14 }, pinHead: { flexDirection: 'row', alignItems: 'center', gap: 10 }, avatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: '#fff', fontWeight: '800' }, author: { fontWeight: '800' }, meta: { fontSize: 12, marginTop: 2 }, caption: { fontSize: 15, lineHeight: 21, marginTop: 12 }, expiry: { fontSize: 12, marginTop: 8 }, pinActions: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 12, paddingTop: 10, flexDirection: 'row' }, pinAction: { flex: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 4 },
  modalShade: { flex: 1, backgroundColor: 'rgba(0,0,0,.35)', justifyContent: 'flex-end' }, sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }, commentsSheet: { height: '72%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10 }, grabber: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }, sheetTitle: { fontSize: 20, fontWeight: '800' }, sheetText: { lineHeight: 19, marginTop: 6 }, input: { minHeight: 82, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top', marginTop: 16 }, field: { fontWeight: '800', marginTop: 16 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }, choice: { borderWidth: 1, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12 }, sheetActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }, publish: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12 }, commentsTitle: { paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, comment: { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 3 }, emptyComments: { textAlign: 'center', marginTop: 32 }, commentEntry: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', padding: 14, gap: 10, alignItems: 'center' },
});