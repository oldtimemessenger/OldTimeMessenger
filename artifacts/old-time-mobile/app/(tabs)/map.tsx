import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import React, { useEffect, useState } from 'react';
import { Alert, Linking, Pressable, Share, StyleSheet, Text, View } from 'react-native';
import { Screen } from '@/components/ui';
import { useColors } from '@/hooks/useColors';

type Coordinate = { latitude: number; longitude: number };

export default function MapScreen() {
  const colors = useColors();
  const [permission, requestPermission] = Location.useForegroundPermissions();
  const [location, setLocation] = useState<Coordinate | null>(null);
  const [loading, setLoading] = useState(false);

  async function refreshLocation() {
    setLoading(true);
    try {
      let granted = permission?.granted;
      if (!granted) {
        const result = await requestPermission();
        granted = result.granted;
        if (!granted) {
          Alert.alert('Location is off', 'Enable location access for Old Time in your device settings.');
          return;
        }
      }
      const result = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      setLocation(result.coords);
    } catch {
      Alert.alert('Location unavailable', 'Old Time could not read your current location. Try again outdoors or check device location services.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (permission?.granted && !location) void refreshLocation();
  }, [permission?.granted]);

  async function openInMaps() {
    if (!location) return;
    await Linking.openURL(`https://maps.google.com/?q=${location.latitude},${location.longitude}`);
  }

  async function shareLocation() {
    if (!location) return;
    await Share.share({
      message: `My location: https://maps.google.com/?q=${location.latitude},${location.longitude}`,
    });
  }

  return (
    <Screen title="Location">
      <View style={styles.content}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <View style={[styles.icon, { backgroundColor: colors.secondary }]}>
            <Ionicons name="location" size={34} color={colors.primary} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>
            {location ? 'Current location ready' : 'Share your current location'}
          </Text>
          <Text style={[styles.description, { color: colors.mutedForeground }]}>
            {location
              ? `${location.latitude.toFixed(5)}, ${location.longitude.toFixed(5)}`
              : 'Old Time reads your location only after you grant permission. Nothing is uploaded automatically.'}
          </Text>
          <Pressable onPress={() => void refreshLocation()} disabled={loading} style={[styles.primary, { backgroundColor: colors.primary, opacity: loading ? 0.55 : 1 }]}>
            <Ionicons name="locate-outline" size={19} color="#fff" />
            <Text style={styles.primaryText}>{loading ? 'Locating…' : location ? 'Refresh location' : 'Enable location'}</Text>
          </Pressable>
        </View>
        {location ? (
          <View style={styles.actions}>
            <Pressable onPress={() => void openInMaps()} style={[styles.action, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Ionicons name="map-outline" size={22} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.foreground }]}>Open in Maps</Text>
            </Pressable>
            <Pressable onPress={() => void shareLocation()} style={[styles.action, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <Ionicons name="share-outline" size={22} color={colors.primary} />
              <Text style={[styles.actionText, { color: colors.foreground }]}>Share location</Text>
            </Pressable>
          </View>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flex: 1, padding: 16, justifyContent: 'center', paddingBottom: 100 },
  card: { borderRadius: 18, borderWidth: 1, padding: 24, alignItems: 'center' },
  icon: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  title: { fontSize: 21, fontWeight: '800', textAlign: 'center' },
  description: { fontSize: 14, lineHeight: 21, textAlign: 'center', marginTop: 8, marginBottom: 22 },
  primary: { minHeight: 48, borderRadius: 12, paddingHorizontal: 20, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' },
  primaryText: { color: '#fff', fontWeight: '800' },
  actions: { marginTop: 14, gap: 10 },
  action: { minHeight: 54, borderWidth: 1, borderRadius: 12, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, gap: 12 },
  actionText: { fontSize: 16, fontWeight: '700' },
});