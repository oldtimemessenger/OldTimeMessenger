import { Ionicons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, type Region } from 'react-native-maps';
import React, { useEffect, useMemo, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { RoutePoint } from '@/lib/routes-storage';

const worldRegion: Region = {
  latitude: 24,
  longitude: 0,
  latitudeDelta: 70,
  longitudeDelta: 120,
};

export default function RoutesMap({
  coordinates,
  showUserLocation = false,
}: {
  coordinates: RoutePoint[];
  showUserLocation?: boolean;
}) {
  const colors = useColors();
  const mapRef = useRef<MapView | null>(null);
  const last = coordinates.at(-1);
  const path = useMemo(
    () => coordinates.map((point) => ({ latitude: point.latitude, longitude: point.longitude })),
    [coordinates],
  );

  useEffect(() => {
    if (!mapRef.current || !path.length) return;
    if (path.length === 1) {
      mapRef.current.animateToRegion({
        latitude: path[0].latitude,
        longitude: path[0].longitude,
        latitudeDelta: 0.012,
        longitudeDelta: 0.012,
      }, 350);
      return;
    }
    mapRef.current.fitToCoordinates(path, {
      edgePadding: { top: 66, right: 36, bottom: 66, left: 36 },
      animated: true,
    });
  }, [path]);

  return (
    <View style={[styles.root, { backgroundColor: colors.mapWater }]}>
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={worldRegion}
        mapType="standard"
        showsBuildings
        showsCompass
        showsScale
        showsUserLocation={showUserLocation}
        showsMyLocationButton={false}
        toolbarEnabled={false}
      >
        {path.length > 1 ? (
          <Polyline
            coordinates={path}
            strokeColor={colors.routeBlue}
            strokeWidth={6}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}
        {last ? (
          <Marker
            coordinate={{ latitude: last.latitude, longitude: last.longitude }}
            pinColor={colors.routePink}
            title="You are here"
            description="Live GPS route position"
          />
        ) : null}
      </MapView>
      <View pointerEvents="none" style={[styles.mapBadge, { backgroundColor: colors.card, borderColor: colors.border }]}>
        <Ionicons name={showUserLocation ? 'navigate' : 'map-outline'} size={14} color={showUserLocation ? colors.routeTeal : colors.routeBlue} />
        <View>
          <Text style={[styles.mapBadgeTitle, { color: colors.foreground }]}>{showUserLocation ? 'LIVE GPS MAP' : 'REAL MAP READY'}</Text>
          <Text style={[styles.mapBadgeBody, { color: colors.mutedForeground }]}>
            {coordinates.length > 1 ? 'Your path updates as you move' : 'Start a route to draw your path'}
          </Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  mapBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    borderWidth: 1,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    shadowColor: '#000',
    shadowOpacity: 0.14,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 3,
  },
  mapBadgeTitle: { fontSize: 10, fontWeight: '900', letterSpacing: 0.6 },
  mapBadgeBody: { fontSize: 10, marginTop: 2 },
});