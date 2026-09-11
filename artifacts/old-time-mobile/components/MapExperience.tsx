import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '@/lib/auth';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { API_BASE_URL } from '@/lib/api';
import { useColors } from '@/hooks/useColors';
import { TAB_BAR_CONTENT_CLEARANCE } from '@/constants/layout';

type Region = { latitude: number; longitude: number; latitudeDelta: number; longitudeDelta: number };
type Layer = 'all' | 'moments' | 'weather' | 'places';
type Moment = {
  id: string;
  latitude: number;
  longitude: number;
  caption: string | null;
  category: string;
  visited: boolean;
  visibility: string;
  ownedByMe: boolean;
  createdAt: string;
  author: { displayName: string; avatarUrl?: string | null };
  counts: { reactions: number; comments: number; saves: number };
  viewer: { reacted: boolean; saved: boolean };
};
type ActivityCluster = { id: string; latitude: number; longitude: number; count: number; score: number; latestAt: string };
type Activity = {
  zoom: number;
  updatedAt: string;
  capabilities: { moments: boolean; weather: boolean; places: boolean; people: boolean; live: boolean; events: boolean; news: boolean };
  summary: { momentCount: number; storyCount: number; activeZoneCount: number };
  clusters: ActivityCluster[];
  moments: Moment[];
  stories: Moment[];
};
type Place = { id: string; name: string; address: string; openingHours: string | null; latitude: number; longitude: number; mapUri: string };
type WeatherSignal = { id: string; latitude: number; longitude: number; title: string; subtitle: string; expiresAt: string };
type NearbyPin = {
  id: string | number;
  latitude: number;
  longitude: number;
  caption?: string | null;
  category?: string;
  createdAt: string | number;
  author?: { name?: string; username?: string };
  counts?: { reactions?: number; comments?: number; saves?: number };
  visibility?: string;
  ownedByMe?: boolean;
  viewer?: { reacted?: boolean; saved?: boolean };
};

const world: Region = { latitude: 24, longitude: 0, latitudeDelta: 70, longitudeDelta: 120 };
const OPENFREEMAP_STYLE = 'https://tiles.openfreemap.org/styles/liberty';

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[character] ?? character);
}

function ageLabel(createdAt: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(createdAt).getTime()) / 60000));
  if (minutes < 1) return 'now';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function openMap(latitude: number, longitude: number) {
  void Linking.openURL(`https://maps.apple.com/?ll=${latitude},${longitude}`);
}

function activityFromPins(items: NearbyPin[], zoom: number): Activity {
  const moments = items.map((pin) => ({
    id: String(pin.id),
    latitude: pin.latitude,
    longitude: pin.longitude,
    caption: pin.caption ?? null,
    category: pin.category ?? 'moment',
    visited: false,
    visibility: pin.visibility ?? 'public',
    ownedByMe: Boolean(pin.ownedByMe),
    createdAt: new Date(pin.createdAt).toISOString(),
    author: { displayName: pin.author?.name ?? 'Old Time user', avatarUrl: null },
    counts: {
      reactions: pin.counts?.reactions ?? 0,
      comments: pin.counts?.comments ?? 0,
      saves: pin.counts?.saves ?? 0,
    },
    viewer: {
      reacted: Boolean(pin.viewer?.reacted),
      saved: Boolean(pin.viewer?.saved),
    },
  }));
  return {
    zoom,
    updatedAt: new Date().toISOString(),
    capabilities: { moments: true, weather: false, places: true, people: false, live: false, events: false, news: false },
    summary: { momentCount: moments.length, storyCount: 0, activeZoneCount: moments.length },
    clusters: moments.map((moment) => ({
      id: `pin-zone-${moment.id}`,
      latitude: moment.latitude,
      longitude: moment.longitude,
      count: 1,
      score: Math.min(100, moment.counts.reactions * 8 + moment.counts.comments * 5 + moment.counts.saves * 3),
      latestAt: moment.createdAt,
    })),
    moments,
    stories: [],
  };
}

export default function MapExperience() {
  const colors = useColors();
  const { getToken } = useAuth();
  const [region, setRegion] = useState(world);
  const [layer, setLayer] = useState<Layer>('all');
  const [activity, setActivity] = useState<Activity | null>(null);
  const [weather, setWeather] = useState<WeatherSignal | null>(null);
  const [places, setPlaces] = useState<Place[]>([]);
  const [selected, setSelected] = useState<Moment | null>(null);
  const [placing, setPlacing] = useState(false);
  const [coordinate, setCoordinate] = useState({ latitude: world.latitude, longitude: world.longitude });
  const [caption, setCaption] = useState('');
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [mapReady, setMapReady] = useState(false);
  const mapElement = useRef<HTMLElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const loadRef = useRef<(next: Region, force?: boolean) => Promise<void>>(async () => undefined);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);
  const placingRef = useRef(false);

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

  const load = useCallback(async (next: Region, force = false) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const zoom = mapRef.current?.getZoom() ?? 2;
      const radiusKm = Math.min(25, Math.max(1, next.latitudeDelta * 111 * .75));
      const [pinData, placeData] = await Promise.all([
        request(`/map/pins/nearby?latitude=${next.latitude}&longitude=${next.longitude}&radiusKm=${radiusKm}`) as Promise<{ items: NearbyPin[] }>,
        layer === 'all' || layer === 'places'
          ? request(`/map/places/nearby?latitude=${next.latitude}&longitude=${next.longitude}&category=all&radiusMeters=5000`) as Promise<{ items: Place[] }>
          : Promise.resolve({ items: [] }),
      ]);
      if (id !== requestId.current) return;
      setActivity(activityFromPins(pinData.items ?? [], zoom));
      setWeather(null);
      setPlaces(placeData.items);
    } catch (error) {
      if (force || id === requestId.current) Alert.alert('Map unavailable', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [layer, request]);

  useEffect(() => { loadRef.current = load; }, [load]);
  useEffect(() => { placingRef.current = placing; }, [placing]);
  useEffect(() => { void load(region); }, [layer]);

  useEffect(() => {
    if (!mapElement.current || mapRef.current) return;
    const map = new maplibregl.Map({
      container: mapElement.current,
      style: OPENFREEMAP_STYLE,
      center: [world.longitude, world.latitude],
      zoom: 2,
      attributionControl: false,
      maxZoom: 19,
      renderWorldCopies: true,
    });
    mapRef.current = map;
    const updateRegion = () => {
      const center = map.getCenter();
      const bounds = map.getBounds();
      const next = { latitude: center.lat, longitude: center.lng, latitudeDelta: Math.max(.01, bounds.getNorth() - bounds.getSouth()), longitudeDelta: Math.max(.01, bounds.getEast() - bounds.getWest()) };
      setRegion(next);
      setCoordinate({ latitude: next.latitude, longitude: next.longitude });
      if (debounce.current) clearTimeout(debounce.current);
      debounce.current = setTimeout(() => void loadRef.current(next), 420);
    };
    map.on('moveend', updateRegion);
    map.on('click', (event: maplibregl.MapMouseEvent) => {
      if (placingRef.current) setCoordinate({ latitude: event.lngLat.lat, longitude: event.lngLat.lng });
      else setSelected(null);
    });
    map.once('load', () => setMapReady(true));
    return () => {
      if (debounce.current) clearTimeout(debounce.current);
      markers.current.forEach((marker) => marker.remove());
      markers.current = [];
      map.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  const visibleMoments = useMemo(() => [...(activity?.moments ?? []), ...(activity?.stories ?? [])], [activity]);
  const visiblePlaces = layer === 'places' || layer === 'all' ? places : [];

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady) return;
    markers.current.forEach((marker) => marker.remove());
    markers.current = [];

    if (layer === 'weather' && weather) {
      const element = document.createElement('div');
      element.innerHTML = `<div style="width:42px;height:42px;border-radius:21px;background:#fff;border:3px solid #8d5cf6;display:flex;align-items:center;justify-content:center;box-shadow:0 2px 10px rgba(0,0,0,.18);font-size:20px">☁</div>`;
      markers.current.push(new maplibregl.Marker({ element }).setLngLat([weather.longitude, weather.latitude]).addTo(map));
    }

    if (layer === 'all' || layer === 'moments') {
      const renderClusters = (map.getZoom() < 11 || visibleMoments.length === 0) && activity?.clusters.length;
      if (renderClusters) {
        activity?.clusters.slice(0, 80).forEach((cluster) => {
          const element = document.createElement('div');
          const size = Math.min(66, 34 + cluster.count * 5);
          element.style.cssText = `width:${size}px;height:${size}px;border-radius:50%;background:rgba(255,255,255,.96);border:3px solid ${cluster.score > 70 ? colors.primary : colors.secondary};color:#181818;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;box-shadow:0 2px 12px rgba(0,0,0,.18);cursor:pointer`;
          element.textContent = String(cluster.count);
          element.addEventListener('click', (event) => {
            event.stopPropagation();
            mapRef.current?.flyTo({ center: [cluster.longitude, cluster.latitude], zoom: Math.min(14, Math.max(mapRef.current?.getZoom() ?? 2, 11) + 1), essential: false });
          });
          markers.current.push(new maplibregl.Marker({ element }).setLngLat([cluster.longitude, cluster.latitude]).addTo(map));
        });
      } else {
        visibleMoments.slice(0, 100).forEach((moment) => {
          const element = document.createElement('div');
          element.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:3px;transform:translateY(-10px);cursor:pointer';
          element.innerHTML = `<div style="width:36px;height:36px;border-radius:18px;border:3px solid #fff;background:${selected?.id === moment.id ? colors.primary : colors.secondary};color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:14px;box-shadow:0 2px 9px rgba(0,0,0,.22)">${escapeHtml(moment.author.displayName.slice(0, 1))}</div><div style="max-width:120px;padding:3px 7px;border-radius:9px;background:rgba(255,255,255,.96);color:#202124;font-size:10px;font-weight:700;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;box-shadow:0 1px 5px rgba(0,0,0,.14)">${escapeHtml(moment.author.displayName)} <span style="color:#72757b;font-weight:500">${ageLabel(moment.createdAt)}</span></div>`;
          element.addEventListener('click', (event) => {
            event.stopPropagation();
            setSelected(moment);
            mapRef.current?.flyTo({ center: [moment.longitude, moment.latitude], zoom: Math.max(mapRef.current?.getZoom() ?? 2, 13), essential: false });
          });
          markers.current.push(new maplibregl.Marker({ element }).setLngLat([moment.longitude, moment.latitude]).addTo(map));
        });
      }
    }

    if (layer === 'all' || layer === 'places') {
      visiblePlaces.slice(0, 50).forEach((place) => {
        const element = document.createElement('div');
        element.innerHTML = `<div style="width:28px;height:28px;border-radius:14px;background:${colors.primary};color:#fff;display:flex;align-items:center;justify-content:center;font-size:14px;box-shadow:0 2px 8px rgba(0,0,0,.18)">•</div>`;
        element.title = place.name;
        element.addEventListener('click', (event) => {
          event.stopPropagation();
          mapRef.current?.flyTo({ center: [place.longitude, place.latitude], zoom: Math.max(mapRef.current?.getZoom() ?? 2, 14), essential: false });
        });
        markers.current.push(new maplibregl.Marker({ element }).setLngLat([place.longitude, place.latitude]).addTo(map));
      });
    }
  }, [activity, colors.primary, colors.secondary, layer, mapReady, selected?.id, visibleMoments, visiblePlaces, weather]);

  const locate = async () => {
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Location stays off', 'Allow location access to center the activity map.');
      return;
    }
    const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
    const next = { latitude: result.coords.latitude, longitude: result.coords.longitude, latitudeDelta: .08, longitudeDelta: .1 };
    mapRef.current?.flyTo({ center: [next.longitude, next.latitude], zoom: 12, essential: true });
    setRegion(next);
    setCoordinate(next);
    await load(next, true);
  };

  const search = async () => {
    if (!query.trim()) return;
    try {
      const match = (await Location.geocodeAsync(query.trim()))[0];
      if (!match) throw new Error('No place found');
      const next = { latitude: match.latitude, longitude: match.longitude, latitudeDelta: .08, longitudeDelta: .1 };
      mapRef.current?.flyTo({ center: [next.longitude, next.latitude], zoom: 12, essential: true });
      setRegion(next);
      setCoordinate(next);
      await load(next, true);
    } catch {
      Alert.alert('Place not found', 'Try a city, venue, landmark, or full address.');
    }
  };

  const publish = async () => {
    try {
      const created = await request('/map/stories', {
        method: 'POST',
        body: JSON.stringify({ ...coordinate, caption: caption.trim(), mediaType: 'quote', mediaUrl: null, visibility: 'friends', expiresAt: new Date(Date.now() + 86_400_000).toISOString() }),
      }) as Moment;
      setSelected(created);
      setPlacing(false);
      setCaption('');
      await load(region, true);
    } catch (error) {
      Alert.alert('Could not share the moment', error instanceof Error ? error.message : 'Please try again.');
    }
  };

  const layerOptions: Array<{ key: Layer; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
    { key: 'all', label: 'All activity', icon: 'radio-outline' },
    { key: 'moments', label: 'Moments', icon: 'people-outline' },
    { key: 'weather', label: 'Weather', icon: 'cloud-outline' },
    { key: 'places', label: 'Places', icon: 'location-outline' },
  ];

  return (
    <View style={[styles.root, { backgroundColor: colors.muted }]}>
      {React.createElement('div', {
        ref: (element: HTMLElement | null) => { mapElement.current = element; },
        style: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 },
        className: 'old-time-maplibre-map',
      })}
      <View style={[styles.activityDock, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <View style={styles.dockHeader}>
          <View>
            <Text style={[styles.dockTitle, { color: colors.foreground }]}>What’s happening nearby</Text>
            <Text style={[styles.dockMeta, { color: colors.mutedForeground }]}>{loading ? 'Updating live signals…' : activity ? `${activity.summary.momentCount + activity.summary.storyCount} shared moments · ${activity.summary.activeZoneCount} active zones` : 'Waiting for map signals'}</Text>
          </View>
          <Pressable accessibilityRole="button" accessibilityLabel="Use my location" onPress={() => void locate()} style={[styles.iconButton, { backgroundColor: colors.muted }]}><Ionicons name="navigate-outline" size={18} color={colors.foreground} /></Pressable>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.layerRow}>
          {layerOptions.map((option) => <Pressable key={option.key} accessibilityRole="tab" accessibilityState={{ selected: layer === option.key }} onPress={() => setLayer(option.key)} style={[styles.layerChip, { backgroundColor: layer === option.key ? colors.primary : colors.muted }]}><Ionicons name={option.icon} size={15} color={layer === option.key ? colors.primaryForeground : colors.foreground} /><Text style={{ color: layer === option.key ? colors.primaryForeground : colors.foreground, fontWeight: '800', fontSize: 12 }}>{option.label}</Text></Pressable>)}
        </ScrollView>
        {placing ? (
          <View style={styles.composer}>
            <Text style={[styles.panelTitle, { color: colors.foreground }]}>Share this spot</Text>
            <TextInput value={query} onChangeText={setQuery} onSubmitEditing={() => void search()} placeholder="Search a place or address" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted }]} />
            <TextInput value={caption} onChangeText={setCaption} placeholder="What’s happening here?" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, backgroundColor: colors.muted }]} />
            <View style={styles.actionRow}><Pressable onPress={() => setPlacing(false)}><Text style={{ color: colors.mutedForeground, fontWeight: '800' }}>Cancel</Text></Pressable><Pressable onPress={() => void publish()}><Text style={{ color: colors.primary, fontWeight: '800' }}>Share moment</Text></Pressable></View>
          </View>
        ) : selected ? (
          <View style={styles.selectedPanel}>
            <View style={styles.selectedHeading}><View style={[styles.selectedAvatar, { backgroundColor: colors.secondary }]}><Text style={styles.selectedAvatarText}>{selected.author.displayName.slice(0, 1)}</Text></View><View style={{ flex: 1 }}><Text style={[styles.panelTitle, { color: colors.foreground }]}>{selected.author.displayName}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{ageLabel(selected.createdAt)} · {selected.category}</Text></View><Pressable onPress={() => setSelected(null)}><Ionicons name="close" size={20} color={colors.mutedForeground} /></Pressable></View>
            <Text style={{ color: colors.foreground }}>{selected.caption || 'A shared moment from this place.'}</Text>
            <View style={styles.actionRow}><Text style={{ color: colors.mutedForeground }}>♥ {selected.counts.reactions}</Text><Text style={{ color: colors.mutedForeground }}>Comments {selected.counts.comments}</Text><Pressable onPress={() => openMap(selected.latitude, selected.longitude)}><Text style={{ color: colors.primary, fontWeight: '800' }}>Open maps</Text></Pressable></View>
          </View>
        ) : layer === 'weather' && weather ? (
          <View style={styles.signalPanel}><Ionicons name="cloud-outline" size={25} color={colors.secondary} /><View style={{ flex: 1 }}><Text style={[styles.panelTitle, { color: colors.foreground }]}>{weather.title}</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>{weather.subtitle}</Text></View></View>
        ) : layer === 'places' && places.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.placeRow}>{places.slice(0, 5).map((place) => <Pressable key={place.id} onPress={() => mapRef.current?.flyTo({ center: [place.longitude, place.latitude], zoom: 14, essential: false })} style={[styles.placeChip, { backgroundColor: colors.muted }]}><Text numberOfLines={1} style={{ color: colors.foreground, fontWeight: '800', maxWidth: 130 }}>{place.name}</Text><Text numberOfLines={1} style={{ color: colors.mutedForeground, fontSize: 10 }}>{place.address || 'Nearby place'}</Text></Pressable>)}</ScrollView>
        ) : activity?.clusters.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zoneRow}>{activity.clusters.slice(0, 5).map((cluster) => <Pressable key={cluster.id} onPress={() => mapRef.current?.flyTo({ center: [cluster.longitude, cluster.latitude], zoom: 12, essential: false })} style={[styles.zoneCard, { backgroundColor: colors.muted }]}><Text style={[styles.zoneCount, { color: colors.foreground }]}>{cluster.count}</Text><Text style={{ color: colors.mutedForeground, fontSize: 11 }}>moment{cluster.count === 1 ? '' : 's'}</Text><Text style={{ color: cluster.score > 70 ? colors.primary : colors.secondary, fontSize: 10, fontWeight: '800' }}>{cluster.score} activity</Text></Pressable>)}</ScrollView>
        ) : (
          <View style={styles.emptyPanel}><Text style={[styles.panelTitle, { color: colors.foreground }]}>Nothing public is active here yet.</Text><Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Move the map or share a moment from this spot to add a real signal.</Text></View>
        )}
        {!placing && !selected ? <Pressable accessibilityRole="button" onPress={() => setPlacing(true)} style={[styles.shareButton, { backgroundColor: colors.primary }]}><Ionicons name="add" size={18} color={colors.primaryForeground} /><Text style={{ color: colors.primaryForeground, fontWeight: '800' }}>Share a moment here</Text></Pressable> : null}
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