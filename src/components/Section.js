import React from 'react';
import { View, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export default function Section({ children, style }) {
  const { theme } = useTheme();
  return (
    <View
      style={[
        styles.section,
        {
          backgroundColor: theme.elevated,
          shadowColor: theme.mode === 'light' ? '#000' : 'transparent',
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    borderRadius: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    overflow: 'hidden',
    // subtle iOS/Telegram card feel
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 1,
  },
});
