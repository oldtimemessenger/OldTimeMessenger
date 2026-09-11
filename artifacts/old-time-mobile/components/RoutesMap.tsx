import * as maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useColors } from '@/hooks/useColors';
import type { RoutePoint } from '@/lib/routes-storage';

export default function RoutesMap({ coordinates }: { coordinates: RoutePoint[]; showUserLocation?: boolean }) {
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
      <View style={[styles.fallbackLayer, { opacity: mapState === 'ready' ? 0 : 1 }]} pointerEvents={mapState === 'fallback' ? 'auto' : 'none'}>
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
  colors: { muted: string; mapWater: string; routeBlue: string; foreground: string; mutedForeground: string };
}) {
  return <RasterRouteMap coordinates={coordinates} colors={colors} />;
}

const TILE_SIZE = 256;

function project(latitude: number, longitude: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const safeLatitude = Math.max(-85.0511, Math.min(85.0511, latitude));
  const sine = Math.sin((safeLatitude * Math.PI) / 180);
  return {
    x: ((longitude + 180) / 360) * scale,
    y: (0.5 - Math.log((1 + sine) / (1 - sine)) / (4 * Math.PI)) * scale,
  };
}

function unproject(x: number, y: number, zoom: number) {
  const scale = TILE_SIZE * 2 ** zoom;
  const longitude = (x / scale) * 360 - 180;
  const latitude = (Math.atan(Math.sinh(Math.PI * (1 - (2 * y) / scale))) * 180) / Math.PI;
  return { latitude, longitude };
}

function startingCenter(coordinates: RoutePoint[]) {
  const last = coordinates.at(-1);
  return last ? { latitude: last.latitude, longitude: last.longitude } : { latitude: 20, longitude: 0 };
}

function startingZoom(coordinates: RoutePoint[]) {
  if (!coordinates.length) return 2;
  const latitudes = coordinates.map((point) => point.latitude);
  const longitudes = coordinates.map((point) => point.longitude);
  const span = Math.max(Math.max(...latitudes) - Math.min(...latitudes), Math.max(...longitudes) - Math.min(...longitudes));
  if (span < 0.004) return 16;
  if (span < 0.02) return 14;
  if (span < 0.1) return 12;
  if (span < 0.5) return 10;
  if (span < 2) return 8;
  return 5;
}

function RasterRouteMap({
  coordinates,
  colors,
}: {
  coordinates: RoutePoint[];
  colors: { muted: string; mapWater: string; routeBlue: string; foreground: string; mutedForeground: string };
}) {
  const [viewport, setViewport] = React.useState({ width: 402, height: 220 });
  const [center, setCenter] = React.useState(startingCenter(coordinates));
  const [zoom, setZoom] = React.useState(startingZoom(coordinates));
  const pan = React.useRef<{ pointerX: number; pointerY: number; centerX: number; centerY: number } | null>(null);
  const lastTimestamp = coordinates.at(-1)?.timestamp ?? null;
  const centerPixel = project(center.latitude, center.longitude, zoom);
  const originX = centerPixel.x - viewport.width / 2;
  const originY = centerPixel.y - viewport.height / 2;
  const firstTileX = Math.floor(originX / TILE_SIZE) - 1;
  const firstTileY = Math.floor(originY / TILE_SIZE) - 1;
  const tileCountX = Math.ceil(viewport.width / TILE_SIZE) + 3;
  const tileCountY = Math.ceil(viewport.height / TILE_SIZE) + 3;
  const routePoints = coordinates.map((point) => {
    const screen = project(point.latitude, point.longitude, zoom);
    return `${screen.x - originX},${screen.y - originY}`;
  }).join(' ');
  const lastPoint = coordinates.at(-1);
  const lastScreen = lastPoint ? project(lastPoint.latitude, lastPoint.longitude, zoom) : null;
  const worldTiles = 2 ** zoom;

  React.useEffect(() => {
    if (!lastTimestamp) return;
    const last = coordinates.at(-1);
    if (last) setCenter({ latitude: last.latitude, longitude: last.longitude });
  }, [lastTimestamp]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture?.(event.pointerId);
    pan.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      centerX: centerPixel.x,
      centerY: centerPixel.y,
    };
  };

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!pan.current) return;
    const next = unproject(
      pan.current.centerX - (event.clientX - pan.current.pointerX),
      pan.current.centerY - (event.clientY - pan.current.pointerY),
      zoom,
    );
    setCenter(next);
  };

  const handlePointerUp = () => {
    pan.current = null;
  };

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.preventDefault();
    setZoom((current) => Math.max(1, Math.min(18, current + (event.deltaY < 0 ? 1 : -1))));
  };

  return (
    <View
      style={[styles.webFallback, { backgroundColor: colors.mapWater }]}
      onLayout={(event) => setViewport({ width: Math.max(1, event.nativeEvent.layout.width), height: Math.max(1, event.nativeEvent.layout.height) })}
    >
      {React.createElement('div', {
        onPointerDown: handlePointerDown,
        onPointerMove: handlePointerMove,
        onPointerUp: handlePointerUp,
        onPointerCancel: handlePointerUp,
        onWheel: handleWheel,
        style: { position: 'absolute', inset: 0, overflow: 'hidden', cursor: pan.current ? 'grabbing' : 'grab', touchAction: 'none' },
      }, Array.from({ length: tileCountX * tileCountY }).map((_, index) => {
        const tileX = firstTileX + (index % tileCountX);
        const tileY = firstTileY + Math.floor(index / tileCountX);
        if (tileY < 0 || tileY >= worldTiles) return null;
        const wrappedTileX = ((tileX % worldTiles) + worldTiles) % worldTiles;
        return React.createElement('img', {
          key: `${zoom}-${tileX}-${tileY}`,
          src: `https://tile.openstreetmap.org/${zoom}/${wrappedTileX}/${tileY}.png`,
          alt: '',
          draggable: false,
          style: { position: 'absolute', width: TILE_SIZE, height: TILE_SIZE, left: tileX * TILE_SIZE - originX, top: tileY * TILE_SIZE - originY, userSelect: 'none' },
        });
      }))}
      {React.createElement('svg', { style: styles.routeOverlay, viewBox: `0 0 ${viewport.width} ${viewport.height}`, preserveAspectRatio: 'none', 'aria-hidden': true },
        routePoints ? React.createElement('polyline', { points: routePoints, fill: 'none', stroke: colors.routeBlue, strokeWidth: 6, strokeLinecap: 'round', strokeLinejoin: 'round' }) : null,
        lastScreen ? React.createElement('circle', { cx: lastScreen.x - originX, cy: lastScreen.y - originY, r: 8, fill: colors.routeBlue, stroke: '#fff', strokeWidth: 3 }) : null,
      )}
      <View pointerEvents="none" style={[styles.fallbackMessage, { backgroundColor: colors.muted }]}>
        <Text style={[styles.fallbackTitle, { color: colors.foreground }]}>{coordinates.length ? 'GPS route map' : 'Interactive map ready'}</Text>
        <Text style={[styles.fallbackBody, { color: colors.mutedForeground }]}>Drag to explore · scroll to zoom · OpenStreetMap</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, overflow: 'hidden' },
  fallbackLayer: { ...StyleSheet.absoluteFillObject },
  webFallback: { ...StyleSheet.absoluteFillObject, overflow: 'hidden' },
  routeOverlay: { ...StyleSheet.absoluteFillObject, width: '100%', height: '100%' },
  fallbackMessage: { position: 'absolute', left: 12, right: 12, bottom: 12, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 12, gap: 3, opacity: 0.94 },
  fallbackTitle: { fontSize: 13, fontWeight: '900' },
  fallbackBody: { fontSize: 11, fontWeight: '600' },
});