import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Alert, AppState, FlatList, Keyboard, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Polyline } from 'react-native-svg';
import { Avatar, Screen } from '@/components/ui';
import { useApp } from '@/context/app-state';
import { useColors } from '@/hooks/useColors';
import { appendTrackedPoint, clearPaceRecording, getStoredPaceRecording, savePaceRecording, startPaceLocationUpdates, stopPaceLocationUpdates, type PaceRecording } from '@/lib/pace-recorder';
import {
  createPaceComment,
  createPaceRoute,
  getPaceComments,
  getPaceFeed,
  sendPaceGift,
  setPaceCommentLike,
  setPaceRouteLike,
  type PaceActivity,
  type PaceComment,
  type PaceDifficulty,
  type PacePoint,
  type PaceRoute,
  type PaceSuggestion,
} from '@/lib/pace-api';

const GIFT_OPTIONS = [
  { key: 'coffee' as const, label: 'Coffee', price: 25, icon: 'cafe-outline' as const },
  { key: 'idea' as const, label: 'Idea', price: 100, icon: 'bulb-outline' as const },
  { key: 'heart' as const, label: 'Heart', price: 200, icon: 'heart-outline' as const },
  { key: 'gem' as const, label: 'Gem', price: 500, icon: 'diamond-outline' as const },
  { key: 'studio' as const, label: 'Studio', price: 1000, icon: 'albums-outline' as const },
  { key: 'time_is_up' as const, label: 'Time is up', price: 10000, icon: 'trophy-outline' as const },
];

const ACTIVITY_LABELS: Record<PaceActivity, string> = { run: 'Run', walk: 'Walk', bike: 'Ride', hike: 'Hike' };
const DIFFICULTY_LABELS: Record<PaceDifficulty, string> = { easy: 'Easy', steady: 'Steady', hard: 'Hard' };

type Coordinate = PacePoint;

function recordingAsSuggestion(recording: PaceRecording): PaceSuggestion {
  const firstPoint = recording.points[0];
  return {
    id: `recorded-${recording.id}`,
    suggested: true,
    title: 'My Pace route',
    description: 'Recorded with Old Time.',
    kind: 'route',
    visibility: 'public',
    activity: 'run',
    difficulty: recording.distanceKm >= 8 ? 'hard' : recording.distanceKm >= 4 ? 'steady' : 'easy',
    distanceKm: recording.distanceKm,
    elevationM: 0,
    durationMin: Math.max(1, Math.round(recording.elapsedSeconds / 60)),
    locationLabel: 'Recorded locally',
    distanceFromYouKm: 0,
    routeCoordinates: recording.points.map(({ latitude, longitude }) => ({ latitude, longitude })),
  };
}

export default function PaceScreen() {
  const colors = useColors();
  const { session } = useApp();
  const [permission, requestPermission] = Location.useForegroundPermissions();
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [routes, setRoutes] = useState<PaceRoute[]>([]);
  const [suggestions, setSuggestions] = useState<PaceSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [composer, setComposer] = useState<PaceSuggestion | null>(null);
  const [commentsRoute, setCommentsRoute] = useState<PaceRoute | null>(null);
  const [giftRoute, setGiftRoute] = useState<PaceRoute | null>(null);
  const [recording, setRecording] = useState<PaceRecording | null>(null);
  const [recordingLoading, setRecordingLoading] = useState(true);
  const [backgroundTrackingEnabled, setBackgroundTrackingEnabled] = useState(false);
  const watchRef = useRef<Location.LocationSubscription | null>(null);

  const syncRecordingState = useCallback(async () => {
    const stored = await getStoredPaceRecording();
    setRecording(stored);
    if (Platform.OS === 'web') return;
    if (stored?.status === 'recording') {
      try {
        setBackgroundTrackingEnabled(await startPaceLocationUpdates());
      } catch {
        setBackgroundTrackingEnabled(false);
      }
      return;
    }
    setBackgroundTrackingEnabled(false);
    await stopPaceLocationUpdates().catch(() => undefined);
  }, []);

  const load = useCallback(async (showRefresh = false) => {
    if (!session?.authToken) return;
    if (showRefresh) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const result = await getPaceFeed(session.authToken, location ?? undefined);
      setRoutes(result.items);
      setSuggestions(result.suggestions);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'Pace could not load right now.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [location, session?.authToken]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!permission?.granted) return;
    void Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced })
      .then((result) => setLocation({ latitude: result.coords.latitude, longitude: result.coords.longitude }))
      .catch(() => undefined);
  }, [permission?.granted]);

  useEffect(() => {
    void syncRecordingState()
      .finally(() => setRecordingLoading(false));

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void syncRecordingState();
      }
    });
    return () => subscription.remove();
  }, [syncRecordingState]);

  useEffect(() => {
    if (recording?.status !== 'recording' || (Platform.OS !== 'web' && backgroundTrackingEnabled)) {
      watchRef.current?.remove();
      watchRef.current = null;
      if (recording?.status !== 'recording') return;
    }

    if (Platform.OS !== 'web' && backgroundTrackingEnabled) {
      void startPaceLocationUpdates().catch(() => {
        setBackgroundTrackingEnabled(false);
      });
      const interval = setInterval(() => {
        void getStoredPaceRecording().then((stored) => {
          if (stored?.status === 'recording') setRecording(stored);
        });
      }, 2_000);
      return () => clearInterval(interval);
    }

    let cancelled = false;
    void Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 10, timeInterval: 5_000 },
      (position) => {
        const point = { latitude: position.coords.latitude, longitude: position.coords.longitude, recordedAt: position.timestamp || Date.now() };
        setRecording((current) => {
          if (!current || current.status !== 'recording') return current;
          const updated = appendTrackedPoint(current, point);
          if (updated !== current) void savePaceRecording(updated);
          return updated;
        });
      },
    ).then((subscription) => {
      if (cancelled) subscription.remove();
      else watchRef.current = subscription;
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      watchRef.current?.remove();
      watchRef.current = null;
    };
  }, [backgroundTrackingEnabled, recording?.status]);

  useEffect(() => {
    if (recording?.status !== 'recording') return;
    const interval = setInterval(() => {
      setRecording((current) => {
        if (!current || current.status !== 'recording') return current;
        const updated = { ...current, elapsedSeconds: Math.max(current.elapsedSeconds, Math.floor((Date.now() - current.startedAt) / 1_000)) };
        void savePaceRecording(updated);
        return updated;
      });
    }, 1_000);
    return () => clearInterval(interval);
  }, [recording?.status, recording?.startedAt]);

  async function useLocation() {
    const result = permission?.granted ? permission : await requestPermission();
    if (!result.granted) {
      Alert.alert('Location stays private', 'Allow location access when you want Pace to suggest routes near you. You can still browse the community without it.');
      return;
    }
    try {
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
    } catch {
      Alert.alert('Location unavailable', 'Pace could not read your location. Try again when location services are available.');
    }
  }

  async function startRecording() {
    const result = permission?.granted ? permission : await requestPermission();
    if (!result.granted) {
      Alert.alert('Location is needed to record', 'Allow location access to record a route. Your route stays on this device until you choose to share it.');
      return;
    }
    try {
      let canTrackInBackground = false;
      if (Platform.OS !== 'web') {
        const backgroundPermission = await Location.getBackgroundPermissionsAsync();
        const backgroundResult = backgroundPermission.granted ? backgroundPermission : await Location.requestBackgroundPermissionsAsync();
        canTrackInBackground = backgroundResult.granted;
      }
      const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
      const now = Date.now();
      const next: PaceRecording = {
        id: `pace-${now}`,
        status: 'recording',
        startedAt: now,
        elapsedSeconds: 0,
        distanceKm: 0,
        points: [{ latitude: current.coords.latitude, longitude: current.coords.longitude, recordedAt: current.timestamp || now }],
      };
      setLocation({ latitude: current.coords.latitude, longitude: current.coords.longitude });
      await savePaceRecording(next);
      setBackgroundTrackingEnabled(canTrackInBackground);
      setRecording(next);
      if (Platform.OS !== 'web' && !canTrackInBackground) {
        Alert.alert('Background tracking is off', 'Pace will keep recording while Old Time is open. Allow background location in Settings to keep recording when your screen is locked.');
      }
    } catch {
      Alert.alert('Could not start tracking', 'Old Time could not get a reliable GPS fix. Try again outside with location services enabled.');
    }
  }

  async function pauseRecording() {
    if (!recording || recording.status !== 'recording') return;
    const paused = { ...recording, status: 'paused' as const, elapsedSeconds: Math.max(recording.elapsedSeconds, Math.floor((Date.now() - recording.startedAt) / 1_000)) };
    await savePaceRecording(paused);
    await stopPaceLocationUpdates().catch(() => undefined);
    setBackgroundTrackingEnabled(false);
    setRecording(paused);
  }

  async function resumeRecording() {
    if (!recording || recording.status !== 'paused') return;
    let canTrackInBackground = false;
    if (Platform.OS !== 'web') {
      canTrackInBackground = (await Location.getBackgroundPermissionsAsync()).granted;
    }
    const resumed = { ...recording, status: 'recording' as const, startedAt: Date.now() - recording.elapsedSeconds * 1_000 };
    await savePaceRecording(resumed);
    setBackgroundTrackingEnabled(canTrackInBackground);
    setRecording(resumed);
    if (Platform.OS !== 'web' && !canTrackInBackground) {
      Alert.alert('Background tracking is off', 'Pace will keep recording while Old Time is open. Allow background location in Settings to keep recording when your screen is locked.');
    }
  }

  async function finishRecording() {
    if (!recording || recording.status === 'finished') return;
    const finished = { ...recording, status: 'finished' as const, elapsedSeconds: recording.status === 'recording' ? Math.max(recording.elapsedSeconds, Math.floor((Date.now() - recording.startedAt) / 1_000)) : recording.elapsedSeconds };
    await savePaceRecording(finished);
    await stopPaceLocationUpdates().catch(() => undefined);
    setBackgroundTrackingEnabled(false);
    setRecording(finished);
    if (finished.points.length < 2 || finished.distanceKm < 0.01) {
      Alert.alert('Route is too short', 'Keep moving a little longer so Pace can create a useful route shape.');
    } else {
      setComposer(recordingAsSuggestion(finished));
    }
  }

  async function discardRecording() {
    if (recording) {
      await savePaceRecording({ ...recording, status: 'paused' });
    }
    await stopPaceLocationUpdates().catch(() => undefined);
    await clearPaceRecording();
    setBackgroundTrackingEnabled(false);
    setRecording(null);
  }

  function updateRoute(updated: PaceRoute) {
    setRoutes((items) => items.map((item) => item.id === updated.id ? updated : item));
  }

  function toggleLike(route: PaceRoute) {
    const liked = !route.viewer.liked;
    updateRoute({ ...route, viewer: { ...route.viewer, liked }, counts: { ...route.counts, likes: Math.max(0, route.counts.likes + (liked ? 1 : -1)) } });
    void setPaceRouteLike(session?.authToken ?? '', route.id, liked).catch(() => updateRoute(route));
  }

  function shareSuggestion(suggestion: PaceSuggestion) {
    setComposer(suggestion);
  }

  return (
    <Screen
      title={
        <View>
          <Text style={[styles.headerEyebrow, { color: colors.primary }]}>OLD TIME</Text>
          <Text style={[styles.headerTitle, { color: colors.foreground }]}>Pace</Text>
        </View>
      }
    >
      <FlatList
        data={routes}
        keyExtractor={(item) => String(item.id)}
        refreshing={refreshing}
        onRefresh={() => void load(true)}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        ListHeaderComponent={
          <View>
            <View style={[styles.hero, { backgroundColor: colors.foreground }]}>
              <View style={styles.heroCopy}>
                <Text style={styles.heroKicker}>MOVE WITH INTENTION</Text>
                <Text style={styles.heroTitle}>Find your next good route.</Text>
                <Text style={styles.heroText}>Local ideas, shared progress, and people who keep showing up.</Text>
              </View>
              <View style={styles.heroMark}><Ionicons name="footsteps-outline" size={30} color={colors.primaryForeground} /></View>
            </View>
            {!recordingLoading ? <PaceRecorderCard recording={recording} backgroundTrackingEnabled={backgroundTrackingEnabled} colors={colors} onStart={() => void startRecording()} onPause={() => void pauseRecording()} onResume={() => void resumeRecording()} onFinish={() => void finishRecording()} onShare={() => recording && setComposer(recordingAsSuggestion(recording))} onDiscard={() => void discardRecording()} /> : null}

            <View style={styles.sectionHeading}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Suggested for you</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>{location ? 'Based on your current area' : 'Set an area for local route ideas'}</Text>
              </View>
              <Pressable onPress={() => void useLocation()} style={[styles.locationAction, { borderColor: colors.border, backgroundColor: colors.card }]} accessibilityRole="button" accessibilityLabel="Use my location">
                <Ionicons name="navigate-outline" size={16} color={location ? colors.primary : colors.mutedForeground} />
                <Text style={[styles.locationActionText, { color: colors.foreground }]}>{location ? 'Nearby' : 'Set area'}</Text>
              </Pressable>
            </View>
            {suggestions.length ? (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionRow}>
                {suggestions.map((suggestion) => (
                  <SuggestedRouteCard key={suggestion.id} suggestion={suggestion} colors={colors} onShare={() => shareSuggestion(suggestion)} />
                ))}
              </ScrollView>
            ) : (
              <View style={[styles.locationPrompt, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Ionicons name="location-outline" size={22} color={colors.primary} />
                <View style={styles.flex}>
                  <Text style={[styles.promptTitle, { color: colors.foreground }]}>Unlock local route ideas</Text>
                  <Text style={[styles.promptText, { color: colors.mutedForeground }]}>{location ? 'Update your area anytime with the control above. Your exact location is never posted.' : 'Your exact location is never posted. Pace only uses it to shape nearby suggestions.'}</Text>
                </View>
              </View>
            )}

            <View style={styles.feedHeading}>
              <View>
                <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Pace community</Text>
                <Text style={[styles.sectionSubtitle, { color: colors.mutedForeground }]}>Routes worth leaving the house for</Text>
              </View>
              <Pressable onPress={() => suggestions[0] ? shareSuggestion(suggestions[0]) : void useLocation()} style={[styles.shareButton, { backgroundColor: colors.primary }]} accessibilityRole="button" accessibilityLabel="Share a route">
                <Ionicons name="add" size={17} color={colors.primaryForeground} />
                <Text style={[styles.shareButtonText, { color: colors.primaryForeground }]}>Share</Text>
              </Pressable>
            </View>
            {loading ? <View style={styles.loading}><ActivityIndicator color={colors.primary} /><Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Finding your pace…</Text></View> : null}
            {error ? <Pressable onPress={() => void load()} style={[styles.errorCard, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="cloud-offline-outline" size={18} color={colors.destructive} /><Text style={[styles.errorText, { color: colors.foreground }]}>{error} Tap to retry.</Text></Pressable> : null}
          </View>
        }
        ListEmptyComponent={!loading && !error ? <View style={styles.empty}><Ionicons name="map-outline" size={32} color={colors.primary} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>Be the first out there</Text><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>Share a route or challenge and give the community somewhere new to go.</Text></View> : null}
        renderItem={({ item }) => (
          <PaceRouteCard
            route={item}
            colors={colors}
            onLike={() => toggleLike(item)}
            onComments={() => setCommentsRoute(item)}
            onGift={() => setGiftRoute(item)}
          />
        )}
        ListFooterComponent={<View style={{ height: 26 }} />}
      />
      <RouteComposer
        visible={composer !== null}
        seed={composer}
        colors={colors}
        location={location}
        token={session?.authToken ?? ''}
        onClose={() => setComposer(null)}
        onCreated={async (route) => { await clearPaceRecording(); setRecording(null); setRoutes((items) => [route, ...items]); setComposer(null); }}
      />
      <PaceCommentsSheet
        route={commentsRoute}
        token={session?.authToken ?? ''}
        colors={colors}
        onClose={() => setCommentsRoute(null)}
      />
      <GiftSheet
        route={giftRoute}
        token={session?.authToken ?? ''}
        colors={colors}
        onClose={() => setGiftRoute(null)}
        onSent={(gift) => {
          if (giftRoute) updateRoute({ ...giftRoute, counts: { ...giftRoute.counts, gifts: giftRoute.counts.gifts + 1 } });
          setGiftRoute(null);
        }}
      />
    </Screen>
  );
}

function RouteThumbnail({ points, colors, large = false }: { points: PacePoint[]; colors: any; large?: boolean }) {
  const width = large ? 148 : 86;
  const height = large ? 104 : 76;
  const lats = points.map((point) => point.latitude);
  const lngs = points.map((point) => point.longitude);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);
  const minLng = Math.min(...lngs);
  const maxLng = Math.max(...lngs);
  const latSpan = Math.max(maxLat - minLat, 0.0001);
  const lngSpan = Math.max(maxLng - minLng, 0.0001);
  const coords = points.map((point) => `${12 + ((point.longitude - minLng) / lngSpan) * (width - 24)},${12 + (1 - (point.latitude - minLat) / latSpan) * (height - 24)}`).join(' ');
  const first = coords.split(' ')[0]?.split(',') ?? ['12', '12'];
  const last = coords.split(' ').at(-1)?.split(',') ?? first;
  return (
    <View style={[styles.routeThumbnail, { width, height, backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <Svg width={width} height={height}>
        <Polyline points={coords} fill="none" stroke={`${colors.primary}5C`} strokeWidth={9} strokeLinecap="round" strokeLinejoin="round" />
        <Polyline points={coords} fill="none" stroke={colors.primary} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" />
        <Circle cx={Number(first[0])} cy={Number(first[1])} r={4} fill={colors.foreground} />
        <Circle cx={Number(last[0])} cy={Number(last[1])} r={4} fill={colors.primary} />
      </Svg>
    </View>
  );
}

function SuggestedRouteCard({ suggestion, colors, onShare }: { suggestion: PaceSuggestion; colors: any; onShare: () => void }) {
  return (
    <View style={[styles.suggestionCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <RouteThumbnail points={suggestion.routeCoordinates} colors={colors} large />
      <View style={styles.suggestionBody}>
        <Text style={[styles.suggestionActivity, { color: colors.primary }]}>{ACTIVITY_LABELS[suggestion.activity].toUpperCase()} · {suggestion.locationLabel.toUpperCase()}</Text>
        <Text style={[styles.suggestionTitle, { color: colors.foreground }]} numberOfLines={1}>{suggestion.title}</Text>
        <Text style={[styles.suggestionMeta, { color: colors.mutedForeground }]}>{suggestion.distanceKm.toFixed(1)} km · {suggestion.durationMin} min · {DIFFICULTY_LABELS[suggestion.difficulty]}</Text>
        <Pressable onPress={onShare} style={[styles.suggestionButton, { backgroundColor: colors.foreground }]} accessibilityRole="button" accessibilityLabel={`Share ${suggestion.title}`}>
          <Ionicons name="arrow-up-outline" size={15} color={colors.background} />
          <Text style={[styles.suggestionButtonText, { color: colors.background }]}>Share route</Text>
        </Pressable>
      </View>
    </View>
  );
}

function PaceRecorderCard({ recording, backgroundTrackingEnabled, colors, onStart, onPause, onResume, onFinish, onShare, onDiscard }: { recording: PaceRecording | null; backgroundTrackingEnabled: boolean; colors: any; onStart: () => void; onPause: () => void; onResume: () => void; onFinish: () => void; onShare: () => void; onDiscard: () => void }) {
  const isActive = recording?.status === 'recording';
  const isPaused = recording?.status === 'paused';
  const isFinished = recording?.status === 'finished';
  const elapsed = recording?.elapsedSeconds ?? 0;
  const minutes = Math.floor(elapsed / 60);
  const seconds = elapsed % 60;
  return (
    <View style={[styles.recorderCard, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <View style={styles.recorderHeader}>
        <View style={[styles.recorderIcon, { backgroundColor: colors.primary }]}><Ionicons name={isActive ? 'radio-outline' : isFinished ? 'checkmark' : 'locate-outline'} size={19} color={colors.primaryForeground} /></View>
        <View style={styles.flex}>
          <Text style={[styles.recorderTitle, { color: colors.foreground }]}>{isFinished ? 'Route ready to share' : isPaused ? 'Route paused' : isActive ? 'Recording your route' : 'Record a route'}</Text>
          <Text style={[styles.recorderText, { color: colors.mutedForeground }]}>{isFinished ? 'Review the route and choose who can see it.' : isActive && Platform.OS !== 'web' && backgroundTrackingEnabled ? 'Recording continues if your screen locks. GPS stays on this device until you choose Share.' : 'GPS stays on this device until you choose Share.'}</Text>
        </View>
        {isActive ? <View style={[styles.liveDot, { backgroundColor: colors.destructive }]} /> : null}
      </View>
      {recording ? <View style={[styles.recorderStats, { borderTopColor: colors.border }]}>
        <View><Text style={[styles.recorderValue, { color: colors.foreground }]}>{recording.distanceKm.toFixed(2)} km</Text><Text style={[styles.recorderLabel, { color: colors.mutedForeground }]}>distance</Text></View>
        <View><Text style={[styles.recorderValue, { color: colors.foreground }]}>{minutes}:{String(seconds).padStart(2, '0')}</Text><Text style={[styles.recorderLabel, { color: colors.mutedForeground }]}>time</Text></View>
        <View><Text style={[styles.recorderValue, { color: colors.foreground }]}>{recording.points.length}</Text><Text style={[styles.recorderLabel, { color: colors.mutedForeground }]}>GPS points</Text></View>
      </View> : null}
      <View style={styles.recorderActions}>
        {!recording ? <Pressable onPress={onStart} style={[styles.recorderPrimary, { backgroundColor: colors.foreground }]}><Ionicons name="play" size={15} color={colors.background} /><Text style={[styles.recorderPrimaryText, { color: colors.background }]}>Start tracking</Text></Pressable> : null}
        {isActive ? <><Pressable onPress={onPause} style={[styles.recorderSecondary, { borderColor: colors.border }]}><Ionicons name="pause" size={15} color={colors.foreground} /><Text style={[styles.recorderSecondaryText, { color: colors.foreground }]}>Pause</Text></Pressable><Pressable onPress={onFinish} style={[styles.recorderPrimary, { backgroundColor: colors.foreground }]}><Ionicons name="stop" size={15} color={colors.background} /><Text style={[styles.recorderPrimaryText, { color: colors.background }]}>Finish</Text></Pressable></> : null}
        {isPaused ? <><Pressable onPress={onResume} style={[styles.recorderPrimary, { backgroundColor: colors.foreground }]}><Ionicons name="play" size={15} color={colors.background} /><Text style={[styles.recorderPrimaryText, { color: colors.background }]}>Resume</Text></Pressable><Pressable onPress={onFinish} style={[styles.recorderSecondary, { borderColor: colors.border }]}><Ionicons name="stop" size={15} color={colors.foreground} /><Text style={[styles.recorderSecondaryText, { color: colors.foreground }]}>Finish</Text></Pressable></> : null}
        {isFinished ? <><Pressable onPress={onShare} style={[styles.recorderPrimary, { backgroundColor: colors.primary }]}><Ionicons name="arrow-up-outline" size={15} color={colors.primaryForeground} /><Text style={[styles.recorderPrimaryText, { color: colors.primaryForeground }]}>Share route</Text></Pressable><Pressable onPress={onDiscard} style={[styles.recorderSecondary, { borderColor: colors.border }]}><Text style={[styles.recorderSecondaryText, { color: colors.foreground }]}>Discard</Text></Pressable></> : null}
      </View>
    </View>
  );
}

function PaceRouteCard({ route, colors, onLike, onComments, onGift }: { route: PaceRoute; colors: any; onLike: () => void; onComments: () => void; onGift: () => void }) {
  return (
    <View style={[styles.routeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
      <View style={styles.routeTop}>
        <View style={styles.authorRow}>
          <Avatar name={route.author.name} size={40} uri={route.author.avatarObjectPath ?? undefined} />
          <View style={styles.flex}>
            <Text style={[styles.authorName, { color: colors.foreground }]}>{route.author.name}</Text>
            <Text style={[styles.authorMeta, { color: colors.mutedForeground }]}>@{route.author.username} · {route.locationLabel}</Text>
          </View>
          <View style={[styles.kindPill, { backgroundColor: colors.secondary }]}><Text style={[styles.kindText, { color: colors.primary }]}>{route.kind === 'challenge' ? 'CHALLENGE' : 'ROUTE'}</Text></View>
        </View>
        <Text style={[styles.routeTitle, { color: colors.foreground }]}>{route.title}</Text>
        {route.description ? <Text style={[styles.routeDescription, { color: colors.mutedForeground }]}>{route.description}</Text> : null}
      </View>
      <View style={styles.routeDetailRow}>
        <RouteThumbnail points={route.routeCoordinates} colors={colors} large />
        <View style={styles.routeStats}>
          <Stat label="Distance" value={`${route.distanceKm.toFixed(1)} km`} colors={colors} />
          <Stat label="Time" value={`${route.durationMin} min`} colors={colors} />
          <Stat label="Climb" value={`${route.elevationM} m`} colors={colors} />
          <Stat label="Level" value={DIFFICULTY_LABELS[route.difficulty]} colors={colors} />
        </View>
      </View>
      <View style={[styles.routeActions, { borderTopColor: colors.border }]}>
        <Pressable onPress={onLike} style={styles.routeAction} accessibilityRole="button" accessibilityLabel={route.viewer.liked ? 'Unlike route' : 'Like route'}>
          <Ionicons name={route.viewer.liked ? 'heart' : 'heart-outline'} size={19} color={route.viewer.liked ? colors.destructive : colors.mutedForeground} />
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>{route.counts.likes}</Text>
        </Pressable>
        <Pressable onPress={onComments} style={styles.routeAction} accessibilityRole="button" accessibilityLabel="Open route comments">
          <Ionicons name="chatbubble-ellipses-outline" size={19} color={colors.mutedForeground} />
          <Text style={[styles.actionCount, { color: colors.mutedForeground }]}>{route.counts.comments}</Text>
        </Pressable>
        {!route.viewer.isOwner ? <Pressable onPress={onGift} style={[styles.giftAction, { backgroundColor: colors.primary }]} accessibilityRole="button" accessibilityLabel={`Send a gift to ${route.author.name}`}>
          <Ionicons name="gift-outline" size={17} color={colors.primaryForeground} />
          <Text style={[styles.giftActionText, { color: colors.primaryForeground }]}>Gift</Text>
          {route.counts.gifts > 0 ? <Text style={[styles.giftCount, { color: colors.primaryForeground }]}>{route.counts.gifts}</Text> : null}
        </Pressable> : <Text style={[styles.ownerLabel, { color: colors.mutedForeground }]}>Your shared route</Text>}
      </View>
    </View>
  );
}

function Stat({ label, value, colors }: { label: string; value: string; colors: any }) {
  return <View style={styles.stat}><Text style={[styles.statValue, { color: colors.foreground }]}>{value}</Text><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>{label}</Text></View>;
}

function RouteComposer({ visible, seed, colors, location, token, onClose, onCreated }: { visible: boolean; seed: PaceSuggestion | null; colors: any; location: Coordinate | null; token: string; onClose: () => void; onCreated: (route: PaceRoute) => void }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [kind, setKind] = useState<'route' | 'challenge'>('route');
  const [visibility, setVisibility] = useState<'public' | 'private'>('public');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setTitle(seed?.title ?? '');
    setDescription(seed?.description ?? '');
    setKind(seed?.kind ?? 'route');
    setVisibility(seed?.visibility ?? 'public');
  }, [seed]);

  async function submit() {
    if (!seed && !location) {
      Alert.alert('Choose an area first', 'Use your location so Pace can shape a route to share.');
      return;
    }
    const points = seed?.routeCoordinates ?? (location ? [{ ...location }, { latitude: location.latitude + 0.01, longitude: location.longitude + 0.01 }] : []);
    if (!title.trim() || points.length < 2) {
      Alert.alert('Finish your route', 'Add a title and a route shape before sharing.');
      return;
    }
    setSaving(true);
    try {
      const created = await createPaceRoute(token, {
        title: title.trim(),
        description: description.trim(),
        kind,
        visibility,
        activity: seed?.activity ?? 'run',
        difficulty: seed?.difficulty ?? 'steady',
        distanceKm: seed?.distanceKm ?? 1,
        elevationM: seed?.elevationM ?? 0,
        durationMin: seed?.durationMin ?? 12,
        startLatitude: points[0].latitude,
        startLongitude: points[0].longitude,
        locationLabel: seed?.locationLabel ?? 'My area',
        routeCoordinates: points,
      });
      onCreated(created);
    } catch (error) {
      Alert.alert('Route not shared', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSaving(false);
    }
  }

  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable style={StyleSheet.absoluteFill} onPress={Keyboard.dismiss} />
      <View style={[styles.modalCard, { backgroundColor: colors.background }]}>
        <View style={styles.modalHandle} />
        <View style={styles.modalHeader}><View><Text style={[styles.modalEyebrow, { color: colors.primary }]}>SHARE TO PACE</Text><Text style={[styles.modalTitle, { color: colors.foreground }]}>Put a route on the map.</Text></View><Pressable onPress={onClose} accessibilityLabel="Close route composer"><Ionicons name="close" size={24} color={colors.mutedForeground} /></Pressable></View>
        <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.modalContent}>
          <TextInput value={title} onChangeText={setTitle} placeholder="Route or challenge name" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
          <TextInput value={description} onChangeText={setDescription} placeholder="What should people know before they go?" placeholderTextColor={colors.mutedForeground} multiline style={[styles.input, styles.multilineInput, { color: colors.foreground, borderColor: colors.border, backgroundColor: colors.card }]} />
          <View style={styles.choiceRow}>
            {(['route', 'challenge'] as const).map((choice) => <Pressable key={choice} onPress={() => setKind(choice)} style={[styles.choice, { borderColor: kind === choice ? colors.primary : colors.border, backgroundColor: kind === choice ? colors.secondary : colors.card }]}><Ionicons name={choice === 'challenge' ? 'trophy-outline' : 'map-outline'} size={17} color={kind === choice ? colors.primary : colors.mutedForeground} /><Text style={[styles.choiceText, { color: kind === choice ? colors.primary : colors.mutedForeground }]}>{choice === 'challenge' ? 'Challenge' : 'Route'}</Text></Pressable>)}
          </View>
          <Text style={[styles.fieldLabel, { color: colors.foreground }]}>Who can see this route?</Text>
          <View style={styles.choiceRow}>
            {(['public', 'private'] as const).map((choice) => <Pressable key={choice} onPress={() => setVisibility(choice)} style={[styles.choice, { borderColor: visibility === choice ? colors.primary : colors.border, backgroundColor: visibility === choice ? colors.secondary : colors.card }]}><Ionicons name={choice === 'public' ? 'globe-outline' : 'lock-closed-outline'} size={16} color={visibility === choice ? colors.primary : colors.mutedForeground} /><Text style={[styles.choiceText, { color: visibility === choice ? colors.primary : colors.mutedForeground }]}>{choice === 'public' ? 'Community' : 'Only me'}</Text></Pressable>)}
          </View>
          <Text style={[styles.privacyNote, { color: colors.mutedForeground }]}>{visibility === 'public' ? 'The shared route shape and metrics will appear in the Pace community.' : 'The route will be saved to your Pace profile but hidden from the community.'}</Text>
          <View style={[styles.routePreviewLarge, { backgroundColor: colors.card, borderColor: colors.border }]}>{seed ? <><RouteThumbnail points={seed.routeCoordinates} colors={colors} large /><View style={styles.previewCopy}><Text style={[styles.previewTitle, { color: colors.foreground }]}>{seed.title}</Text><Text style={[styles.previewMeta, { color: colors.mutedForeground }]}>{seed.distanceKm.toFixed(1)} km · {seed.durationMin} min · {DIFFICULTY_LABELS[seed.difficulty]}</Text></View></> : <Text style={[styles.previewMeta, { color: colors.mutedForeground }]}>A simple local route will be shaped from your chosen area.</Text>}</View>
          <Pressable onPress={() => void submit()} disabled={saving} style={[styles.primaryButton, { backgroundColor: colors.primary, opacity: saving ? 0.6 : 1 }]}><Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>{saving ? 'Sharing…' : 'Share with the community'}</Text></Pressable>
        </ScrollView>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

function PaceCommentsSheet({ route, token, colors, onClose }: { route: PaceRoute | null; token: string; colors: any; onClose: () => void }) {
  const [comments, setComments] = useState<PaceComment[]>([]);
  const [draft, setDraft] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!route) return;
    setLoading(true);
    void getPaceComments(token, route.id).then((result) => setComments(result.items)).catch(() => setComments([])).finally(() => setLoading(false));
  }, [route?.id, token]);

  async function submit() {
    if (!route || !draft.trim() || sending) return;
    setSending(true);
    try {
      const comment = await createPaceComment(token, route.id, draft.trim());
      setComments((items) => [...items, comment]);
      setDraft('');
    } catch (error) {
      Alert.alert('Comment not posted', error instanceof Error ? error.message : 'Please try again.');
    } finally {
      setSending(false);
    }
  }

  return <Modal visible={route !== null} transparent animationType="slide" onRequestClose={onClose}>
    <KeyboardAvoidingView style={styles.modalBackdrop} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <View style={[styles.modalCard, { backgroundColor: colors.background, maxHeight: '82%' }]}>
        <View style={styles.modalHandle} />
        <View style={styles.modalHeader}><View><Text style={[styles.modalEyebrow, { color: colors.primary }]}>COMMUNITY</Text><Text style={[styles.modalTitle, { color: colors.foreground }]}>Route notes</Text></View><Pressable onPress={onClose} accessibilityLabel="Close route comments"><Ionicons name="close" size={24} color={colors.mutedForeground} /></Pressable></View>
        {loading ? <ActivityIndicator color={colors.primary} style={{ marginVertical: 28 }} /> : <FlatList data={comments} keyExtractor={(item) => String(item.id)} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.commentsList} ListEmptyComponent={<Text style={[styles.emptyComments, { color: colors.mutedForeground }]}>Be the first to leave a note for this route.</Text>} renderItem={({ item }) => <View style={[styles.commentRow, { borderBottomColor: colors.border }]}><Avatar name={item.author.name} size={32} /><View style={styles.flex}><Text style={[styles.commentAuthor, { color: colors.foreground }]}>{item.author.name} <Text style={{ color: colors.mutedForeground, fontWeight: '400' }}>@{item.author.username}</Text></Text><Text style={[styles.commentContent, { color: colors.foreground }]}>{item.content}</Text><Pressable onPress={() => { const active = !item.liked; setComments((items) => items.map((comment) => comment.id === item.id ? { ...comment, liked: active, likes: Math.max(0, comment.likes + (active ? 1 : -1)) } : comment)); void setPaceCommentLike(token, item.id, active); }} style={styles.commentLike}><Ionicons name={item.liked ? 'heart' : 'heart-outline'} size={14} color={item.liked ? colors.destructive : colors.mutedForeground} /><Text style={[styles.commentLikeText, { color: colors.mutedForeground }]}>{item.likes}</Text></Pressable></View></View>} />}
        <View style={[styles.commentComposer, { borderTopColor: colors.border }]}><TextInput value={draft} onChangeText={setDraft} placeholder="Add a route note…" placeholderTextColor={colors.mutedForeground} style={[styles.commentInput, { color: colors.foreground, backgroundColor: colors.card }]} /><Pressable onPress={() => void submit()} disabled={!draft.trim() || sending} style={[styles.commentSend, { backgroundColor: colors.primary, opacity: !draft.trim() || sending ? 0.5 : 1 }]}><Ionicons name="arrow-up" size={18} color={colors.primaryForeground} /></Pressable></View>
      </View>
    </KeyboardAvoidingView>
  </Modal>;
}

function GiftSheet({ route, token, colors, onClose, onSent }: { route: PaceRoute | null; token: string; colors: any; onClose: () => void; onSent: (gift: string) => void }) {
  const [sending, setSending] = useState<string | null>(null);
  async function send(gift: typeof GIFT_OPTIONS[number]['key']) {
    if (!route) return;
    setSending(gift);
    try {
      await sendPaceGift(token, route.id, gift);
      onSent(gift);
      Alert.alert('Gift sent', `Your ${GIFT_OPTIONS.find((item) => item.key === gift)?.label ?? 'gift'} helped celebrate this route.`);
    } catch (error) {
      Alert.alert('Gift not sent', error instanceof Error ? error.message : 'Check your Coin balance and try again.');
    } finally {
      setSending(null);
    }
  }
  return <Modal visible={route !== null} transparent animationType="slide" onRequestClose={onClose}>
    <View style={styles.modalBackdrop}><View style={[styles.modalCard, { backgroundColor: colors.background }]}>
      <View style={styles.modalHandle} />
      <View style={styles.modalHeader}><View><Text style={[styles.modalEyebrow, { color: colors.primary }]}>CELEBRATE THE EFFORT</Text><Text style={[styles.modalTitle, { color: colors.foreground }]}>Send a gift</Text></View><Pressable onPress={onClose} accessibilityLabel="Close gift picker"><Ionicons name="close" size={24} color={colors.mutedForeground} /></Pressable></View>
      <Text style={[styles.giftIntro, { color: colors.mutedForeground }]}>Use Coins to thank {route?.author.name ?? 'this member'} for sharing a route. They receive Gold.</Text>
      <View style={styles.giftGrid}>{GIFT_OPTIONS.map((item) => <Pressable key={item.key} onPress={() => void send(item.key)} disabled={sending !== null} style={[styles.giftTile, { backgroundColor: colors.card, borderColor: colors.border, opacity: sending && sending !== item.key ? 0.45 : 1 }]}><View style={[styles.giftIcon, { backgroundColor: colors.secondary }]}><Ionicons name={item.icon} size={22} color={colors.primary} /></View><Text style={[styles.giftLabel, { color: colors.foreground }]}>{sending === item.key ? 'Sending…' : item.label}</Text><Text style={[styles.giftPrice, { color: colors.mutedForeground }]}>{item.price.toLocaleString()} Coins</Text></Pressable>)}</View>
    </View></View>
  </Modal>;
}

const styles = StyleSheet.create({
  headerEyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.4 },
  headerTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.4, marginTop: 1 },
  content: { paddingHorizontal: 16, paddingTop: 16, paddingBottom: 110 },
  hero: { minHeight: 172, borderRadius: 25, padding: 21, flexDirection: 'row', justifyContent: 'space-between', overflow: 'hidden' },
  heroCopy: { flex: 1, paddingRight: 18 },
  heroKicker: { color: '#9FB9FF', fontSize: 10, fontWeight: '800', letterSpacing: 1.8 },
  heroTitle: { color: '#FFFFFF', fontSize: 27, lineHeight: 31, fontWeight: '800', letterSpacing: -0.8, marginTop: 10 },
  heroText: { color: '#CBD5E1', fontSize: 13, lineHeight: 18, marginTop: 9, maxWidth: 260 },
  heroMark: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(87,124,255,0.24)' },
  recorderCard: { borderRadius: 20, borderWidth: 1, padding: 14, marginTop: 14 },
  recorderHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  recorderIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  recorderTitle: { fontSize: 14, fontWeight: '800' },
  recorderText: { fontSize: 11, lineHeight: 15, marginTop: 3 },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  recorderStats: { borderTopWidth: StyleSheet.hairlineWidth, marginTop: 13, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between' },
  recorderValue: { fontSize: 16, fontWeight: '800' },
  recorderLabel: { fontSize: 10, marginTop: 2 },
  recorderActions: { flexDirection: 'row', gap: 8, marginTop: 13 },
  recorderPrimary: { minHeight: 38, borderRadius: 13, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  recorderPrimaryText: { fontSize: 12, fontWeight: '800' },
  recorderSecondary: { minHeight: 38, borderRadius: 13, borderWidth: 1, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  recorderSecondaryText: { fontSize: 12, fontWeight: '800' },
  sectionHeading: { marginTop: 26, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  locationAction: { flexDirection: 'row', alignItems: 'center', gap: 5, borderWidth: 1, borderRadius: 18, paddingHorizontal: 10, paddingVertical: 7 },
  locationActionText: { fontSize: 11, fontWeight: '700' },
  sectionTitle: { fontSize: 19, fontWeight: '800', letterSpacing: -0.35 },
  sectionSubtitle: { fontSize: 12, marginTop: 4 },
  suggestionRow: { gap: 12, paddingVertical: 14, paddingRight: 12 },
  suggestionCard: { width: 250, minHeight: 268, borderRadius: 21, borderWidth: 1, overflow: 'hidden' },
  suggestionBody: { padding: 13 },
  suggestionActivity: { fontSize: 9, fontWeight: '800', letterSpacing: 1.1 },
  suggestionTitle: { fontSize: 16, fontWeight: '800', marginTop: 5 },
  suggestionMeta: { fontSize: 11, marginTop: 5 },
  suggestionButton: { marginTop: 12, borderRadius: 13, minHeight: 35, paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  suggestionButtonText: { fontSize: 12, fontWeight: '800' },
  routeThumbnail: { overflow: 'hidden', borderWidth: 1, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
  locationPrompt: { minHeight: 76, borderRadius: 18, borderWidth: 1, paddingHorizontal: 14, marginTop: 14, flexDirection: 'row', alignItems: 'center', gap: 11 },
  promptTitle: { fontSize: 14, fontWeight: '800' },
  promptText: { fontSize: 11, lineHeight: 15, marginTop: 3 },
  flex: { flex: 1 },
  feedHeading: { marginTop: 18, marginBottom: 11, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  shareButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 11, paddingVertical: 8, borderRadius: 15 },
  shareButtonText: { fontSize: 12, fontWeight: '800' },
  loading: { paddingVertical: 34, alignItems: 'center', gap: 9 },
  loadingText: { fontSize: 13 },
  errorCard: { borderWidth: 1, borderRadius: 16, padding: 14, flexDirection: 'row', alignItems: 'center', gap: 9 },
  errorText: { flex: 1, fontSize: 13, lineHeight: 18 },
  empty: { alignItems: 'center', paddingVertical: 50, paddingHorizontal: 28 },
  emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: 13 },
  emptyText: { textAlign: 'center', fontSize: 13, lineHeight: 19, marginTop: 7 },
  routeCard: { borderRadius: 21, borderWidth: 1, padding: 15, marginBottom: 12 },
  routeTop: {},
  authorRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  authorName: { fontSize: 14, fontWeight: '800' },
  authorMeta: { fontSize: 11, marginTop: 3 },
  kindPill: { borderRadius: 10, paddingHorizontal: 8, paddingVertical: 5 },
  kindText: { fontSize: 9, fontWeight: '900', letterSpacing: 0.8 },
  routeTitle: { fontSize: 20, fontWeight: '800', letterSpacing: -0.35, marginTop: 17 },
  routeDescription: { fontSize: 13, lineHeight: 18, marginTop: 5 },
  routeDetailRow: { flexDirection: 'row', gap: 14, marginTop: 15 },
  routeStats: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', alignContent: 'center', rowGap: 13 },
  stat: { width: '50%' },
  statValue: { fontSize: 14, fontWeight: '800' },
  statLabel: { fontSize: 10, marginTop: 2 },
  routeActions: { marginTop: 15, paddingTop: 12, borderTopWidth: StyleSheet.hairlineWidth, flexDirection: 'row', alignItems: 'center', gap: 18 },
  routeAction: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  actionCount: { fontSize: 12, fontWeight: '700' },
  giftAction: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 7, borderRadius: 12, marginLeft: 'auto' },
  giftActionText: { fontSize: 12, fontWeight: '800' },
  giftCount: { fontSize: 11, fontWeight: '800', opacity: 0.85 },
  ownerLabel: { marginLeft: 'auto', fontSize: 11, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(7,12,20,0.48)' },
  modalCard: { borderTopLeftRadius: 27, borderTopRightRadius: 27, paddingTop: 10, paddingHorizontal: 18, paddingBottom: 28 },
  modalHandle: { width: 38, height: 4, borderRadius: 2, alignSelf: 'center', backgroundColor: '#AAB3C0', opacity: 0.6, marginBottom: 17 },
  modalHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  modalEyebrow: { fontSize: 9, fontWeight: '900', letterSpacing: 1.5 },
  modalTitle: { fontSize: 22, fontWeight: '800', letterSpacing: -0.45, marginTop: 4 },
  modalContent: { paddingTop: 18, paddingBottom: 8, gap: 12 },
  input: { minHeight: 50, borderRadius: 14, borderWidth: 1, paddingHorizontal: 14, fontSize: 14 },
  multilineInput: { minHeight: 88, paddingTop: 13, textAlignVertical: 'top' },
  choiceRow: { flexDirection: 'row', gap: 9 },
  choice: { flex: 1, minHeight: 44, borderRadius: 13, borderWidth: 1, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 6 },
  choiceText: { fontSize: 12, fontWeight: '800' },
  fieldLabel: { fontSize: 12, fontWeight: '800', marginTop: 2 },
  privacyNote: { fontSize: 11, lineHeight: 15, marginTop: -4 },
  routePreviewLarge: { borderRadius: 17, borderWidth: 1, padding: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  previewCopy: { flex: 1 },
  previewTitle: { fontSize: 14, fontWeight: '800' },
  previewMeta: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  primaryButton: { minHeight: 52, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginTop: 3 },
  primaryButtonText: { fontSize: 14, fontWeight: '800' },
  commentsList: { paddingTop: 11, paddingBottom: 8 },
  emptyComments: { textAlign: 'center', paddingVertical: 30, fontSize: 13 },
  commentRow: { flexDirection: 'row', gap: 9, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  commentAuthor: { fontSize: 12, fontWeight: '800' },
  commentContent: { fontSize: 13, lineHeight: 18, marginTop: 4 },
  commentLike: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 6, alignSelf: 'flex-start' },
  commentLikeText: { fontSize: 11, fontWeight: '700' },
  commentComposer: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 11, flexDirection: 'row', gap: 8, alignItems: 'center' },
  commentInput: { flex: 1, minHeight: 43, borderRadius: 15, paddingHorizontal: 13, fontSize: 13 },
  commentSend: { width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' },
  giftIntro: { fontSize: 13, lineHeight: 19, marginTop: 13, marginBottom: 16 },
  giftGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  giftTile: { width: '31.8%', minHeight: 104, borderRadius: 16, borderWidth: 1, alignItems: 'center', justifyContent: 'center', padding: 8 },
  giftIcon: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  giftLabel: { fontSize: 11, fontWeight: '800', marginTop: 6 },
  giftPrice: { fontSize: 9, marginTop: 3 },
});