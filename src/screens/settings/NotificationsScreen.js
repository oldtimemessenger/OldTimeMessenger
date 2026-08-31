import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import Section from '../../components/Section';
import SettingsRow from '../../components/SettingsRow';
import Toggle from '../../components/Toggle';

export default function NotificationsScreen({ navigation }) {
  const { theme } = useTheme();
  const [messageNotifs, setMessageNotifs] = useState(true);
  const [callNotifs, setCallNotifs] = useState(true);
  const [preview, setPreview] = useState(true);

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="Notifications" onBack={() => navigation.goBack()} />
      <ScrollView contentContainerStyle={{ paddingVertical: 16 }}>
        <Section>
          <View style={styles.toggleRow}>
            <Text style={{ color: theme.text, fontSize: 16, flex: 1 }}>Message notifications</Text>
            <Toggle value={messageNotifs} onChange={setMessageNotifs} />
          </View>
          <View style={[styles.toggleRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider }]}>
            <Text style={{ color: theme.text, fontSize: 16, flex: 1 }}>Call notifications</Text>
            <Toggle value={callNotifs} onChange={setCallNotifs} />
          </View>
          <View style={[styles.toggleRow, { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.divider }]}>
            <Text style={{ color: theme.text, fontSize: 16, flex: 1 }}>Show preview</Text>
            <Toggle value={preview} onChange={setPreview} />
          </View>
        </Section>
        <Section>
          <SettingsRow label="Notification color" onPress={() => navigation.navigate('NotificationColor')} last />
        </Section>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  toggleRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, minHeight: 52 },
});
