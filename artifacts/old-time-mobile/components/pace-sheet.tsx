import { Ionicons } from "@expo/vector-icons";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Svg, Polyline } from "react-native-svg";
import * as Location from "expo-location";
import {
  appendPacePoints,
  createPaceActivity,
  discardPaceActivity,
  finishPaceActivity,
  getPaceHistory,
  getPaceHome,
  pausePaceActivity,
  type PaceActivity,
  type PaceActivityType,
  type PacePoint,
  type PaceVisibility,
  resumePaceActivity,
} from "@/lib/pace-api";
import {
  appendCompletedLocalActivity,
  consumeUploadBatch,
  createTrackingSession,
  deriveLiveMetrics,
  ensureTrackingPermission,
  loadCompletedLocalActivities,
  loadActiveTrackingSession,
  pauseSession,
  resumeSession,
  saveActiveTrackingSession,
  startLocationWatch,
  takePendingPointBatches,
  updateSessionWithPoint,
  type PaceTrackingSession,
} from "@/lib/pace-tracking";

type Screen = "home" | "select" | "pre" | "live" | "summary" | "history";

const ACTIVITY_OPTIONS: Array<{ id: PaceActivityType; label: string; icon: keyof typeof Ionicons.glyphMap }> = [
  { id: "running", label: "Running", icon: "walk" },
  { id: "walking", label: "Walking", icon: "footsteps" },
  { id: "cycling", label: "Cycling", icon: "bicycle" },
  { id: "hiking", label: "Hiking", icon: "trail-sign" },
  { id: "jogging", label: "Jogging", icon: "fitness" },
  { id: "other", label: "Other", icon: "ellipsis-horizontal" },
];

function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const hh = Math.floor(s / 3600);
  const mm = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  if (hh > 0) return `${hh}:${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  return `${mm}:${String(ss).padStart(2, "0")}`;
}

function formatMiles(meters: number): string {
  return `${(meters / 1609.344).toFixed(2)} mi`;
}

function formatSpeedMph(mps: number): string {
  return `${(mps * 2.23694).toFixed(1)} mph`;
}

function formatPaceSecPerKm(pace: number): string {
  if (!pace || !Number.isFinite(pace)) return "--:-- /mi";
  const perMile = pace * 1.609344;
  const minutes = Math.floor(perMile / 60);
  const seconds = Math.round(perMile % 60);
  return `${minutes}:${String(seconds).padStart(2, "0")} /mi`;
}

function RoutePreview({ points }: { points: Array<{ latitude: number; longitude: number }> }) {
  const coordinates = useMemo(() => {
    if (points.length < 2) return "";
    const latitudes = points.map((point) => point.latitude);
    const longitudes = points.map((point) => point.longitude);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLon = Math.min(...longitudes);
    const maxLon = Math.max(...longitudes);
    const latSpan = Math.max(0.00001, maxLat - minLat);
    const lonSpan = Math.max(0.00001, maxLon - minLon);
    return points.map((point) => {
      const x = 12 + ((point.longitude - minLon) / lonSpan) * 296;
      const y = 108 - ((point.latitude - minLat) / latSpan) * 96;
      return `${x},${y}`;
    }).join(" ");
  }, [points]);
  return (
    <View style={styles.routeCard}>
      <Text style={styles.routeTitle}>Route</Text>
      <Svg width="320" height="120">
        <Polyline points={coordinates} fill="none" stroke="#4C63F5" strokeWidth="3" />
      </Svg>
      {points.length < 2 ? <Text style={styles.routeHint}>Move to start drawing your route.</Text> : null}
    </View>
  );
}

export default function PaceSheet({
  visible,
  token,
  colors,
  onClose,
}: {
  visible: boolean;
  token: string;
  colors: any;
  onClose: () => void;
}) {
  const insets = useSafeAreaInsets();
  const [screen, setScreen] = useState<Screen>("home");
  const [selectedType, setSelectedType] = useState<PaceActivityType>("running");
  const [visibility, setVisibility] = useState<PaceVisibility>("followers");
  const [autoPauseEnabled, setAutoPauseEnabled] = useState(true);
  const [voiceAnnouncementsEnabled, setVoiceAnnouncementsEnabled] = useState(false);
  const [hideStartEnd, setHideStartEnd] = useState(true);
  const [privacyRadiusMeters, setPrivacyRadiusMeters] = useState(120);
  const [equipment, setEquipment] = useState("");
  const [gpsStatus, setGpsStatus] = useState("GPS: Searching…");
  const [permissionGranted, setPermissionGranted] = useState(false);
  const [session, setSession] = useState<PaceTrackingSession | null>(null);
  const [currentActivity, setCurrentActivity] = useState<PaceActivity | null>(null);
  const [homeLoading, setHomeLoading] = useState(false);
  const [homeData, setHomeData] = useState<Awaited<ReturnType<typeof getPaceHome>> | null>(null);
  const [historyItems, setHistoryItems] = useState<PaceActivity[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [caption, setCaption] = useState("");
  const [busy, setBusy] = useState(false);
  const [offlineWarning, setOfflineWarning] = useState<string | null>(null);
  const [localCompletedCount, setLocalCompletedCount] = useState(0);
  const watchRef = useRef<Location.LocationSubscription | null>(null);
  const movingRef = useRef<number>(Date.now());

  const metrics = useMemo(() => (session ? deriveLiveMetrics(session) : {
    distanceMeters: 0,
    elapsedTimeSec: 0,
    movingTimeSec: 0,
    averageSpeedMps: 0,
    averagePaceSecPerKm: 0,
    currentSpeedMps: 0,
  }), [session]);
  const displayPaceSecPerKm = metrics.currentSpeedMps > 0 ? 1000 / metrics.currentSpeedMps : metrics.averagePaceSecPerKm;

  const commitSession = useCallback((next: PaceTrackingSession | null) => {
    setSession(next);
    void saveActiveTrackingSession(next);
  }, []);

  const stopWatch = useCallback(() => {
    if (watchRef.current) {
      watchRef.current.remove();
      watchRef.current = null;
    }
  }, []);

  const flushPending = useCallback(async (sessionState: PaceTrackingSession): Promise<PaceTrackingSession> => {
    if (!token || !sessionState.activityId || sessionState.pendingPoints.length === 0) return sessionState;
    let nextSession = sessionState;
    for (const batch of takePendingPointBatches(nextSession, 80)) {
      try {
        const result = await appendPacePoints(token, nextSession.activityId!, batch, "uploading");
        nextSession = consumeUploadBatch(
          nextSession,
          result.acceptedSequences.length ? result.acceptedSequences : batch.map((point) => point.sequence),
        );
        setOfflineWarning(null);
      } catch {
        setOfflineWarning("You’re offline. Your activity is being saved on this device.");
        return { ...nextSession, syncStatus: "failed" as const };
      }
    }
    return nextSession;
  }, [token]);

  const loadHome = useCallback(async () => {
    if (!token) return;
    setHomeLoading(true);
    try {
      const [remote, local] = await Promise.all([getPaceHome(token), loadCompletedLocalActivities()]);
      setHomeData(remote);
      setLocalCompletedCount(local.length);
    } catch {
      setHomeData(null);
    } finally {
      setHomeLoading(false);
    }
  }, [token]);

  const loadHistory = useCallback(async () => {
    if (!token) return;
    setHistoryLoading(true);
    try {
      const result = await getPaceHistory(token, { limit: 40 });
      setHistoryItems(result.items);
    } catch {
      setHistoryItems([]);
    } finally {
      setHistoryLoading(false);
    }
  }, [token]);

  useEffect(() => {
    if (!visible) return;
    void loadHome();
    void loadActiveTrackingSession().then((saved) => {
      if (!saved) return;
      void (async () => {
        let recovered = saved;
        if (!recovered.activityId && token) {
          try {
            const created = await createPaceActivity(token, {
              activityUuid: recovered.activityUuid,
              activityType: recovered.activityType,
              visibility: recovered.visibility,
              autoPauseEnabled: recovered.autoPauseEnabled,
              voiceAnnouncementsEnabled: recovered.voiceAnnouncementsEnabled,
              hideStartEnd: recovered.hideStartEnd,
              privacyRadiusMeters: recovered.privacyRadiusMeters,
              startedAt: recovered.startedAt,
            });
            recovered = { ...recovered, activityId: created.id };
            await saveActiveTrackingSession(recovered);
          } catch {
            // Keep local session; user can still avoid data loss even if sync is unavailable.
          }
        }
        setSession(recovered);
        setScreen("live");
      })();
    });
  }, [visible, loadHome, token]);

  const handleIncomingPoint = useCallback((point: Omit<PacePoint, "sequence">) => {
    setSession((current) => {
      if (!current) return current;
      if (current.manualPaused) return current;
      const speed = typeof point.speed === "number" ? point.speed : 0;
      const now = Date.now();
      let working = current;
      if (speed > 0.75) {
        movingRef.current = now;
        if (working.autoPaused && working.autoPauseEnabled) {
          const resumed = resumeSession(working);
          if (resumed.activityId) {
            void resumePaceActivity(token, resumed.activityId, resumed.syncStatus).catch(() => undefined);
          }
          void saveActiveTrackingSession(resumed);
          working = resumed;
        }
      }
      let next = updateSessionWithPoint(working, point);
      if (next.autoPauseEnabled && !next.autoPaused && now - movingRef.current > 30000) {
        next = pauseSession(next, true);
        if (next.activityId) {
          void pausePaceActivity(token, next.activityId, next.syncStatus).catch(() => undefined);
        }
      }
      void saveActiveTrackingSession(next);
      void flushPending(next).then((updated) => {
        if (updated.activityUuid !== next.activityUuid) return;
        setSession((latest) => (latest?.activityUuid === updated.activityUuid ? updated : latest));
        void saveActiveTrackingSession(updated);
      });
      return next;
    });
  }, [flushPending, token]);

  const ensureWatcher = useCallback(async () => {
    if (watchRef.current || !session || session.manualPaused || session.autoPaused) return;
    watchRef.current = await startLocationWatch(
      handleIncomingPoint,
      (message) => {
        setOfflineWarning(message);
      },
    );
  }, [handleIncomingPoint, session]);

  useEffect(() => {
    if (!visible || screen !== "live") return;
    void ensureWatcher();
  }, [ensureWatcher, screen, visible]);

  useEffect(() => {
    if (!session) return;
    if (session.manualPaused || session.autoPaused) {
      stopWatch();
      return;
    }
    if (visible && screen === "live") {
      void ensureWatcher();
    }
  }, [ensureWatcher, screen, session, stopWatch, visible]);

  useEffect(() => () => stopWatch(), [stopWatch]);

  useEffect(() => {
    if (!session || session.manualPaused || session.autoPaused) return;
    const timer = setInterval(() => {
      setSession((current) => (current ? { ...current } : current));
    }, 1000);
    return () => clearInterval(timer);
  }, [session]);

  useEffect(() => {
    if (!visible || screen !== "pre") return;
    void (async () => {
      const permission = await ensureTrackingPermission();
      setPermissionGranted(permission.granted);
      if (!permission.granted) {
        setGpsStatus("Location permission: Required");
        return;
      }
      try {
        const current = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setGpsStatus(`GPS ready · ±${Math.round(current.coords.accuracy ?? 0)}m`);
      } catch {
        setGpsStatus("GPS signal is weak. Move somewhere with a clearer view of the sky.");
      }
    })();
  }, [screen, visible]);

  async function beginTracking() {
    if (!token) return;
    setBusy(true);
    try {
      const local = createTrackingSession({
        activityType: selectedType,
        visibility,
        autoPauseEnabled,
        voiceAnnouncementsEnabled,
        hideStartEnd,
        privacyRadiusMeters,
      });
      const activity = await createPaceActivity(token, {
        activityUuid: local.activityUuid,
        activityType: selectedType,
        visibility,
        autoPauseEnabled,
        voiceAnnouncementsEnabled,
        hideStartEnd,
        privacyRadiusMeters,
        equipment: equipment.trim() || null,
        startedAt: local.startedAt,
      });
      const linked = { ...local, activityId: activity.id, syncStatus: "pending" as const };
      setCurrentActivity(activity);
      commitSession(linked);
      setScreen("live");
      watchRef.current = await startLocationWatch(handleIncomingPoint, (message) => {
        setOfflineWarning(message);
      });
    } catch (error) {
      Alert.alert("Could not start activity", error instanceof Error ? error.message : "Please try again.");
    } finally {
      setBusy(false);
    }
  }

  async function toggleManualPause() {
    if (!session || !token || !session.activityId) return;
    if (session.manualPaused || session.autoPaused) {
      const resumed = resumeSession(session);
      commitSession(resumed);
      await resumePaceActivity(token, resumed.activityId!, resumed.syncStatus).catch(() => undefined);
      return;
    }
    const paused = pauseSession(session, false);
    commitSession(paused);
    await pausePaceActivity(token, paused.activityId!, paused.syncStatus).catch(() => undefined);
  }

  async function finishTracking() {
    if (!session || !token || !session.activityId) return;
    Alert.alert("Finish activity?", "You can continue if you’re not done yet.", [
      { text: "Continue", style: "cancel" },
      {
        text: "Finish",
        style: "default",
        onPress: () => {
          void (async () => {
            setBusy(true);
            stopWatch();
            const resumed = resumeSession(session);
            commitSession(resumed);
            await saveActiveTrackingSession(resumed);
            const flushed = await flushPending(resumed);
            const finishedLocal = { ...flushed, manualPaused: false, autoPaused: false };
            const finishMetrics = deriveLiveMetrics(finishedLocal);
            commitSession(finishedLocal);
            try {
              const finished = await finishPaceActivity(token, session.activityId!, {
                endedAt: Date.now(),
                elapsedTimeSec: finishMetrics.elapsedTimeSec,
                caption: caption.trim() || undefined,
                visibility,
              });
              setCurrentActivity(finished);
              await appendCompletedLocalActivity(finishedLocal);
              await saveActiveTrackingSession(null);
              setSession(null);
              setScreen("summary");
              void loadHome();
            } catch {
              const failed = { ...finishedLocal, syncStatus: "failed" as const };
              commitSession(failed);
              setOfflineWarning("We couldn’t sync your activity. Retry when connected.");
              setScreen("summary");
            } finally {
              setBusy(false);
            }
          })();
        },
      },
    ]);
  }

  function discardTracking() {
    if (!session) return;
    Alert.alert("Discard activity?", "This keeps a local copy so your data is not lost.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Discard",
        style: "destructive",
        onPress: () => {
          stopWatch();
          void (async () => {
            if (token && session.activityId) {
              try {
                await discardPaceActivity(token, session.activityId);
              } catch {
                // Keep local recovery copy if network is unavailable.
              }
            }
            await appendCompletedLocalActivity({ ...session, syncStatus: "failed", warning: "discarded_by_user" });
            commitSession(null);
            setCurrentActivity(null);
            setCaption("");
            setScreen("home");
          })();
        },
      },
    ]);
  }

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { backgroundColor: colors.background, paddingBottom: Math.max(insets.bottom, 14) }]}>
          <View style={styles.top}>
            <View>
              <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>CURRENT UPDATES</Text>
              <Text style={[styles.title, { color: colors.foreground }]}>PACE</Text>
            </View>
            <Pressable onPress={onClose}><Ionicons name="close" size={24} color={colors.foreground} /></Pressable>
          </View>

          {screen === "home" ? (
            <ScrollView contentContainerStyle={{ paddingBottom: 30 }}>
              <Pressable style={[styles.startButton, { backgroundColor: colors.primary }]} onPress={() => setScreen("select")}>
                <Ionicons name="play" size={21} color={colors.primaryForeground} />
                <Text style={[styles.startButtonText, { color: colors.primaryForeground }]}>START ACTIVITY</Text>
              </Pressable>
              {homeLoading ? <ActivityIndicator color={colors.primary} style={{ marginTop: 20 }} /> : (
                <View style={styles.grid}>
                  <Card title="Recent activities" value={`${homeData?.recentActivities.length ?? 0}`} />
                  <Card title="Nearby activity" value={`${homeData?.nearbyActivity.reduce((sum, item) => sum + item.count, 0) ?? 0}`} />
                  <Card title="Challenges" value={`${homeData?.challenges.length ?? 0}`} />
                  <Card title="Personal records" value="Coming soon" />
                  <Card title="Suggested routes" value="Coming soon" />
                  <Card title="Leaderboards" value="Coming soon" />
                </View>
              )}
              <Pressable style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => { setScreen("history"); void loadHistory(); }}>
                <Text style={{ color: colors.foreground, fontWeight: "700" }}>Activity History</Text>
              </Pressable>
              {localCompletedCount > 0 ? <Text style={{ color: colors.mutedForeground, marginTop: 8 }}>{localCompletedCount} local activities pending sync protection.</Text> : null}
            </ScrollView>
          ) : null}

          {screen === "select" ? (
            <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 20 }}>
              {ACTIVITY_OPTIONS.map((option) => (
                <Pressable
                  key={option.id}
                  onPress={() => {
                    setSelectedType(option.id);
                    setScreen("pre");
                  }}
                  style={[styles.activityRow, { borderColor: colors.border, backgroundColor: colors.card }]}
                >
                  <Ionicons name={option.icon} size={21} color={colors.primary} />
                  <Text style={{ color: colors.foreground, fontWeight: "700", fontSize: 16 }}>{option.label}</Text>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}

          {screen === "pre" ? (
            <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
              <Text style={{ color: colors.foreground, fontSize: 16, fontWeight: "700" }}>Activity: {selectedType}</Text>
              <Text style={{ color: permissionGranted ? colors.primary : colors.destructive }}>{gpsStatus}</Text>
              <ToggleRow label="Auto pause" value={autoPauseEnabled} onChange={setAutoPauseEnabled} />
              <ToggleRow label="Voice announcements" value={voiceAnnouncementsEnabled} onChange={setVoiceAnnouncementsEnabled} />
              <ToggleRow label="Hide start/end location" value={hideStartEnd} onChange={setHideStartEnd} />
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Privacy radius ({privacyRadiusMeters}m)</Text>
              <View style={styles.choices}>
                {[60, 120, 200, 400].map((value) => (
                  <Pressable key={value} onPress={() => setPrivacyRadiusMeters(value)} style={[styles.choice, { borderColor: privacyRadiusMeters === value ? colors.primary : colors.border }]}>
                    <Text style={{ color: colors.foreground }}>{value}m</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>Visibility</Text>
              <View style={styles.choices}>
                {(["public", "followers", "private"] as PaceVisibility[]).map((value) => (
                  <Pressable key={value} onPress={() => setVisibility(value)} style={[styles.choice, { borderColor: visibility === value ? colors.primary : colors.border }]}>
                    <Text style={{ color: colors.foreground }}>{value === "public" ? "Everyone" : value === "followers" ? "Followers" : "Only Me"}</Text>
                  </Pressable>
                ))}
              </View>
              <TextInput value={equipment} onChangeText={setEquipment} placeholder="Equipment (optional)" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
              <Pressable disabled={!permissionGranted || busy} style={[styles.startButton, { backgroundColor: !permissionGranted || busy ? colors.muted : colors.primary }]} onPress={() => void beginTracking()}>
                <Text style={[styles.startButtonText, { color: colors.primaryForeground }]}>{busy ? "Starting..." : "START"}</Text>
              </Pressable>
              <Text style={{ color: colors.mutedForeground, fontSize: 12 }}>If GPS is weak, start is still available when permission and basic signal are present.</Text>
            </ScrollView>
          ) : null}

          {screen === "live" && session ? (
            <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 18 }}>
              <Text style={[styles.liveType, { color: colors.foreground }]}>{session.activityType.toUpperCase()}</Text>
              <Text style={[styles.paceValue, { color: colors.foreground }]}>{formatPaceSecPerKm(displayPaceSecPerKm)}</Text>
              <View style={styles.metricRow}>
                <Metric label="Distance" value={formatMiles(metrics.distanceMeters)} />
                <Metric label="Time" value={formatDuration(metrics.elapsedTimeSec)} />
                <Metric label="Speed" value={formatSpeedMph(metrics.currentSpeedMps || metrics.averageSpeedMps)} />
              </View>
              <RoutePreview points={session.points.map((point) => ({ latitude: point.latitude, longitude: point.longitude }))} />
              <TextInput value={caption} onChangeText={setCaption} placeholder="Activity caption (optional)" placeholderTextColor={colors.mutedForeground} style={[styles.input, { color: colors.foreground, borderColor: colors.border }]} />
              {offlineWarning ? <Text style={{ color: colors.destructive }}>{offlineWarning}</Text> : null}
              <View style={styles.actionRow}>
                <Pressable
                  accessibilityLabel={session.manualPaused || session.autoPaused ? "Resume activity" : "Pause activity"}
                  style={[styles.secondaryAction, { borderColor: colors.border }]}
                  onPress={() => void toggleManualPause()}
                >
                  <Text style={{ color: colors.foreground, fontWeight: "700" }}>{session.manualPaused || session.autoPaused ? "RESUME" : "PAUSE"}</Text>
                </Pressable>
                <Pressable style={[styles.primaryAction, { backgroundColor: colors.primary }]} onPress={() => void finishTracking()}>
                  <Text style={{ color: colors.primaryForeground, fontWeight: "800" }}>FINISH</Text>
                </Pressable>
              </View>
            </ScrollView>
          ) : null}

          {(screen === "summary") ? (
            <ScrollView contentContainerStyle={{ gap: 12, paddingBottom: 20 }}>
              <Text style={[styles.paceValue, { color: colors.foreground, fontSize: 34 }]}>YOU DID IT</Text>
              <View style={styles.metricRow}>
                <Metric label="Distance" value={formatMiles(currentActivity?.distanceMeters ?? metrics.distanceMeters)} />
                <Metric label="Time" value={formatDuration(currentActivity?.elapsedTimeSec ?? metrics.elapsedTimeSec)} />
                <Metric label="Pace" value={formatPaceSecPerKm(currentActivity?.averagePaceSecPerKm ?? metrics.averagePaceSecPerKm)} />
              </View>
              <Text style={{ color: colors.mutedForeground }}>
                {(currentActivity?.leaderboardEligible ?? true) ? "Activity saved." : "Activity saved with suspicious tracking signals and excluded from competitive rankings."}
              </Text>
              {offlineWarning ? <Text style={{ color: colors.destructive }}>{offlineWarning}</Text> : null}
              <Pressable style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => { setScreen("home"); setCurrentActivity(null); setCaption(""); }}>
                <Text style={{ color: colors.foreground, fontWeight: "700" }}>Back to PACE Home</Text>
              </Pressable>
              <Pressable style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => void loadHistory().then(() => setScreen("history"))}>
                <Text style={{ color: colors.foreground, fontWeight: "700" }}>View History</Text>
              </Pressable>
            </ScrollView>
          ) : null}

          {screen === "history" ? (
            <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 20 }}>
              {historyLoading ? <ActivityIndicator color={colors.primary} /> : historyItems.map((item) => (
                <View key={item.id} style={[styles.historyRow, { borderColor: colors.border }]}>
                  <Text style={{ color: colors.foreground, fontWeight: "700" }}>{item.title || item.activityType}</Text>
                  <Text style={{ color: colors.mutedForeground }}>{formatMiles(item.distanceMeters)} · {formatDuration(item.movingTimeSec)} · {formatPaceSecPerKm(item.averagePaceSecPerKm)}</Text>
                </View>
              ))}
              {!historyLoading && historyItems.length === 0 ? <Text style={{ color: colors.mutedForeground }}>No activities yet.</Text> : null}
              <Pressable style={[styles.secondaryButton, { borderColor: colors.border }]} onPress={() => setScreen("home")}>
                <Text style={{ color: colors.foreground, fontWeight: "700" }}>Back</Text>
              </Pressable>
            </ScrollView>
          ) : null}

          {(screen === "live" && session && (session.manualPaused || session.autoPaused)) ? (
            <View style={[styles.pausePanel, { borderColor: colors.border }]}>
              <Text style={{ color: colors.foreground, fontWeight: "900", fontSize: 22 }}>PAUSED</Text>
              <View style={styles.actionRow}>
                <Pressable style={[styles.secondaryAction, { borderColor: colors.border }]} onPress={() => void toggleManualPause()}>
                  <Text style={{ color: colors.foreground, fontWeight: "800" }}>RESUME</Text>
                </Pressable>
                <Pressable style={[styles.secondaryAction, { borderColor: colors.border }]} onPress={() => void finishTracking()}>
                  <Text style={{ color: colors.foreground, fontWeight: "800" }}>FINISH</Text>
                </Pressable>
                <Pressable style={[styles.secondaryAction, { borderColor: colors.destructive }]} onPress={discardTracking}>
                  <Text style={{ color: colors.destructive, fontWeight: "800" }}>DISCARD</Text>
                </Pressable>
              </View>
            </View>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <View style={styles.card}>
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardValue}>{value}</Text>
    </View>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.metric}>
      <Text style={styles.metricLabel}>{label}</Text>
      <Text style={styles.metricValue}>{value}</Text>
    </View>
  );
}

function ToggleRow({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <View style={styles.toggleRow}>
      <Text style={{ fontWeight: "600" }}>{label}</Text>
      <Switch value={value} onValueChange={onChange} />
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,.32)" },
  sheet: { minHeight: "85%", borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 16 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  eyebrow: { fontSize: 11, fontWeight: "700" },
  title: { fontSize: 28, fontWeight: "900" },
  startButton: { minHeight: 56, borderRadius: 28, alignItems: "center", justifyContent: "center", flexDirection: "row", gap: 8, marginTop: 8 },
  startButtonText: { fontSize: 16, fontWeight: "900", letterSpacing: 0.4 },
  grid: { marginTop: 12, flexDirection: "row", flexWrap: "wrap", gap: 10 },
  card: { width: "48%", borderRadius: 16, backgroundColor: "#EEF2FF", padding: 12, minHeight: 78 },
  cardTitle: { fontSize: 12, fontWeight: "600", color: "#1F2937" },
  cardValue: { fontSize: 17, fontWeight: "800", color: "#111827", marginTop: 6 },
  secondaryButton: { minHeight: 48, borderRadius: 24, borderWidth: 1, alignItems: "center", justifyContent: "center", marginTop: 14 },
  activityRow: { minHeight: 56, borderRadius: 16, borderWidth: 1, paddingHorizontal: 14, flexDirection: "row", alignItems: "center", gap: 10 },
  toggleRow: { minHeight: 46, borderRadius: 14, borderWidth: 1, borderColor: "#E5E7EB", paddingHorizontal: 12, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  choice: { minHeight: 38, borderRadius: 19, borderWidth: 1, paddingHorizontal: 12, alignItems: "center", justifyContent: "center" },
  input: { minHeight: 48, borderWidth: 1, borderRadius: 12, paddingHorizontal: 12 },
  liveType: { fontSize: 14, fontWeight: "700", letterSpacing: 0.4 },
  paceValue: { fontSize: 46, fontWeight: "900" },
  metricRow: { flexDirection: "row", gap: 8 },
  metric: { flex: 1, borderRadius: 14, backgroundColor: "#E0E7FF", padding: 10 },
  metricLabel: { color: "#1F2937", fontSize: 12, fontWeight: "600" },
  metricValue: { color: "#111827", fontSize: 18, fontWeight: "800", marginTop: 4 },
  routeCard: { borderRadius: 18, borderWidth: 1, borderColor: "#C7D2FE", backgroundColor: "#F8FAFC", padding: 12, alignItems: "center" },
  routeTitle: { color: "#1F2937", fontWeight: "800", marginBottom: 8 },
  routeHint: { color: "#64748B", fontSize: 12 },
  actionRow: { flexDirection: "row", gap: 8 },
  secondaryAction: { flex: 1, minHeight: 46, borderRadius: 23, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  primaryAction: { flex: 1, minHeight: 46, borderRadius: 23, alignItems: "center", justifyContent: "center" },
  historyRow: { borderWidth: 1, borderRadius: 12, padding: 10 },
  pausePanel: { marginTop: 12, borderWidth: 1, borderRadius: 14, padding: 12, gap: 10 },
});
