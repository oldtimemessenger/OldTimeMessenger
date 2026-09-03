import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker, type MapPressEvent, type Region } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Avatar, StoryAvatar } from '@/components/ui';
import type { Story } from '@/lib/social-api';
import type { SocialMapProps, SocialMapRegion } from './social-map.types';

type StoryCluster = {
  id: string;
  latitude: number;
  longitude: number;
  stories: Story[];
};

type HeatPoint = {
  id: string;
  latitude: number;
  longitude: number;
  weight: number;
};

function clusterStories(stories: Story[], region: SocialMapRegion): StoryCluster[] {
  const threshold = Math.max(region.latitudeDelta, region.longitudeDelta) * 0.075;
  const clusters: StoryCluster[] = [];
  for (const story of stories) {
    if (!story.location) continue;
    const cluster = clusters.find((item) =>
      Math.abs(item.latitude - story.location!.latitude) < threshold
      && Math.abs(item.longitude - story.location!.longitude) < threshold,
    );
    if (cluster) {
      const size = cluster.stories.length;
      cluster.latitude = (cluster.latitude * size + story.location.latitude) / (size + 1);
      cluster.longitude = (cluster.longitude * size + story.location.longitude) / (size + 1);
      cluster.stories.push(story);
    } else {
      clusters.push({
        id: `story-${story.id}`,
        latitude: story.location.latitude,
        longitude: story.location.longitude,
        stories: [story],
      });
    }
  }
  return clusters;
}

function buildHeatPoints(
  pins: SocialMapProps['pins'],
  stories: Story[],
  discoveryItems: NonNullable<SocialMapProps['discoveryItems']>,
  region: SocialMapRegion,
): HeatPoint[] {
  const threshold = Math.max(region.latitudeDelta, region.longitudeDelta) * 0.045;
  const raw = [
    ...pins.map((pin) => ({
      latitude: pin.latitude,
      longitude: pin.longitude,
      weight: 1 + Math.min(4, pin.counts.reactions + pin.counts.comments + pin.counts.saves),
    })),
    ...stories.filter((story) => story.location).map((story) => ({
      latitude: story.location!.latitude,
      longitude: story.location!.longitude,
      weight: 2,
    })),
    ...discoveryItems.filter((item) => item.latitude !== null && item.longitude !== null).map((item) => ({
      latitude: item.latitude!,
      longitude: item.longitude!,
      weight: 2 + Math.min(4, Math.round(item.score)),
    })),
  ];
  const clusters: HeatPoint[] = [];
  for (const point of raw) {
    const cluster = clusters.find((item) =>
      Math.abs(item.latitude - point.latitude) < threshold
      && Math.abs(item.longitude - point.longitude) < threshold,
    );
    if (cluster) {
      const totalWeight = cluster.weight + point.weight;
      cluster.latitude = (cluster.latitude * cluster.weight + point.latitude * point.weight) / totalWeight;
      cluster.longitude = (cluster.longitude * cluster.weight + point.longitude * point.weight) / totalWeight;
      cluster.weight = totalWeight;
    } else {
      clusters.push({ id: `heat-${clusters.length}`, ...point });
    }
  }
  return clusters.sort((left, right) => right.weight - left.weight).slice(0, 24);
}

export default function SocialMap({
  center,
  region,
  pins,
  stories,
  discoveryItems = [],
  selectedPinId,
  placementMode = false,
  heatEnabled = true,
  loading,
  colors,
  onLocate,
  onCreate,
  onToggleHeat,
  onPlacementChange,
  onSelectPin,
  onSelectStory,
  onSelectDiscoveryItem,
  onAreaPress,
  onRegionChange,
}: SocialMapProps) {
  const insets = useSafeAreaInsets();
  const mapRef = useRef<MapView>(null);
  const clusters = useMemo(() => region ? clusterStories(stories, region) : [], [region, stories]);
  const heatPoints = useMemo(
    () => region ? buildHeatPoints(pins, stories, discoveryItems, region) : [],
    [discoveryItems, pins, region, stories],
  );
  const heatRadius = region
    ? Math.max(900, Math.min(55_000, region.latitudeDelta * 111_000 * 0.085))
    : 2_000;

  function recenter() {
    onLocate();
  }

  function zoomCluster(cluster: StoryCluster) {
    if (!region) return;
    mapRef.current?.animateToRegion({
      latitude: cluster.latitude,
      longitude: cluster.longitude,
      latitudeDelta: Math.max(0.004, region.latitudeDelta * 0.45),
      longitudeDelta: Math.max(0.004, region.longitudeDelta * 0.45),
    }, 350);
  }

  function pressCoordinate(coordinate: { latitude: number; longitude: number }) {
    if (placementMode) {
      onPlacementChange?.(coordinate);
      return;
    }
    onAreaPress(coordinate);
  }

  function pressMap(event: MapPressEvent) {
    pressCoordinate(event.nativeEvent.coordinate);
  }

  if (!region) {
    return (
      <View style={[styles.map, styles.center, { backgroundColor: colors.muted }]}>
        <Ionicons name="map-outline" size={38} color={colors.primary} />
        <Text style={[styles.promptTitle, { color: colors.foreground }]}>See what’s nearby</Text>
        <Pressable onPress={onLocate} style={[styles.locateButton, { backgroundColor: colors.primary }]}>
          <Ionicons name="locate" size={18} color={colors.primaryForeground} />
          <Text style={{ color: colors.primaryForeground, fontWeight: '600' }}>Use my location</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.map}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        region={region as Region}
        showsUserLocation={center !== null}
        showsMyLocationButton={false}
        showsCompass
        showsScale
        scrollEnabled
        zoomEnabled
        rotateEnabled
        pitchEnabled
        loadingEnabled
        loadingBackgroundColor={colors.muted}
        onPress={pressMap}
        onLongPress={(event) => pressCoordinate(event.nativeEvent.coordinate)}
        onRegionChangeComplete={(next) => {
          onRegionChange(next);
          if (placementMode) {
            onPlacementChange?.({ latitude: next.latitude, longitude: next.longitude });
          }
        }}
      >
        {heatEnabled && !placementMode ? heatPoints.flatMap((point) => {
          const intensity = Math.min(1, point.weight / 8);
          const hotColor = intensity > 0.72
            ? 'rgba(239, 68, 68, 0.34)'
            : intensity > 0.38
              ? 'rgba(249, 115, 22, 0.3)'
              : 'rgba(250, 204, 21, 0.25)';
          return [
            <Circle key={`${point.id}-outer`} center={{ latitude: point.latitude, longitude: point.longitude }} radius={heatRadius * 1.4} fillColor="rgba(34, 211, 238, 0.10)" strokeWidth={0} />,
            <Circle key={`${point.id}-middle`} center={{ latitude: point.latitude, longitude: point.longitude }} radius={heatRadius * 0.82} fillColor="rgba(52, 211, 153, 0.14)" strokeWidth={0} />,
            <Circle key={`${point.id}-inner`} center={{ latitude: point.latitude, longitude: point.longitude }} radius={heatRadius * 0.42} fillColor={hotColor} strokeWidth={0} />,
          ];
        }) : null}
        {pins.slice(0, 80).map((pin) => (
          <Marker
            key={`pin-${pin.id}`}
            coordinate={{ latitude: pin.latitude, longitude: pin.longitude }}
            onPress={(event) => {
              event.stopPropagation();
              onSelectPin(pin);
            }}
            tracksViewChanges={false}
            zIndex={selectedPinId === pin.id ? 30 : 5}
          >
            <View style={[styles.pinMarker, {
              backgroundColor: selectedPinId === pin.id ? colors.primary : colors.card,
              borderColor: selectedPinId === pin.id ? colors.primaryForeground : colors.border,
            }]}>
              <Avatar name={pin.author.name} size={28} color={colors.primary} />
              <View style={[styles.pinTail, { borderTopColor: selectedPinId === pin.id ? colors.primary : colors.card }]} />
            </View>
          </Marker>
        ))}
        {clusters.map((cluster) => cluster.stories.length === 1 ? (
          <Marker
            key={cluster.id}
            coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
            onPress={(event) => {
              event.stopPropagation();
              onSelectStory(cluster.stories[0]);
            }}
            tracksViewChanges={false}
            zIndex={20}
          >
            <View style={styles.storyMarker}>
              <StoryAvatar
                name={cluster.stories[0].author.name}
                size={48}
                color={colors.primary}
                viewed={cluster.stories[0].viewer.viewed}
              />
            </View>
          </Marker>
        ) : (
          <Marker
            key={cluster.id}
            coordinate={{ latitude: cluster.latitude, longitude: cluster.longitude }}
            onPress={(event) => {
              event.stopPropagation();
              zoomCluster(cluster);
            }}
            tracksViewChanges={false}
            zIndex={25}
          >
            <View style={[styles.cluster, { backgroundColor: colors.primary, borderColor: colors.primaryForeground }]}>
              <Text style={[styles.clusterCount, { color: colors.primaryForeground }]}>{cluster.stories.length}</Text>
            </View>
          </Marker>
        ))}
        {discoveryItems.filter((item) => item.latitude !== null && item.longitude !== null).slice(0, 40).map((item) => (
          <Marker
            key={`discovery-${item.id}`}
            coordinate={{ latitude: item.latitude!, longitude: item.longitude! }}
            onPress={() => onSelectDiscoveryItem?.(item)}
            tracksViewChanges={false}
          >
            <View style={styles.discoveryMarker}>
              <Ionicons name="flame" size={18} color="#fff" />
            </View>
          </Marker>
        ))}
      </MapView>
      {placementMode ? (
        <View pointerEvents="none" style={styles.placementTarget}>
          <View style={[styles.placementHalo, { borderColor: colors.primary }]}>
            <Ionicons name="location" size={34} color={colors.primary} />
          </View>
        </View>
      ) : null}
      <View style={[styles.controls, { top: insets.top + 68 }]}>
        <Pressable accessibilityLabel={heatEnabled ? 'Hide activity heat' : 'Show activity heat'} onPress={onToggleHeat} style={[styles.control, { backgroundColor: heatEnabled ? colors.primary : colors.card, borderColor: heatEnabled ? colors.primary : colors.border }]}>
          <Ionicons name="flame" size={21} color={heatEnabled ? colors.primaryForeground : colors.primary} />
        </Pressable>
        <Pressable accessibilityLabel="Recenter map" onPress={recenter} style={[styles.control, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name={loading ? 'hourglass-outline' : 'locate'} size={21} color={colors.primary} />
        </Pressable>
        <Pressable accessibilityLabel="Post a location" onPress={onCreate} style={[styles.control, { backgroundColor: colors.primary, borderColor: colors.primary, opacity: placementMode ? 0.45 : 1 }]}>
          <Ionicons name="add" size={23} color={colors.primaryForeground} />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { flex: 1, overflow: 'hidden' },
  discoveryMarker: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F97316', borderWidth: 2, borderColor: '#fff' },
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  promptTitle: { fontSize: 18, fontWeight: '600', marginTop: 12, marginBottom: 16 },
  locateButton: { minHeight: 44, borderRadius: 22, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 8 },
  controls: { position: 'absolute', right: 14, gap: 10 },
  control: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  placementTarget: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  placementHalo: { width: 58, height: 58, borderRadius: 29, borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.92)', alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 10, shadowOffset: { width: 0, height: 5 }, elevation: 7 },
  pinMarker: { width: 36, height: 36, borderRadius: 18, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  pinTail: { position: 'absolute', bottom: -7, width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  storyMarker: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  cluster: { minWidth: 46, height: 46, borderRadius: 23, borderWidth: 3, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, elevation: 6 },
  clusterCount: { fontSize: 15, fontWeight: '600' },
});