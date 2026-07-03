import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

export default function SettingsRow({ icon: Icon, color = '#5B7C99', label, value, onPress, danger }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity onPress={onPress} disabled={!onPress} style={styles.row} activeOpacity={0.7}>
      {Icon && (
        <View style={[styles.iconWrap, { backgroundColor: color }]}>
          <Icon size={16} color="#fff" />
        </View>
      )}
      <Text style={[styles.label, { color: danger ? theme.danger : theme.text }]}>{label}</Text>
      {!!value && <Text style={{ color: theme.muted, fontSize: 13.5, marginRight: 4 }}>{value}</Text>}
      {onPress && <ChevronRight size={16} color={theme.muted} />}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 12, gap: 13 },
  iconWrap: { width: 30, height: 30, borderRadius: 8, justifyContent: 'center', alignItems: 'center' },
  label: { flex: 1, fontSize: 15 },
});
