import { Ionicons } from '@expo/vector-icons';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Avatar, StoryAvatar } from '@/components/ui';
import type { SocialMapProps } from './social-map.types';

export default function SocialMap({
  center,
  region,
  pins,
  stories,
  selectedPinId,
  loading,
  colors,
  onLocate,
  onCreate,
  onSelectPin,
  onSelectStory,
  onAreaPress,
}: SocialMapProps) {
  if (!region || !center) {
    return (
      <View style={[styles.map, styles.center, { backgroundColor: colors.muted }]}>
        <Ionicons name="map-outline" size={38} color={colors.primary} />
        <Text style={[styles.promptTitle, { color: colors.foreground }]}>See what’s nearby</Text>
        <Pressable onPress={onLocate} style={[styles.locateButton, { backgroundColor: colors.primary }]}>
          <Ionicons name="locate" size={18} color={colors.primaryForeground} />
          <Text style={{ color: colors.primaryForeground, fontWeight: '800' }}>Use my location</Text>
        </Pressable>
      </View>
    );
  }
  return (
    <View style={[styles.map, { backgroundColor: colors.muted }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Discover activity in this area"
        style={StyleSheet.absoluteFill}
        onPress={(event) => {
          const x = Math.max(0, Math.min(1, event.nativeEvent.locationX / 370));
          const y = Math.max(0, Math.min(1, event.nativeEvent.locationY / 600));
          onAreaPress({
            latitude: region.latitude + (0.5 - y) * region.latitudeDelta,
            longitude: region.longitude + (x - 0.5) * region.longitudeDelta,
          });
        }}
      />
      <View style={styles.roadA} /><View style={styles.roadB} /><View style={styles.roadC} />
      {pins.slice(0, 5).map((pin, index) => {
        const positions = [{ left: 45, top: 180 }, { right: 65, top: 145 }, { left: 150, top: 290 }, { right: 40, top: 350 }, { left: 84, top: 410 }];
        return (
          <Pressable key={pin.id} onPress={() => onSelectPin(pin)} style={[styles.pinMarker, positions[index], { backgroundColor: selectedPinId === pin.id ? colors.primary : colors.card, borderColor: colors.primaryForeground }]}>
            <Avatar name={pin.author.name} size={28} color={colors.primary} />
          </Pressable>
        );
      })}
      {stories.filter((story) => story.location).slice(0, 5).map((story, index) => {
        const positions = [{ right: 100, top: 245 }, { left: 90, top: 120 }, { left: 210, top: 390 }, { right: 45, top: 455 }, { left: 35, top: 330 }];
        return <Pressable key={story.id} onPress={() => onSelectStory(story)} style={[styles.storyMarker, positions[index]]}><StoryAvatar name={story.author.name} size={48} color={colors.primary} viewed={story.viewer.viewed} /></Pressable>;
      })}
      <View style={styles.controls}>
        <Pressable accessibilityLabel="Recenter map" onPress={onLocate} style={[styles.control, { backgroundColor: colors.card, borderColor: colors.border }]}>
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
  center: { alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  promptTitle: { fontSize: 18, fontWeight: '900', marginTop: 12, marginBottom: 16 },
  locateButton: { minHeight: 44, borderRadius: 22, paddingHorizontal: 17, flexDirection: 'row', alignItems: 'center', gap: 8 },
  roadA: { position: 'absolute', width: 700, height: 38, backgroundColor: 'rgba(255,255,255,0.58)', transform: [{ rotate: '-20deg' }], top: 245, left: -140 },
  roadB: { position: 'absolute', width: 620, height: 24, backgroundColor: 'rgba(255,255,255,0.46)', transform: [{ rotate: '58deg' }], top: 240, left: -115 },
  roadC: { position: 'absolute', width: 520, height: 15, backgroundColor: 'rgba(255,255,255,0.4)', transform: [{ rotate: '8deg' }], top: 430, left: -30 },
  controls: { position: 'absolute', right: 14, top: 16, gap: 10 },
  control: { width: 46, height: 46, borderRadius: 23, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  pinMarker: { position: 'absolute', width: 36, height: 36, borderRadius: 18, borderWidth: 2.5, alignItems: 'center', justifyContent: 'center' },
  storyMarker: { position: 'absolute' },
});