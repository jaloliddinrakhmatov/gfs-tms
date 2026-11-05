'use client';

import L from 'leaflet';
import { useEffect, useRef } from 'react';
import { Polyline, useMap } from 'react-leaflet';
import { useFleet } from '@/lib/fleet-store';
import { formatDuration } from '@/lib/format';
import type { LatLng, VehiclePosition } from '@/lib/types';
import { BaseMap, InvalidateOnResize } from './base-map';
import { TruckMarker } from './markers';

function FlyToSelected({ selected }: { selected: VehiclePosition | null }) {
  const map = useMap();
  const id = selected?.vehicleId;
  useEffect(() => {
    if (selected) map.flyTo([selected.lat, selected.lng], Math.max(map.getZoom(), 6), { duration: 0.8 });
    // fly only when the selection changes, not on every GPS tick
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, map]);
  return null;
}

/** Frame the whole moving fleet the first time positions arrive. */
function FitFleetOnce({ points }: { points: [number, number][] }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || points.length < 2) return;
    done.current = true;
    map.fitBounds(L.latLngBounds(points), { padding: [48, 48], maxZoom: 6 });
  }, [map, points]);
  return null;
}

export default function FleetMap({
  selectedRoute,
  lateShipments,
  compact = false,
}: {
  selectedRoute?: LatLng[] | null;
  lateShipments?: Set<string>;
  compact?: boolean;
}) {
  const positions = useFleet((s) => s.positions);
  const selectedId = useFleet((s) => s.selectedVehicleId);
  const select = useFleet((s) => s.select);
  const list = Object.values(positions);
  const selected = selectedId ? positions[selectedId] ?? null : null;

  return (
    <BaseMap interactive={!compact} zoom={compact ? 3.6 : 4.4}>
      <InvalidateOnResize />
      <FitFleetOnce points={list.map((p) => [p.lat, p.lng])} />
      {!compact && <FlyToSelected selected={selected} />}
      {selectedRoute && selectedRoute.length > 1 && (
        <>
          <Polyline positions={selectedRoute} pathOptions={{ color: '#6366f1', weight: 8, opacity: 0.12 }} />
          <Polyline positions={selectedRoute} pathOptions={{ color: '#6366f1', weight: 3, opacity: 0.8, dashArray: '1 7', lineCap: 'round' }} />
        </>
      )}
      {list.map((p) => (
        <TruckMarker
          key={p.vehicleId}
          position={[p.lat, p.lng]}
          heading={p.heading}
          selected={p.vehicleId === selectedId}
          late={lateShipments?.has(p.shipmentId)}
          onClick={compact ? undefined : () => select(p.vehicleId === selectedId ? null : p.vehicleId)}
          tooltip={
            <div className="space-y-0.5">
              <p className="font-semibold">
                {p.unitNumber} <span className="font-normal text-muted-foreground">· {p.reference}</span>
              </p>
              <p className="text-muted-foreground">
                {p.originCode} → {p.destinationCode} · {p.speedMph} mph · ETA {formatDuration(p.remainingSeconds)}
              </p>
            </div>
          }
        />
      ))}
    </BaseMap>
  );
}
