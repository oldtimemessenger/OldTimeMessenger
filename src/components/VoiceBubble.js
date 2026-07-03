import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Play } from 'lucide-react-native';
import { useTheme } from '../theme/ThemeContext';

export default function VoiceBubble({ fromMe, durationLabel = '0:14' }) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <View style={[styles.playBtn, { backgroundColor: fromMe ? '#06140F22' : theme.green }]}>
        <Play size={12} color={fromMe ? theme.text : '#fff'} fill={fromMe ? theme.text : '#fff'} />
      </View>
      <View style={styles.wave}>
        {[6, 12, 8, 16, 10, 14, 7, 11, 5].map((h, i) => (
          <View key={i} style={{ width: 2.5, height: h, borderRadius: 2, backgroundColor: fromMe ? '#0000004d' : `${theme.text}66` }} />
        ))}
      </View>
      <Text style={{ fontSize: 11, color: fromMe ? '#00000088' : theme.muted }}>{durationLabel}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  playBtn: { width: 26, height: 26, borderRadius: 13, justifyContent: 'center', alignItems: 'center' },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 2 },
});
