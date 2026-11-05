'use client';

import L from 'leaflet';
import { useEffect, useMemo, useRef } from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import type { LatLng } from '@/lib/types';

function truckHtml(selected: boolean, late: boolean) {
  const ring = late ? '#f43f5e' : '#6366f1';
  return `
    <div style="position:relative;width:34px;height:34px;display:flex;align-items:center;justify-content:center">
      ${selected ? `<span style="position:absolute;inset:0;border-radius:9999px;background:${ring};opacity:.35" class="animate-pulse-ring"></span>` : ''}
      <span class="heading" style="position:absolute;inset:0;display:flex;justify-content:center;transition:transform .6s ease">
        <svg width="34" height="34" viewBox="0 0 34 34"><path d="M17 1 L21 8 L13 8 Z" fill="${ring}" /></svg>
      </span>
      <span style="width:${selected ? 24 : 20}px;height:${selected ? 24 : 20}px;border-radius:9999px;background:${ring};border:2.5px solid white;box-shadow:0 2px 8px rgba(15,23,42,.35);display:flex;align-items:center;justify-content:center">
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"><path d="M14 18V6a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2v11a1 1 0 0 0 1 1h2"/><path d="M15 18H9"/><path d="M19 18h2a1 1 0 0 0 1-1v-3.65a1 1 0 0 0-.22-.624l-3.48-4.35A1 1 0 0 0 17.52 8H14"/><circle cx="17" cy="18" r="2"/><circle cx="7" cy="18" r="2"/></svg>
      </span>
    </div>`;
}

/**
 * A truck marker whose icon DOM is stable across GPS updates: position changes glide via a
 * CSS transform transition and heading is applied imperatively (no icon re-creation per tick).
 */
export function TruckMarker({
  position,
  heading,
  selected,
  late = false,
  onClick,
  tooltip,
}: {
  position: LatLng;
  heading: number;
  selected?: boolean;
  late?: boolean;
  onClick?: () => void;
  tooltip?: React.ReactNode;
}) {
  const ref = useRef<L.Marker>(null);
  const icon = useMemo(
    () =>
      L.divIcon({
        className: 'truck-icon',
        html: truckHtml(!!selected, late),
        iconSize: [34, 34],
        iconAnchor: [17, 17],
      }),
    [selected, late],
  );

  useEffect(() => {
    const el = ref.current?.getElement()?.querySelector<HTMLElement>('.heading');
    if (el) el.style.transform = `rotate(${heading}deg)`;
  }, [heading, icon]);

  return (
    <Marker
      ref={ref}
      position={position}
      icon={icon}
      zIndexOffset={selected ? 1000 : 0}
      eventHandlers={onClick ? { click: onClick } : undefined}
    >
      {tooltip && (
        <Tooltip direction="top" offset={[0, -16]} className="tms-tooltip" opacity={1}>
          {tooltip}
        </Tooltip>
      )}
    </Marker>
  );
}

const pinIcon = (kind: 'origin' | 'destination', label: string) =>
  L.divIcon({
    className: '',
    iconSize: [0, 0],
    html: `
      <div style="position:absolute;transform:translate(-50%,-50%);display:flex;align-items:center;gap:6px;white-space:nowrap">
        <span style="width:14px;height:14px;border-radius:9999px;border:3px solid ${kind === 'origin' ? '#0f172a' : '#6366f1'};background:${kind === 'origin' ? 'white' : '#6366f1'};box-shadow:0 0 0 3px rgba(255,255,255,.9),0 2px 6px rgba(0,0,0,.25)"></span>
        <span style="font:600 11px/1 var(--font-geist-sans);padding:4px 7px;border-radius:6px;background:white;color:#0f172a;box-shadow:0 2px 8px rgba(15,23,42,.18)">${label}</span>
      </div>`,
  });

export function StopMarker({ position, kind, label }: { position: LatLng; kind: 'origin' | 'destination'; label: string }) {
  const icon = useMemo(() => pinIcon(kind, label), [kind, label]);
  return <Marker position={position} icon={icon} interactive={false} />;
}
