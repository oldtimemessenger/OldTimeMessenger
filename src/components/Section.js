import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export default function Section({ children }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.section, { backgroundColor: theme.elevated, borderColor: theme.inputBorder === 'transparent' ? theme.divider : theme.inputBorder }]}>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: { borderRadius: 12, marginHorizontal: 14, marginBottom: 16, overflow: 'hidden', borderWidth: 1 },
});
