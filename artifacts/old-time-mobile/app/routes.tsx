import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { useAuth } from '@/lib/auth';
import { useRouter } from 'expo-router';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Share, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RoutesMap from '@/components/RoutesMap';
import { useColors } from '@/hooks/useColors';
import { useOldTime } from '@/context/OldTimeContext';
import {
  caloriesBurned,
  elapsedSeconds,
  elevationGainMeters,
  emptyRoutesStore,
  formatDistance,
  formatDuration,
  formatPace,
  loadRoutesStore,
  makeRouteId,
  plannedRouteMetrics,
  routeActivityProfiles,
  routeActivityLabel,
  saveRoutesStore,
  type ActiveRoute,
  type FinishedRoute,
  type RouteActivity,
  type RouteChallenge,
  type RoutePoint,
  type RoutesStore,
} from '@/lib/routes-storage';
import { appendRoutePoint, isRouteGpsStale } from '@/lib/route-recording';
import { TAB_BAR_CONTENT_CLEARANCE } from '@/constants/layout';

const activityOptions: Array<{ key: RouteActivity; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { key: 'run', label: 'Run', icon: 'walk-outline' },
  { key: 'walk', label: 'Walk', icon: 'footsteps-outline' },
  { key: 'ride', label: 'Ride', icon: 'bicycle-outline' },
  { key: 'hike', label: 'Hike', icon: 'trail-sign-outline' },
  { key: 'skate', label: 'Skate', icon: 'accessibility-outline' },
];

type Panel = 'route' | 'challenges' | 'leaderboard';
type PlanPhase = 'calculating' | 'ready';

function routePoint(location: Location.LocationObject): RoutePoint {
  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    timestamp: location.timestamp,
    accuracy: location.coords.accuracy ?? null,
    speed: location.coords.speed ?? null,
    altitude: location.coords.altitude ?? null,
  };
}

function challengeProgress(challenge: RouteChallenge, routes: FinishedRoute[]) {
  return routes
    .filter((route) => route.activity === challenge.activity && route.finishedAt >= challenge.startsAt && route.finishedAt <= challenge.endsAt)
    .reduce((total, route) => total + route.distanceMeters, 0);
}

function weekStart() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() - date.getDay());
  return date.getTime();
}

export default function RoutesScreen() {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { userId } = useAuth();
  const { profile } = useOldTime();
  const [store, setStore] = useState<RoutesStore>(emptyRoutesStore);
  const [hydrated, setHydrated] = useState(false);
  const [activity, setActivity] = useState<RouteActivity>('run');
  const [panel, setPanel] = useState<Panel>('route');
  const [challengeOpen, setChallengeOpen] = useState(false);
  const [challengeTitle, setChallengeTitle] = useState('');
  const [challengeGoal, setChallengeGoal] = useState('10');
  const [challengeDays, setChallengeDays] = useState('7');
  const [planActivity, setPlanActivity] = useState<RouteActivity | null>(null);
  const [planPhase, setPlanPhase] = useState<PlanPhase>('calculating');
  const [planDistance, setPlanDistance] = useState('5');
  const [planWeight, setPlanWeight] = useState('70');
  const [planLocation, setPlanLocation] = useState<Location.LocationObject | null>(null);
  const [tick, setTick] = useState(Date.now());
  const activeRef = useRef<ActiveRoute | null>(null);
  const storeRef = useRef(store);

  useEffect(() => {
    if (!userId) {
      setStore(emptyRoutesStore);
      storeRef.current = emptyRoutesStore;
      setHydrated(true);
      return;
    }
    let cancelled = false;
    setHydrated(false);
    void loadRoutesStore(userId).then((next) => {
      if (cancelled) return;
      setStore(next);
      storeRef.current = next;
      activeRef.current = next.activeRoute;
      setPlanWeight(String(next.bodyWeightKg));
      setHydrated(true);
    });
    return () => { cancelled = true; };
  }, [userId]);

  const persist = (next: RoutesStore) => {
    storeRef.current = next;
    setStore(next);
    if (userId) void saveRoutesStore(userId, next);
  };

  useEffect(() => {
    activeRef.current = store.activeRoute;
  }, [store.activeRoute]);

  useEffect(() => {
    if (!store.activeRoute || store.activeRoute.status !== 'recording') return;
    const timer = setInterval(() => setTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [store.activeRoute?.status]);

  useEffect(() => {
    if (!store.activeRoute || store.activeRoute.status !== 'recording') return;
    let cancelled = false;
    let subscription: Location.LocationSubscription | null = null;
    void Location.watchPositionAsync(
      { accuracy: Location.Accuracy.BestForNavigation, distanceInterval: 3, timeInterval: 3000 },
      (location) => {
        if (cancelled) return;
        const current = activeRef.current;
        if (!current || current.status !== 'recording') return;
        const next = appendRoutePoint(current, routePoint(location));
        if (!next) return;
        activeRef.current = next;
        persist({ ...storeRef.current, activeRoute: next });
      },
    ).then((nextSubscription) => {
      if (cancelled) nextSubscription.remove();
      else subscription = nextSubscription;
    }).catch(() => undefined);
    return () => {
      cancelled = true;
      subscription?.remove();
    };
  }, [store.activeRoute?.status]);

  const currentElapsed = store.activeRoute ? elapsedSeconds(store.activeRoute, tick) : 0;
  const currentCoordinates = store.activeRoute?.coordinates ?? [];
  const gpsStale = isRouteGpsStale(store.activeRoute, tick);
  const latestFinished = store.finishedRoutes[0] ?? null;
  const currentDistance = store.activeRoute?.distanceMeters ?? latestFinished?.distanceMeters ?? 0;
  const currentActivity = store.activeRoute?.activity ?? latestFinished?.activity ?? activity;
  const currentElapsedForMetrics = store.activeRoute ? currentElapsed : latestFinished?.elapsedSeconds ?? 0;
  const currentElevation = store.activeRoute
    ? elevationGainMeters(store.activeRoute.coordinates)
    : latestFinished
      ? elevationGainMeters(latestFinished.coordinates)
      : 0;
  const currentCalories = caloriesBurned(currentActivity, currentElapsedForMetrics, store.bodyWeightKg);
  const plannedMetrics = useMemo(
    () => planActivity ? plannedRouteMetrics(planActivity, Number(planDistance) || 0, Number(planWeight) || store.bodyWeightKg) : null,
    [planActivity, planDistance, planWeight, store.bodyWeightKg],
  );
  const weekDistance = useMemo(
    () => store.finishedRoutes.filter((route) => route.finishedAt >= weekStart()).reduce((total, route) => total + route.distanceMeters, 0),
    [store.finishedRoutes],
  );
  const routeChallenges = useMemo(() => [...store.challenges].sort((a, b) => b.createdAt - a.createdAt), [store.challenges]);

  const startRoute = async (selectedActivity = activity) => {
    if (!userId || store.activeRoute) return;
    const permission = await Location.requestForegroundPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('Location stays off', 'Routes needs location access to record a real path. Nothing is recorded until you start a route.');
      return;
    }
    try {
      const position = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
      const now = Date.now();
      const firstPoint = routePoint(position);
      const next: ActiveRoute = {
        id: makeRouteId(),
        activity: selectedActivity,
        status: 'recording',
        startedAt: now,
        elapsedSeconds: 0,
        lastResumedAt: now,
        distanceMeters: 0,
        coordinates: [firstPoint],
        validation: firstPoint.accuracy !== null && firstPoint.accuracy > 80 ? 'needs_review' : 'pending',
      };
      activeRef.current = next;
      persist({ ...storeRef.current, activeRoute: next });
    } catch (error) {
      Alert.alert('Could not start Routes', error instanceof Error ? error.message : 'Your location could not be read.');
    }
  };

  const openPlan = (selectedActivity: RouteActivity) => {
    setActivity(selectedActivity);
    setPlanActivity(selectedActivity);
    setPlanDistance(String(routeActivityProfiles[selectedActivity].defaultDistanceKm));
    setPlanWeight(String(storeRef.current.bodyWeightKg));
    setPlanLocation(null);
    setPlanPhase('calculating');
  };

  useEffect(() => {
    if (!planActivity) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (!cancelled) setPlanPhase('ready');
    }, 950);
    void Location.getForegroundPermissionsAsync()
      .then(async (permission) => {
        if (!permission.granted) return;
        try {
          const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          if (!cancelled) setPlanLocation(location);
        } catch {
          // Starting a route requests permission again if GPS is unavailable during planning.
        }
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [planActivity]);

  const beginPlannedRoute = () => {
    if (!planActivity) return;
    const selectedActivity = planActivity;
    const distance = Number(planDistance);
    const weight = Number(planWeight);
    if (!Number.isFinite(distance) || distance < 0.5 || distance > 500) {
      Alert.alert('Check route distance', 'Choose a distance between 0.5 and 500 km.');
      return;
    }
    if (!Number.isFinite(weight) || weight < 30 || weight > 300) {
      Alert.alert('Check body weight', 'Enter a weight between 30 and 300 kg so calorie estimates stay meaningful.');
      return;
    }
    persist({ ...storeRef.current, bodyWeightKg: weight });
    setPlanActivity(null);
    void startRoute(selectedActivity);
  };

  const pauseRoute = () => {
    const current = activeRef.current;
    if (!current || current.status !== 'recording') return;
    const next: ActiveRoute = { ...current, status: 'paused', elapsedSeconds: elapsedSeconds(current), lastResumedAt: null };
    activeRef.current = next;
    persist({ ...storeRef.current, activeRoute: next });
  };

  const resumeRoute = () => {
    const current = activeRef.current;
    if (!current || current.status !== 'paused') return;
    const next: ActiveRoute = { ...current, status: 'recording', lastResumedAt: Date.now() };
    activeRef.current = next;
    persist({ ...storeRef.current, activeRoute: next });
  };

  const retryLocation = async () => {
    const current = activeRef.current;
    if (!current || current.status !== 'recording') return;
    try {
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.BestForNavigation });
      const next = appendRoutePoint(current, routePoint(location));
      if (!next) return;
      activeRef.current = next;
      persist({ ...storeRef.current, activeRoute: next });
      setTick(Date.now());
    } catch (error) {
      Alert.alert('GPS is still unavailable', error instanceof Error ? error.message : 'Keep the app open and try again in a moment.');
    }
  };

  const discardRoute = () => {
    Alert.alert('Discard this route?', 'The local recording will be deleted and will not appear in your activities.', [
      { text: 'Keep recording', style: 'cancel' },
      {
        text: 'Discard',
        style: 'destructive',
        onPress: () => {
          activeRef.current = null;
          persist({ ...storeRef.current, activeRoute: null });
        },
      },
    ]);
  };

  const finishRoute = () => {
    const current = activeRef.current;
    if (!current) return;
    const finalElapsed = elapsedSeconds(current);
    if (current.coordinates.length < 2 || current.distanceMeters < 10) {
      Alert.alert('Keep moving', 'Routes needs at least two GPS points and 10 meters before it can save an activity.');
      return;
    }
    const finished: FinishedRoute = {
      id: current.id,
      activity: current.activity,
      startedAt: current.startedAt,
      elapsedSeconds: finalElapsed,
      distanceMeters: current.distanceMeters,
      coordinates: current.coordinates,
      validation: current.validation === 'needs_review' ? 'needs_review' : 'verified',
      finishedAt: Date.now(),
      sharedAt: null,
    };
    const next = { ...storeRef.current, activeRoute: null, finishedRoutes: [finished, ...storeRef.current.finishedRoutes].slice(0, 40) };
    activeRef.current = null;
    persist(next);
    setPanel('route');
  };

  const createChallenge = () => {
    const goal = Number(challengeGoal);
    const days = Number(challengeDays);
    if (!challengeTitle.trim() || !Number.isFinite(goal) || goal <= 0 || !Number.isFinite(days) || days <= 0) {
      Alert.alert('Finish the challenge details', 'Add a name, a distance greater than zero, and a duration in days.');
      return;
    }
    const now = Date.now();
    const challenge: RouteChallenge = {
      id: makeRouteId(),
      title: challengeTitle.trim(),
      activity,
      targetDistanceMeters: goal * 1000,
      startsAt: now,
      endsAt: now + days * 86_400_000,
      createdAt: now,
    };
    persist({ ...storeRef.current, challenges: [challenge, ...storeRef.current.challenges] });
    setChallengeTitle('');
    setChallengeGoal('10');
    setChallengeDays('7');
    setChallengeOpen(false);
    setPanel('challenges');
  };

  const shareRoute = async (route: FinishedRoute) => {
    try {
      const elevation = Math.round(elevationGainMeters(route.coordinates));
      const calories = caloriesBurned(route.activity, route.elapsedSeconds, storeRef.current.bodyWeightKg);
      await Share.share({
        message: [
          `${routeActivityLabel(route.activity)} on Old Time Routes`,
          formatDistance(route.distanceMeters),
          formatDuration(route.elapsedSeconds),
          formatPace(route.elapsedSeconds, route.distanceMeters),
          `${calories} kcal`,
          `${elevation} m elevation`,
          'Recorded with real GPS.',
        ].join(' · '),
      });
      const updated = storeRef.current.finishedRoutes.map((item) => item.id === route.id ? { ...item, sharedAt: Date.now() } : item);
      persist({ ...storeRef.current, finishedRoutes: updated });
    } catch {
      Alert.alert('Could not share route', 'Please try again.');
    }
  };

  if (!hydrated) {
    return <View style={[styles.loading, { backgroundColor: colors.background }]}><Ionicons name="map-outline" size={30} color={colors.primary} /><Text style={[styles.loadingText, { color: colors.mutedForeground }]}>Loading your Routes…</Text></View>;
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: colors.border }]}>
        <Pressable onPress={() => router.back()} accessibilityRole="button" accessibilityLabel="Close Routes" style={styles.headerButton}><Ionicons name="chevron-back" size={24} color={colors.foreground} /></Pressable>
        <View style={styles.headerTitleWrap}><Text style={[styles.headerTitle, { color: colors.foreground }]}>Routes</Text><Text style={[styles.headerSubtitle, { color: colors.mutedForeground }]}>Real movement. Shared with intention.</Text></View>
        <Pressable onPress={() => setChallengeOpen(true)} accessibilityRole="button" accessibilityLabel="Start a challenge" style={[styles.headerButton, { backgroundColor: colors.secondary }]}><Ionicons name="flag-outline" size={20} color={colors.primary} /></Pressable>
      </View>

      <View style={[styles.panelRail, { borderBottomColor: colors.border }]}>
        {([{ key: 'route', label: 'Route' }, { key: 'challenges', label: 'Challenges' }, { key: 'leaderboard', label: 'Leaderboard' }] as const).map((item) => (
          <Pressable key={item.key} onPress={() => setPanel(item.key)} accessibilityRole="tab" accessibilityState={{ selected: panel === item.key }} style={styles.panelTab}>
            <Text style={[styles.panelTabText, { color: panel === item.key ? colors.foreground : colors.mutedForeground }]}>{item.label}</Text>
            <View style={[styles.panelLine, { backgroundColor: panel === item.key ? colors.primary : 'transparent' }]} />
          </Pressable>
        ))}
      </View>

      {panel === 'route' ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + TAB_BAR_CONTENT_CLEARANCE }]} showsVerticalScrollIndicator={false}>
          <View style={[styles.mapCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
            <RoutesMap coordinates={currentCoordinates} />
            <View style={[styles.mapBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Ionicons name={store.activeRoute ? 'radio' : 'map-outline'} size={14} color={store.activeRoute ? colors.primary : colors.mutedForeground} />
              <Text style={[styles.mapBadgeText, { color: colors.foreground }]}>{gpsStale ? 'GPS signal stale' : store.activeRoute ? 'GPS recording' : currentCoordinates.length ? 'Current route' : 'No route started'}</Text>
            </View>
          </View>

          <View style={[styles.statsCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
             <View><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Distance</Text><Text style={[styles.statValue, { color: colors.foreground }]}>{formatDistance(currentDistance)}</Text></View>
             <View><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Time</Text><Text style={[styles.statValue, { color: colors.foreground }]}>{formatDuration(currentElapsedForMetrics)}</Text></View>
             <View><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Pace</Text><Text style={[styles.statValue, { color: colors.foreground }]}>{formatPace(currentElapsedForMetrics, currentDistance)}</Text></View>
            <View><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>This week</Text><Text style={[styles.statValue, { color: colors.foreground }]}>{formatDistance(weekDistance)}</Text></View>
          </View>
           <View style={[styles.metricStrip, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
             <View style={styles.metricItem}><Ionicons name="flame-outline" size={17} color={colors.primary} /><Text style={[styles.metricValue, { color: colors.foreground }]}>{currentCalories} kcal</Text><Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>estimated burn</Text></View>
             <View style={styles.metricItem}><Ionicons name="trending-up-outline" size={17} color={colors.primary} /><Text style={[styles.metricValue, { color: colors.foreground }]}>{Math.round(currentElevation)} m</Text><Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>elevation gain</Text></View>
             <View style={styles.metricItem}><Ionicons name="pulse-outline" size={17} color={colors.primary} /><Text style={[styles.metricValue, { color: colors.foreground }]}>{store.activeRoute ? 'LIVE' : currentDistance ? 'READY' : 'IDLE'}</Text><Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>route state</Text></View>
           </View>

          {!store.activeRoute ? (
            <>
              <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Choose what you’re doing</Text>
              <Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>Routes records a real GPS path only after you start. Nothing here is simulated.</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activityRail}>
                {activityOptions.map((option) => <Pressable key={option.key} onPress={() => openPlan(option.key)} style={[styles.activityChip, { backgroundColor: activity === option.key ? colors.primary : colors.muted }]}><Ionicons name={option.icon} size={16} color={activity === option.key ? colors.primaryForeground : colors.foreground} /><Text style={{ color: activity === option.key ? colors.primaryForeground : colors.foreground, fontWeight: '800', fontSize: 12 }}>{option.label}</Text></Pressable>)}
              </ScrollView>
              <Pressable onPress={() => openPlan(activity)} style={[styles.primaryButton, { backgroundColor: colors.primary }]} accessibilityRole="button" accessibilityLabel={`Calculate ${activityOptions.find((option) => option.key === activity)?.label ?? activity} route`}><Ionicons name="analytics-outline" size={18} color={colors.primaryForeground} /><Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Calculate {routeActivityLabel(activity)} route</Text></Pressable>
            </>
          ) : (
            <View style={[styles.activeCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
               <View style={styles.activeHeader}><View style={styles.activeCopy}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{routeActivityLabel(store.activeRoute.activity)} in progress</Text><Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>{gpsStale ? 'GPS stopped updating. Distance is paused until a real location fix returns.' : store.activeRoute.validation === 'needs_review' ? 'GPS quality needs review before sharing.' : currentCoordinates.length > 1 && currentDistance < 3 ? 'GPS is locked. Keep moving for a measurable distance.' : currentCoordinates.length ? 'GPS is collecting your path.' : 'Waiting for a GPS fix.'}</Text></View><View style={[styles.liveDot, { backgroundColor: gpsStale || store.activeRoute.validation === 'needs_review' ? colors.destructive : colors.primary }]} /></View>
               {gpsStale ? <Pressable onPress={() => void retryLocation()} accessibilityRole="button" style={[styles.gpsRetry, { backgroundColor: colors.secondary, borderColor: colors.border }]}><Ionicons name="locate-outline" size={16} color={colors.primary} /><View style={styles.activeCopy}><Text style={[styles.gpsRetryTitle, { color: colors.foreground }]}>Try GPS again</Text><Text style={[styles.gpsRetryBody, { color: colors.mutedForeground }]}>Your timer keeps running; no distance is added without a new fix.</Text></View></Pressable> : null}
              <View style={styles.activeActions}><Pressable onPress={store.activeRoute.status === 'recording' ? pauseRoute : resumeRoute} style={[styles.secondaryAction, { borderColor: colors.border }]}><Ionicons name={store.activeRoute.status === 'recording' ? 'pause' : 'play'} size={16} color={colors.foreground} /><Text style={[styles.secondaryActionText, { color: colors.foreground }]}>{store.activeRoute.status === 'recording' ? 'Pause' : 'Resume'}</Text></Pressable><Pressable onPress={finishRoute} style={[styles.primaryAction, { backgroundColor: colors.primary }]}><Ionicons name="stop" size={16} color={colors.primaryForeground} /><Text style={[styles.primaryActionText, { color: colors.primaryForeground }]}>Finish</Text></Pressable></View>
              <Pressable onPress={discardRoute} accessibilityRole="button" accessibilityLabel="Discard route"><Text style={[styles.discardText, { color: colors.destructive }]}>Discard recording</Text></Pressable>
            </View>
          )}

          {latestFinished ? (
            <View style={[styles.latestCard, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <View style={styles.latestHeader}><View><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Latest activity</Text><Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>{routeActivityLabel(latestFinished.activity)} · {new Date(latestFinished.finishedAt).toLocaleDateString()}</Text></View><Text style={[styles.validation, { color: latestFinished.validation === 'verified' ? colors.primary : colors.destructive }]}>{latestFinished.validation === 'verified' ? 'Verified GPS' : 'Needs review'}</Text></View>
              <View style={styles.latestStats}><Text style={[styles.latestMetric, { color: colors.foreground }]}>{formatDistance(latestFinished.distanceMeters)}</Text><Text style={[styles.latestMetric, { color: colors.foreground }]}>{formatDuration(latestFinished.elapsedSeconds)}</Text><Text style={[styles.latestMetric, { color: colors.foreground }]}>{caloriesBurned(latestFinished.activity, latestFinished.elapsedSeconds, store.bodyWeightKg)} kcal</Text></View>
              <Pressable onPress={() => void shareRoute(latestFinished)} style={[styles.shareButton, { borderColor: colors.border }]}><Ionicons name="share-outline" size={16} color={colors.primary} /><Text style={[styles.shareButtonText, { color: colors.foreground }]}>{latestFinished.sharedAt ? 'Share again' : 'Share activity'}</Text></Pressable>
            </View>
          ) : null}
        </ScrollView>
      ) : panel === 'challenges' ? (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + TAB_BAR_CONTENT_CLEARANCE }]} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionIntro}><View><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Challenges you start</Text><Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>Set a distance, invite your people, and let real Routes progress the goal.</Text></View><Ionicons name="flag-outline" size={24} color={colors.primary} /></View>
          <Pressable onPress={() => setChallengeOpen(true)} style={[styles.primaryButton, { backgroundColor: colors.primary }]}><Ionicons name="add" size={19} color={colors.primaryForeground} /><Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Start a challenge</Text></Pressable>
          {routeChallenges.length ? routeChallenges.map((challenge) => {
            const progress = challengeProgress(challenge, store.finishedRoutes);
            const ratio = Math.min(1, progress / challenge.targetDistanceMeters);
            const expired = challenge.endsAt < Date.now();
            return <View key={challenge.id} style={[styles.challengeCard, { backgroundColor: colors.card, borderColor: colors.border }]}><View style={styles.challengeHeader}><View style={{ flex: 1 }}><Text style={[styles.challengeTitle, { color: colors.foreground }]}>{challenge.title}</Text><Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>{routeActivityLabel(challenge.activity)} · {expired ? 'Ended' : `Ends ${new Date(challenge.endsAt).toLocaleDateString()}`}</Text></View><Text style={[styles.challengePercent, { color: expired ? colors.mutedForeground : colors.primary }]}>{Math.round(ratio * 100)}%</Text></View><View style={[styles.progressTrack, { backgroundColor: colors.muted }]}><View style={[styles.progressFill, { backgroundColor: colors.primary, width: `${Math.max(2, ratio * 100)}%` }]} /></View><Text style={[styles.challengeMeta, { color: colors.mutedForeground }]}>{formatDistance(progress)} of {formatDistance(challenge.targetDistanceMeters)} · {expired ? 'No more progress can be added' : 'Your finished Routes count automatically'}</Text></View>;
          }) : <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="flag-outline" size={30} color={colors.mutedForeground} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No challenge started yet</Text><Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>Create one for your own goal or challenge friends when they join Old Time.</Text></View>}
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + TAB_BAR_CONTENT_CLEARANCE }]} showsVerticalScrollIndicator={false}>
          <View style={[styles.leaderboardHero, { backgroundColor: colors.secondary }]}><Ionicons name="trophy-outline" size={25} color={colors.primary} /><View style={{ flex: 1 }}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>Earn your place with verified movement</Text><Text style={[styles.sectionBody, { color: colors.foreground }]}>Routes never fills this board with invented athletes. Community ranks appear after people share real activities.</Text></View></View>
          <Text style={[styles.sectionTitle, { color: colors.foreground }]}>Your week</Text>
          <View style={[styles.myRankCard, { backgroundColor: colors.card, borderColor: colors.border }]}><View><Text style={[styles.statLabel, { color: colors.mutedForeground }]}>Current distance</Text><Text style={[styles.rankDistance, { color: colors.foreground }]}>{formatDistance(weekDistance)}</Text></View><Text style={[styles.rankNumber, { color: colors.mutedForeground }]}>Rank —</Text></View>
          <View style={[styles.emptyCard, { backgroundColor: colors.card, borderColor: colors.border }]}><Ionicons name="people-outline" size={30} color={colors.mutedForeground} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>No verified community entries yet</Text><Text style={[styles.sectionBody, { color: colors.mutedForeground }]}>Invite a friend and their finished, shared Route will appear here. No random names or fake mileage.</Text><Pressable onPress={() => void Share.share({ message: 'Join me on Old Time Routes and take on a real movement challenge.' })} style={[styles.shareButton, { borderColor: colors.border }]}><Ionicons name="person-add-outline" size={16} color={colors.primary} /><Text style={[styles.shareButtonText, { color: colors.foreground }]}>Invite friends</Text></Pressable></View>
          {profile && store.finishedRoutes.length ? <Text style={[styles.footerNote, { color: colors.mutedForeground }]}>@{profile.handle} · {store.finishedRoutes.length} finished {store.finishedRoutes.length === 1 ? 'Route' : 'Routes'}</Text> : null}
        </ScrollView>
      )}

      <Modal visible={Boolean(planActivity)} animationType="fade" onRequestClose={() => setPlanActivity(null)}>
        <View style={[styles.planRoot, { backgroundColor: colors.background, paddingTop: insets.top + 8, paddingBottom: insets.bottom + 12 }]}>
          <View style={styles.planHeader}>
            <Pressable onPress={() => setPlanActivity(null)} style={styles.headerButton} accessibilityRole="button" accessibilityLabel="Close route calculator"><Ionicons name="chevron-down" size={25} color={colors.foreground} /></Pressable>
            <View style={styles.planHeaderCenter}><Text style={[styles.planEyebrow, { color: colors.primary }]}>ROUTE INTELLIGENCE</Text><Text style={[styles.planTitle, { color: colors.foreground }]}>{planActivity ? routeActivityLabel(planActivity) : 'Route'}</Text></View>
            <View style={[styles.planSignal, { backgroundColor: planLocation ? colors.primary : colors.muted }]}><Ionicons name={planLocation ? 'locate' : 'locate-outline'} size={17} color={planLocation ? colors.primaryForeground : colors.mutedForeground} /></View>
          </View>

          <ScrollView contentContainerStyle={styles.planContent} showsVerticalScrollIndicator={false}>
            <View style={[styles.scanCard, { backgroundColor: colors.authInk, borderColor: colors.primary }]}>
              <View style={[styles.scanRings, { borderColor: colors.primary }]}><View style={[styles.scanRing, { borderColor: colors.primary }]} /><View style={[styles.scanRingInner, { borderColor: colors.secondary }]} /><Ionicons name={planActivity ? activityOptions.find((option) => option.key === planActivity)?.icon ?? 'pulse-outline' : 'pulse-outline'} size={30} color={colors.primary} /></View>
              <Text style={[styles.scanKicker, { color: colors.primary }]}>{planPhase === 'calculating' ? 'CALCULATING YOUR WINDOW' : 'ROUTE WINDOW READY'}</Text>
              <Text style={[styles.scanTitle, { color: colors.homeForeground }]}>{planPhase === 'calculating' ? 'Reading the variables' : 'Your activity has a plan'}</Text>
              <Text style={[styles.scanBody, { color: colors.homeMutedForeground }]}>{planPhase === 'calculating' ? 'Calibrating target pace, energy model, elevation budget, and GPS readiness.' : planLocation ? 'GPS lock found. Start when you are ready; only the live recording becomes a completed Route.' : 'No GPS lock yet. Start will request location and record the real path.'}</Text>
              <View style={[styles.scanProgressTrack, { backgroundColor: colors.homeBorder }]}><View style={[styles.scanProgressFill, { backgroundColor: colors.primary, width: planPhase === 'calculating' ? '58%' : '100%' }]} /></View>
              <Text style={[styles.scanStatus, { color: colors.homeMutedForeground }]}>{planLocation ? 'GPS LOCKED' : 'GPS READY ON START'} · {planPhase === 'calculating' ? 'ANALYZING' : 'CALIBRATED'}</Text>
            </View>

            {planPhase === 'ready' && plannedMetrics ? (
              <>
                <View style={styles.planInputs}>
                  <View style={styles.planInputWrap}><Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Target distance (km)</Text><TextInput value={planDistance} onChangeText={setPlanDistance} keyboardType="decimal-pad" style={[styles.planInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]} /></View>
                  <View style={styles.planInputWrap}><Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Body weight (kg)</Text><TextInput value={planWeight} onChangeText={setPlanWeight} keyboardType="decimal-pad" style={[styles.planInput, { color: colors.foreground, backgroundColor: colors.card, borderColor: colors.border }]} /></View>
                </View>
                <View style={[styles.planGrid, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={styles.planMetric}><Text style={[styles.planMetricLabel, { color: colors.mutedForeground }]}>ROUTE BUDGET</Text><Text style={[styles.planMetricValue, { color: colors.foreground }]}>{formatDistance(plannedMetrics.distanceMeters)}</Text><Text style={[styles.planMetricHint, { color: colors.mutedForeground }]}>estimated loop</Text></View>
                  <View style={styles.planMetric}><Text style={[styles.planMetricLabel, { color: colors.mutedForeground }]}>ETA</Text><Text style={[styles.planMetricValue, { color: colors.foreground }]}>{formatDuration(plannedMetrics.elapsedSeconds)}</Text><Text style={[styles.planMetricHint, { color: colors.mutedForeground }]}>target moving time</Text></View>
                  <View style={styles.planMetric}><Text style={[styles.planMetricLabel, { color: colors.mutedForeground }]}>ENERGY</Text><Text style={[styles.planMetricValue, { color: colors.foreground }]}>{plannedMetrics.calories} kcal</Text><Text style={[styles.planMetricHint, { color: colors.mutedForeground }]}>weight-adjusted estimate</Text></View>
                  <View style={styles.planMetric}><Text style={[styles.planMetricLabel, { color: colors.mutedForeground }]}>CLIMB</Text><Text style={[styles.planMetricValue, { color: colors.foreground }]}>{plannedMetrics.elevationMeters} m</Text><Text style={[styles.planMetricHint, { color: colors.mutedForeground }]}>terrain estimate</Text></View>
                </View>
                <View style={[styles.planRouteLine, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
                  <Ionicons name="git-branch-outline" size={20} color={colors.primary} />
                  <View style={{ flex: 1 }}><Text style={[styles.planRouteTitle, { color: colors.foreground }]}>Live route, shareable finish</Text><Text style={[styles.planRouteBody, { color: colors.mutedForeground }]}>The plan is only a target. When you finish, Old Time shares the recorded GPS path with pace, calories, elevation, and time.</Text></View>
                </View>
                <Pressable onPress={beginPlannedRoute} style={[styles.primaryButton, { backgroundColor: colors.primary }]} accessibilityRole="button" accessibilityLabel={`Start live ${planActivity} route`}><Ionicons name="radio" size={18} color={colors.primaryForeground} /><Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Start live {planActivity ? routeActivityLabel(planActivity) : 'route'}</Text></Pressable>
                <Pressable onPress={() => setPlanActivity(null)} style={styles.planCancel}><Text style={[styles.planCancelText, { color: colors.mutedForeground }]}>Adjust later</Text></Pressable>
              </>
            ) : <View style={styles.calculatingLines}><Text style={[styles.calculatingLine, { color: colors.mutedForeground }]}>› pace model / activity profile</Text><Text style={[styles.calculatingLine, { color: colors.mutedForeground }]}>› calorie model / body weight</Text><Text style={[styles.calculatingLine, { color: colors.mutedForeground }]}>› terrain model / elevation estimate</Text><Text style={[styles.calculatingLine, { color: colors.mutedForeground }]}>› device state / GPS readiness</Text></View>}
          </ScrollView>
        </View>
      </Modal>

      <Modal visible={challengeOpen} transparent animationType="slide" onRequestClose={() => setChallengeOpen(false)}>
        <View style={styles.modalRoot}><Pressable onPress={() => setChallengeOpen(false)} style={styles.modalShade} accessibilityRole="button" accessibilityLabel="Close challenge form" /><View style={[styles.sheet, { backgroundColor: colors.card, paddingBottom: insets.bottom + 18 }]}><View style={styles.sheetHandle} /><View style={styles.sheetHeader}><View><Text style={[styles.sheetEyebrow, { color: colors.primary }]}>NEW CHALLENGE</Text><Text style={[styles.sheetTitle, { color: colors.foreground }]}>Start something real</Text></View><Pressable onPress={() => setChallengeOpen(false)}><Ionicons name="close" size={24} color={colors.foreground} /></Pressable></View><TextInput value={challengeTitle} onChangeText={setChallengeTitle} placeholder="Challenge name" placeholderTextColor={colors.mutedForeground} style={[styles.formInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} maxLength={70} /><View style={styles.formRow}><View style={styles.formHalf}><Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Goal (km)</Text><TextInput value={challengeGoal} onChangeText={setChallengeGoal} keyboardType="decimal-pad" placeholder="10" placeholderTextColor={colors.mutedForeground} style={[styles.formInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /></View><View style={styles.formHalf}><Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Days</Text><TextInput value={challengeDays} onChangeText={setChallengeDays} keyboardType="number-pad" placeholder="7" placeholderTextColor={colors.mutedForeground} style={[styles.formInput, { color: colors.foreground, backgroundColor: colors.background, borderColor: colors.border }]} /></View></View><Text style={[styles.formLabel, { color: colors.mutedForeground }]}>Activity</Text><ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.activityRail}>{activityOptions.map((option) => <Pressable key={option.key} onPress={() => setActivity(option.key)} style={[styles.activityChip, { backgroundColor: activity === option.key ? colors.primary : colors.muted }]}><Text style={{ color: activity === option.key ? colors.primaryForeground : colors.foreground, fontWeight: '800', fontSize: 12 }}>{option.label}</Text></Pressable>)}</ScrollView><Pressable onPress={createChallenge} style={[styles.primaryButton, { backgroundColor: colors.primary }]}><Text style={[styles.primaryButtonText, { color: colors.primaryForeground }]}>Create challenge</Text></Pressable></View></View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10 },
  loadingText: { fontFamily: 'Outfit_500Medium', fontSize: 14 },
  header: { minHeight: 72, borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerButton: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  headerTitleWrap: { flex: 1, alignItems: 'center' },
  headerTitle: { fontFamily: 'Fraunces_900Black', fontSize: 21 },
  headerSubtitle: { fontFamily: 'Outfit_500Medium', fontSize: 10, marginTop: 2 },
  panelRail: { flexDirection: 'row', borderBottomWidth: StyleSheet.hairlineWidth, paddingHorizontal: 14 },
  panelTab: { flex: 1, alignItems: 'center' },
  panelTabText: { fontFamily: 'Outfit_700Bold', fontSize: 13, paddingVertical: 12 },
  panelLine: { height: 2, width: 30, borderRadius: 2 },
  content: { padding: 16, gap: 13 },
  mapCard: { height: 250, borderWidth: 1, borderRadius: 20, overflow: 'hidden', position: 'relative' },
  mapBadge: { position: 'absolute', left: 12, top: 12, borderWidth: 1, borderRadius: 15, paddingHorizontal: 10, height: 30, flexDirection: 'row', alignItems: 'center', gap: 6 },
  mapBadgeText: { fontFamily: 'Outfit_700Bold', fontSize: 11 },
  statsCard: { borderWidth: 1, borderRadius: 18, padding: 14, flexDirection: 'row', justifyContent: 'space-between' },
  statLabel: { fontFamily: 'Outfit_600SemiBold', fontSize: 11 },
  statValue: { fontFamily: 'Fraunces_900Black', fontSize: 20, marginTop: 4 },
  metricStrip: { borderWidth: 1, borderRadius: 18, padding: 13, flexDirection: 'row', justifyContent: 'space-between' },
  metricItem: { flex: 1, gap: 2 },
  metricValue: { fontFamily: 'Outfit_700Bold', fontSize: 13, marginTop: 2 },
  metricLabel: { fontFamily: 'Outfit_500Medium', fontSize: 9 },
  sectionIntro: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  sectionTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 17 },
  sectionBody: { fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 18, marginTop: 4 },
  activityRail: { gap: 8, paddingVertical: 2 },
  activityChip: { minHeight: 37, borderRadius: 19, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 6 },
  primaryButton: { minHeight: 50, borderRadius: 25, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingHorizontal: 18 },
  primaryButtonText: { fontFamily: 'Outfit_700Bold', fontSize: 15 },
  activeCard: { borderWidth: 1, borderRadius: 18, padding: 15, gap: 14 },
  activeHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  activeCopy: { flex: 1 },
  liveDot: { width: 11, height: 11, borderRadius: 6, marginTop: 5 },
  gpsRetry: { minHeight: 54, borderWidth: 1, borderRadius: 14, paddingHorizontal: 12, paddingVertical: 9, flexDirection: 'row', alignItems: 'center', gap: 10 },
  gpsRetryTitle: { fontFamily: 'Outfit_700Bold', fontSize: 13 },
  gpsRetryBody: { fontFamily: 'Outfit_400Regular', fontSize: 10, lineHeight: 15, marginTop: 2 },
  activeActions: { flexDirection: 'row', gap: 9 },
  secondaryAction: { flex: 1, minHeight: 46, borderWidth: 1, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  secondaryActionText: { fontFamily: 'Outfit_700Bold', fontSize: 14 },
  primaryAction: { flex: 1, minHeight: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  primaryActionText: { fontFamily: 'Outfit_700Bold', fontSize: 14 },
  discardText: { alignSelf: 'center', fontFamily: 'Outfit_600SemiBold', fontSize: 12 },
  latestCard: { borderWidth: 1, borderRadius: 18, padding: 15, gap: 12 },
  latestHeader: { flexDirection: 'row', justifyContent: 'space-between', gap: 10 },
  validation: { fontFamily: 'Outfit_700Bold', fontSize: 11 },
  latestStats: { flexDirection: 'row', gap: 26 },
  latestMetric: { fontFamily: 'Fraunces_900Black', fontSize: 22 },
  shareButton: { minHeight: 42, borderRadius: 21, borderWidth: 1, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center', flexDirection: 'row', gap: 7 },
  shareButtonText: { fontFamily: 'Outfit_700Bold', fontSize: 13 },
  challengeCard: { borderWidth: 1, borderRadius: 18, padding: 15, gap: 10 },
  challengeHeader: { flexDirection: 'row', alignItems: 'flex-start', gap: 10 },
  challengeTitle: { fontFamily: 'Outfit_700Bold', fontSize: 16 },
  challengePercent: { fontFamily: 'Fraunces_900Black', fontSize: 17 },
  progressTrack: { height: 8, borderRadius: 4, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: 4 },
  challengeMeta: { fontFamily: 'Outfit_500Medium', fontSize: 11 },
  emptyCard: { borderWidth: 1, borderRadius: 18, padding: 22, alignItems: 'center', gap: 6 },
  emptyTitle: { fontFamily: 'Fraunces_700Bold', fontSize: 16, textAlign: 'center' },
  leaderboardHero: { borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'flex-start', gap: 11 },
  myRankCard: { borderWidth: 1, borderRadius: 18, padding: 15, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  rankDistance: { fontFamily: 'Fraunces_900Black', fontSize: 26, marginTop: 4 },
  rankNumber: { fontFamily: 'Fraunces_900Black', fontSize: 14 },
  footerNote: { textAlign: 'center', fontFamily: 'Outfit_500Medium', fontSize: 11 },
  planRoot: { flex: 1 },
  planHeader: { minHeight: 54, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  planHeaderCenter: { alignItems: 'center', flex: 1 },
  planEyebrow: { fontFamily: 'Outfit_700Bold', fontSize: 9, letterSpacing: 1.7 },
  planTitle: { fontFamily: 'Fraunces_900Black', fontSize: 20, marginTop: 2 },
  planSignal: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  planContent: { padding: 18, gap: 15 },
  scanCard: { minHeight: 292, borderRadius: 24, borderWidth: 1, padding: 22, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  scanRings: { width: 116, height: 116, borderRadius: 58, alignItems: 'center', justifyContent: 'center', borderWidth: 1, marginBottom: 18 },
  scanRing: { position: 'absolute', width: 86, height: 86, borderRadius: 43, borderWidth: 1, opacity: 0.75 },
  scanRingInner: { position: 'absolute', width: 58, height: 58, borderRadius: 29, borderWidth: 1, opacity: 0.9 },
  scanKicker: { fontFamily: 'Outfit_700Bold', fontSize: 10, letterSpacing: 1.8 },
  scanTitle: { fontFamily: 'Fraunces_900Black', fontSize: 25, marginTop: 7, textAlign: 'center' },
  scanBody: { fontFamily: 'Outfit_400Regular', fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 8, maxWidth: 285 },
  scanProgressTrack: { width: '100%', height: 5, borderRadius: 3, marginTop: 22, overflow: 'hidden' },
  scanProgressFill: { height: '100%', borderRadius: 3 },
  scanStatus: { fontFamily: 'Outfit_700Bold', fontSize: 9, letterSpacing: 1.1, marginTop: 10 },
  planInputs: { flexDirection: 'row', gap: 10 },
  planInputWrap: { flex: 1 },
  planInput: { minHeight: 48, borderWidth: 1, borderRadius: 14, paddingHorizontal: 13, fontFamily: 'Outfit_700Bold', fontSize: 15 },
  planGrid: { borderWidth: 1, borderRadius: 18, padding: 13, flexDirection: 'row', flexWrap: 'wrap', gap: 13 },
  planMetric: { width: '45%', gap: 2 },
  planMetricLabel: { fontFamily: 'Outfit_700Bold', fontSize: 9, letterSpacing: 0.8 },
  planMetricValue: { fontFamily: 'Fraunces_900Black', fontSize: 18, marginTop: 3 },
  planMetricHint: { fontFamily: 'Outfit_500Medium', fontSize: 10 },
  planRouteLine: { borderWidth: 1, borderRadius: 17, padding: 14, flexDirection: 'row', gap: 11, alignItems: 'flex-start' },
  planRouteTitle: { fontFamily: 'Outfit_700Bold', fontSize: 14 },
  planRouteBody: { fontFamily: 'Outfit_400Regular', fontSize: 11, lineHeight: 17, marginTop: 4 },
  planCancel: { alignItems: 'center', paddingVertical: 5 },
  planCancelText: { fontFamily: 'Outfit_700Bold', fontSize: 12 },
  calculatingLines: { paddingHorizontal: 8, gap: 9 },
  calculatingLine: { fontFamily: 'Outfit_700Bold', fontSize: 12, letterSpacing: 0.3 },
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  modalShade: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(17,17,17,0.42)' },
  sheet: { borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingHorizontal: 18, paddingTop: 10 },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#d7d0c8', marginBottom: 12 },
  sheetHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  sheetEyebrow: { fontFamily: 'Outfit_700Bold', fontSize: 10, letterSpacing: 1.2, marginBottom: 4 },
  sheetTitle: { fontFamily: 'Fraunces_900Black', fontSize: 23 },
  formInput: { minHeight: 48, borderWidth: 1, borderRadius: 15, paddingHorizontal: 14, fontFamily: 'Outfit_400Regular', fontSize: 14, marginBottom: 10 },
  formRow: { flexDirection: 'row', gap: 10 },
  formHalf: { flex: 1 },
  formLabel: { fontFamily: 'Outfit_700Bold', fontSize: 11, marginTop: 4, marginBottom: 7 },
});