import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline as SvgPolyline, Rect } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import type { RoutePoint } from '@/lib/routes-storage';

export default function RoutesMap({ coordinates }: { coordinates: RoutePoint[] }) {
  const colors = useColors();
  const padding = 12;
  const longitudes = coordinates.map((point) => point.longitude);
  const latitudes = coordinates.map((point) => point.latitude);
  const minLongitude = longitudes.length ? Math.min(...longitudes) : -1;
  const maxLongitude = longitudes.length ? Math.max(...longitudes) : 1;
  const minLatitude = latitudes.length ? Math.min(...latitudes) : -1;
  const maxLatitude = latitudes.length ? Math.max(...latitudes) : 1;
  const longitudeSpan = Math.max(maxLongitude - minLongitude, 0.0001);
  const latitudeSpan = Math.max(maxLatitude - minLatitude, 0.0001);
  const project = (point: RoutePoint) => [
    padding + ((point.longitude - minLongitude) / longitudeSpan) * (100 - padding * 2),
    100 - padding - ((point.latitude - minLatitude) / latitudeSpan) * (100 - padding * 2),
  ];
  const points = coordinates.map(project).map(([x, y]) => `${x},${y}`).join(' ');
  const current = coordinates.at(-1);
  const currentPoint = current ? project(current) : [50, 50];

  return (
    <View style={[styles.root, { backgroundColor: colors.muted }]}>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
        <Rect width="100" height="100" fill={colors.muted} />
        {[20, 40, 60, 80].map((value) => <Line key={`v-${value}`} x1={value} y1="0" x2={value} y2="100" stroke={colors.border} strokeWidth="0.35" opacity="0.7" />)}
        {[20, 40, 60, 80].map((value) => <Line key={`h-${value}`} x1="0" y1={value} x2="100" y2={value} stroke={colors.border} strokeWidth="0.35" opacity="0.7" />)}
        {points ? <SvgPolyline points={points} fill="none" stroke={colors.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /> : null}
        <Circle cx={currentPoint[0]} cy={currentPoint[1]} r="2.4" fill={colors.primary} />
      </Svg>
      <View pointerEvents="none" style={styles.fallbackMessage}>
        <Text style={[styles.fallbackTitle, { color: colors.foreground }]}>{coordinates.length ? 'Route preview' : 'Ready to record'}</Text>
        <Text style={[styles.fallbackBody, { color: colors.mutedForeground }]}>{coordinates.length ? 'Your route is shown in a lightweight preview.' : 'Your live route will appear here.'}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  fallbackMessage: { position: 'absolute', left: 16, right: 16, bottom: 16, gap: 3 },
  fallbackTitle: { fontSize: 13, fontWeight: '900' },
  fallbackBody: { fontSize: 11, fontWeight: '600' },
});