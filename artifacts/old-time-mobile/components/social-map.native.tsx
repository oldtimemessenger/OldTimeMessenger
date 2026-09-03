import { Ionicons } from '@expo/vector-icons';
import React, { useMemo, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import MapView, { Marker, type MapPressEvent, type Region } from 'react-native-maps';
import { Avatar, StoryAvatar } from '@/components/ui';
import type { Story } from '@/lib/social-api';
import type { SocialMapProps, SocialMapRegion } from './social-map.types';

type StoryCluster = {
  id: string;
  latitude: number;
  longitude: number;
  stories: Story[];
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

const mapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#E7EEF4' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#486074' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#F7FAFC' }] },
  { featureType: 'poi', elementType: 'geometry', stylers: [{ color: '#DCE9E2' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#FFFFFF' }] },
  { featureType: 'road.arterial', elementType: 'geometry', stylers: [{ color: '#F8FAFC' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#BBD8EB' }] },
];

export default function SocialMap({
  center,
  region,
  pins,
  stories,
  discoveryItems = [],
  selectedPinId,
  loading,
  colors,
  onLocate,
  onCreate,
  onSelectPin,
  onSelectStory,
  onSelectDiscoveryItem,
  onAreaPress,
  onRegionChange,
}: SocialMapProps) {
  const mapRef = useRef<MapView>(null);
  const clusters = useMemo(() => region ? clusterStories(stories, region) : [], [region, stories]);

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

  function pressMap(event: MapPressEvent) {
    onAreaPress(event.nativeEvent.coordinate);
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
        customMapStyle={mapStyle}
        showsUserLocation
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
        onRegionChangeComplete={(next) => onRegionChange(next)}
      >
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
      <View style={styles.controls}>
        <Pressable accessibilityLabel="Recenter map" onPress={recenter} style={[styles.control, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Ionicons name={loading ? 'hourglass-outline' : 'locate'} size={21} color={colors.primary} />
        </Pressable>
        <Pressable accessibilityLabel="Post a location" onPress={onCreate} style={[styles.control, { backgroundColor: colors.primary, borderColor: colors.primary }]}>
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
  controls: { position: 'absolute', right: 14, top: 16, gap: 10 },
  control: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.12, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 4 },
  pinMarker: { width: 36, height: 36, borderRadius: 18, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  pinTail: { position: 'absolute', bottom: -7, width: 0, height: 0, borderLeftWidth: 5, borderRightWidth: 5, borderTopWidth: 8, borderLeftColor: 'transparent', borderRightColor: 'transparent' },
  storyMarker: { shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
  cluster: { minWidth: 46, height: 46, borderRadius: 23, borderWidth: 3, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 8, shadowColor: '#000', shadowOpacity: 0.18, shadowRadius: 8, elevation: 6 },
  clusterCount: { fontSize: 15, fontWeight: '600' },
});