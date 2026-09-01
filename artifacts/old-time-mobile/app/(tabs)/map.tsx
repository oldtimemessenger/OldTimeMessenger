import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, Pressable, RefreshControl, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { Avatar, EmptyState, Screen } from '@/components/ui';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';
import { createMapPin, createMapPinComment, deleteMapPin, getMapPinComments, getNearbyPins, reportMapPin, setMapPinRelation, type MapComment, type MapPin, type MapVisibility } from '@/lib/map-api';
import { setUserBlocked } from '@/lib/social-api';

type Coordinate = { latitude: number; longitude: number };

export default function MapScreen() {
  const colors = useColors();
  const { session, settings } = useApp();
  const [permission, requestPermission] = Location.useForegroundPermissions();
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [caption, setCaption] = useState('');
  const [visibility, setVisibility] = useState<MapVisibility>(settings.locationAudience);
  const [expiry, setExpiry] = useState<'day' | 'week' | 'never'>('day');
  const [commentPin, setCommentPin] = useState<MapPin | null>(null);
  const [selectedPin, setSelectedPin] = useState<MapPin | null>(null);

  useEffect(() => {
    setVisibility(settings.locationAudience === 'public' ? 'friends' : settings.locationAudience);
  }, [settings.locationAudience]);

  const loadNearby = useCallback(async (coordinate: Coordinate) => {
    if (!session?.authToken) return;
    setLoading(true);
    setError(null);
    try {
      const page = await getNearbyPins(session.authToken, coordinate.latitude, coordinate.longitude);
      setPins(page.items);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load nearby pins.');
    } finally {
      setLoading(false);
    }
  }, [session?.authToken]);

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
      setLocation(coordinate);
      await loadNearby(coordinate);
    } catch {
      Alert.alert('Location unavailable', 'Old Time could not read your current location. Try again outdoors or check device location services.');
    } finally {
      setLoading(false);
    }
  }

  async function openInMaps(pin: Coordinate) {
    const url = `https://maps.google.com/?q=${pin.latitude},${pin.longitude}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  }

  async function publishPin() {
    if (!location || !session?.authToken) return;
    try {
      const expiresAt = expiry === 'never' ? null : Date.now() + (expiry === 'day' ? 86_400_000 : 604_800_000);
      const created = await createMapPin(session.authToken, { ...location, caption: caption.trim() || undefined, visibility, expiresAt });
      setPins((items) => [created, ...items]);
      setCaption('');
      setComposerOpen(false);
    } catch (requestError) {
      Alert.alert('Pin not saved', requestError instanceof Error ? requestError.message : 'Please try again.');
    }
  }

  return (
    <Screen title="Map">
      <FlatList
        data={pins}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={() => location && void loadNearby(location)} tintColor={colors.primary} />}
        ListHeaderComponent={<>
          <MapScene pins={pins} selected={selectedPin} colors={colors} loading={loading} hasLocation={Boolean(location)} onLocate={() => void refreshLocation()} onSelect={setSelectedPin} onCreate={() => setComposerOpen(true)} onOpenMaps={(pin: MapPin) => void openInMaps(pin)} />
          <View style={[styles.privacy, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Ionicons name="shield-checkmark" size={18} color={colors.primary} />
            <Text style={[styles.privacyText, { color: colors.foreground }]}>Private by default. Your location stays on this device until you tap Post pin.</Text>
          </View>
          {error ? <Pressable onPress={() => location && void loadNearby(location)} style={[styles.error, { backgroundColor: colors.muted }]}><Text style={{ color: colors.foreground }}>{error}  <Text style={{ color: colors.primary, fontWeight: '700' }}>Retry</Text></Text></Pressable> : null}
        </>}
        renderItem={({ item }) => <PinCard pin={item} own={item.authorId === session?.id} colors={colors} onOpen={() => void openInMaps(item)} onComment={() => setCommentPin(item)} onChanged={(pin) => setPins((all) => all.map((current) => current.id === pin.id ? pin : current))} onDelete={() => setPins((all) => all.filter((pin) => pin.id !== item.id))} token={session?.authToken ?? ''} />}
        ListEmptyComponent={!loading && location ? <EmptyState icon="location-outline" title="No nearby pins yet" description="Be the first to share a place with the audience you choose." /> : null}
        ListFooterComponent={<View style={{ height: 96 }} />}
      />
      <PinComposer visible={composerOpen} colors={colors} caption={caption} setCaption={setCaption} visibility={visibility} setVisibility={setVisibility} expiry={expiry} setExpiry={setExpiry} onClose={() => setComposerOpen(false)} onSave={() => void publishPin()} />
      <CommentsSheet pin={commentPin} token={session?.authToken ?? ''} colors={colors} onClose={() => setCommentPin(null)} />
    </Screen>
  );
}

function MapScene({ pins, selected, colors, loading, hasLocation, onLocate, onSelect, onCreate, onOpenMaps }: any) {
  const visible = pins.slice(0, 6);
  return <View style={[styles.mapScene, { backgroundColor: colors.muted, borderColor: colors.border }]}>
    <View style={styles.mapRoadA} /><View style={styles.mapRoadB} /><View style={styles.mapRoadC} />
    <View style={[styles.mapPark, { backgroundColor: `${colors.primary}18` }]} />
    <View style={styles.storyRail}>
      {visible.slice(0, 4).map((pin: MapPin) => <Pressable key={pin.id} onPress={() => onSelect(pin)} style={[styles.storyBubble, { borderColor: selected?.id === pin.id ? colors.primary : 'rgba(255,255,255,.88)' }]}>
        <Avatar name={pin.author.name} size={42} color={colors.primary} />
      </Pressable>)}
    </View>
    {visible.map((pin: MapPin, index: number) => {
      const positions = [{ left: 48, top: 190 }, { right: 80, top: 140 }, { left: 142, top: 255 }, { right: 45, top: 290 }, { left: 75, top: 315 }, { left: 165, top: 158 }];
      return <Pressable key={pin.id} onPress={() => onSelect(pin)} style={[styles.mapMarker, positions[index], { backgroundColor: selected?.id === pin.id ? colors.primary : colors.card, borderColor: selected?.id === pin.id ? '#fff' : colors.border }]}>
        <Text style={{ color: selected?.id === pin.id ? '#fff' : colors.foreground, fontWeight: '900' }}>{pin.author.name.slice(0, 1).toUpperCase()}</Text>
      </Pressable>;
    })}
    <View style={styles.mapControls}>
      <Pressable onPress={onLocate} style={[styles.mapControl, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name={loading ? 'hourglass-outline' : 'locate'} size={21} color={colors.primary} /></Pressable>
      {hasLocation ? <Pressable onPress={onCreate} style={[styles.mapCreate, { backgroundColor: colors.primary }]}><Ionicons name="add" size={20} color="#fff" /><Text style={styles.mapCreateText}>Pin</Text></Pressable> : null}
    </View>
    {!hasLocation ? <View style={[styles.mapPrompt, { backgroundColor: colors.card, borderColor: colors.border }]}><Text style={[styles.mapPromptTitle, { color: colors.foreground }]}>See what’s nearby</Text><Text style={[styles.mapPromptText, { color: colors.mutedForeground }]}>Location is only read after you tap below.</Text><Pressable onPress={onLocate} style={[styles.locate, { backgroundColor: colors.primary }]}><Text style={styles.primaryText}>Use my location</Text></Pressable></View> : null}
    {selected ? <View style={[styles.selectedPin, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <Avatar name={selected.author.name} size={38} color={colors.primary} /><View style={{ flex: 1 }}><Text style={[styles.author, { color: colors.foreground }]}>{selected.author.name}</Text><Text numberOfLines={1} style={[styles.meta, { color: colors.mutedForeground }]}>{selected.caption || `${selected.distanceKm.toFixed(1)} km away`}</Text></View><Pressable onPress={() => onOpenMaps(selected)} style={[styles.navigate, { backgroundColor: colors.primary }]}><Ionicons name="navigate" size={18} color="#fff" /></Pressable>
    </View> : null}
  </View>;
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