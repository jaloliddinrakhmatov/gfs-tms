'use client';

import { Polyline } from 'react-leaflet';
import type { LatLng, Location, VehiclePosition } from '@/lib/types';
import { BaseMap, FitBounds, InvalidateOnResize } from './base-map';
import { StopMarker, TruckMarker } from './markers';

/** A single lane: road polyline, stops, travelled portion and (optionally) the live truck. */
export default function RouteMap({
  route,
  origin,
  destination,
  live,
  progress = 0,
  interactive = true,
}: {
  route: LatLng[];
  origin: Location;
  destination: Location;
  live?: VehiclePosition | null;
  progress?: number;
  interactive?: boolean;
}) {
  const cut = Math.max(1, Math.round(route.length * (live?.progress ?? progress)));
  const travelled = live ? [...route.slice(0, cut), [live.lat, live.lng] as LatLng] : route.slice(0, cut);
  const key = `${origin.code}-${destination.code}-${route.length}`;

  return (
    <BaseMap interactive={interactive}>
      <InvalidateOnResize />
      <FitBounds points={route.length ? route : [[origin.lat, origin.lng], [destination.lat, destination.lng]]} depsKey={key} padding={48} />
      {route.length > 1 && (
        <>
          <Polyline positions={route} pathOptions={{ color: '#6366f1', weight: 8, opacity: 0.12 }} />
          <Polyline positions={route} pathOptions={{ color: '#818cf8', weight: 3.5, opacity: 0.55, dashArray: '2 7', lineCap: 'round' }} />
          {travelled.length > 1 && <Polyline positions={travelled} pathOptions={{ color: '#4f46e5', weight: 4, opacity: 0.95 }} />}
        </>
      )}
      <StopMarker position={[origin.lat, origin.lng]} kind="origin" label={`${origin.name}, ${origin.state}`} />
      <StopMarker position={[destination.lat, destination.lng]} kind="destination" label={`${destination.name}, ${destination.state}`} />
      {live && <TruckMarker position={[live.lat, live.lng]} heading={live.heading} selected />}
    </BaseMap>
  );
}
