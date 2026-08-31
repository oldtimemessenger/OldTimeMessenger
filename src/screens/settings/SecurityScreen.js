import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { ShieldCheck } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import Section from '../../components/Section';
import SettingsRow from '../../components/SettingsRow';

export default function SecurityScreen({ navigation }) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="Encryption" onBack={() => navigation.goBack()} />
      <View style={{ paddingVertical: 16, alignItems: 'center' }}>
        <View style={[styles.badge, { backgroundColor: theme.elevated }]}>
          <ShieldCheck size={36} color={theme.greenBright} />
        </View>
        <Text style={{ color: theme.text, fontSize: 18, fontWeight: '600', marginTop: 16 }}>Protected chats</Text>
        <Text style={{ color: theme.muted, fontSize: 14, textAlign: 'center', paddingHorizontal: 32, marginTop: 8, lineHeight: 20 }}>
          Messages are stored with row-level access so only chat participants can read them. Call media is not relayed through Old Time servers.
        </Text>
      </View>
      <Section>
        <SettingsRow label="Show security notifications" value="On" last />
      </Section>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center' },
});
