import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Smartphone } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import Header from '../../components/Header';
import Section from '../../components/Section';

export default function DevicesScreen({ navigation }) {
  const { theme } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="Linked Devices" onBack={() => navigation.goBack()} />
      <View style={{ paddingVertical: 16 }}>
        <Section>
          <View style={styles.row}>
            <View style={[styles.icon, { backgroundColor: theme.green }]}>
              <Smartphone size={18} color="#fff" />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ color: theme.text, fontSize: 16 }}>This device</Text>
              <Text style={{ color: theme.muted, fontSize: 13, marginTop: 2 }}>Active now</Text>
            </View>
          </View>
        </Section>
        <Text style={{ color: theme.muted, fontSize: 13, paddingHorizontal: 20, lineHeight: 18 }}>
          Link a computer or tablet by scanning a QR code from Settings on that device. Session keys stay on your devices.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', padding: 16, gap: 14 },
  icon: { width: 36, height: 36, borderRadius: 10, justifyContent: 'center', alignItems: 'center' },
});
