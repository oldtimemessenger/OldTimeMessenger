import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as WebBrowser from 'expo-web-browser';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Linking, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
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
import { createMapPin, createMapPinComment, deleteMapPin, discoveryEmbedUrl, getMapPinComments, getNearbyDiscoveryItems, getNearbyPins, reportMapPin, setMapPinRelation, type DiscoveryItem, type MapComment, type MapPin, type MapVisibility } from '@/lib/map-api';
import { getNearbyStories, setUserBlocked, type Story } from '@/lib/social-api';
import CurrentEventsHome from '@/components/current-events-home';

type Coordinate = { latitude: number; longitude: number };

const WORLD_REGION: SocialMapRegion = {
  latitude: 20,
  longitude: 0,
  latitudeDelta: 105,
  longitudeDelta: 170,
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
  const [storyOpen, setStoryOpen] = useState<Story | null>(null);
  const [storyPreview, setStoryPreview] = useState<Story | null>(null);
  const [heatEnabled, setHeatEnabled] = useState(true);
  const [placingPin, setPlacingPin] = useState(false);
  const [pinCoordinate, setPinCoordinate] = useState<Coordinate | null>(null);
  const [placeQuery, setPlaceQuery] = useState('');
  const [placeSearching, setPlaceSearching] = useState(false);
  const [currentEventsMode, setCurrentEventsMode] = useState(false);
  const [currentEventRooms, setCurrentEventRooms] = useState<CurrentEventRoom[]>([]);
  const regionTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const regionCache = useRef(new Map<string, { loadedAt: number; pins: MapPin[]; stories: Story[]; discoveryItems: DiscoveryItem[] }>());

  useEffect(() => {
    setVisibility(settings.locationAudience === 'public' ? 'friends' : settings.locationAudience);
  }, [settings.locationAudience]);

  useEffect(() => {
    if (!session?.authToken) return;
    void getCurrentEventRooms().then(({ items }) => setCurrentEventRooms(items)).catch(() => setCurrentEventRooms([]));
  }, [session?.authToken]);

  const loadRegion = useCallback(async (nextRegion: SocialMapRegion, force = false) => {
    if (!session?.authToken) return;
    const radiusKm = radiusForRegion(nextRegion);
    const cacheKey = `${nextRegion.latitude.toFixed(2)}:${nextRegion.longitude.toFixed(2)}:${Math.round(radiusKm)}`;
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
        getNearbyPins(session.authToken, nextRegion.latitude, nextRegion.longitude, radiusKm),
        getNearbyStories(session.authToken, nextRegion.latitude, nextRegion.longitude, radiusKm, 30),
        getNearbyDiscoveryItems(session.authToken, nextRegion.latitude, nextRegion.longitude, radiusKm),
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
    setDiscoveryCoordinate(coordinate);
    setDiscoveryLoading(true);
    try {
      const [pinPage, storyPage, discoveryPage] = await Promise.all([
        getNearbyPins(session.authToken, coordinate.latitude, coordinate.longitude, 5),
        getNearbyStories(session.authToken, coordinate.latitude, coordinate.longitude, 5, 20),
        getNearbyDiscoveryItems(session.authToken, coordinate.latitude, coordinate.longitude, 5),
      ]);
      setDiscoveryPins(pinPage.items);
      setDiscoveryStories(storyPage.items);
      setAreaDiscoveryItems(discoveryPage.items);
    } catch {
      setDiscoveryPins([]);
      setDiscoveryStories([]);
      setAreaDiscoveryItems([]);
    } finally {
      setDiscoveryLoading(false);
    }
  }, [session?.authToken]);

  function selectPin(pin: MapPin) {
    setSelectedPin(pin);
    setStoryPreview(null);
    setDiscoveryCoordinate(null);
    setDiscoveryPins(null);
    setDiscoveryStories(null);
    setAreaDiscoveryItems(null);
  }

  function previewMapStory(story: Story) {
    setStoryPreview(story);
    setSelectedPin(null);
    setDiscoveryCoordinate(null);
    setDiscoveryPins(null);
    setDiscoveryStories(null);
    setAreaDiscoveryItems(null);
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
      if (placingPin) setPinCoordinate(coordinate);
      setSelectedPin(null);
      setDiscoveryCoordinate(null);
      setDiscoveryPins(null);
      setDiscoveryStories(null);
      setAreaDiscoveryItems(null);
      await loadRegion(nextRegion, true);
    } catch {
      Alert.alert('Location unavailable', 'Old Time could not read your current location. Try again outdoors or check device location services.');
    } finally {
      setLoading(false);
    }
  }

  function startPinPlacement() {
    setPinCoordinate({ latitude: region.latitude, longitude: region.longitude });
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
      const coordinate = { latitude: first.latitude, longitude: first.longitude };
      setPinCoordinate(coordinate);
      setRegion({ ...coordinate, latitudeDelta: 0.08, longitudeDelta: 0.1 });
    } catch {
      Alert.alert('Search unavailable', 'Move the map to choose the location, or try searching again.');
    } finally {
      setPlaceSearching(false);
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

  async function openDiscoveryItem(item: DiscoveryItem) {
    await WebBrowser.openBrowserAsync(discoveryEmbedUrl(item.id), {
      presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
      controlsColor: colors.primary,
    });
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
      const created = await createMapPin(session.authToken, { ...pinCoordinate, caption: caption.trim() || undefined, visibility, expiresAt });
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
          accessibilityLabel="Open Current Events"
          style={[styles.currentEventsButton, { top: insets.top + 10, backgroundColor: colors.primary }]}
        >
          <Ionicons name="mic-outline" size={16} color={colors.primaryForeground} />
          <Text style={{ color: colors.primaryForeground, fontSize: 12, fontWeight: '800' }}>What’s happening</Text>
          <View style={styles.liveDot} />
          <Text style={{ color: colors.primaryForeground, fontSize: 12, fontWeight: '800' }}>{currentEventRooms.length}</Text>
        </Pressable>
        <SocialMap
          center={location}
          region={region}
          pins={pins}
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
          onPlacementChange={setPinCoordinate}
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
        {loading ? <View style={[styles.loadingPill, { top: insets.top + 10, backgroundColor: colors.card }]}><ActivityIndicator size="small" color={colors.primary} /></View> : null}
        {error ? <Pressable onPress={() => void loadRegion(region, true)} style={[styles.errorPill, { top: insets.top + 10, backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="cloud-offline-outline" size={17} color={colors.destructive} /><Text style={{ color: colors.foreground, fontWeight: '700' }}>Retry area</Text></Pressable> : null}
        {discoveryCoordinate ? (
          <DiscoveryPanel
            pins={discoveryPins ?? []}
            stories={discoveryStories ?? []}
            discoveryItems={areaDiscoveryItems ?? []}
            loading={discoveryLoading}
            colors={colors}
            onClose={() => {
              setDiscoveryCoordinate(null);
              setDiscoveryPins(null);
              setDiscoveryStories(null);
              setAreaDiscoveryItems(null);
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
        {!placingPin && !storyPreview && !selectedPin && !discoveryCoordinate && stories.length > 0 ? (
          <MapStoryTray stories={stories} colors={colors} onSelect={previewMapStory} />
        ) : null}
      </View>
      <PinComposer visible={composerOpen} coordinate={pinCoordinate} colors={colors} caption={caption} setCaption={setCaption} visibility={visibility} setVisibility={setVisibility} expiry={expiry} setExpiry={setExpiry} onClose={() => { setComposerOpen(false); setPinCoordinate(null); }} onSave={() => void publishPin()} />
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

function DiscoveryPanel({ pins, stories, discoveryItems, loading, colors, onClose, onSelectPin, onSelectStory, onSelectDiscoveryItem }: { pins: MapPin[]; stories: Story[]; discoveryItems: DiscoveryItem[]; loading: boolean; colors: any; onClose: () => void; onSelectPin: (pin: MapPin) => void; onSelectStory: (story: Story) => void; onSelectDiscoveryItem: (item: DiscoveryItem) => void }) {
  const recentPins = [...pins].sort((left, right) => right.createdAt - left.createdAt);
  const popularPins = [...pins].filter((pin) => pin.counts.reactions + pin.counts.comments + pin.counts.saves > 0).sort((left, right) => (right.counts.reactions + right.counts.comments + right.counts.saves) - (left.counts.reactions + left.counts.comments + left.counts.saves));
  const people = new Set([...pins.map((pin) => pin.author.id), ...stories.map((story) => story.author.id)]).size;
  return (
    <View style={[styles.discoveryPanel, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.discoveryHeader}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.discoveryTitle, { color: colors.foreground }]}>What’s happening here?</Text>
          <Text style={[styles.discoveryMeta, { color: colors.mutedForeground }]}>{loading ? 'Looking nearby' : `${discoveryItems.length} trending · ${stories.length} Stories · ${recentPins.length} locations`}</Text>
        </View>
        {loading ? <ActivityIndicator color={colors.primary} /> : <Pressable accessibilityLabel="Close location discovery" onPress={onClose} hitSlop={10}><Ionicons name="close" size={20} color={colors.mutedForeground} /></Pressable>}
      </View>
      {!loading && discoveryItems.length === 0 && stories.length === 0 && recentPins.length === 0 ? <Text style={[styles.discoveryEmpty, { color: colors.mutedForeground }]}>Nothing posted here yet.</Text> : null}
      {!loading && discoveryItems.slice(0, 2).map((item) => <Pressable key={`discovery-${item.id}`} onPress={() => onSelectDiscoveryItem(item)} style={[styles.discoveryItem, { borderTopColor: colors.border }]}>
        <View style={styles.discoveryFlame}><Ionicons name="flame" size={16} color="#fff" /></View>
        <View style={{ flex: 1 }}><Text numberOfLines={1} style={[styles.discoveryItemTitle, { color: colors.foreground }]}>{item.title}</Text><Text numberOfLines={1} style={[styles.discoveryItemText, { color: colors.mutedForeground }]}>{item.creator.handle || item.creator.name} · {item.platform === 'x' ? 'X' : item.platform[0].toUpperCase() + item.platform.slice(1)}</Text></View>
        <Ionicons name="play" size={15} color={colors.primary} />
      </Pressable>)}
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

function PinComposer({ visible, coordinate, colors, caption, setCaption, visibility, setVisibility, expiry, setExpiry, onClose, onSave }: any) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><View style={styles.modalShade}><View style={[styles.sheet, { backgroundColor: colors.background }]}><View style={[styles.grabber, { backgroundColor: colors.border }]} /><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Post location</Text><Text style={[styles.sheetText, { color: colors.mutedForeground }]}>{coordinate ? 'Your chosen map location will be attached to this pin.' : 'Choose a location on the map before posting.'}</Text><TextInput value={caption} onChangeText={setCaption} placeholder="Add a caption (optional)" placeholderTextColor={colors.mutedForeground} multiline maxLength={280} style={[styles.input, { borderColor: colors.border, color: colors.foreground }]} /><Text style={[styles.field, { color: colors.foreground }]}>Who can see this?</Text><View style={styles.choices}>{(['public', 'friends', 'followers', 'private'] as MapVisibility[]).map((item) => <Pressable key={item} onPress={() => setVisibility(item)} style={[styles.choice, { borderColor: visibility === item ? colors.primary : colors.border, backgroundColor: visibility === item ? colors.secondary : 'transparent' }]}><Text style={{ color: colors.foreground }}>{item}</Text></Pressable>)}</View><Text style={[styles.field, { color: colors.foreground }]}>Expiry</Text><View style={styles.choices}>{(['day', 'week', 'never'] as const).map((item) => <Pressable key={item} onPress={() => setExpiry(item)} style={[styles.choice, { borderColor: expiry === item ? colors.primary : colors.border }]}><Text style={{ color: colors.foreground }}>{item === 'day' ? '24 hours' : item === 'week' ? '7 days' : 'Never'}</Text></Pressable>)}</View><View style={styles.sheetActions}><Pressable onPress={onClose}><Text style={{ color: colors.mutedForeground, fontWeight: '700' }}>Cancel</Text></Pressable><Pressable onPress={onSave} style={[styles.publish, { backgroundColor: colors.primary }]}><Text style={styles.primaryText}>Post pin</Text></Pressable></View></View></View></Modal>;
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
  currentEventsButton: { position: 'absolute', zIndex: 8, left: 68, right: 68, minHeight: 40, borderRadius: 21, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 12, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, elevation: 5 },
  liveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#EF4444', marginLeft: 1 },
  loadingPill: { position: 'absolute', left: 14, zIndex: 7, width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, elevation: 4 },
  errorPill: { position: 'absolute', left: 14, zIndex: 7, minHeight: 40, borderRadius: 20, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 7 },
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
  storyTray: { position: 'absolute', zIndex: 9, left: 8, right: 8, bottom: 8, borderRadius: 25, borderWidth: 1, paddingTop: 10, paddingBottom: 8, shadowColor: '#000', shadowOpacity: 0.14, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 6 },
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
   discoveryPanel: { position: 'absolute', left: 12, right: 12, bottom: 12, borderRadius: 22, borderWidth: 1, paddingHorizontal: 14, paddingTop: 12, paddingBottom: 4, shadowColor: '#000', shadowOpacity: .12, shadowRadius: 12, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
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
  modalShade: { flex: 1, backgroundColor: 'rgba(0,0,0,.35)', justifyContent: 'flex-end' }, sheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 20 }, commentsSheet: { height: '72%', borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10 }, grabber: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', marginBottom: 16 }, sheetTitle: { fontSize: 20, fontWeight: '800' }, sheetText: { lineHeight: 19, marginTop: 6 }, input: { minHeight: 82, borderWidth: 1, borderRadius: 12, padding: 12, textAlignVertical: 'top', marginTop: 16 }, field: { fontWeight: '800', marginTop: 16 }, choices: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }, choice: { borderWidth: 1, borderRadius: 18, paddingVertical: 8, paddingHorizontal: 12 }, sheetActions: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 24 }, publish: { borderRadius: 10, paddingHorizontal: 18, paddingVertical: 12 }, commentsTitle: { paddingHorizontal: 20, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }, comment: { paddingHorizontal: 20, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, gap: 3 }, emptyComments: { textAlign: 'center', marginTop: 32 }, commentEntry: { borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', padding: 14, gap: 10, alignItems: 'center' },
});