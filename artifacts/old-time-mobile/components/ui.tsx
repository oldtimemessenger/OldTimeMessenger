import { Ionicons } from '@expo/vector-icons';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import React, { type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useColors } from '@/hooks/useColors';

export function initials(name: string) {
  return name.split(' ').map((part) => part[0]).join('').slice(0, 2).toUpperCase() || 'OT';
}

export function Screen({ children, title, right, scroll = false }: { children: ReactNode; title?: string; right?: ReactNode; scroll?: boolean }) {
  const colors = useColors();
  const insets = useSafeAreaInsets();
  const content = scroll ? <View style={[styles.scroll, { paddingBottom: insets.bottom + 100 }]}>{children}</View> : children;
  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      {title ? (
        <LinearGradient colors={['#63BFFB', '#3B8FD6']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.header, { paddingTop: insets.top + 8 }]}>
          <View>
            <Text style={styles.brandMark}>Old Time.</Text>
            <Text style={styles.title}>{title}</Text>
          </View>
          <View style={styles.headerRight}>{right}</View>
        </LinearGradient>
      ) : null}
      {content}
    </View>
  );
}

export function Avatar({ name, size = 48, color, uri }: { name: string; size?: number; color?: string; uri?: string }) {
  const tones = ['#3B8FD6', '#D65A66', '#4C9B85', '#8A6BBE', '#D18A43', '#5B82AF'];
  const tone = color ?? tones[name.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0) % tones.length];
  return <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: tone, overflow: 'hidden' }]}>{uri ? <Image source={{ uri }} style={{ width: size, height: size }} contentFit="cover" /> : <Text style={[styles.avatarText, { fontSize: Math.max(12, size * 0.3) }]}>{initials(name)}</Text>}</View>;
}

export function IconButton({ name, onPress, color, size = 22, label }: { name: keyof typeof Ionicons.glyphMap; onPress: () => void; color?: string; size?: number; label?: string }) {
  return <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.iconButton, { opacity: pressed ? 0.6 : 1 }]}><Ionicons name={name} size={size} color={color ?? '#FFFFFF'} /></Pressable>;
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
  return <Pressable onPress={onPress} disabled={!onPress} style={({ pressed }) => [styles.row, { backgroundColor: colors.card, borderBottomColor: colors.border, opacity: pressed ? 0.72 : 1 }]}><View style={[styles.rowIcon, { backgroundColor: destructive ? colors.destructive : colors.primary }]}><Ionicons name={icon} size={17} color="#fff" /></View><View style={styles.rowBody}><Text style={[styles.rowLabel, { color: destructive ? colors.destructive : colors.foreground }]}>{label}</Text>{detail ? <Text style={[styles.rowDetail, { color: colors.mutedForeground }]}>{detail}</Text> : null}</View>{right ?? (onPress ? <Ionicons name="chevron-forward" size={18} color={colors.mutedForeground} /> : null)}</Pressable>;
}

export const styles = StyleSheet.create({
  screen: { flex: 1 },
  header: { minHeight: 72, paddingHorizontal: 16, paddingBottom: 14, flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  brandMark: { color: 'rgba(255,255,255,0.82)', fontSize: 11, fontWeight: '800', letterSpacing: 1.4, textTransform: 'uppercase' },
  title: { fontSize: 26, fontWeight: '800', letterSpacing: -0.6, color: '#FFFFFF', marginTop: 2 },
  headerRight: { flexDirection: 'row', alignItems: 'center' },
  scroll: { paddingHorizontal: 16, paddingTop: 14 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingAvatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: '#ddd', marginBottom: 14, opacity: 0.8 },
  loadingBar: { height: 10, width: '48%', borderRadius: 5, marginBottom: 9, opacity: 0.8 },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#fff', fontWeight: '700' },
  iconButton: { minWidth: 42, minHeight: 42, alignItems: 'center', justifyContent: 'center' },
  primaryButton: { minHeight: 50, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 20 },
  primaryLabel: { color: '#fff', fontWeight: '700', fontSize: 15 },
  empty: { alignItems: 'center', justifyContent: 'center', padding: 28, gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', marginTop: 6, letterSpacing: -0.2 },
  emptyText: { textAlign: 'center', lineHeight: 20, maxWidth: 290 },
  sectionLabel: { textTransform: 'uppercase', fontSize: 11, fontWeight: '700', letterSpacing: 1.1, marginHorizontal: 4, marginBottom: 8, marginTop: 18 },
  row: { minHeight: 62, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 12, borderBottomWidth: StyleSheet.hairlineWidth },
  rowIcon: { width: 30, height: 30, borderRadius: 8, alignItems: 'center', justifyContent: 'center' },
  rowBody: { flex: 1 },
  rowLabel: { fontSize: 15 },
  rowDetail: { fontSize: 12, marginTop: 2 },
});
