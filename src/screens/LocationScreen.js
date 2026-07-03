import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { MapPin, Check } from 'lucide-react-native';
import * as Location from 'expo-location';
import { useTheme } from '../theme/ThemeContext';
import Header from '../components/Header';

export default function LocationScreen({ navigation, route }) {
  const { theme } = useTheme();
  const otherUser = route.params?.otherUser;
  const [sharing, setSharing] = useState(false);
  const [duration, setDuration] = useState('15 minutes');

  const toggleShare = async () => {
    if (!sharing) {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') { Alert.alert('Permission needed', 'Enable location access to share it.'); return; }
    }
    setSharing((s) => !s);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.bg }}>
      <Header title="Share Live Location" onBack={() => navigation.goBack()} />
      <View style={[styles.map, { backgroundColor: '#122019' }]}><MapPin size={34} color={theme.greenBright} /></View>
      <View style={{ padding: 18 }}>
        <Text style={{ color: theme.text, fontSize: 15.5, fontWeight: '600', marginBottom: 4 }}>
          {sharing ? `Sharing live location with ${otherUser?.display_name || 'contact'}` : 'Share your live location'}
        </Text>
        <Text style={{ color: theme.muted, fontSize: 13, marginBottom: 16 }}>Updates automatically and stops after the time you choose.</Text>
        {!sharing && (
          <View style={{ backgroundColor: theme.elevated, borderRadius: 12, overflow: 'hidden', marginBottom: 16 }}>
            {['15 minutes', '1 hour', '8 hours'].map((d, i) => (
              <TouchableOpacity key={d} onPress={() => setDuration(d)} style={[styles.durationRow, i && { borderTopWidth: 1, borderTopColor: theme.divider }]}>
                <Text style={{ color: theme.text, fontSize: 15 }}>{d}</Text>
                {duration === d && <Check size={17} color={theme.greenBright} />}
              </TouchableOpacity>
            ))}
          </View>
        )}
        <TouchableOpacity onPress={toggleShare} style={[styles.button, { backgroundColor: sharing ? theme.danger : theme.greenBright }]}>
          <Text style={{ color: sharing ? '#fff' : '#06140F', fontWeight: '700', fontSize: 15.5 }}>
            {sharing ? 'Stop Sharing' : `Share for ${duration}`}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  map: { height: 220, justifyContent: 'center', alignItems: 'center' },
  durationRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 13 },
  button: { borderRadius: 24, padding: 13, alignItems: 'center' },
});
