import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { QrCode } from 'lucide-react-native';
import { useTheme } from '../../theme/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import Header from '../../components/Header';
import Avatar from '../../components/Avatar';

export default function QrScreen({ navigation }) {
  const { theme } = useTheme();
  const { profile } = useAuth();
  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="QR code" onBack={() => navigation.goBack()} />
      <View style={styles.center}>
        <Avatar name={profile?.display_name || 'You'} color="#C97B4A" size={72} />
        <Text style={{ color: theme.text, fontSize: 20, fontWeight: '600', marginTop: 14 }}>
          {profile?.display_name || 'You'}
        </Text>
        <View style={[styles.qrBox, { backgroundColor: theme.elevated, borderColor: theme.divider }]}>
          <QrCode size={160} color={theme.text} />
        </View>
        <Text style={{ color: theme.muted, fontSize: 13, textAlign: 'center', paddingHorizontal: 40, marginTop: 16 }}>
          Let someone scan this code to start a chat with you on Old Time.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', paddingTop: 40 },
  qrBox: { marginTop: 24, padding: 24, borderRadius: 20, borderWidth: 1 },
});
