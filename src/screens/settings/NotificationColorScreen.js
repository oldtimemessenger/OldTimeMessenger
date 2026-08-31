import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Check } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { ACCENTS } from '../../theme/theme';
import Header from '../../components/Header';
import Section from '../../components/Section';

export default function NotificationColorScreen({ navigation }) {
  const { theme, accentMode, setAccentMode } = useTheme();

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="Notification Color" onBack={() => navigation.goBack()} />
      <View style={{ paddingVertical: 16 }}>
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
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 },
  swatch: { width: 22, height: 22, borderRadius: 11, marginRight: 12 },
});
