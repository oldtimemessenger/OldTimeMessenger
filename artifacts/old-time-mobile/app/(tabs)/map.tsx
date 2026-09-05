import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, Screen, StoryAvatar } from '@/components/ui';
import { useRouter } from 'expo-router';
import { getCurrentEventRooms, type CurrentEventRoom } from '@workspace/api-client-react';
import SocialMap from '@/components/social-map';
import type { SocialMapRegion } from '@/components/social-map.types';
import { ServerStoryViewer } from '@/components/server-story-viewer';
import { userStoryViewerItemId } from '@/components/story-viewer-content';
import { buildStoryViewerItems } from '@/lib/story-viewer-sequence';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';
import { createMapPin, createMapPinComment, deleteMapPin, discoveryEmbedUrl, getMapPinComments, getNearbyDiscoveryItems, getNearbyPins, getNearbyPlaces, reportMapPin, setMapPinRelation, type DiscoveryItem, type MapComment, type MapPin, type MapVisibility, type NearbyPlace } from '@/lib/map-api';
import { getNearbyStories, setUserBlocked, type Story } from '@/lib/social-api';
import { getPaceNearby } from '@/lib/pace-api';
import CurrentEventsHome from '@/components/current-events-home';
import { AdMobNativeFeedAd } from '@/components/admob-native-feed-ad';
import { adManager } from '@/lib/ad-manager';

type Coordinate = { latitude: number; longitude: number };
type PlaceCategory = 'all' | 'favorites' | 'visited' | 'restaurant' | 'cafe' | 'shop' | 'club' | 'gym' | 'park' | 'church';

const PLACE_CATEGORIES: Array<{ key: PlaceCategory; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'all', label: 'Explore', icon: 'search' },
  { key: 'favorites', label: 'Favorites', icon: 'heart' },
  { key: 'visited', label: 'Visited', icon: 'checkmark-circle' },
  { key: 'restaurant', label: 'Restaurants', icon: 'restaurant' },
  { key: 'cafe', label: 'Cafes', icon: 'cafe' },
  { key: 'shop', label: 'Shops', icon: 'bag-handle' },
  { key: 'club', label: 'Clubs', icon: 'musical-notes' },
  { key: 'gym', label: 'Gyms', icon: 'barbell' },
  { key: 'park', label: 'Parks', icon: 'leaf' },
  { key: 'church', label: 'Churches', icon: 'business' },
];

function categoryLabel(category: PlaceCategory) {
  return PLACE_CATEGORIES.find((item) => item.key === category)?.label ?? 'Place';
}

function seasonalMapMessage(now = new Date()) {
  const month = now.getMonth();
  const day = now.getDate();
  const isMotherDay = month === 4 && now.getDay() === 0 && day >= 8 && day <= 14;
  if (isMotherDay) return 'Happy Mother’s Day';
  if (month === 8 && day >= 4 && day <= 8) return 'Happy Labor Day';
  if ((month === 11 && day === 31) || (month === 0 && day <= 2)) return 'Happy New Year';
  return null;
}

const WORLD_REGION: SocialMapRegion = {
  latitude: 24,
  longitude: 0,
  latitudeDelta: 70,
  longitudeDelta: 120,
};

export default function MapScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const { session, settings } = useApp();
  const router = useRouter();
  const [permission, requestPermission] = Location.useForegroundPermissions();
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [region, setRegion] = useState<SocialMapRegion>(WORLD_REGION);
  const [pins, setPins] = useState<MapPin[]>([]);
  const [stories, setStories] = useState<Story[]>([]);
  const [mapDiscoveryItems, setMapDiscoveryItems] = useState<DiscoveryItem[]>([]);
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
  const [areaDiscoveryItems, setAreaDiscoveryItems] = useState<DiscoveryItem[] | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = useState(false);
  const [discoveryError, setDiscoveryError] = useState<string | null>(null);
  const [storyOpen, setStoryOpen] = useState<Story | null>(null);
  const [storyPreview, setStoryPreview] = useState<Story | null>(null);
  const [heatEnabled, setHeatEnabled] = useState(true);
  const [placingPin, setPlacingPin] = useState(false);
  const [pinCoordinate, setPinCoordinate] = useState<Coordinate | null>(null);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeSearching, setPlaceSearching] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<PlaceCategory>('all');
  const [nearbyPlaces, setNearbyPlaces] = useState<NearbyPlace[]>([]);
  const [placesLoading, setPlacesLoading] = useState(false);
  const [placesError, setPlacesError] = useState<string | null>(null);
  const [pinCategory, setPinCategory] = useState<Exclude<PlaceCategory, 'all' | 'favorites' | 'visited'>>('restaurant');
  const [markVisited, setMarkVisited] = useState(true);
  const [seasonalVisible, setSeasonalVisible] = useState(true);
  const [currentEventsMode, setCurrentEventsMode] = useState(false);
  const [currentEventRooms, setCurrentEventRooms] = useState<CurrentEventRoom[]>([]);
  const [currentEventsError, setCurrentEventsError] = useState<string | null>(null);
  const [paceLayerEnabled, setPaceLayerEnabled] = useState(false);
  const [paceNearby, setPaceNearby] = useState<Array<{ activityType: string; count: number }>>([]);
  const regionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regionCache = useRef(new Map<string, { loadedAt: number; pins: MapPin[]; stories: Story[]; discoveryItems: DiscoveryItem[] }>());
  const discoveryRequestId = useRef(0);
  const seasonalMessage = seasonalMapMessage();
  const visiblePins = useMemo(() => {
    if (selectedCategory === 'all') return pins;
    if (selectedCategory === 'favorites') return pins.filter((pin) => pin.viewer.saved);
    if (selectedCategory === 'visited') return pins.filter((pin) => pin.caption?.startsWith('Visited ·'));
    const label = categoryLabel(selectedCategory);
    return pins.filter((pin) => pin.caption?.includes(`· ${label} ·`) || pin.caption?.startsWith(`${label} ·`));
  }, [pins, selectedCategory]);

  useEffect(() => {
    adManager.setActiveSurface('map');
  }, []);

  useEffect(() => {
    setVisibility(settings.locationAudience === 'public' ? 'friends' : settings.locationAudience);
  }, [settings.locationAudience]);

  useEffect(() => {
    if (!session?.authToken || ['all', 'favorites', 'visited'].includes(selectedCategory)) {
      setNearbyPlaces([]);
      setPlacesError(null);
      return;
    }
    let active = true;
    setPlacesLoading(true);
    setPlacesError(null);
    const googleCategory = selectedCategory as Exclude<PlaceCategory, 'favorites' | 'visited'>;
    void getNearbyPlaces(session.authToken, region.latitude, region.longitude, googleCategory)
      .then((result) => {
        if (active) setNearbyPlaces(result.items);
      })
      .catch((requestError) => {
        if (active) {
          setNearbyPlaces([]);
          setPlacesError(requestError instanceof Error ? requestError.message : 'Could not load nearby places.');
        }
      })
      .finally(() => {
        if (active) setPlacesLoading(false);
      });
    return () => {
      active = false;
    };
  }, [selectedCategory, session?.authToken]);

  const loadCurrentEventRooms = useCallback(async () => {
    if (!session?.authToken) return;
    try {
      const { items } = await getCurrentEventRooms();
      setCurrentEventRooms(items);
      setCurrentEventsError(null);
    } catch {
      // Retain the last known rooms rather than presenting a failed request as an empty list.
      setCurrentEventsError('Access could not be refreshed.');
    }
  }, [session?.authToken]);

  useEffect(() => {
    void loadCurrentEventRooms();
  }, [loadCurrentEventRooms]);

  useEffect(() => {
    if (!session?.authToken || !paceLayerEnabled) {
      setPaceNearby([]);
      return;
    }
    let active = true;
    void getPaceNearby(session.authToken, region.latitude, region.longitude, radiusForRegion(region))
      .then((result) => {
        if (active) setPaceNearby(result.items);
      })
      .catch(() => {
        if (active) setPaceNearby([]);
      });
    return () => {
      active = false;
    };
  }, [paceLayerEnabled, session?.authToken, region.latitude, region.longitude]);

  const loadRegion = useCallback(async (nextRegion: SocialMapRegion, force = false) => {
    if (!session?.authToken) return;
    const safeRegion = normalizeRegion(nextRegion);
    const radiusKm = radiusForRegion(safeRegion);
    const cacheKey = `${safeRegion.latitude.toFixed(2)}:${safeRegion.longitude.toFixed(2)}:${Math.round(radiusKm)}`;
    const cached = regionCache.current.get(cacheKey);
    if (!force && cached && Date.now() - cached.loadedAt < 60_000) {
      setPins(cached.pins);
      setStories(cached.stories);
      setMapDiscoveryItems(cached.discoveryItems);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const [pinPage, storyPage, discoveryPage] = await Promise.all([
        getNearbyPins(session.authToken, safeRegion.latitude, safeRegion.longitude, radiusKm),
        getNearbyStories(session.authToken, safeRegion.latitude, safeRegion.longitude, radiusKm, 30),
        getNearbyDiscoveryItems(session.authToken, safeRegion.latitude, safeRegion.longitude, radiusKm),
      ]);
      setPins(pinPage.items);
      setStories(storyPage.items);
      setMapDiscoveryItems(discoveryPage.items);
      regionCache.current.set(cacheKey, { loadedAt: Date.now(), pins: pinPage.items, stories: storyPage.items, discoveryItems: discoveryPage.items });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Could not load this area.');
    } finally {
      setLoading(false);
    }
  }, [session?.authToken]);

  const discoverArea = useCallback(async (coordinate: Coordinate) => {
    if (!session?.authToken) return;
    const requestId = ++discoveryRequestId.current;
    const safeCoordinate = normalizeCoordinate(coordinate);
    setDiscoveryCoordinate(safeCoordinate);
    setDiscoveryLoading(true);
    setDiscoveryError(null);
    setDiscoveryPins(null);
    setDiscoveryStories(null);
    setAreaDiscoveryItems(null);
    try {
      const [pinPage, storyPage, discoveryPage] = await Promise.all([
        getNearbyPins(session.authToken, safeCoordinate.latitude, safeCoordinate.longitude, 5),
        getNearbyStories(session.authToken, safeCoordinate.latitude, safeCoordinate.longitude, 5, 20),
        getNearbyDiscoveryItems(session.authToken, safeCoordinate.latitude, safeCoordinate.longitude, 5),
      ]);
      if (requestId !== discoveryRequestId.current) return;
      setDiscoveryPins(pinPage.items);
      setDiscoveryStories(storyPage.items);
      setAreaDiscoveryItems(discoveryPage.items);
    } catch (requestError) {
      if (requestId !== discoveryRequestId.current) return;
      setDiscoveryPins(null);
      setDiscoveryStories(null);
      setAreaDiscoveryItems(null);
      setDiscoveryError(requestError instanceof Error ? requestError.message : 'Could not load this area.');
    } finally {
      if (requestId === discoveryRequestId.current) setDiscoveryLoading(false);
    }
  }, [session?.authToken]);

  function selectPin(pin: MapPin) {
    discoveryRequestId.current += 1;
    setSelectedPin(pin);
    setStoryPreview(null);
    setDiscoveryCoordinate(null);
    setDiscoveryPins(null);
    setDiscoveryStories(null);
    setAreaDiscoveryItems(null);
    setDiscoveryError(null);
  }

  function previewMapStory(story: Story) {
    discoveryRequestId.current += 1;
    setStoryPreview(story);
    setSelectedPin(null);
    setDiscoveryCoordinate(null);
    setDiscoveryPins(null);
    setDiscoveryStories(null);
    setAreaDiscoveryItems(null);
    setDiscoveryError(null);
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
      const coordinate = normalizeCoordinate({ latitude: result.coords.latitude, longitude: result.coords.longitude });
      const nextRegion = { ...coordinate, latitudeDelta: 0.055, longitudeDelta: 0.07 };
      setLocation(coordinate);
      setRegion(nextRegion);
      if (placingPin) setPinCoordinate(coordinate);
      setSelectedPin(null);
      setDiscoveryCoordinate(null);
      setDiscoveryPins(null);
      setDiscoveryStories(null);
      setAreaDiscoveryItems(null);
      setDiscoveryError(null);
      await loadRegion(nextRegion, true);
    } catch {
      Alert.alert('Location unavailable', 'Old Time could not read your current location. Try again outdoors or check device location services.');
    } finally {
      setLoading(false);
    }
  }

  function startPinPlacement() {
    setPinCoordinate(normalizeCoordinate(region));
    setPlacingPin(true);
    setSelectedPin(null);
    setStoryPreview(null);
    setDiscoveryCoordinate(null);
    setDiscoveryPins(null);
    setDiscoveryStories(null);
    setAreaDiscoveryItems(null);
  }

  async function searchPlace() {
    const query = placeQuery.trim();
    if (!query) return;
    setPlaceSearching(true);
    try {
      const matches = await Location.geocodeAsync(query);
      const first = matches[0];
      if (!first) {
        Alert.alert('Place not found', 'Try a city, landmark, venue, or full address.');
        return;
      }
      const coordinate = normalizeCoordinate({ latitude: first.latitude, longitude: first.longitude });
      setPinCoordinate(coordinate);
      setRegion({ ...coordinate, latitudeDelta: 0.08, longitudeDelta: 0.1 });
    } catch {
      Alert.alert('Search unavailable', 'Move the map to choose the location, or try searching again.');
    } finally {
      setPlaceSearching(false);
    }
  }

  const changeRegion = useCallback((nextRegion: SocialMapRegion) => {
    const safeRegion = normalizeRegion(nextRegion);
    setRegion(safeRegion);
    if (regionTimer.current) clearTimeout(regionTimer.current);
    regionTimer.current = setTimeout(() => void loadRegion(safeRegion), 420);
  }, [loadRegion]);

  useEffect(() => () => {
    if (regionTimer.current) clearTimeout(regionTimer.current);
  }, []);

  async function openInMaps(pin: Coordinate) {
    const url = `https://maps.google.com/?q=${pin.latitude},${pin.longitude}`;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  }

  async function openDiscoveryItem(item: DiscoveryItem) {
    await WebBrowser.openBrowserAsync(discoveryEmbedUrl(item.id), {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: colors.primary,
    });
  }

  async function openPlaceDetails(place: NearbyPlace) {
    const url = place.mapUri;
    if (await Linking.canOpenURL(url)) await Linking.openURL(url);
  }

  function postPlaceVisit(place: NearbyPlace) {
    setPlaceQuery(place.name);
    setPinCoordinate({ latitude: place.latitude, longitude: place.longitude });
    setRegion({ latitude: place.latitude, longitude: place.longitude, latitudeDelta: 0.03, longitudeDelta: 0.04 });
    if (['restaurant', 'cafe', 'shop', 'club', 'gym', 'park', 'church'].includes(selectedCategory)) {
      setPinCategory(selectedCategory as Exclude<PlaceCategory, 'all' | 'favorites' | 'visited'>);
    }
    setMarkVisited(true);
    setComposerOpen(true);
  }

  async function publishPin() {
    if (!pinCoordinate) {
      Alert.alert('Choose a location', 'Move the map or search for the place where this pin belongs.');
      return;
    }
    if (!session?.authToken) {
      Alert.alert('Sign in required', 'Sign in again before posting a location pin.');
      return;
    }
    try {
      const expiresAt = expiry === 'never' ? null : Date.now() + (expiry === 'day' ? 86_400_000 : 604_800_000);
      const placeName = placeQuery.trim() || 'Shared place';
      const placeTag = `${markVisited ? 'Visited · ' : ''}${categoryLabel(pinCategory)} · ${placeName}`;
      const created = await createMapPin(session.authToken, { ...pinCoordinate, caption: caption.trim() ? `${placeTag}\n${caption.trim()}` : placeTag, visibility, expiresAt });
      setPins((items) => [created, ...items]);
      regionCache.current.clear();
      setCaption('');
      setComposerOpen(false);
      setPinCoordinate(null);
    } catch (requestError) {
      Alert.alert('Pin not saved', requestError instanceof Error ? requestError.message : 'Please try again.');
    }
  }

  if (currentEventsMode) {
    return (
      <Screen>
        <CurrentEventsHome
          colors={colors}
          onBack={() => setCurrentEventsMode(false)}
          onOpenRoom={(room) => router.push({ pathname: '/current-event/[id]', params: { id: String(room.id), returnTo: 'events' } })}
          onRoomCreated={(room) => {
            setCurrentEventRooms((rooms) => [room, ...rooms.filter((item) => item.id !== room.id)]);
            router.push({ pathname: '/current-event/[id]', params: { id: String(room.id), returnTo: 'events' } });
          }}
          onRoomsChanged={setCurrentEventRooms}
          currentUserId={session?.id ?? null}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <View style={styles.mapCanvas}>
        <Pressable
          onPress={() => setCurrentEventsMode(true)}
          accessibilityRole="button"
          accessibilityLabel="Open Access"
          style={[styles.currentEventsButton, { top: insets.top + 10, backgroundColor: colors.card, borderColor: colors.border }]}
        >
          <Ionicons name="mic" size={21} color={colors.foreground} />
          {currentEventRooms.length > 0 ? <View style={styles.liveCount}><Text style={styles.liveCountText}>{currentEventRooms.length}</Text></View> : null}
        </Pressable>
        <Pressable
          onPress={() => setPaceLayerEnabled((value) => !value)}
          accessibilityRole="button"
          accessibilityLabel={paceLayerEnabled ? 'Hide PACE layer' : 'Show PACE layer'}
          style={[styles.paceLayerButton, { top: insets.top + 60, backgroundColor: paceLayerEnabled ? colors.primary : colors.card, borderColor: paceLayerEnabled ? colors.primary : colors.border }]}
        >
          <Ionicons name="fitness" size={20} color={paceLayerEnabled ? colors.primaryForeground : colors.foreground} />
        </Pressable>
        {currentEventsError ? <Pressable onPress={() => void loadCurrentEventRooms()} style={[styles.currentEventsError, { top: insets.top + 56, backgroundColor: colors.card, borderColor: colors.border }]} accessibilityRole="button" accessibilityLabel="Retry loading Access"><Ionicons name="cloud-offline-outline" size={15} color={colors.destructive} /><Text style={{ color: colors.destructive, fontSize: 12, fontWeight: '700' }}>Retry Access</Text></Pressable> : null}
        <SocialMap
          center={location}
          region={region}
          pins={visiblePins}
          stories={stories}
          discoveryItems={mapDiscoveryItems}
          currentEventRooms={currentEventRooms}
          selectedPinId={selectedPin?.id ?? null}
          placementMode={placingPin}
          placementCoordinate={pinCoordinate}
          heatEnabled={heatEnabled}
          loading={loading}
          colors={colors}
          onLocate={() => void refreshLocation()}
          onCreate={startPinPlacement}
          onToggleHeat={() => setHeatEnabled((enabled) => !enabled)}
          onPlacementChange={(coordinate) => setPinCoordinate(normalizeCoordinate(coordinate))}
          onSelectPin={selectPin}
          onSelectStory={previewMapStory}
          onSelectDiscoveryItem={(item) => void openDiscoveryItem(item)}
          onSelectCurrentEventRoom={(room) => router.push({ pathname: '/current-event/[id]', params: { id: String(room.id), returnTo: 'map' } })}
          onAreaPress={(coordinate) => {
            setSelectedPin(null);
            setStoryPreview(null);
            void discoverArea(coordinate);
          }}
          onRegionChange={changeRegion}
        />
        {seasonalVisible && seasonalMessage ? (
          <Pressable onPress={() => setSeasonalVisible(false)} style={[styles.seasonalTag, { top: insets.top + 12, backgroundColor: colors.card, borderColor: colors.border }]} accessibilityLabel={`Dismiss ${seasonalMessage}`}>
            <Text style={[styles.seasonalText, { color: colors.foreground }]}>{seasonalMessage}</Text>
            <Ionicons name="close" size={14} color={colors.mutedForeground} />
          </Pressable>
        ) : null}
        {!placingPin && !storyPreview && !selectedPin && !discoveryCoordinate ? (
          <View style={[styles.placeCategoryTray, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.placeCategoryList}>
              {PLACE_CATEGORIES.map((item) => {
                const active = selectedCategory === item.key;
                return (
                  <Pressable
                    key={item.key}
                    onPress={() => setSelectedCategory(item.key)}
                    style={[styles.placeCategoryChip, { backgroundColor: active ? colors.foreground : colors.muted }]}
                    accessibilityRole="button"
                    accessibilityState={{ selected: active }}
                  >
                    <Ionicons name={item.icon} size={15} color={active ? colors.background : colors.foreground} />
                    <Text style={[styles.placeCategoryText, { color: active ? colors.background : colors.foreground }]}>{item.label}</Text>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable onPress={startPinPlacement} style={[styles.placePostButton, { backgroundColor: colors.primary }]} accessibilityLabel="Post a place visit">
              <Ionicons name="add" size={20} color={colors.primaryForeground} />
            </Pressable>
          </View>
        ) : null}
        {!placingPin && !storyPreview && !selectedPin && !discoveryCoordinate && !['all', 'favorites', 'visited'].includes(selectedCategory) ? (
          <NearbyPlacesPanel
            category={selectedCategory}
            places={nearbyPlaces}
            loading={placesLoading}
            error={placesError}
            colors={colors}
            onDirections={(place) => void openPlaceDetails(place)}
            onPost={postPlaceVisit}
          />
        ) : null}
        {loading ? <View style={[styles.loadingPill, { top: insets.top + 10, backgroundColor: colors.card }]}><ActivityIndicator size="small" color={colors.primary} /></View> : null}
        {error ? <Pressable onPress={() => void loadRegion(region, true)} style={[styles.errorPill, { top: insets.top + 10, backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="cloud-offline-outline" size={17} color={colors.destructive} /><Text style={{ color: colors.foreground, fontWeight: '700' }}>Retry area</Text></Pressable> : null}
        {paceLayerEnabled ? (
          <View style={[styles.paceLayerPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.paceLayerTitle, { color: colors.foreground }]}>PACE nearby</Text>
            {paceNearby.length === 0 ? <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>No public live activity nearby yet.</Text> : paceNearby.map((item) => (
              <Text key={item.activityType} style={{ color: colors.foreground, fontSize: 12 }}>
                {item.count} {item.activityType}
              </Text>
            ))}
            <Text style={{ color: colors.mutedForeground, fontSize: 11, marginTop: 6 }}>Route and segment discovery map cards are scaffolded for next phase.</Text>
          </View>
        ) : null}
        {discoveryCoordinate ? (
          <DiscoveryPanel
            pins={discoveryPins ?? []}
            stories={discoveryStories ?? []}
            discoveryItems={areaDiscoveryItems ?? []}
            loading={discoveryLoading}
            error={discoveryError}
            colors={colors}
            onRetry={() => {
              if (discoveryCoordinate) void discoverArea(discoveryCoordinate);
            }}
            onClose={() => {
              discoveryRequestId.current += 1;
              setDiscoveryCoordinate(null);
              setDiscoveryPins(null);
              setDiscoveryStories(null);
              setAreaDiscoveryItems(null);
              setDiscoveryError(null);
            }}
            onSelectPin={selectPin}
            onSelectStory={previewMapStory}
            onSelectDiscoveryItem={(item) => void openDiscoveryItem(item)}
          />
        ) : null}
        {selectedPin ? <View style={styles.selectedPinPanel}><PinCard pin={selectedPin} own={selectedPin.authorId === session?.id} colors={colors} onOpen={() => void openInMaps(selectedPin)} onComment={() => setCommentPin(selectedPin)} onChanged={(pin) => { setSelectedPin(pin); setPins((all) => all.map((current) => current.id === pin.id ? pin : current)); }} onDelete={() => { setPins((all) => all.filter((pin) => pin.id !== selectedPin.id)); setSelectedPin(null); }} token={session?.authToken ?? ''} /></View> : null}
        {placingPin ? (
          <PlacementPanel
            coordinate={pinCoordinate}
            query={placeQuery}
            setQuery={setPlaceQuery}
            searching={placeSearching}
            colors={colors}
            onSearch={() => void searchPlace()}
            onUseLocation={() => void refreshLocation()}
            onCancel={() => {
              setPlacingPin(false);
              setPinCoordinate(null);
            }}
            onContinue={() => {
              setPlacingPin(false);
              setComposerOpen(true);
            }}
          />
        ) : null}
        {!placingPin && storyPreview ? (
          <MapStoryPreview
            story={storyPreview}
            colors={colors}
            onClose={() => setStoryPreview(null)}
            onOpen={() => {
              setStoryOpen(storyPreview);
              setStoryPreview(null);
            }}
          />
        ) : null}
        {!placingPin && !storyPreview && !selectedPin && !discoveryCoordinate && stories.length > 0 && selectedCategory === 'all' ? (
          <MapStoryTray stories={stories} colors={colors} onSelect={previewMapStory} />
        ) : null}
      </View>
      <PinComposer visible={composerOpen} coordinate={pinCoordinate} colors={colors} caption={caption} setCaption={setCaption} visibility={visibility} setVisibility={setVisibility} expiry={expiry} setExpiry={setExpiry} category={pinCategory} setCategory={setPinCategory} markVisited={markVisited} setMarkVisited={setMarkVisited} placeName={placeQuery} onClose={() => { setComposerOpen(false); setPinCoordinate(null); }} onSave={() => void publishPin()} />
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

function normalizeCoordinate(coordinate: Coordinate): Coordinate {
  const latitude = Number.isFinite(coordinate.latitude)
    ? Math.max(-85, Math.min(85, coordinate.latitude))
    : 0;
  const rawLongitude = Number.isFinite(coordinate.longitude) ? coordinate.longitude : 0;
  const longitude = ((rawLongitude + 180) % 360 + 360) % 360 - 180;
  return { latitude, longitude };
}

function normalizeRegion(region: SocialMapRegion): SocialMapRegion {
  const coordinate = normalizeCoordinate(region);
  const latitudeDelta = Number.isFinite(region.latitudeDelta)
    ? Math.max(0.002, Math.min(85, Math.abs(region.latitudeDelta)))
    : WORLD_REGION.latitudeDelta;
  const longitudeDelta = Number.isFinite(region.longitudeDelta)
    ? Math.max(0.002, Math.min(170, Math.abs(region.longitudeDelta)))
    : WORLD_REGION.longitudeDelta;
  return { ...coordinate, latitudeDelta, longitudeDelta };
}

function timeAgo(timestamp: number) {
  const minutes = Math.max(1, Math.floor((Date.now() - timestamp) / 60_000));
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.floor(hours / 24)}d`;
}

function PlacementPanel({
  coordinate,
  query,
  setQuery,
  searching,
  colors,
  onSearch,
  onUseLocation,
  onCancel,
  onContinue,
}: {
  coordinate: Coordinate | null;
  query: string;
  setQuery: (value: string) => void;
  searching: boolean;
  colors: any;
  onSearch: () => void;
  onUseLocation: () => void;
  onCancel: () => void;
  onContinue: () => void;
}) {
  return (
    <View style={[styles.placementPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.placementHeading}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.placementTitle, { color: colors.foreground }]}>Choose where to post</Text>
          <Text style={[styles.placementText, { color: colors.mutedForeground }]}>Move the map anywhere in the world. The marker stays centered.</Text>
        </View>
        <Pressable accessibilityLabel="Cancel location selection" hitSlop={10} onPress={onCancel}>
          <Ionicons name="close" size={22} color={colors.foreground} />
        </Pressable>
      </View>
      <View style={[styles.placeSearch, { borderColor: colors.border, backgroundColor: colors.background }]}>
        <Ionicons name="search" size={18} color={colors.mutedForeground} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search a city, venue, or address"
          placeholderTextColor={colors.mutedForeground}
          returnKeyType="search"
          onSubmitEditing={onSearch}
          style={[styles.placeSearchInput, { color: colors.foreground }]}
        />
        <Pressable disabled={!query.trim() || searching} onPress={onSearch} style={styles.searchAction}>
          {searching ? <ActivityIndicator size="small" color={colors.primary} /> : <Ionicons name="arrow-forward" size={19} color={colors.primary} />}
        </Pressable>
      </View>
      <View style={styles.placementActions}>
        <Pressable onPress={onUseLocation} style={[styles.locationShortcut, { borderColor: colors.border }]}>
          <Ionicons name="locate-outline" size={17} color={colors.primary} />
          <Text style={{ color: colors.foreground, fontWeight: '700' }}>My location</Text>
        </Pressable>
        <Pressable disabled={!coordinate} onPress={onContinue} style={[styles.postHere, { backgroundColor: colors.primary, opacity: coordinate ? 1 : 0.45 }]}>
          <Ionicons name="location" size={17} color={colors.primaryForeground} />
          <Text style={{ color: colors.primaryForeground, fontWeight: '800' }}>Post here</Text>
        </Pressable>
      </View>
    </View>
  );
}

function MapStoryPreview({ story, colors, onClose, onOpen }: { story: Story; colors: any; onClose: () => void; onOpen: () => void }) {
  return (
    <Pressable onPress={onOpen} style={[styles.storyPreview, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <StoryAvatar name={story.author.name} size={54} color={colors.primary} viewed={story.viewer.viewed} />
      <View style={styles.storyPreviewCopy}>
        <View style={styles.storyPreviewTitle}>
          <Text numberOfLines={1} style={[styles.storyPreviewName, { color: colors.foreground }]}>{story.author.name}</Text>
          <Text style={[styles.storyPreviewTime, { color: colors.mutedForeground }]}>{timeAgo(story.createdAt)}</Text>
        </View>
        <Text numberOfLines={2} style={[styles.storyPreviewText, { color: colors.mutedForeground }]}>{story.content || 'Open this Story from the map'}</Text>
      </View>
      <View style={[styles.storyPlay, { backgroundColor: colors.primary }]}>
        <Ionicons name="play" size={17} color={colors.primaryForeground} />
      </View>
      <Pressable accessibilityLabel="Close Story preview" hitSlop={10} onPress={(event) => { event.stopPropagation(); onClose(); }} style={styles.storyPreviewClose}>
        <Ionicons name="close" size={17} color={colors.mutedForeground} />
      </Pressable>
    </Pressable>
  );
}

function MapStoryTray({ stories, colors, onSelect }: { stories: Story[]; colors: any; onSelect: (story: Story) => void }) {
  return (
    <View style={[styles.storyTray, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.storyTrayHeader}>
        <View style={styles.storyTrayLabel}>
          <Ionicons name="flame" size={15} color={colors.primary} />
          <Text style={[styles.storyTrayTitle, { color: colors.foreground }]}>Stories on the map</Text>
        </View>
        <Text style={[styles.storyTrayMeta, { color: colors.mutedForeground }]}>{stories.length} nearby</Text>
      </View>
      <FlatList
        horizontal
        data={stories.slice(0, 20)}
        keyExtractor={(story) => String(story.id)}
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.storyTrayList}
        renderItem={({ item }) => (
          <Pressable onPress={() => onSelect(item)} style={styles.storyTrayItem}>
            <StoryAvatar name={item.author.name} size={48} color={colors.primary} viewed={item.viewer.viewed} />
            <Text numberOfLines={1} style={[styles.storyTrayName, { color: colors.foreground }]}>{item.author.name.split(' ')[0]}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

function NearbyPlacesPanel({ category, places, loading, error, colors, onDirections, onPost }: { category: PlaceCategory; places: NearbyPlace[]; loading: boolean; error: string | null; colors: any; onDirections: (place: NearbyPlace) => void; onPost: (place: NearbyPlace) => void }) {
  return (
    <View style={[styles.placesPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.placesPanelHeader}>
        <View>
          <Text style={[styles.placesPanelTitle, { color: colors.foreground }]}>{categoryLabel(category)}</Text>
          <Text style={[styles.placesAttribution, { color: colors.mutedForeground }]}>Nearby · © OpenStreetMap contributors</Text>
        </View>
        {loading ? <ActivityIndicator color={colors.primary} /> : null}
      </View>
      {error ? <Text style={[styles.placesEmpty, { color: colors.destructive }]}>{error}</Text> : null}
      {!loading && !error && places.length === 0 ? <Text style={[styles.placesEmpty, { color: colors.mutedForeground }]}>No nearby places found in this area.</Text> : null}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.placesList}>
        {places.map((place) => (
          <View key={place.id} style={[styles.placeCard, { borderTopColor: colors.border }]}>
            <View style={[styles.placeTypeIcon, { backgroundColor: colors.muted }]}>
              <Ionicons name={PLACE_CATEGORIES.find((item) => item.key === category)?.icon ?? 'location'} size={18} color={colors.foreground} />
            </View>
            <View style={styles.placeCardCopy}>
              <Text numberOfLines={1} style={[styles.placeCardTitle, { color: colors.foreground }]}>{place.name}</Text>
              <Text numberOfLines={1} style={[styles.placeCardAddress, { color: colors.mutedForeground }]}>{place.address}</Text>
              <Text numberOfLines={1} style={[styles.placeCardMeta, { color: colors.mutedForeground }]}>{place.openingHours || 'Hours not listed'}</Text>
            </View>
            <Pressable onPress={() => onDirections(place)} style={[styles.placeMiniAction, { backgroundColor: colors.muted }]} accessibilityLabel={`Directions to ${place.name}`}>
              <Ionicons name="navigate" size={17} color={colors.foreground} />
            </Pressable>
            <Pressable onPress={() => onPost(place)} style={[styles.placeMiniAction, { backgroundColor: colors.primary }]} accessibilityLabel={`Post that you visited ${place.name}`}>
              <Ionicons name="camera" size={17} color={colors.primaryForeground} />
            </Pressable>
          </View>
        ))}
      </ScrollView>
    </View>
  );
}

type MapActivity =
  | { kind: 'discovery'; id: string; item: DiscoveryItem }
  | { kind: 'story'; id: string; story: Story }
  | { kind: 'pin'; id: string; pin: MapPin };

function DiscoveryPanel({ pins, stories, discoveryItems, loading, error, colors, onRetry, onClose, onSelectPin, onSelectStory, onSelectDiscoveryItem }: { pins: MapPin[]; stories: Story[]; discoveryItems: DiscoveryItem[]; loading: boolean; error: string | null; colors: any; onRetry: () => void; onClose: () => void; onSelectPin: (pin: MapPin) => void; onSelectStory: (story: Story) => void; onSelectDiscoveryItem: (item: DiscoveryItem) => void }) {
  const recentPins = [...pins].sort((left, right) => right.createdAt - left.createdAt);
  const popularPins = [...pins].filter((pin) => pin.counts.reactions + pin.counts.comments + pin.counts.saves > 0).sort((left, right) => (right.counts.reactions + right.counts.comments + right.counts.saves) - (left.counts.reactions + left.counts.comments + left.counts.saves));
  const people = new Set([...pins.map((pin) => pin.author.id), ...stories.map((story) => story.author.id)]).size;
  const activity = useMemo<MapActivity[]>(() => [
    ...discoveryItems.slice(0, 2).map((item) => ({ kind: 'discovery' as const, id: `discovery-${item.id}`, item })),
    ...stories.slice(0, 2).map((story) => ({ kind: 'story' as const, id: `story-${story.id}`, story })),
    ...(stories.length === 0 && (popularPins[0] ?? recentPins[0]) ? [{ kind: 'pin' as const, id: `pin-${(popularPins[0] ?? recentPins[0]).id}`, pin: popularPins[0] ?? recentPins[0] }] : []),
  ], [discoveryItems, popularPins, recentPins, stories]);
  const activityFeed = useMemo(() => adManager.blendNativeAds('map', activity, (item) => item.id), [activity]);
  return (
    <View style={[styles.discoveryPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.discoveryHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.discoveryTitle, { color: colors.foreground }]}>What’s happening here?</Text>
          <Text style={[styles.discoveryMeta, { color: colors.mutedForeground }]}>{loading ? 'Looking nearby' : `${discoveryItems.length} trending · ${stories.length} Stories · ${recentPins.length} locations`}</Text>
        </View>
        {loading ? <ActivityIndicator color={colors.primary} /> : <Pressable accessibilityLabel="Close location discovery" onPress={onClose} hitSlop={10}><Ionicons name="close" size={20} color={colors.mutedForeground} /></Pressable>}
      </View>
      {!loading && error ? <Pressable onPress={onRetry} style={styles.discoveryEmpty}><Text style={{ color: colors.destructive }}>{error}</Text><Text style={{ color: colors.primary, fontWeight: '700' }}>Try again</Text></Pressable> : null}
      {!loading && !error && discoveryItems.length === 0 && stories.length === 0 && recentPins.length === 0 ? <Text style={[styles.discoveryEmpty, { color: colors.mutedForeground }]}>Nothing posted here yet.</Text> : null}
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.discoveryList}>
      {!loading && activityFeed.map((entry) => entry.kind === 'native-ad' ? (
        <AdMobNativeFeedAd key={entry.key} surface="map" placement={entry.placement} />
      ) : entry.content.kind === 'discovery' ? (
        <Pressable key={entry.key} onPress={() => onSelectDiscoveryItem((entry.content as Extract<MapActivity, { kind: 'discovery' }>).item)} style={[styles.discoveryItem, { borderTopColor: colors.border }]}>
          <View style={styles.discoveryFlame}><Ionicons name="flame" size={16} color="#fff" /></View>
          <View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.discoveryItemTitle, { color: colors.foreground }]}>{(entry.content as Extract<MapActivity, { kind: 'discovery' }>).item.title}</Text><Text numberOfLines={1} style={[styles.discoveryItemText, { color: colors.mutedForeground }]}>{(entry.content as Extract<MapActivity, { kind: 'discovery' }>).item.creator.handle || (entry.content as Extract<MapActivity, { kind: 'discovery' }>).item.creator.name} · {(entry.content as Extract<MapActivity, { kind: 'discovery' }>).item.platform === 'x' ? 'X' : (entry.content as Extract<MapActivity, { kind: 'discovery' }>).item.platform[0].toUpperCase() + (entry.content as Extract<MapActivity, { kind: 'discovery' }>).item.platform.slice(1)}</Text></View>
          <Ionicons name="play" size={15} color={colors.primary} />
        </Pressable>
      ) : entry.content.kind === 'story' ? (
        <Pressable key={entry.key} onPress={() => onSelectStory((entry.content as Extract<MapActivity, { kind: 'story' }>).story)} style={[styles.discoveryItem, { borderTopColor: colors.border }]}>
          <Avatar name={(entry.content as Extract<MapActivity, { kind: 'story' }>).story.author.name} size={28} color={colors.primary} />
          <View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.discoveryItemTitle, { color: colors.foreground }]}>{(entry.content as Extract<MapActivity, { kind: 'story' }>).story.author.name}</Text><Text numberOfLines={1} style={[styles.discoveryItemText, { color: colors.mutedForeground }]}>{(entry.content as Extract<MapActivity, { kind: 'story' }>).story.content || 'Active Story'} · {timeAgo((entry.content as Extract<MapActivity, { kind: 'story' }>).story.createdAt)}</Text></View>
          <Ionicons name="play" size={15} color={colors.primary} />
        </Pressable>
      ) : (
        <Pressable key={entry.key} onPress={() => onSelectPin((entry.content as Extract<MapActivity, { kind: 'pin' }>).pin)} style={[styles.discoveryItem, { borderTopColor: colors.border }]}>
          <Avatar name={(entry.content as Extract<MapActivity, { kind: 'pin' }>).pin.author.name} size={28} color={colors.primary} />
          <View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.discoveryItemTitle, { color: colors.foreground }]}>{(entry.content as Extract<MapActivity, { kind: 'pin' }>).pin.author.name}</Text><Text numberOfLines={1} style={[styles.discoveryItemText, { color: colors.mutedForeground }]}>{(entry.content as Extract<MapActivity, { kind: 'pin' }>).pin.caption || 'Shared a location'} · {timeAgo((entry.content as Extract<MapActivity, { kind: 'pin' }>).pin.createdAt)}</Text></View>
          <Ionicons name="chevron-forward" size={16} color={colors.mutedForeground} />
        </Pressable>
      ))}
      </ScrollView>
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

function PinComposer({ visible, coordinate, colors, caption, setCaption, visibility, setVisibility, expiry, setExpiry, category, setCategory, markVisited, setMarkVisited, placeName, onClose, onSave }: any) {
  const categories = PLACE_CATEGORIES.filter((item) => !['all', 'favorites', 'visited'].includes(item.key));
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalShade}><View style={[styles.sheet, { backgroundColor: colors.background }]}><View style={[styles.grabber, { backgroundColor: colors.border }]} /><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Post this place</Text><Text style={[styles.sheetText, { color: colors.mutedForeground }]}>{coordinate ? `${placeName || 'Your chosen location'} will be attached to this post.` : 'Choose a location on the map before posting.'}</Text><Text style={[styles.field, { color: colors.foreground }]}>Place type</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.composerCategories}>{categories.map((item) => <Pressable key={item.key} onPress={() => setCategory(item.key)} style={[styles.choice, { borderColor: category === item.key ? colors.primary : colors.border, backgroundColor: category === item.key ? colors.secondary : 'transparent', flexDirection: 'row', alignItems: 'center', gap: 6 }]}><Ionicons name={item.icon} size={15} color={colors.foreground} /><Text style={{ color: colors.foreground }}>{item.label}</Text></Pressable>)}</ScrollView><Pressable onPress={() => setMarkVisited(!markVisited)} style={[styles.visitedChoice, { borderColor: markVisited ? colors.primary : colors.border, backgroundColor: markVisited ? colors.secondary : 'transparent' }]}><Ionicons name={markVisited ? 'checkmark-circle' : 'ellipse-outline'} size={19} color={markVisited ? colors.primary : colors.mutedForeground} /><Text style={{ color: colors.foreground, fontWeight: '700' }}>I visited this place</Text></Pressable><TextInput value={caption} onChangeText={setCaption} placeholder="Add a caption (optional)" placeholderTextColor={colors.mutedForeground} multiline maxLength={280} style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} /><Text style={[styles.field, { color: colors.foreground }]}>Who can see this?</Text><View style={styles.choices}>{(['public', 'friends', 'followers', 'private'] as MapVisibility[]).map((item) => <Pressable key={item} onPress={() => setVisibility(item)} style={[styles.choice, { borderColor: visibility === item ? colors.primary : colors.border, backgroundColor: visibility === item ? colors.secondary : 'transparent' }]}><Text style={{ color: colors.foreground }}>{item}</Text></Pressable>)}</View><Text style={[styles.field, { color: colors.foreground }]}>Expiry</Text><View style={styles.choices}>{(['day', 'week', 'never'] as const).map((item) => <Pressable key={item} onPress={() => setExpiry(item)} style={[styles.choice, { borderColor: expiry === item ? colors.primary : colors.border }]}><Text style={{ color: colors.foreground }}>{item === 'day' ? '24 hours' : item === 'week' ? '7 days' : 'Never'}</Text></Pressable>)}</View><View style={styles.sheetActions}><Pressable onPress={onClose}><Text style={{ color: colors.mutedForeground, fontWeight: '700' }}>Cancel</Text></Pressable><Pressable onPress={onSave} style={[styles.publish, { backgroundColor: colors.primary }]}><Text style={styles.primaryText}>Post place</Text></Pressable></View></View></View></Modal>;
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
  currentEventsButton: { position: 'absolute', zIndex: 11, right: 14, width: 44, height: 44, borderRadius: 22, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, elevation: 5 },
  paceLayerButton: { position: 'absolute', zIndex: 11, right: 14, width: 42, height: 42, borderRadius: 21, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.16, shadowRadius: 7, elevation: 4 },
  paceLayerPanel: { position: 'absolute', zIndex: 9, left: 14, top: 110, borderRadius: 14, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 12, paddingVertical: 10, minWidth: 170, gap: 2 },
  paceLayerTitle: { fontSize: 13, fontWeight: '800' },
  liveCount: { position: 'absolute', right: -3, top: -3, minWidth: 18, height: 18, borderRadius: 9, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  liveCountText: { color: '#fff', fontSize: 10, fontWeight: '900' },
  currentEventsError: { position: 'absolute', zIndex: 8, alignSelf: 'center', minHeight: 32, borderRadius: 16, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 11 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#EF4444', marginLeft: 1 },
  loadingPill: { position: 'absolute', left: 14, zIndex: 7, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  errorPill: { position: 'absolute', left: 14, zIndex: 7, minHeight: 40, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
  seasonalTag: { position: 'absolute', zIndex: 10, alignSelf: 'center', minHeight: 38, borderRadius: 20, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 8, shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  seasonalText: { fontSize: 13, fontWeight: '900' },
  placeCategoryTray: { position: 'absolute', zIndex: 10, left: 8, right: 8, bottom: 8, minHeight: 58, borderRadius: 25, borderWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', paddingLeft: 8, paddingRight: 7, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 14, elevation: 6 },
  placeCategoryList: { alignItems: 'center', gap: 7, paddingRight: 8 },
  placeCategoryChip: { minHeight: 38, borderRadius: 19, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 6 },
  placeCategoryText: { fontSize: 12, fontWeight: '800' },
  placePostButton: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  placesPanel: { position: 'absolute', zIndex: 9, left: 8, right: 8, bottom: 74, maxHeight: '55%', borderRadius: 25, borderWidth: StyleSheet.hairlineWidth, paddingHorizontal: 13, paddingTop: 12, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 14, elevation: 6 },
  placesPanelHeader: { minHeight: 42, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  placesPanelTitle: { fontSize: 17, fontWeight: '900' },
  placesAttribution: { fontSize: 11, marginTop: 2 },
  placesList: { paddingBottom: 8 },
  placesEmpty: { fontSize: 12, paddingVertical: 16 },
  placeCard: { minHeight: 74, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 9, paddingVertical: 9 },
  placeTypeIcon: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  placeCardCopy: { flex: 1 },
  placeCardTitle: { fontSize: 13, fontWeight: '900' },
  placeCardAddress: { fontSize: 10, marginTop: 2 },
  placeCardMeta: { fontSize: 10, fontWeight: '700', marginTop: 3 },
  placeMiniAction: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  selectedPinPanel: { position: 'absolute', left: 10, right: 10, bottom: 10, shadowColor: '#000', shadowOpacity: 0.15, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 6 },
  placementPanel: { position: 'absolute', zIndex: 12, left: 10, right: 10, bottom: 10, borderRadius: 26, borderWidth: 1, padding: 14, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 16, shadowOffset: { width: 0, height: 7 }, elevation: 8 },
  placementHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  placementTitle: { fontSize: 16, fontWeight: '900' },
  placementText: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  placeSearch: { minHeight: 46, borderRadius: 23, borderWidth: 1, flexDirection: 'row', alignItems: 'center', paddingLeft: 13, paddingRight: 7, marginTop: 12 },
  placeSearchInput: { flex: 1, minHeight: 44, paddingHorizontal: 9, fontSize: 14 },
  searchAction: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  placementActions: { flexDirection: 'row', gap: 10, marginTop: 11 },
  locationShortcut: { minHeight: 44, flex: 1, borderRadius: 22, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  postHere: { minHeight: 44, flex: 1.15, borderRadius: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  storyPreview: { position: 'absolute', zIndex: 10, left: 10, right: 10, bottom: 10, minHeight: 82, borderRadius: 26, borderWidth: 1, padding: 12, paddingRight: 44, flexDirection: 'row', alignItems: 'center', gap: 11, shadowColor: '#000', shadowOpacity: 0.17, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 7 },
  storyPreviewCopy: { flex: 1 },
  storyPreviewTitle: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  storyPreviewName: { flexShrink: 1, fontSize: 14, fontWeight: '900' },
  storyPreviewTime: { fontSize: 11, fontWeight: '600' },
  storyPreviewText: { fontSize: 12, lineHeight: 17, marginTop: 3 },
  storyPlay: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  storyPreviewClose: { position: 'absolute', top: 7, right: 8, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
  storyTray: { position: 'absolute', zIndex: 9, left: 8, right: 8, bottom: 74, borderRadius: 25, borderWidth: 1, paddingTop: 10, paddingBottom: 8, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
  storyTrayHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 13, marginBottom: 7 },
  storyTrayLabel: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  storyTrayTitle: { fontSize: 12, fontWeight: '900' },
  storyTrayMeta: { fontSize: 10, fontWeight: '600' },
  storyTrayList: { paddingHorizontal: 10, gap: 9 },
  storyTrayItem: { width: 55, alignItems: 'center', gap: 4 },
  storyTrayName: { width: 55, textAlign: 'center', fontSize: 10, fontWeight: '600' },
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
    discoveryPanel: { position: 'absolute', left: 12, right: 12, bottom: 12, maxHeight: '72%', borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4, shadowColor: '#000', shadowOpacity: .12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
    discoveryList: { paddingBottom: 6 },
  discoveryFlame: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F97316' },
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
  modalShade: { flex: 1, backgroundColor: 'rgba(0,0,0,.35)', justifyContent: 'flex-end' }, sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }, commentsSheet: { height: '72%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10 }, grabber: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }, sheetTitle: { fontSize: 20, fontWeight: '800' }, sheetText: { lineHeight: 19, marginTop: 6 }, input: { minHeight: 82, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top', marginTop: 16 }, field: { fontWeight: '800', marginTop: 16 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }, choice: { borderWidth: 1, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12 }, composerCategories: { gap: 8, paddingVertical: 8 }, visitedChoice: { minHeight: 44, borderRadius: 22, borderWidth: 1, marginTop: 8, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 8 }, sheetActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }, publish: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12 }, commentsTitle: { paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, comment: { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 3 }, emptyComments: { textAlign: 'center', marginTop: 32 }, commentEntry: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', padding: 14, gap: 10, alignItems: 'center' },
});
