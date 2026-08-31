import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import Section from '../../components/Section';

const OPTIONS = ['Everyone', 'My contacts', 'Nobody'];

export default function AudienceSettingsScreen({ navigation }) {
  const { theme } = useTheme();
  const [stories, setStories] = useState('My contacts');
  const [notes, setNotes] = useState('My contacts');

  const Group = ({ title, value, onChange }) => (
    <>
      <Text style={[styles.caption, { color: theme.muted }]}>{title}</Text>
      <Section>
        {OPTIONS.map((opt, i) => (
          <TouchableOpacity
            key={opt}
            onPress={() => onChange(opt)}
            style={[styles.row, i < OPTIONS.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider }]}
          >
            <Text style={{ color: theme.text, fontSize: 16, flex: 1 }}>{opt}</Text>
            {value === opt && <Check size={18} color={theme.greenBright} />}
          </TouchableOpacity>
        ))}
      </Section>
    </>
  );

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="Story & Note Privacy" onBack={() => navigation.goBack()} />
      <View style={{ paddingVertical: 16 }}>
        <Group title="WHO CAN SEE MY STORIES" value={stories} onChange={setStories} />
        <Group title="WHO CAN SEE MY NOTES" value={notes} onChange={setNotes} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, paddingHorizontal: 20, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 50 },
});
