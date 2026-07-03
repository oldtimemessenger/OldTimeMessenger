import React from 'react';
import { TouchableOpacity, View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export default function Toggle({ value, onChange }) {
  const { theme } = useTheme();
  return (
    <TouchableOpacity onPress={() => onChange(!value)} activeOpacity={0.8}
      style={[styles.toggle, { backgroundColor: value ? theme.green : '#8b969b55' }]}>
      <View style={[styles.knob, { transform: [{ translateX: value ? 19 : 0 }] }]} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  toggle: { width: 44, height: 25, borderRadius: 13, padding: 2.5 },
  knob: { width: 20, height: 20, borderRadius: 10, backgroundColor: '#fff' },
});
