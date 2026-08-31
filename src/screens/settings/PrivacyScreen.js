import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import Section from '../../components/Section';
import SettingsRow from '../../components/SettingsRow';
import Toggle from '../../components/Toggle';

export default function PrivacyScreen({ navigation }) {
  const { theme } = useTheme();
  const [readReceipts, setReadReceipts] = useState(true);
  const [lastSeen, setLastSeen] = useState(true);
  const [typing, setTyping] = useState(true);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="Privacy" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingVertical: 16 }}>
        <Text style={[styles.caption, { color: theme.muted }]}>WHO CAN SEE MY INFO</Text>
        <Section>
          <SettingsRow label="Last seen & online" value={lastSeen ? 'Everyone' : 'Nobody'} onPress={() => setLastSeen((v) => !v)} />
          <SettingsRow label="Profile photo" value="Everyone" />
          <SettingsRow label="About" value="My contacts" last />
        </Section>

        <Text style={[styles.caption, { color: theme.muted }]}>MESSAGES</Text>
        <Section>
          <View style={styles.toggleRow}>
            <Text style={{ color: theme.text, fontSize: 16, flex: 1 }}>Read receipts</Text>
            <Toggle value={readReceipts} onChange={setReadReceipts} />
          </View>
          <View style={[styles.toggleRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider }]}>
            <Text style={{ color: theme.text, fontSize: 16, flex: 1 }}>Typing indicators</Text>
            <Toggle value={typing} onChange={setTyping} />
          </View>
        </Section>
        <Text style={[styles.hint, { color: theme.muted }]}>
          If you turn off read receipts, you will not see receipts from other people either.
        </Text>

        <Section>
          <SettingsRow label="Blocked contacts" value="0" />
          <SettingsRow label="Disappearing messages" value="Off" last />
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  caption: { fontSize: 12, fontWeight: '600', letterSpacing: 0.6, paddingHorizontal: 20, marginBottom: 8 },
  hint: { fontSize: 13, lineHeight: 18, paddingHorizontal: 20, marginBottom: 16, marginTop: -4 },
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 },
});
