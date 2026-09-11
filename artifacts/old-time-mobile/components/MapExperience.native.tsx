import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, type MapPressEvent, type Region as NativeMapRegion } from 'react-native-maps';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { API_BASE_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useColors } from '@/hooks/useColors';
import { TAB_BAR_CONTENT_CLEARANCE } from '@/constants/layout';

type Layer = 'all' | 'moments' | 'weather' | 'places';
type Moment = {
  id: string;
  latitude: number;
  longitude: number;
  caption: string | null;
  category: string;
  createdAt: string;
  author: { displayName: string; avatarUrl?: string | null };
  counts: { reactions: number; comments: number; saves: number };
};
type Activity = {
  summary: { momentCount: number; storyCount: number; activeZoneCount: number };
  clusters: Array<{ id: string; latitude: number; longitude: number; count: number; score: number }>;
  moments: Moment[];
  stories: Moment[];
};
type Place = { id: string; name: string; address: string; latitude: number; longitude: number; mapUri: string };
type WeatherSignal = { id: string; latitude: number; longitude: number; title: string; subtitle: string };
type NearbyPin = {
  id: string | number;
  latitude: number;
  longitude: number;
  caption?: string | null;
  category?: string;
  createdAt: string | number;
  author?: { name?: string; username?: string };
  counts?: { reactions?: number; comments?: number; saves?: number };
};

const initialRegion: NativeMapRegion = {
  latitude: 24,
  longitude: 0,
  latitudeDelta: 70,
  longitudeDelta: 120,
};

function ageLabel(createdAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function activityFromPins(items: NearbyPin[]): Activity {
  const moments = items.map((pin) => ({
    id: String(pin.id),
    latitude: pin.latitude,
    longitude: pin.longitude,
    caption: pin.caption ?? null,
    category: pin.category ?? 'moment',
    createdAt: new Date(pin.createdAt).toISOString(),
    author: { displayName: pin.author?.name ?? 'Old Time user', avatarUrl: null },
    counts: {
      reactions: pin.counts?.reactions ?? 0,
      comments: pin.counts?.comments ?? 0,
      saves: pin.counts?.saves ?? 0,
    },
  }));
  return {
    summary: { momentCount: moments.length, storyCount: 0, activeZoneCount: moments.length },
    clusters: moments.map((moment) => ({
      id: `pin-zone-${moment.id}`,
      latitude: moment.latitude,
      longitude: moment.longitude,
      count: 1,
      score: Math.min(100, moment.counts.reactions * 8 + moment.counts.comments * 5 + moment.counts.saves * 3),
    })),
    moments,
    stories: [],
  };
}

export default function MapExperience() {
  const colors = useColors();
  const { getToken } = useAuth();
  const [region, setRegion] = useState(initialRegion);
  const [layer, setLayer] = useState<Layer>('all');
  const [activity, setActivity] = useState<Activity | null>(null);
  const [weather, setWeather] = useState<WeatherSignal | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Moment | null>(null);
  const [placing, setPlacing] = useState(false);
  const [coordinate, setCoordinate] = useState({ latitude: initialRegion.latitude, longitude: initialRegion.longitude });
  const [caption, setCaption] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const [showUserLocation, setShowUserLocation] = useState(false);
  const [locating, setLocating] = useState(false);
  const mapRef = useRef<MapView | null>(null);
  const requestId = useRef(0);
  const regionChangeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const request = useCallback(async (path: string, init?: RequestInit) => {
    const token = await getToken();
    const response = await fetch(`${API_BASE_URL}/api${path}`, {
      ...init,
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...init?.headers },
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.message ?? 'Map request failed');
    }
    return response.status === 204 ? null : response.json();
  }, [getToken]);

  const load = useCallback(async (next: NativeMapRegion, showError = false) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const radiusKm = Math.min(25, Math.max(1, next.latitudeDelta * 111 * 0.75));
      const [pinData, placeData] = await Promise.all([
        request(`/map/pins/nearby?latitude=${next.latitude}&longitude=${next.longitude}&radiusKm=${radiusKm}`) as Promise<{ items: NearbyPin[] }>,
        layer === 'all' || layer === 'places'
          ? request(`/map/places/nearby?latitude=${next.latitude}&longitude=${next.longitude}&category=all&radiusMeters=5000`) as Promise<{ items: Place[] }>
          : Promise.resolve({ items: [] }),
      ]);
      if (id !== requestId.current) return;
      setActivity(activityFromPins(pinData.items ?? []));
      setWeather(null);
      setPlaces(placeData.items);
    } catch (error) {
      if (showError) Alert.alert('Map unavailable', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [layer, request]);

  useEffect(() => {
    void load(region);
  }, [layer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => {
    if (regionChangeTimer.current) clearTimeout(regionChangeTimer.current);
  }, []);

  const visibleMoments = useMemo(() => [...(activity?.moments ?? []), ...(activity?.stories ?? [])], [activity]);
  const visiblePlaces = layer === 'places' || layer === 'all' ? places : [];

  const handleRegionChange = (next: NativeMapRegion) => {
    setRegion(next);
    setCoordinate({ latitude: next.latitude, longitude: next.longitude });
    if (regionChangeTimer.current) clearTimeout(regionChangeTimer.current);
    regionChangeTimer.current = setTimeout(() => void load(next), 420);
  };

  const locate = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Location stays off',
          permission.canAskAgain === false
            ? 'Location access is blocked. Open Settings and allow location for Old Time.'
            : 'Allow location access to center the activity map.',
          permission.canAskAgain === false
            ? [{ text: 'Not now', style: 'cancel' }, { text: 'Open Settings', onPress: () => void Linking.openSettings() }]
            : [{ text: 'OK', style: 'cancel' }],
        );
        return;
      }
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { latitude: result.coords.latitude, longitude: result.coords.longitude, latitudeDelta: 0.08, longitudeDelta: 0.1 };
      setShowUserLocation(true);
      setRegion(next);
      setCoordinate(next);
      mapRef.current?.animateToRegion(next, 450);
      await load(next, true);
    } catch (error) {
      Alert.alert('Could not find you', error instanceof Error ? error.message : 'Turn on Location Services and try again.');
    } finally {
      setLocating(false);
    }
  };

  const search = async () => {
    if (!query.trim()) return;
    try {
      const match = (await Location.geocodeAsync(query.trim()))[0];
      if (!match) throw new Error('No place found');
      const next = { latitude: match.latitude, longitude: match.longitude, latitudeDelta: 0.08, longitudeDelta: 0.1 };
      setRegion(next);
      setCoordinate(next);
      mapRef.current?.animateToRegion(next, 450);
      await load(next, true);
    } catch {
      Alert.alert('Place not found', 'Try a city, venue, landmark, or full address.');
    }
  };

  const publish = async () => {
    try {
      const created = await request('/map/pins', {
        method: 'POST',
        body: JSON.stringify({ ...coordinate, caption: caption.trim(), visibility: 'public', expiresAt: null }),
      }) as NearbyPin;
      setSelected(activityFromPins([created]).moments[0] ?? null);
      setPlacing(false);
      setCaption('');
      await load(region, true);
    } catch (error) {
      Alert.alert('Could not share the moment', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const handleMapPress = (event: MapPressEvent) => {
    if (placing) setCoordinate(event.nativeEvent.coordinate);
    else setSelected(null);
  };

  const layerOptions: Array<{ key: Layer; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { key: 'all', label: 'All activity', icon: 'radio-outline' },
    { key: 'moments', label: 'Moments', icon: 'people-outline' },
    { key: 'weather', label: 'Weather', icon: 'cloud-outline' },
    { key: 'places', label: 'Places', icon: 'location-outline' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.muted }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        onMapReady={() => setMapReady(true)}
        onRegionChangeComplete={handleRegionChange}
        onPress={handleMapPress}
        showsUserLocation={showUserLocation}
        showsCompass
        showsScale
        toolbarEnabled={false}
      >
        {mapReady && layer !== 'weather' && (layer === 'all' || layer === 'moments') ? visibleMoments.slice(0, 100).map((moment) => (
          <Marker key={`moment-${moment.id}`} coordinate={{ latitude: moment.latitude, longitude: moment.longitude }} pinColor={colors.primary} onPress={() => setSelected(moment)} title={moment.author.displayName} description={moment.caption ?? `Shared ${ageLabel(moment.createdAt)} ago`} />
        )) : null}
        {mapReady && (layer === 'all' || layer === 'places') ? visiblePlaces.slice(0, 50).map((place) => (
          <Marker key={`place-${place.id}`} coordinate={{ latitude: place.latitude, longitude: place.longitude }} pinColor={colors.secondary} title={place.name} description={place.address} />
        )) : null}
        {mapReady && layer === 'weather' && weather ? (
          <Marker coordinate={{ latitude: weather.latitude, longitude: weather.longitude }} pinColor={colors.secondary} title={weather.title} description={weather.subtitle} />
        ) : null}
        {placing ? <Marker coordinate={coordinate} pinColor={colors.primary} title="Shared moment location" /> : null}
      </MapView>

      <View style={[styles.activityDock, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.dockHeader}>
          <View>
            <Text style={[styles.dockTitle, { color: colors.foreground }]}>What’s happening nearby</Text>
            <Text style={[styles.dockMeta, { color: colors.mutedForeground }]}>{locating ? 'Finding your location…' : loading ? 'Updating live signals…' : activity ? `${activity.summary.momentCount + activity.summary.storyCount} shared moments · ${activity.summary.activeZoneCount} active zones` : 'Waiting for map signals'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={locating ? 'Finding your location' : 'Use my location'} accessibilityState={{ busy: locating, disabled: locating }} disabled={locating} onPress={() => void locate()} style={[styles.iconButton, { backgroundColor: colors.muted, opacity: locating ? 0.55 : 1 }]}><Ionicons name={locating ? 'sync-outline' : 'navigate-outline'} size={18} color={colors.foreground} /></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layerRow}>
          {layerOptions.map((option) => <Pressable key={option.key} accessibilityRole="tab" accessibilityState={{ selected: layer === option.key }} onPress={() => setLayer(option.key)} style={[styles.layerChip, { backgroundColor: layer === option.key ? colors.primary : colors.muted }]}><Ionicons name={option.icon} size={15} color={layer === option.key ? colors.primaryForeground : colors.foreground} /><Text style={{ color: layer === option.key ? colors.primaryForeground : colors.foreground, fontWeight: '800', fontSize: 12 }}>{option.label}</Text></Pressable>)}
        </ScrollView>
        {placing ? (
          <View style={styles.composer}>
             <Text style={[styles.panelTitle, { color: colors.foreground }]}>Drop a pin here</Text>
            <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => void search()} placeholder="Search a place or address" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted }]} />
             <TextInput value={caption} onChangeText={setCaption} placeholder="Add a note about this place" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted }]} />
             <Text style={{ color: colors.mutedForeground, fontSize: 11 }}>Only this selected location is shared. Your live location is never published automatically.</Text>
             <View style={styles.actionRow}><Pressable onPress={() => setPlacing(false)}><Text style={{ color: colors.mutedForeground, fontWeight: '800' }}>Cancel</Text></Pressable><Pressable onPress={() => void publish()}><Text style={{ color: colors.primary, fontWeight: '800' }}>Drop pin</Text></Pressable></View>
          </View>
        ) : selected ? (
          <View style={styles.selectedPanel}>
            <View style={styles.selectedHeading}><View style={[styles.selectedAvatar, { backgroundColor: colors.secondary }]}><Text style={styles.selectedAvatarText}>{selected.author.displayName.slice(0, 1)}</Text></View><View style={{ flex: 1 }}><Text style={[styles.panelTitle, { color: colors.foreground }]}>{selected.author.displayName}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{ageLabel(selected.createdAt)} · {selected.category}</Text></View><Pressable onPress={() => setSelected(null)}><Ionicons name="close" size={20} color={colors.mutedForeground} /></Pressable></View>
            <Text style={{ color: colors.foreground }}>{selected.caption || 'A shared moment from this place.'}</Text>
            <View style={styles.actionRow}><Text style={{ color: colors.mutedForeground }}>♥ {selected.counts.reactions}</Text><Text style={{ color: colors.mutedForeground }}>Comments {selected.counts.comments}</Text><Pressable onPress={() => void Linking.openURL(`https://maps.apple.com/?ll=${selected.latitude},${selected.longitude}`)}><Text style={{ color: colors.primary, fontWeight: '800' }}>Open maps</Text></Pressable></View>
          </View>
        ) : layer === 'weather' && weather ? (
          <View style={styles.signalPanel}><Ionicons name="cloud-outline" size={25} color={colors.secondary} /><View style={{ flex: 1 }}><Text style={[styles.panelTitle, { color: colors.foreground }]}>{weather.title}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{weather.subtitle}</Text></View></View>
        ) : layer === 'places' && places.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.placeRow}>{places.slice(0, 5).map((place) => <Pressable key={place.id} onPress={() => mapRef.current?.animateToRegion({ latitude: place.latitude, longitude: place.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 350)} style={[styles.placeChip, { backgroundColor: colors.muted }]}><Text numberOfLines={1} style={{ color: colors.foreground, fontWeight: '800', maxWidth: 130 }}>{place.name}</Text><Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 10 }}>{place.address || 'Nearby place'}</Text></Pressable>)}</ScrollView>
        ) : activity?.clusters.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zoneRow}>{activity.clusters.slice(0, 5).map((cluster) => <Pressable key={cluster.id} onPress={() => mapRef.current?.animateToRegion({ latitude: cluster.latitude, longitude: cluster.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 }, 350)} style={[styles.zoneCard, { backgroundColor: colors.muted }]}><Text style={[styles.zoneCount, { color: colors.foreground }]}>{cluster.count}</Text><Text style={{ color: colors.mutedForeground, fontSize: 11 }}>moment{cluster.count === 1 ? '' : 's'}</Text><Text style={{ color: cluster.score > 70 ? colors.primary : colors.secondary, fontSize: 10, fontWeight: '800' }}>{cluster.score} activity</Text></Pressable>)}</ScrollView>
        ) : (
          <View style={styles.emptyPanel}><Text style={[styles.panelTitle, { color: colors.foreground }]}>Nothing public is active here yet.</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Move the map or share a moment from this spot to add a real signal.</Text></View>
        )}
       {!placing && !selected ? <Pressable accessibilityRole="button" onPress={() => setPlacing(true)} style={[styles.shareButton, { backgroundColor: colors.primary }]}><Ionicons name="location" size={18} color={colors.primaryForeground} /><Text style={{ color: colors.primaryForeground, fontWeight: '800' }}>Drop a pin here</Text></Pressable> : null}
      </View>
      <View style={{ height: TAB_BAR_CONTENT_CLEARANCE }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' },
  activityDock: { position: 'absolute', left: 10, right: 10, bottom: TAB_BAR_CONTENT_CLEARANCE + 8, zIndex: 20, elevation: 20, borderRadius: 22, borderWidth: 1, padding: 14, gap: 12, shadowColor: '#000', shadowOpacity: .16, shadowRadius: 16, shadowOffset: { width: 0, height: -3 } },
  dockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dockTitle: { fontSize: 17, fontWeight: '800' },
  dockMeta: { fontSize: 11, marginTop: 3 },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  layerRow: { gap: 8 },
  layerChip: { minHeight: 34, borderRadius: 17, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 5 },
  selectedPanel: { gap: 10 },
  selectedHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  selectedAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  selectedAvatarText: { color: '#fff', fontWeight: '800' },
  panelTitle: { fontSize: 14, fontWeight: '800' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 15 },
  signalPanel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  zoneRow: { gap: 8 },
  zoneCard: { minWidth: 94, borderRadius: 14, padding: 10, gap: 2 },
  zoneCount: { fontSize: 22, fontWeight: '900' },
  placeRow: { gap: 8 },
  placeChip: { width: 145, borderRadius: 13, padding: 10, gap: 3 },
  composer: { gap: 8 },
  input: { minHeight: 40, borderRadius: 11, paddingHorizontal: 11 },
  emptyPanel: { gap: 4 },
  shareButton: { minHeight: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },
});