import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { ACCENTS } from '../../theme/theme';
import Header from '../../components/Header';
import Section from '../../components/Section';

const MODES = [
  { key: 'light', label: 'Light' },
  { key: 'dark', label: 'Dark' },
];

export default function AppearanceScreen({ navigation }) {
  const { theme, themeMode, setThemeMode, accentMode, setAccentMode } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="Appearance" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingVertical: 16 }}>
        <Text style={[styles.caption, { color: theme.muted }]}>THEME</Text>
        <Section>
          {MODES.map((m, i) => (
            <TouchableOpacity
              key={m.key}
              onPress={() => setThemeMode(m.key)}
              style={[styles.row, i < MODES.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider }]}
            >
              <Text style={{ color: theme.text, fontSize: 16, flex: 1 }}>{m.label}</Text>
              {themeMode === m.key && <Check size={18} color={theme.greenBright} />}
            </TouchableOpacity>
          ))}
        </Section>

        <Text style={[styles.caption, { color: theme.muted }]}>ACCENT</Text>
        <Section>
          {Object.entries(ACCENTS).map(([key, accent], i, arr) => (
            <TouchableOpacity
              key={key}
              onPress={() => setAccentMode(key)}
              style={[styles.row, i < arr.length - 1 && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.divider }]}
            >
              <View style={[styles.swatch, { backgroundColor: accent.greenBright }]} />
              <Text style={{ color: theme.text, fontSize: 16, flex: 1 }}>{accent.name}</Text>
              {accentMode === key && <Check size={18} color={theme.greenBright} />}
            </TouchableOpacity>
          ))}
        </Section>

        <TouchableOpacity onPress={() => navigation.navigate('Wallpaper')} style={{ paddingHorizontal: 20, paddingTop: 8 }}>
          <Text style={{ color: theme.greenBright, fontSize: 15, fontWeight: '600' }}>Choose chat wallpaper</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, paddingHorizontal: 20, marginBottom: 8 },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 50 },
  swatch: { width: 18, height: 18, borderRadius: 9, marginRight: 12 },
});
