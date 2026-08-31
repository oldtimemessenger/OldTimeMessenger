import React from 'react';
import { View } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import Section from '../../components/Section';
import SettingsRow from '../../components/SettingsRow';

export default function HelpScreen({ navigation }) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="Help" onBack={() => navigation.goBack()} />
      <View style={{ paddingVertical: 16 }}>
        <Section>
          <SettingsRow label="Contact support" onPress={() => navigation.navigate('Support')} />
          <SettingsRow label="Terms of Service" />
          <SettingsRow label="Privacy Policy" last />
        </Section>
      </View>
    </View>
  );
}
