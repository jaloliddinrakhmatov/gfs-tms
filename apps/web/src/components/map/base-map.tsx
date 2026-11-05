'use client';

import L from 'leaflet';
import { useTheme } from 'next-themes';
import { useEffect } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import { cn } from '@/lib/utils';
import type { LatLng } from '@/lib/types';

// Keyless, muted basemaps (base + label reference layer) that keep data in focus.
const ESRI = 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas';
const TILES = {
  light: { base: `${ESRI}/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}`, labels: `${ESRI}/World_Light_Gray_Reference/MapServer/tile/{z}/{y}/{x}` },
  dark: { base: `${ESRI}/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}`, labels: `${ESRI}/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}` },
};
const ATTRIBUTION = 'Tiles &copy; <a href="https://www.esri.com">Esri</a> &mdash; Esri, HERE, Garmin, &copy; OpenStreetMap contributors';

export const US_CENTER: LatLng = [38.5, -96];

export function BaseMap({
  children,
  className,
  center = US_CENTER,
  zoom = 4,
  interactive = true,
}: {
  children?: React.ReactNode;
  className?: string;
  center?: LatLng;
  zoom?: number;
  interactive?: boolean;
}) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === 'dark' ? 'dark' : 'light';
  return (
    <MapContainer
      center={center}
      zoom={zoom}
      minZoom={3}
      maxZoom={16}
      zoomControl={false}
      scrollWheelZoom={interactive}
      dragging={interactive}
      doubleClickZoom={interactive}
      attributionControl
      className={cn('h-full w-full', className)}
      preferCanvas={false}
    >
      <TileLayer key={`${theme}-base`} url={TILES[theme].base} attribution={ATTRIBUTION} maxZoom={16} />
      <TileLayer key={`${theme}-labels`} url={TILES[theme].labels} maxZoom={16} zIndex={2} />
      {interactive && <ZoomControl />}
      {children}
    </MapContainer>
  );
}

function ZoomControl() {
  const map = useMap();
  useEffect(() => {
    const control = L.control.zoom({ position: 'bottomright' }).addTo(map);
    return () => {
      control.remove();
    };
  }, [map]);
  return null;
}

/** Fits the map to the given points once (or whenever `deps` key changes). */
export function FitBounds({ points, padding = 40, depsKey }: { points: LatLng[]; padding?: number; depsKey?: string }) {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    if (points.length === 1) map.setView(points[0], 7);
    else map.fitBounds(L.latLngBounds(points), { padding: [padding, padding] });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, depsKey ?? points.length]);
  return null;
}

/** Leaflet measures its container on mount; re-measure when layout changes. */
export function InvalidateOnResize() {
  const map = useMap();
  useEffect(() => {
    const el = map.getContainer();
    const ro = new ResizeObserver(() => map.invalidateSize());
    ro.observe(el);
    return () => ro.disconnect();
  }, [map]);
  return null;
}
