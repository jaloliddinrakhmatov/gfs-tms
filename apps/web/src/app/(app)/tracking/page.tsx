'use client';

import { ArrowRight, Gauge, MapPinned, Navigation, Search, Timer, X } from 'lucide-react';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { FleetMap } from '@/components/map';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Avatar, EmptyState, Progress } from '@/components/ui/misc';
import { CITY_NAMES } from '@/lib/cities';
import { useFleet } from '@/lib/fleet-store';
import { formatDuration, formatSmartDate } from '@/lib/format';
import { useShipment, useShipments } from '@/lib/queries';
import { cn } from '@/lib/utils';

export default function TrackingPage() {
  const positions = useFleet((s) => s.positions);
  const selectedId = useFleet((s) => s.selectedVehicleId);
  const select = useFleet((s) => s.select);
  const connected = useFleet((s) => s.connected);
  const lastUpdate = useFleet((s) => s.lastUpdate);
  const [query, setQuery] = useState('');

  const { data: inTransit } = useShipments({ status: ['IN_TRANSIT'], pageSize: 100 });
  const late = useMemo(() => new Set(inTransit?.data.filter((s) => s.isLate).map((s) => s.id)), [inTransit]);

  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    return Object.values(positions)
      .filter((p) =>
        !q ||
        [p.unitNumber, p.reference, p.driverName ?? '', p.originCode, p.destinationCode, CITY_NAMES[p.originCode] ?? '', CITY_NAMES[p.destinationCode] ?? '']
          .some((v) => v.toLowerCase().includes(q)),
      )
      .sort((a, b) => a.remainingSeconds - b.remainingSeconds);
  }, [positions, query]);

  const selected = selectedId ? positions[selectedId] : undefined;
  const { data: detail } = useShipment(selected?.shipmentId);
  const avgSpeed = list.length ? Math.round(list.reduce((s, p) => s + p.speedMph, 0) / list.length) : 0;

  return (
    <div className="-m-4 flex h-[calc(100dvh-4rem)] flex-col sm:-m-6 lg:flex-row">
      <aside className="flex max-h-[45%] w-full shrink-0 flex-col border-b border-border bg-card lg:max-h-none lg:w-[360px] lg:border-b-0 lg:border-r">
        <div className="space-y-3 border-b border-border p-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-base font-semibold">Live tracking</h1>
              <p className="text-xs text-muted-foreground">
                {connected ? `Updated ${lastUpdate ? 'just now' : '—'}` : 'Reconnecting…'} · {list.length} trucks moving
              </p>
            </div>
            <Badge tone={connected ? 'green' : 'neutral'} dot pulse={connected}>
              {connected ? 'Live' : 'Offline'}
            </Badge>
          </div>
          <div className="grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-muted/60 p-2">
              <p className="text-base font-semibold tabular">{list.length}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Moving</p>
            </div>
            <div className="rounded-lg bg-muted/60 p-2">
              <p className="text-base font-semibold tabular">{avgSpeed}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Avg mph</p>
            </div>
            <div className="rounded-lg bg-muted/60 p-2">
              <p className={cn('text-base font-semibold tabular', late.size && 'text-rose-600 dark:text-rose-400')}>{late.size}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">At risk</p>
            </div>
          </div>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Truck, load, driver or city"
              className="h-9 w-full rounded-lg border border-input bg-card pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-3 focus:ring-ring/15"
            />
          </div>
        </div>

        <ul className="flex-1 divide-y divide-border overflow-y-auto scrollbar-thin">
          {list.length === 0 ? (
            <EmptyState icon={MapPinned} title={connected ? 'No trucks match' : 'Waiting for GPS…'} description="Trucks appear here as soon as they start reporting." />
          ) : (
            list.map((p) => {
              const active = p.vehicleId === selectedId;
              const atRisk = late.has(p.shipmentId);
              return (
                <li key={p.vehicleId}>
                  <button
                    onClick={() => select(active ? null : p.vehicleId)}
                    className={cn(
                      'relative w-full cursor-pointer px-4 py-3 text-left transition-colors',
                      active ? 'bg-primary-soft/60' : 'hover:bg-muted/60',
                    )}
                  >
                    {active && <span className="absolute inset-y-0 left-0 w-[3px] bg-primary" />}
                    <div className="flex items-center justify-between gap-2">
                      <p className="font-mono text-[13px] font-semibold">{p.unitNumber}</p>
                      <span className="flex items-center gap-1 text-[11px] text-muted-foreground tabular">
                        <Gauge className="size-3" /> {p.speedMph} mph
                      </span>
                    </div>
                    <p className="mt-0.5 truncate text-xs text-muted-foreground">
                      {CITY_NAMES[p.originCode]} → {CITY_NAMES[p.destinationCode]} · {p.driverName}
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <Progress value={p.progress * 100} tone={atRisk ? 'danger' : 'primary'} className="h-1" />
                      <span className={cn('shrink-0 text-[11px] tabular', atRisk ? 'font-medium text-rose-600 dark:text-rose-400' : 'text-muted-foreground')}>
                        {formatDuration(p.remainingSeconds)}
                      </span>
                    </div>
                  </button>
                </li>
              );
            })
          )}
        </ul>
      </aside>

      <div className="relative min-h-0 flex-1">
        <FleetMap selectedRoute={detail && selected && detail.id === selected.shipmentId ? detail.route : null} lateShipments={late} />

        {selected && (
          <Card className="absolute left-3 right-3 top-3 z-[500] animate-fade-in p-4 shadow-xl sm:left-auto sm:w-[340px]">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="flex items-center gap-2 font-mono text-sm font-semibold">
                  {selected.unitNumber}
                  {late.has(selected.shipmentId) && <Badge tone="red">At risk</Badge>}
                </p>
                <p className="text-xs text-muted-foreground">Load {selected.reference}</p>
              </div>
              <Button variant="ghost" size="icon-sm" onClick={() => select(null)} aria-label="Close">
                <X />
              </Button>
            </div>

            <div className="mt-3 flex items-center gap-2.5">
              <Avatar name={selected.driverName ?? '?'} className="size-8" />
              <div className="text-[13px] leading-tight">
                <p className="font-medium">{selected.driverName}</p>
                <p className="text-xs text-muted-foreground">{detail?.customer.name ?? '…'}</p>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-2">
              <div className="rounded-lg bg-muted/60 p-2">
                <Gauge className="size-3.5 text-muted-foreground" />
                <p className="mt-1 text-sm font-semibold tabular">{selected.speedMph} mph</p>
              </div>
              <div className="rounded-lg bg-muted/60 p-2">
                <Navigation className="size-3.5 text-muted-foreground" style={{ transform: `rotate(${selected.heading}deg)` }} />
                <p className="mt-1 text-sm font-semibold tabular">{selected.heading}°</p>
              </div>
              <div className="rounded-lg bg-muted/60 p-2">
                <Timer className="size-3.5 text-muted-foreground" />
                <p className="mt-1 text-sm font-semibold tabular">{formatDuration(selected.remainingSeconds)}</p>
              </div>
            </div>

            <div className="mt-4">
              <div className="mb-1.5 flex justify-between text-xs">
                <span className="font-medium">{CITY_NAMES[selected.originCode]}</span>
                <span className="text-muted-foreground tabular">{Math.round(selected.progress * 100)}%</span>
                <span className="font-medium">{CITY_NAMES[selected.destinationCode]}</span>
              </div>
              <Progress value={selected.progress * 100} />
              {detail && (
                <p className="mt-2 text-[11px] text-muted-foreground">
                  Deliver by {formatSmartDate(detail.deliveryBy)} · {selected.lat.toFixed(3)}, {selected.lng.toFixed(3)}
                </p>
              )}
            </div>

            <Button variant="outline" size="sm" className="mt-4 w-full" asChild>
              <Link href={`/shipments/${selected.shipmentId}`}>
                Open load <ArrowRight />
              </Link>
            </Button>
          </Card>
        )}
      </div>
    </div>
  );
}
