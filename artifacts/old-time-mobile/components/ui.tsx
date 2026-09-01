import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { BlurView } from 'expo-blur';
import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'OT';
}

export function Screen({ children, title, left, right, scroll = false }: { children: ReactNode; title?: string; left?: ReactNode; right?: ReactNode; scroll?: boolean }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const content = scroll ? <View style={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}>{children}</View> : children;
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {title ? <BlurView intensity={55} tint="systemMaterial" style={[styles.header, { paddingTop: insets.top + 6, borderBottomColor: colors.border }]}>
        <View style={styles.headerTitleGroup}>{left}<Text style={[styles.title, { color: colors.foreground }]}>{title}</Text></View><View style={styles.headerRight}>{right}</View>
      </BlurView> : null}
      {content}
    </View>
  );
}

export function Avatar({ name, size = 48, color, uri }: { name: string; size?: number; color?: string; uri?: string }) {
  const colors = useColors();
  const tones = ['#3B8FD6', '#D65A66', '#4C9B85', '#8A6BBE', '#D18A43', '#5B82AF'];
  const tone = color ?? tones[name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length];
  return <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: tone, overflow: 'hidden' }]}>{uri ? <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" /> : <Text style={[styles.avatarText, { fontSize: Math.max(12, size * 0.3) }]}>{initials(name)}</Text>}</View>;
}

export function IconButton({ name, onPress, color, size = 22, label }: { name: keyof typeof Ionicons.glyphMap; onPress: () => void; color?: string; size?: number; label?: string }) {
  const colors = useColors();
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, { backgroundColor: colors.card, borderColor: colors.border, opacity: pressed ? 0.62 : 1 }]}><Ionicons name={name} size={size} color={color ?? colors.foreground} /></Pressable>;
}

export function PrimaryButton({ label, onPress, disabled = false }: { label: string; onPress: () => void; disabled?: boolean }) {
  const colors = useColors();
  return <Pressable accessibilityRole="button" onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.primaryButton, { backgroundColor: colors.primary, opacity: disabled ? 0.45 : pressed ? 0.78 : 1 }]}><Text style={styles.primaryLabel}>{label}</Text></Pressable>;
}

export function EmptyState({ icon, title, description, action }: { icon: keyof typeof Ionicons.glyphMap; title: string; description: string; action?: ReactNode }) {
  const colors = useColors();
  return <View style={styles.empty}><Ionicons name={icon} size={42} color={colors.mutedForeground} /><Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text><Text style={[styles.emptyText, { color: colors.mutedForeground }]}>{description}</Text>{action}</View>;
}

export function LoadingState() {
  const colors = useColors();
  return <View style={styles.center}><View style={[styles.loadingAvatar, { backgroundColor: colors.muted }]} /><View style={[styles.loadingBar, { backgroundColor: colors.muted }]} /><View style={[styles.loadingBar, { backgroundColor: colors.muted, width: '68%' }]} /><View style={[styles.loadingBar, { backgroundColor: colors.muted, width: '82%' }]} /></View>;
}

export function SectionLabel({ children }: { children: ReactNode }) {
  const colors = useColors();
  return <Text style={[styles.sectionLabel, { color: colors.mutedForeground }]}>{children}</Text>;
}

export function Row({ icon, label, detail, onPress, destructive = false, right }: { icon: keyof typeof Ionicons.glyphMap; label: string; detail?: string; onPress?: () => void; destructive?: boolean; right?: ReactNode }) {
  const colors = useColors();
  return <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border, opacity: pressed ? 0.72 : 1 }]}><View style={[styles.rowIcon, { backgroundColor: destructive ? `${colors.destructive}16` : colors.muted }]}><Ionicons name={icon} size={17} color={destructive ? colors.destructive : colors.foreground} /></View><View style={styles.rowBody}><Text style={[styles.rowLabel, { color: destructive ? colors.destructive : colors.foreground }]}>{label}</Text>{detail ? <Text style={[styles.rowDetail, { color: colors.mutedForeground }]}>{detail}</Text> : null}</View>{right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} /> : null)}</Pressable>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 60, paddingHorizontal: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderBottomWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  headerTitleGroup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  title: { fontSize: 24, fontWeight: '700', letterSpacing: -0.5 },
  scroll: { paddingHorizontal: 16, paddingTop: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ddd', marginBottom: 14, opacity: 0.8 },
  loadingBar: { height: 10, width: '48%', borderRadius: 5, marginBottom: 9, opacity: 0.8 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  iconButton: { width: 38, height: 38, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center', shadowColor: '#18212B', shadowOpacity: 0.06, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 1 },
  primaryButton: { minHeight: 50, borderRadius: 25, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20, shadowColor: '#18212B', shadowOpacity: 0.08, shadowRadius: 12, shadowOffset: { width: 0, height: 5 }, elevation: 2 },
  primaryLabel: { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 28, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 6, letterSpacing: -0.2 },
  emptyText: { textAlign: 'center', lineHeight: 20, maxWidth: 290 },
  sectionLabel: { textTransform: 'uppercase', fontSize: 11, fontWeight: '700', letterSpacing: 1.1, marginHorizontal: 4, marginBottom: 8, marginTop: 18 },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowIcon: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 15 },
  rowDetail: { fontSize: 12, marginTop: 2 },
});