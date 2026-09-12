import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import MapView, { Marker, type MapPressEvent, type Region as NativeMapRegion } from 'react-native-maps';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { API_BASE_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';
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

const THEME = {
  background: '#000000',
  card: '#121214',
  border: '#27272a',
  foreground: '#ffffff',
  mutedForeground: '#a1a1aa',
  primary: '#8d5cf6',
  primaryForeground: '#ffffff',
  secondary: '#27272a',
  routeBlue: '#3b82f6',
  routePink: '#ec4899',
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

  const request = useCallback(async (path: string, init?: RequestInit, tokenOverride?: string | null) => {
    const token = tokenOverride === undefined ? await getToken() : tokenOverride;
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
      const token = await getToken();
      const pinRequest = token
        ? request(`/map/pins/nearby?latitude=${next.latitude}&longitude=${next.longitude}&radiusKm=${radiusKm}`, undefined, token) as Promise<{ items: NearbyPin[] }>
        : Promise.resolve({ items: [] as NearbyPin[] });
      const placeRequest = layer === 'all' || layer === 'places'
        ? request(`/map/places/nearby?latitude=${next.latitude}&longitude=${next.longitude}&category=all&radiusMeters=5000`, undefined, token) as Promise<{ items: Place[] }>
        : Promise.resolve({ items: [] as Place[] });
      const [pinResult, placeResult] = await Promise.allSettled([
        pinRequest,
        placeRequest,
      ]);
      if (placeResult.status === 'rejected') throw placeResult.reason;
      const pinData = pinResult.status === 'fulfilled' ? pinResult.value : { items: [] as NearbyPin[] };
      const placeData = placeResult.value;
      if (id !== requestId.current) return;
      setActivity(activityFromPins(pinData.items ?? []));
      setWeather(null);
      setPlaces(placeData.items);
    } catch (error) {
      if (showError) Alert.alert('Map unavailable', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [getToken, layer, request]);

  useEffect(() => {
    void load(region);
  }, [layer]);

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
    <View style={[styles.root, { backgroundColor: THEME.background }]}>
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
        userInterfaceStyle="dark"
      >
        {mapReady && layer !== 'weather' && (layer === 'all' || layer === 'moments') ? visibleMoments.slice(0, 100).map((moment, index) => {
          const isFloatingCard = index < 4;
          return (
            <Marker key={`moment-${moment.id}`} coordinate={{ latitude: moment.latitude, longitude: moment.longitude }} onPress={() => setSelected(moment)} zIndex={isFloatingCard ? 2 : 1}>
              {isFloatingCard ? (
                <View style={styles.floatingCard}>
                  <Text style={styles.floatingCardTitle} numberOfLines={2}>{moment.caption || 'A moment shared here'}</Text>
                  <Text style={styles.floatingCardMeta}>@{moment.author.displayName}</Text>
                  <Text style={styles.floatingCardTime}>{ageLabel(moment.createdAt)} ago</Text>
                </View>
              ) : (
                <View style={styles.luminousContainer}>
                  <View style={[styles.luminousMarker, { backgroundColor: 'rgba(141, 92, 246, 0.25)', borderColor: 'rgba(141, 92, 246, 0.6)' }]}>
                    <View style={[styles.luminousMarkerDot, { backgroundColor: '#8d5cf6' }]} />
                  </View>
                  <View style={styles.luminousLabel}>
                    <Text style={styles.luminousLabelText}>{moment.author.displayName.slice(0, 10)}</Text>
                  </View>
                </View>
              )}
            </Marker>
          );
        }) : null}

        {mapReady && (layer === 'all' || layer === 'places') ? visiblePlaces.slice(0, 50).map((place) => (
          <Marker key={`place-${place.id}`} coordinate={{ latitude: place.latitude, longitude: place.longitude }} onPress={() => mapRef.current?.animateToRegion({ latitude: place.latitude, longitude: place.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 350)}>
            <View style={styles.luminousContainer}>
              <View style={[styles.luminousMarker, { backgroundColor: 'rgba(236, 72, 153, 0.25)', borderColor: 'rgba(236, 72, 153, 0.6)', width: 36, height: 36, borderRadius: 18 }]}>
                <View style={[styles.luminousMarkerDot, { backgroundColor: '#ec4899', width: 8, height: 8, borderRadius: 4 }]} />
              </View>
              <View style={styles.luminousLabel}>
                <Text style={styles.luminousLabelText}>{place.name}</Text>
              </View>
            </View>
          </Marker>
        )) : null}

        {mapReady && layer === 'weather' && weather ? (
          <Marker coordinate={{ latitude: weather.latitude, longitude: weather.longitude }}>
            <View style={styles.luminousContainer}>
              <View style={[styles.luminousMarker, { backgroundColor: 'rgba(59, 130, 246, 0.25)', borderColor: 'rgba(59, 130, 246, 0.6)' }]}>
                 <Ionicons name="cloud" size={16} color="#3b82f6" />
              </View>
            </View>
          </Marker>
        ) : null}

        {placing ? (
          <Marker coordinate={coordinate}>
            <View style={styles.luminousContainer}>
              <View style={[styles.luminousMarker, { backgroundColor: 'rgba(234, 179, 8, 0.25)', borderColor: 'rgba(234, 179, 8, 0.6)' }]}>
                 <View style={[styles.luminousMarkerDot, { backgroundColor: '#eab308' }]} />
              </View>
            </View>
          </Marker>
        ) : null}
      </MapView>

      <View style={[styles.activityDock, { backgroundColor: THEME.card, borderColor: THEME.border }]}>
        <View style={styles.dockHeader}>
          <View>
            <Text style={[styles.dockTitle, { color: THEME.foreground }]}>What’s happening nearby</Text>
            <Text style={[styles.dockMeta, { color: THEME.mutedForeground }]}>{locating ? 'Finding your location…' : loading ? 'Updating live signals…' : activity ? `${activity.summary.momentCount + activity.summary.storyCount} shared moments · ${activity.summary.activeZoneCount} active zones` : 'Waiting for map signals'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel={locating ? 'Finding your location' : 'Use my location'} accessibilityState={{ busy: locating, disabled: locating }} disabled={locating} onPress={() => void locate()} style={[styles.iconButton, { backgroundColor: THEME.secondary, opacity: locating ? 0.55 : 1 }]}><Ionicons name={locating ? 'sync-outline' : 'navigate-outline'} size={18} color={THEME.foreground} /></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layerRow}>
          {layerOptions.map((option) => (
            <Pressable key={option.key} accessibilityRole="tab" accessibilityState={{ selected: layer === option.key }} onPress={() => setLayer(option.key)} style={[styles.layerChip, { backgroundColor: layer === option.key ? THEME.primary : 'transparent', borderWidth: 1, borderColor: layer === option.key ? THEME.primary : THEME.border }]}>
              <Ionicons name={option.icon} size={15} color={layer === option.key ? THEME.primaryForeground : THEME.foreground} />
              <Text style={{ color: layer === option.key ? THEME.primaryForeground : THEME.foreground, fontWeight: '800', fontSize: 12 }}>{option.label}</Text>
            </Pressable>
          ))}
        </ScrollView>
        {placing ? (
          <View style={styles.composer}>
             <Text style={[styles.panelTitle, { color: THEME.foreground }]}>Drop a pin here</Text>
             <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => void search()} placeholder="Search a place or address" placeholderTextColor={THEME.mutedForeground} style={[styles.input, { color: THEME.foreground, backgroundColor: THEME.secondary }]} />
             <TextInput value={caption} onChangeText={setCaption} placeholder="Add a note about this place" placeholderTextColor={THEME.mutedForeground} style={[styles.input, { color: THEME.foreground, backgroundColor: THEME.secondary }]} />
             <Text style={{ color: THEME.mutedForeground, fontSize: 11 }}>Only this selected location is shared. Your live location is never published automatically.</Text>
             <View style={styles.actionRow}><Pressable onPress={() => setPlacing(false)}><Text style={{ color: THEME.mutedForeground, fontWeight: '800' }}>Cancel</Text></Pressable><Pressable onPress={() => void publish()}><Text style={{ color: THEME.primary, fontWeight: '800' }}>Drop pin</Text></Pressable></View>
          </View>
        ) : selected ? (
          <View style={styles.selectedPanel}>
            <View style={styles.selectedHeading}><View style={[styles.selectedAvatar, { backgroundColor: THEME.primary }]}><Text style={styles.selectedAvatarText}>{selected.author.displayName.slice(0, 1)}</Text></View><View style={{ flex: 1 }}><Text style={[styles.panelTitle, { color: THEME.foreground }]}>{selected.author.displayName}</Text><Text style={{ color: THEME.mutedForeground, fontSize: 12 }}>{ageLabel(selected.createdAt)} · {selected.category}</Text></View><Pressable onPress={() => setSelected(null)}><Ionicons name="close" size={20} color={THEME.mutedForeground} /></Pressable></View>
            <Text style={{ color: THEME.foreground }}>{selected.caption || 'A shared moment from this place.'}</Text>
            <View style={styles.actionRow}><Text style={{ color: THEME.mutedForeground }}>♥ {selected.counts.reactions}</Text><Text style={{ color: THEME.mutedForeground }}>Comments {selected.counts.comments}</Text><Pressable onPress={() => void Linking.openURL(`https://maps.apple.com/?ll=${selected.latitude},${selected.longitude}`)}><Text style={{ color: THEME.primary, fontWeight: '800' }}>Open maps</Text></Pressable></View>
          </View>
        ) : layer === 'weather' && weather ? (
          <View style={styles.signalPanel}><Ionicons name="cloud-outline" size={25} color={THEME.routeBlue} /><View style={{ flex: 1 }}><Text style={[styles.panelTitle, { color: THEME.foreground }]}>{weather.title}</Text><Text style={{ color: THEME.mutedForeground, fontSize: 12 }}>{weather.subtitle}</Text></View></View>
        ) : activity?.moments.length && (layer === 'all' || layer === 'moments') ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zoneRow}>
            {activity.moments.slice(0, 10).map((moment) => (
              <Pressable key={moment.id} onPress={() => mapRef.current?.animateToRegion({ latitude: moment.latitude, longitude: moment.longitude, latitudeDelta: 0.08, longitudeDelta: 0.08 }, 350)} style={[styles.activityCard, { backgroundColor: THEME.secondary }]}>
                <View style={styles.activityCardBadge}>
                  <View style={styles.recentDot} />
                  <Text style={styles.recentText}>{ageLabel(moment.createdAt).toUpperCase()} AGO</Text>
                  <View style={{ flex: 1 }} />
                  {moment.counts.reactions > 0 && (
                    <View style={styles.activityCardScore}>
                      <Text style={styles.activityCardScoreText}>{moment.counts.reactions}</Text>
                    </View>
                  )}
                </View>
                <View style={{ flex: 1, justifyContent: 'flex-end', marginTop: 12 }}>
                  <Text style={styles.activityCardTitle} numberOfLines={2}>{moment.caption || 'Shared moment'}</Text>
                  <Text style={styles.activityCardMeta}>@{moment.author.displayName}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : layer === 'places' && places.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zoneRow}>
            {places.slice(0, 10).map((place) => (
              <Pressable key={place.id} onPress={() => mapRef.current?.animateToRegion({ latitude: place.latitude, longitude: place.longitude, latitudeDelta: 0.04, longitudeDelta: 0.04 }, 350)} style={[styles.activityCard, { backgroundColor: THEME.secondary }]}>
                <View style={styles.activityCardBadge}>
                  <Ionicons name="location" size={12} color={THEME.routePink} />
                  <Text style={[styles.recentText, { color: THEME.routePink }]}>PLACE</Text>
                </View>
                <View style={{ flex: 1, justifyContent: 'flex-end', marginTop: 12 }}>
                  <Text style={styles.activityCardTitle} numberOfLines={2}>{place.name}</Text>
                  <Text style={styles.activityCardMeta} numberOfLines={1}>{place.address || 'Nearby place'}</Text>
                </View>
              </Pressable>
            ))}
          </ScrollView>
        ) : (
          <View style={styles.emptyPanel}>
            <Text style={[styles.panelTitle, { color: THEME.foreground }]}>No activity here yet.</Text>
            <Text style={{ color: THEME.mutedForeground, fontSize: 13, marginTop: 2 }}>Move the map or share a moment to add a real signal.</Text>
          </View>
        )}
        {!placing && !selected ? <Pressable accessibilityRole="button" onPress={() => setPlacing(true)} style={[styles.shareButton, { backgroundColor: THEME.primary }]}><Ionicons name="location" size={18} color={THEME.primaryForeground} /><Text style={{ color: THEME.primaryForeground, fontWeight: '800' }}>Drop a pin here</Text></Pressable> : null}
      </View>
      <View style={{ height: TAB_BAR_CONTENT_CLEARANCE }} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, minHeight: 0, position: 'relative', overflow: 'hidden' },
  activityDock: { position: 'absolute', left: 10, right: 10, bottom: TAB_BAR_CONTENT_CLEARANCE + 8, zIndex: 20, elevation: 20, borderRadius: 22, borderWidth: 1, padding: 14, gap: 14, shadowColor: '#000', shadowOpacity: 0.25, shadowRadius: 20, shadowOffset: { width: 0, height: -5 } },
  dockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  dockTitle: { fontSize: 17, fontWeight: '800' },
  dockMeta: { fontSize: 11, marginTop: 3 },
  iconButton: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  layerRow: { gap: 8 },
  layerChip: { minHeight: 34, borderRadius: 17, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 5 },
  selectedPanel: { gap: 10 },
  selectedHeading: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  selectedAvatar: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  selectedAvatarText: { color: '#fff', fontWeight: '800' },
  panelTitle: { fontSize: 15, fontWeight: '800' },
  actionRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 15 },
  signalPanel: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  zoneRow: { gap: 10 },
  composer: { gap: 10 },
  input: { minHeight: 40, borderRadius: 11, paddingHorizontal: 11 },
  emptyPanel: { paddingVertical: 10 },
  shareButton: { minHeight: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 6 },

  floatingCard: { backgroundColor: 'rgba(18, 18, 20, 0.95)', borderRadius: 12, padding: 10, maxWidth: 140, borderWidth: 1, borderColor: '#333', shadowColor: '#000', shadowOpacity: 0.6, shadowRadius: 12, shadowOffset: { width: 0, height: 6 } },
  floatingCardTitle: { color: '#fff', fontSize: 12, fontWeight: '800', marginBottom: 4 },
  floatingCardMeta: { color: '#a1a1aa', fontSize: 10 },
  floatingCardTime: { color: '#8d5cf6', fontSize: 9, fontWeight: '800', marginTop: 4 },
  luminousContainer: { alignItems: 'center', justifyContent: 'center' },
  luminousMarker: { width: 44, height: 44, borderRadius: 22, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  luminousMarkerDot: { width: 10, height: 10, borderRadius: 5 },
  luminousLabel: { marginTop: 2, backgroundColor: 'rgba(0,0,0,0.7)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 },
  luminousLabelText: { color: '#fff', fontSize: 9, fontWeight: '800' },

  activityCard: { width: 140, minHeight: 120, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#333', marginRight: 10 },
  activityCardBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
  recentText: { color: '#ef4444', fontSize: 9, fontWeight: '800' },
  activityCardScore: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  activityCardScoreText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  activityCardTitle: { color: '#fff', fontSize: 13, fontWeight: '800', marginBottom: 2 },
  activityCardMeta: { color: '#a1a1aa', fontSize: 11 },
});
