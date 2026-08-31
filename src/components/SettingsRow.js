import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

export default function SettingsRow({
  icon: Icon,
  color = '#0A84FF',
  label,
  value,
  onPress,
  danger,
  badge,
  last,
}) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      style={[styles.row, !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider }]}
      activeOpacity={0.65}
    >
      {Icon && (
        <View style={[styles.iconWrap, { backgroundColor: color }]}>
          <Icon size={18} color="#fff" strokeWidth={2.2} />
        </View>
      )}
      <Text style={[styles.label, { color: danger ? theme.danger : theme.text }]} numberOfLines={1}>
        {label}
      </Text>
      {!!value && (
        <Text style={{ color: theme.muted, fontSize: 15, marginRight: 6 }} numberOfLines={1}>
          {value}
        </Text>
      )}
      {badge ? (
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{badge === true ? '!' : badge}</Text>
        </View>
      ) : null}
      {onPress && <ChevronRight size={18} color={theme.muted} strokeWidth={2} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 11,
    gap: 14,
    minHeight: 52,
  },
  iconWrap: {
    width: 29,
    height: 29,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: {
    flex: 1,
    fontSize: 16,
    fontWeight: '400',
  },
  badge: {
    backgroundColor: '#FF3B30',
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 5,
    marginRight: 4,
  },
  badgeText: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
});
