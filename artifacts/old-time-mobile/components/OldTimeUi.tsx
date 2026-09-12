import { Feather, Ionicons } from '@expo/vector-icons';
import React, { ReactNode } from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';

export function Avatar({ source, name, size = 42, accent, editable = false, onPress }: { source?: ImageSourcePropType; name?: string; size?: number; accent?: string; editable?: boolean; onPress?: () => void }) {
  const colors = useColors();
  const content = source ? (
    <Image source={source} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: colors.secondary }} />
  ) : (
    <View style={[styles.avatarFallback, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.secondary, borderColor: colors.border }]}>
      {name ? <Text style={[styles.avatarLetter, { color: colors.foreground, fontSize: size * 0.45 }]}>{name.trim().split(/\s+/).map((part) => part[0]).join('').slice(0, 2).toUpperCase()}</Text> : <Ionicons name="person" size={size * 0.5} color={colors.mutedForeground} />}
    </View>
  );
  return (
    <Pressable
      accessibilityRole={editable ? 'button' : undefined}
      accessibilityLabel={editable ? 'Change profile photo' : undefined}
      testID={editable ? 'profile-avatar-edit' : undefined}
      disabled={!onPress}
      onPress={onPress}
      style={({ pressed }) => [{ width: size, height: size }, pressed && styles.pressed]}
    >
      {content}
      {editable ? <View pointerEvents="none" style={[styles.avatarAdd, { backgroundColor: colors.foreground, borderColor: colors.background }]}><Ionicons name="add" size={Math.max(14, size * 0.28)} color={colors.background} /></View> : null}
    </Pressable>
  );
}

export function Wordmark({ compact = false }: { compact?: boolean }) {
  const colors = useColors();
  return (
    <View style={styles.wordmark}>
      <Text style={[styles.wordmarkText, compact && styles.wordmarkCompact, { color: colors.foreground }]}>Old Time<Text style={{color: colors.action}}>.</Text></Text>
    </View>
  );
}

export function IconButton({ icon, onPress, accessibilityLabel, color, size = 24 }: { icon: keyof typeof Ionicons.glyphMap; onPress: () => void; accessibilityLabel: string; color?: string; size?: number }) {
  const colors = useColors();
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.iconButton, pressed && styles.pressed]}>
      <Ionicons name={icon} size={size} color={color ?? colors.foreground} />
    </Pressable>
  );
}

export function SectionLabel({ children, action, onAction }: { children: ReactNode; action?: string; onAction?: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.sectionRow}>
      <Text style={[styles.sectionLabel, { color: colors.foreground }]}>{children}</Text>
      {action && onAction ? <Pressable onPress={onAction}><Text style={[styles.sectionAction, { color: colors.action }]}>{action}</Text></Pressable> : null}
    </View>
  );
}

export function Pill({ children, active = false, onPress }: { children: ReactNode; active?: boolean; onPress?: () => void }) {
  const colors = useColors();
  const content = <Text style={[styles.pillText, { color: active ? colors.background : colors.foreground }]}>{children}</Text>;
  return onPress ? <Pressable onPress={onPress} style={[styles.pill, { backgroundColor: active ? colors.foreground : colors.secondary, borderColor: active ? colors.foreground : colors.border }]}><View style={styles.pillInner}>{content}</View></Pressable> : <View style={[styles.pill, { backgroundColor: colors.secondary, borderColor: colors.border }]}><View style={styles.pillInner}>{content}</View></View>;
}

export function EmptyState({ icon, title, body, action, onAction }: { icon: keyof typeof Feather.glyphMap; title: string; body: string; action?: string; onAction?: () => void }) {
  const colors = useColors();
  return (
    <View style={styles.emptyState}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.secondary, borderColor: colors.border }]}><Feather name={icon} size={32} color={colors.foreground} /></View>
      <Text style={[styles.emptyTitle, { color: colors.foreground }]}>{title}</Text>
      <Text style={[styles.emptyBody, { color: colors.mutedForeground }]}>{body}</Text>
      {action && onAction ? <Pressable onPress={onAction} style={[styles.emptyAction, { backgroundColor: colors.foreground }]}><Text style={{ color: colors.background, fontFamily: 'NunitoSans_700Bold', fontSize: 15 }}>{action}</Text></Pressable> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wordmark: { flexDirection: 'row', alignItems: 'center' },
  wordmarkText: { fontSize: 26, letterSpacing: -0.5, fontFamily: 'NunitoSans_900Black' },
  wordmarkCompact: { fontSize: 22 },
  avatarFallback: { alignItems: 'center', justifyContent: 'center' },
  avatarAdd: { position: 'absolute', right: -3, bottom: -3, width: 27, height: 27, borderRadius: 14, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  avatarLetter: { fontFamily: 'NunitoSans_700Bold' },
  iconButton: { minWidth: 40, minHeight: 40, alignItems: 'center', justifyContent: 'center' },
  pressed: { opacity: 0.6 },
  sectionRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 },
  sectionLabel: { fontSize: 18, fontFamily: 'NunitoSans_700Bold' },
  sectionAction: { fontSize: 14, fontFamily: 'NunitoSans_700Bold' },
  pill: { borderRadius: 24, overflow: 'hidden' },
  pillInner: { paddingHorizontal: 16, paddingVertical: 10, alignItems: 'center', justifyContent: 'center' },
  pillText: { fontSize: 14, fontFamily: 'NunitoSans_700Bold' },
  emptyState: { alignItems: 'center', justifyContent: 'center', padding: 36, minHeight: 300 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  emptyTitle: { fontSize: 22, marginBottom: 8, fontFamily: 'NunitoSans_700Bold', textAlign: 'center' },
  emptyBody: { fontSize: 15, lineHeight: 22, textAlign: 'center', maxWidth: 280, fontFamily: 'NunitoSans_400Regular' },
  emptyAction: { paddingHorizontal: 24, paddingVertical: 14, borderRadius: 24, marginTop: 24 },
});
