import React from 'react';
import { View, Text } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import Section from '../../components/Section';
import SettingsRow from '../../components/SettingsRow';

export default function StorageScreen({ navigation }) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="Data and Storage" onBack={() => navigation.goBack()} />
      <View style={{ paddingVertical: 16 }}>
        <Section>
          <SettingsRow label="Manage storage" value="124 MB" />
          <SettingsRow label="Network usage" last />
        </Section>
        <Section>
          <SettingsRow label="Auto-download media" value="Wi-Fi" last />
        </Section>
        <Text style={{ color: theme.muted, fontSize: 13, paddingHorizontal: 20 }}>
          Voice notes and photos stay on this device until you clear cache.
        </Text>
      </View>
    </View>
  );
}
