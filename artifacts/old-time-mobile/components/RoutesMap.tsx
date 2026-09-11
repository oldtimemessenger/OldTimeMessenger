import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Line, Polyline as SvgPolyline, Rect } from 'react-native-svg';
import { useColors } from '@/hooks/useColors';
import type { RoutePoint } from '@/lib/routes-storage';

export default function RoutesMap({ coordinates }: { coordinates: RoutePoint[] }) {
  const colors = useColors();
  const [mapState, setMapState] = React.useState<'loading' | 'ready' | 'fallback'>('loading');
  const mapElement = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<maplibregl.Map | null>(null);
  const markerRef = React.useRef<maplibregl.Marker | null>(null);
  const last = coordinates.at(-1);
  const routeFeature = React.useMemo<GeoJSON.FeatureCollection<GeoJSON.LineString>>(() => ({
    type: 'FeatureCollection',
    features: coordinates.length > 1 ? [{
      type: 'Feature',
      properties: {},
      geometry: {
        type: 'LineString',
        coordinates: coordinates.map((point) => [point.longitude, point.latitude]),
      },
    }] : [],
  }), [coordinates]);

  React.useEffect(() => {
    if (!mapElement.current || mapRef.current) return;
    let fallbackTimer: ReturnType<typeof setTimeout> | null = setTimeout(() => {
      setMapState((current) => current === 'loading' ? 'fallback' : current);
    }, 3500);
    try {
      const canvas = document.createElement('canvas');
      if (!canvas.getContext('webgl2')) {
        setMapState('fallback');
        if (fallbackTimer) clearTimeout(fallbackTimer);
        return;
      }
      const map = new maplibregl.Map({
        container: mapElement.current,
        style: 'https://tiles.openfreemap.org/styles/liberty',
        center: last ? [last.longitude, last.latitude] : [0, 20],
        zoom: last ? 13 : 1,
        attributionControl: false,
      });
      mapRef.current = map;
      map.on('error', () => {
        setMapState('fallback');
        if (fallbackTimer) clearTimeout(fallbackTimer);
      });
      map.on('load', () => {
        map.addSource('route', { type: 'geojson', data: routeFeature });
        map.addLayer({
          id: 'route-line',
          type: 'line',
          source: 'route',
          layout: { 'line-cap': 'round', 'line-join': 'round' },
          paint: { 'line-color': colors.primary, 'line-width': 5, 'line-opacity': 0.9 },
        });
        setMapState('ready');
        if (fallbackTimer) clearTimeout(fallbackTimer);
        updateMap(map);
      });
    } catch {
      setMapState('fallback');
      if (fallbackTimer) clearTimeout(fallbackTimer);
    }
    return () => {
      if (fallbackTimer) clearTimeout(fallbackTimer);
      markerRef.current?.remove();
      markerRef.current = null;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  React.useEffect(() => {
    if (mapState !== 'ready' || !mapRef.current || !mapRef.current.isStyleLoaded()) return;
    updateMap(mapRef.current);
  }, [mapState, routeFeature, last, colors.primary]);

  return (
    <View style={[styles.root, { backgroundColor: colors.muted }]}>
      <View style={[styles.fallbackLayer, { opacity: mapState === 'ready' ? 0 : 1 }]} pointerEvents="none">
        <RouteFallback coordinates={coordinates} colors={colors} />
      </View>
      {React.createElement('div', {
        ref: (element: HTMLDivElement | null) => { mapElement.current = element; },
        style: { position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: mapState === 'ready' ? 1 : 0 },
      })}
    </View>
  );

  function updateMap(map: maplibregl.Map) {
    const source = map.getSource('route') as maplibregl.GeoJSONSource | undefined;
    if (source) source.setData(routeFeature);
    markerRef.current?.remove();
    markerRef.current = null;
    if (last) {
      markerRef.current = new maplibregl.Marker({ color: colors.primary }).setLngLat([last.longitude, last.latitude]).addTo(map);
      map.easeTo({ center: [last.longitude, last.latitude], duration: 350 });
    }
  }
}

function RouteFallback({
  coordinates,
  colors,
}: {
  coordinates: RoutePoint[];
  colors: { muted: string; border: string; primary: string; foreground: string; mutedForeground: string };
}) {
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
    <>
      <Svg style={StyleSheet.absoluteFill} viewBox="0 0 100 100" preserveAspectRatio="none">
        <Rect width="100" height="100" fill={colors.muted} />
        {[20, 40, 60, 80].map((value) => <Line key={`v-${value}`} x1={value} y1="0" x2={value} y2="100" stroke={colors.border} strokeWidth="0.35" opacity="0.7" />)}
        {[20, 40, 60, 80].map((value) => <Line key={`h-${value}`} x1="0" y1={value} x2="100" y2={value} stroke={colors.border} strokeWidth="0.35" opacity="0.7" />)}
        {points ? <SvgPolyline points={points} fill="none" stroke={colors.primary} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" /> : null}
        <Circle cx={currentPoint[0]} cy={currentPoint[1]} r="2.4" fill={colors.primary} />
      </Svg>
      <View pointerEvents="none" style={styles.fallbackMessage}>
        <Text style={[styles.fallbackTitle, { color: colors.foreground }]}>
          {coordinates.length ? 'Route preview' : 'Ready to record'}
        </Text>
        <Text style={[styles.fallbackBody, { color: colors.mutedForeground }]}>
          {coordinates.length ? 'WebGL is unavailable, so the route is shown in a lightweight preview.' : 'Your live route will appear here.'}
        </Text>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  fallbackLayer: { ...StyleSheet.absoluteFillObject },
  fallbackMessage: { position: 'absolute', left: 16, right: 16, bottom: 16, gap: 3 },
  fallbackTitle: { fontSize: 13, fontWeight: '900' },
  fallbackBody: { fontSize: 11, fontWeight: '600' },
});