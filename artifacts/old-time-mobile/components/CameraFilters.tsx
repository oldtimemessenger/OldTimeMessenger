import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export type CameraFilterId =
  | 'fresh-light'
  | 'soft-focus'
  | 'warm-polish'
  | 'clean-film'
  | 'cherry-pop'
  | 'blue-note'
  | 'disco-flash'
  | 'ink-loop'
  | 'sunset-stamp'
  | 'bubble-time';

type FilterIcon = keyof typeof Ionicons.glyphMap;
type FilterDefinition = {
  id: CameraFilterId;
  name: string;
  group: 'Natural polish' | 'Signature play';
  icon: FilterIcon;
  tint: string;
  tintOpacity: number;
  gradient: [string, string, ...string[]];
  accent: string;
  motif: 'none' | 'corner' | 'heart' | 'lines' | 'bubble' | 'rings';
};

export const CAMERA_FILTERS: FilterDefinition[] = [
  {
    id: 'fresh-light',
    name: 'Glass Glow',
    group: 'Natural polish',
    icon: 'sunny-outline',
    tint: 'rgba(255,244,220,1)',
    tintOpacity: 0.14,
    gradient: ['rgba(255,248,232,.18)', 'transparent', 'rgba(255,228,190,.10)'],
    accent: '#f0a35b',
    motif: 'none',
  },
  {
    id: 'soft-focus',
    name: 'Soft Lift',
    group: 'Natural polish',
    icon: 'cloud-outline',
    tint: 'rgba(255,235,226,1)',
    tintOpacity: 0.13,
    gradient: ['rgba(255,255,255,.2)', 'transparent', 'rgba(255,202,202,.12)'],
    accent: '#e9948f',
    motif: 'none',
  },
  {
    id: 'warm-polish',
    name: 'Sunlit Skin',
    group: 'Natural polish',
    icon: 'partly-sunny-outline',
    tint: 'rgba(244,180,112,1)',
    tintOpacity: 0.16,
    gradient: ['rgba(255,181,104,.14)', 'transparent', 'rgba(162,75,34,.12)'],
    accent: '#d9824d',
    motif: 'none',
  },
  {
    id: 'clean-film',
    name: 'Clear Tone',
    group: 'Natural polish',
    icon: 'film-outline',
    tint: 'rgba(222,234,228,1)',
    tintOpacity: 0.1,
    gradient: ['rgba(216,238,230,.14)', 'transparent', 'rgba(34,64,61,.11)'],
    accent: '#82c0af',
    motif: 'none',
  },
  {
    id: 'cherry-pop',
    name: 'Cherry 3D',
    group: 'Signature play',
    icon: 'heart-outline',
    tint: 'rgba(225,32,93,1)',
    tintOpacity: 0.15,
    gradient: ['rgba(235,43,102,.2)', 'transparent', 'rgba(255,122,86,.13)'],
    accent: '#ff426e',
    motif: 'heart',
  },
  {
    id: 'blue-note',
    name: 'Blue Pop',
    group: 'Signature play',
    icon: 'water-outline',
    tint: 'rgba(37,99,235,1)',
    tintOpacity: 0.16,
    gradient: ['rgba(31,99,235,.18)', 'transparent', 'rgba(54,205,220,.14)'],
    accent: '#57c9e9',
    motif: 'corner',
  },
  {
    id: 'disco-flash',
    name: 'Prism Flash',
    group: 'Signature play',
    icon: 'radio-outline',
    tint: 'rgba(246,165,35,1)',
    tintOpacity: 0.15,
    gradient: ['rgba(255,211,73,.18)', 'transparent', 'rgba(224,47,118,.18)'],
    accent: '#ffd34e',
    motif: 'lines',
  },
  {
    id: 'ink-loop',
    name: 'Electric Line',
    group: 'Signature play',
    icon: 'pencil-outline',
    tint: 'rgba(32,28,52,1)',
    tintOpacity: 0.2,
    gradient: ['rgba(31,26,66,.22)', 'transparent', 'rgba(133,80,181,.17)'],
    accent: '#c29af2',
    motif: 'corner',
  },
  {
    id: 'sunset-stamp',
    name: 'Heat Wave',
    group: 'Signature play',
    icon: 'ticket-outline',
    tint: 'rgba(246,91,55,1)',
    tintOpacity: 0.17,
    gradient: ['rgba(255,128,67,.17)', 'transparent', 'rgba(168,52,112,.2)'],
    accent: '#ff956d',
    motif: 'rings',
  },
  {
    id: 'bubble-time',
    name: 'Bubble Blink',
    group: 'Signature play',
    icon: 'chatbubble-ellipses-outline',
    tint: 'rgba(38,180,164,1)',
    tintOpacity: 0.13,
    gradient: ['rgba(62,215,194,.15)', 'transparent', 'rgba(79,130,232,.17)'],
    accent: '#70e0ce',
    motif: 'bubble',
  },
];

function filterById(id: CameraFilterId) {
  return CAMERA_FILTERS.find((filter) => filter.id === id) ?? CAMERA_FILTERS[0];
}

export function CameraFilterOverlay({ filterId }: { filterId: CameraFilterId }) {
  const filter = filterById(filterId);

  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <LinearGradient colors={filter.gradient} locations={[0, 0.48, 1]} style={StyleSheet.absoluteFill} />
      <View style={[StyleSheet.absoluteFill, { backgroundColor: filter.tint, opacity: filter.tintOpacity }]} />
      {filter.group === 'Natural polish' ? <LinearGradient colors={['rgba(255,255,255,.11)', 'transparent', 'rgba(255,244,232,.06)']} style={StyleSheet.absoluteFill} /> : null}
      {filter.motif === 'corner' ? <View style={[styles.cornerFrame, { borderColor: filter.accent }]} /> : null}
      {filter.motif === 'heart' ? (
        <View style={styles.heartMotif}>
          <Ionicons name="heart" size={64} color={filter.accent} />
          <Ionicons name="heart-outline" size={30} color="#fff" style={styles.heartOutline} />
        </View>
      ) : null}
      {filter.motif === 'lines' ? (
        <View style={styles.lineMotif}>
          <View style={[styles.flashLine, { backgroundColor: filter.accent, transform: [{ rotate: '-18deg' }] }]} />
          <View style={[styles.flashLine, { backgroundColor: '#fff', transform: [{ rotate: '18deg' }] }]} />
          <View style={[styles.flashLine, { backgroundColor: '#f06d9a', transform: [{ rotate: '52deg' }] }]} />
        </View>
      ) : null}
      {filter.motif === 'rings' ? (
        <View style={styles.ringMotif}>
          <View style={[styles.ringLarge, { borderColor: filter.accent }]} />
          <View style={[styles.ringMedium, { borderColor: '#fff' }]} />
          <View style={[styles.ringSmall, { backgroundColor: filter.accent }]} />
        </View>
      ) : null}
      {filter.motif === 'bubble' ? (
        <View style={styles.bubbleMotif}>
          <View style={[styles.bubbleLarge, { borderColor: filter.accent }]} />
          <View style={[styles.bubbleSmall, { backgroundColor: filter.accent }]} />
          <View style={[styles.bubbleTiny, { backgroundColor: '#fff' }]} />
        </View>
      ) : null}
    </View>
  );
}

export function CameraFilterPicker({
  selectedId,
  onSelect,
}: {
  selectedId: CameraFilterId;
  onSelect: (id: CameraFilterId) => void;
}) {
  const colors = useColors();
  const selected = filterById(selectedId);

  return (
    <View style={styles.picker}>
      <View style={styles.pickerHeader}>
        <View style={styles.pickerTitleRow}>
          <Ionicons name="color-wand-outline" size={14} color={colors.background} />
          <Text style={[styles.pickerTitle, { color: colors.background }]}>Looks</Text>
        </View>
        <Text style={[styles.pickerSelected, { color: selected.accent }]}>{selected.name}</Text>
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterRow}>
        {CAMERA_FILTERS.map((filter) => {
          const active = filter.id === selectedId;
          return (
            <Pressable
              key={filter.id}
              onPress={() => onSelect(filter.id)}
              style={[styles.filterChip, active && { backgroundColor: filter.accent, borderColor: filter.accent }]}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${filter.group}: ${filter.name}`}
              testID={`camera-filter-${filter.id}`}
            >
              <Ionicons name={filter.icon} size={15} color={active ? colors.background : colors.background} />
              <Text style={[styles.filterChipText, { color: colors.background }]}>{filter.name}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  picker: { gap: 7, zIndex: 3 },
  pickerHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18 },
  pickerTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  pickerTitle: { fontSize: 12, fontWeight: '900', letterSpacing: 0.5 },
  pickerSelected: { fontSize: 11, fontWeight: '800' },
  filterRow: { gap: 8, paddingHorizontal: 16, paddingVertical: 2 },
  filterChip: { minHeight: 35, borderRadius: 18, borderWidth: 1, borderColor: 'rgba(255,255,255,.28)', backgroundColor: 'rgba(0,0,0,.42)', paddingHorizontal: 11, flexDirection: 'row', alignItems: 'center', gap: 5 },
  filterChipText: { fontSize: 11, fontWeight: '800' },
  cornerFrame: { ...StyleSheet.absoluteFillObject, margin: 14, borderWidth: 2, borderRadius: 24, opacity: 0.72 },
  heartMotif: { position: 'absolute', top: '22%', right: '11%', opacity: 0.82, transform: [{ rotate: '12deg' }] },
  heartOutline: { position: 'absolute', top: 15, left: 18 },
  lineMotif: { position: 'absolute', top: '28%', left: '12%', width: 70, height: 70, opacity: 0.78 },
  flashLine: { position: 'absolute', width: 56, height: 7, borderRadius: 4, top: 30, left: 7 },
  ringMotif: { position: 'absolute', bottom: '22%', left: 22, width: 74, height: 74, opacity: 0.8 },
  ringLarge: { position: 'absolute', width: 68, height: 68, borderRadius: 34, borderWidth: 3 },
  ringMedium: { position: 'absolute', top: 12, left: 12, width: 44, height: 44, borderRadius: 22, borderWidth: 2 },
  ringSmall: { position: 'absolute', top: 28, left: 28, width: 12, height: 12, borderRadius: 6 },
  bubbleMotif: { position: 'absolute', top: '20%', right: '12%', width: 76, height: 64, opacity: 0.8 },
  bubbleLarge: { position: 'absolute', right: 5, top: 0, width: 54, height: 54, borderRadius: 27, borderWidth: 3 },
  bubbleSmall: { position: 'absolute', left: 5, bottom: 2, width: 20, height: 20, borderRadius: 10 },
  bubbleTiny: { position: 'absolute', left: 0, bottom: 26, width: 9, height: 9, borderRadius: 5 },
});