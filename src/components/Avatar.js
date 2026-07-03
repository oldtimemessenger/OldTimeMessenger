import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

export default function Avatar({ name = '?', color = '#5B7C99', size = 48, status }) {
  const { theme } = useTheme();
  const initials = name.split(' ').map((w) => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase();
  const dotColor = status === 'online' ? theme.online : status === 'away' ? theme.away : null;
  return (
    <View style={{ width: size, height: size }}>
      <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2, backgroundColor: color }]}>
        <Text style={{ color: '#fff', fontWeight: '600', fontSize: size * 0.36 }}>{initials}</Text>
      </View>
      {dotColor && (
        <View
          style={[
            styles.dot,
            {
              width: size * 0.28, height: size * 0.28, borderRadius: size * 0.14,
              backgroundColor: dotColor, borderWidth: 2.5, borderColor: theme.bg,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  avatar: { justifyContent: 'center', alignItems: 'center' },
  dot: { position: 'absolute', bottom: -1, right: -1 },
});
