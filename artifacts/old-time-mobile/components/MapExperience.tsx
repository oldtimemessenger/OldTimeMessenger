import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '@/lib/auth';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Linking, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { API_BASE_URL } from '@/lib/api';
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
  const [currentLocation, setCurrentLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  const [locating, setLocating] = useState(false);
  const mapElement = useRef<HTMLElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markers = useRef<maplibregl.Marker[]>([]);
  const locationMarker = useRef<maplibregl.Marker | null>(null);
  const loadRef = useRef<(next: Region, force?: boolean) => Promise<void>>(async () => undefined);
  const debounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const requestId = useRef(0);
  const placingRef = useRef(false);

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

  const load = useCallback(async (next: Region, force = false) => {
    const id = ++requestId.current;
    setLoading(true);
    try {
      const zoom = mapRef.current?.getZoom() ?? 2;
      const radiusKm = Math.min(25, Math.max(1, next.latitudeDelta * 111 * .75));
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
      setActivity(activityFromPins(pinData.items ?? [], zoom));
      setWeather(null);
      setPlaces(placeData.items);
    } catch (error) {
      if (force || id === requestId.current) Alert.alert('Map unavailable', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [getToken, layer, request]);

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
      locationMarker.current?.remove();
      locationMarker.current = null;
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
      element.style.cssText = `display:flex;flex-direction:column;align-items:center;justify-content:center;`;
      element.innerHTML = `
        <div style="width:44px;height:44px;border-radius:22px;background:rgba(59,130,246,0.25);border:1px solid rgba(59,130,246,0.6);display:flex;align-items:center;justify-content:center;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.5 19a5.5 5.5 0 0 0-1-10.9A7.5 7.5 0 1 0 5 15.5"></path></svg>
        </div>
      `;
      markers.current.push(new maplibregl.Marker({ element }).setLngLat([weather.longitude, weather.latitude]).addTo(map));
    }

    if (layer === 'all' || layer === 'moments') {
      visibleMoments.slice(0, 100).forEach((moment, index) => {
        const isFloatingCard = index < 4;
        const element = document.createElement('div');

        if (isFloatingCard) {
          element.style.cssText = `background:rgba(18,18,20,0.95);border-radius:12px;padding:10px;max-width:140px;border:1px solid #333;box-shadow:0 6px 12px rgba(0,0,0,0.6);cursor:pointer;`;
          element.innerHTML = `
            <div style="color:#fff;font-size:12px;font-weight:800;margin-bottom:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${escapeHtml(moment.caption || 'A moment shared here')}</div>
            <div style="color:#a1a1aa;font-size:10px">@${escapeHtml(moment.author.displayName)}</div>
            <div style="color:#8d5cf6;font-size:9px;font-weight:800;margin-top:4px">${ageLabel(moment.createdAt)} ago</div>
          `;
        } else {
          element.style.cssText = `display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;`;
          element.innerHTML = `
            <div style="width:44px;height:44px;border-radius:22px;background:rgba(141,92,246,0.25);border:1px solid rgba(141,92,246,0.6);display:flex;align-items:center;justify-content:center;">
              <div style="width:10px;height:10px;border-radius:5px;background:#8d5cf6;"></div>
            </div>
            <div style="margin-top:2px;background:rgba(0,0,0,0.7);padding:2px 6px;border-radius:6px;color:#fff;font-size:9px;font-weight:800;">
              ${escapeHtml(moment.author.displayName.slice(0, 10))}
            </div>
          `;
        }

        element.addEventListener('click', (event) => {
          event.stopPropagation();
          setSelected(moment);
          mapRef.current?.flyTo({ center: [moment.longitude, moment.latitude], zoom: Math.max(mapRef.current?.getZoom() ?? 2, 13), essential: false });
        });
        markers.current.push(new maplibregl.Marker({ element }).setLngLat([moment.longitude, moment.latitude]).addTo(map));
      });
    }

    if (layer === 'all' || layer === 'places') {
      visiblePlaces.slice(0, 50).forEach((place) => {
        const element = document.createElement('div');
        element.style.cssText = `display:flex;flex-direction:column;align-items:center;justify-content:center;cursor:pointer;`;
        element.innerHTML = `
          <div style="width:36px;height:36px;border-radius:18px;background:rgba(236,72,153,0.25);border:1px solid rgba(236,72,153,0.6);display:flex;align-items:center;justify-content:center;">
            <div style="width:8px;height:8px;border-radius:4px;background:#ec4899;"></div>
          </div>
          <div style="margin-top:2px;background:rgba(0,0,0,0.7);padding:2px 6px;border-radius:6px;color:#fff;font-size:9px;font-weight:800;white-space:nowrap;max-width:80px;overflow:hidden;text-overflow:ellipsis;">
            ${escapeHtml(place.name)}
          </div>
        `;
        element.title = place.name;
        element.addEventListener('click', (event) => {
          event.stopPropagation();
          mapRef.current?.flyTo({ center: [place.longitude, place.latitude], zoom: Math.max(mapRef.current?.getZoom() ?? 2, 14), essential: false });
        });
        markers.current.push(new maplibregl.Marker({ element }).setLngLat([place.longitude, place.latitude]).addTo(map));
      });
    }
    if (placing) {
      const element = document.createElement('div');
      element.style.cssText = `display:flex;flex-direction:column;align-items:center;justify-content:center;`;
      element.innerHTML = `
        <div style="width:44px;height:44px;border-radius:22px;background:rgba(234,179,8,0.25);border:1px solid rgba(234,179,8,0.6);display:flex;align-items:center;justify-content:center;">
          <div style="width:10px;height:10px;border-radius:5px;background:#eab308;"></div>
        </div>
      `;
      markers.current.push(new maplibregl.Marker({ element }).setLngLat([coordinate.longitude, coordinate.latitude]).addTo(map));
    }
  }, [activity, coordinate, layer, mapReady, placing, selected?.id, visibleMoments, visiblePlaces, weather]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !mapReady || !currentLocation) return;
    locationMarker.current?.remove();
    const element = document.createElement('div');
    element.style.cssText = `width:18px;height:18px;border-radius:9px;background:${THEME.routeBlue};border:4px solid #fff;box-shadow:0 0 0 7px rgba(37,99,235,.2),0 2px 8px rgba(0,0,0,.25)`;
    locationMarker.current = new maplibregl.Marker({ element })
      .setLngLat([currentLocation.longitude, currentLocation.latitude])
      .addTo(map);
    map.flyTo({ center: [currentLocation.longitude, currentLocation.latitude], zoom: 12, essential: true });
  }, [currentLocation, mapReady]);

  const locate = async () => {
    if (locating) return;
    setLocating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (!permission.granted) {
        Alert.alert(
          'Location stays off',
          permission.canAskAgain === false
            ? 'Location access is blocked. Allow it in your browser settings for Old Time.'
            : 'Allow location access to center the activity map.',
        );
        return;
      }
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const next = { latitude: result.coords.latitude, longitude: result.coords.longitude, latitudeDelta: .08, longitudeDelta: .1 };
      setCurrentLocation({ latitude: result.coords.latitude, longitude: result.coords.longitude });
      setRegion(next);
      setCoordinate(next);
      await load(next, true);
    } catch (error) {
      Alert.alert('Could not find you', error instanceof Error ? error.message : 'Allow location access and try again.');
    } finally {
      setLocating(false);
    }
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
      const created = await request('/map/pins', {
        method: 'POST',
        body: JSON.stringify({ ...coordinate, caption: caption.trim(), visibility: 'public', expiresAt: null }),
      }) as NearbyPin;
      setSelected(activityFromPins([created], mapRef.current?.getZoom() ?? 12).moments[0] ?? null);
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
    <View style={[styles.root, { backgroundColor: THEME.background }]}>
      <style>{`.old-time-maplibre-map .maplibregl-canvas { filter: invert(100%) hue-rotate(180deg) brightness(80%) contrast(1.1); }`}</style>
      {React.createElement('div', {
        ref: (element: HTMLElement | null) => { mapElement.current = element; },
        style: { position: 'absolute', inset: 0, width: '100%', height: '100%', zIndex: 0 },
        className: 'old-time-maplibre-map',
      })}

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
            <View style={styles.actionRow}><Text style={{ color: THEME.mutedForeground }}>♥ {selected.counts.reactions}</Text><Text style={{ color: THEME.mutedForeground }}>Comments {selected.counts.comments}</Text><Pressable onPress={() => openMap(selected.latitude, selected.longitude)}><Text style={{ color: THEME.primary, fontWeight: '800' }}>Open maps</Text></Pressable></View>
          </View>
        ) : layer === 'weather' && weather ? (
          <View style={styles.signalPanel}><Ionicons name="cloud-outline" size={25} color={THEME.routeBlue} /><View style={{ flex: 1 }}><Text style={[styles.panelTitle, { color: THEME.foreground }]}>{weather.title}</Text><Text style={{ color: THEME.mutedForeground, fontSize: 12 }}>{weather.subtitle}</Text></View></View>
        ) : activity?.moments.length && (layer === 'all' || layer === 'moments') ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.zoneRow}>
            {activity.moments.slice(0, 10).map((moment) => (
              <Pressable key={moment.id} onPress={() => mapRef.current?.flyTo({ center: [moment.longitude, moment.latitude], zoom: 14, essential: false })} style={[styles.activityCard, { backgroundColor: THEME.secondary }]}>
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
              <Pressable key={place.id} onPress={() => mapRef.current?.flyTo({ center: [place.longitude, place.latitude], zoom: 14, essential: false })} style={[styles.activityCard, { backgroundColor: THEME.secondary }]}>
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

  activityCard: { width: 140, minHeight: 120, borderRadius: 14, padding: 12, borderWidth: 1, borderColor: '#333', marginRight: 10 },
  activityCardBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  recentDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: '#ef4444' },
  recentText: { color: '#ef4444', fontSize: 9, fontWeight: '800' },
  activityCardScore: { backgroundColor: 'rgba(255,255,255,0.1)', paddingHorizontal: 4, paddingVertical: 2, borderRadius: 4 },
  activityCardScoreText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  activityCardTitle: { color: '#fff', fontSize: 13, fontWeight: '800', marginBottom: 2 },
  activityCardMeta: { color: '#a1a1aa', fontSize: 11 },
});
