import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';

const TAGS = ['Music', 'Sports', 'Tech', 'Art', 'Travel', 'Food', 'Gaming', 'News', 'Faith', 'Family'];

export default function InterestsScreen({ navigation }) {
  const { theme } = useTheme();
  const [picked, setPicked] = useState(['Music', 'Tech']);

  const toggle = (tag) => {
    setPicked((prev) => (prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]));
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="Your Interests" onBack={() => navigation.goBack()} />
      <Text style={{ color: theme.muted, paddingHorizontal: 20, paddingTop: 16, paddingBottom: 8 }}>
        Used to personalize status and note drops. Never sold.
      </Text>
      <View style={styles.wrap}>
        {TAGS.map((tag) => {
          const on = picked.includes(tag);
          return (
            <TouchableOpacity
              key={tag}
              onPress={() => toggle(tag)}
              style={[styles.chip, { backgroundColor: on ? theme.green : theme.elevated, borderColor: theme.divider }]}
            >
              <Text style={{ color: on ? '#fff' : theme.text, fontWeight: '600' }}>{tag}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', padding: 16, gap: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20, borderWidth: 1 },
});
