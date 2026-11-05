'use client';

import { createColumnHelper } from '@tanstack/react-table';
import { AlertTriangle, Zap } from 'lucide-react';
import { Lane } from '@/components/lane';
import { ShipmentStatusBadge } from '@/components/status-badges';
import { Avatar, Progress } from '@/components/ui/misc';
import { Tooltip } from '@/components/ui/tooltip';
import { EQUIPMENT } from '@/lib/constants';
import { useFleet } from '@/lib/fleet-store';
import { formatDuration, formatMiles, formatMoney, formatSmartDate, metersToMiles } from '@/lib/format';
import type { Shipment } from '@/lib/types';
import { ShipmentRowActions } from './shipment-actions';

/** Progress merges the server snapshot with the live GPS stream, so bars move in real time. */
function LiveProgress({ shipment }: { shipment: Shipment }) {
  const live = useFleet((s) => s.byShipment[shipment.id]);
  if (shipment.status === 'DELIVERED') return <span className="text-xs text-muted-foreground">Completed</span>;
  if (shipment.status !== 'IN_TRANSIT') return <span className="text-xs text-muted-foreground">—</span>;
  const progress = live?.progress ?? shipment.progress;
  const remaining = live?.remainingSeconds ?? shipment.remainingSeconds;
  return (
    <div className="w-28 space-y-1">
      <div className="flex justify-between text-[11px] tabular">
        <span className="font-medium">{Math.round(progress * 100)}%</span>
        <span className="text-muted-foreground">{formatDuration(remaining)}</span>
      </div>
      <Progress value={progress * 100} tone={shipment.isLate ? 'danger' : 'primary'} />
    </div>
  );
}

const col = createColumnHelper<Shipment>();

export const shipmentColumns = [
  col.accessor('reference', {
    header: 'Load',
    cell: ({ row: { original: s } }) => (
      <div className="min-w-0">
        <p className="flex items-center gap-1.5 font-mono text-[13px] font-medium">
          {s.reference}
          {s.priority === 'EXPEDITED' && (
            <Tooltip content="Expedited">
              <Zap className="size-3.5 fill-amber-400 text-amber-500" />
            </Tooltip>
          )}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {s.commodity} · {EQUIPMENT[s.equipment]}
        </p>
      </div>
    ),
  }),
  col.display({
    id: 'lane',
    header: 'Lane',
    cell: ({ row: { original: s } }) => (
      <div>
        <Lane origin={s.origin} destination={s.destination} />
        <p className="mt-1 pl-[18px] text-[11px] text-muted-foreground">{formatMiles(s.distanceMeters)}</p>
      </div>
    ),
  }),
  col.accessor((s) => s.customer.name, {
    id: 'customer',
    header: 'Customer',
    enableSorting: false,
    cell: (info) => <span className="block min-w-32 text-[13px] leading-snug">{info.getValue()}</span>,
  }),
  col.accessor('status', {
    header: 'Status',
    cell: ({ row: { original: s } }) => (
      <div className="flex flex-col items-start gap-1">
        <ShipmentStatusBadge status={s.status} />
        {s.isLate && (
          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-rose-600 dark:text-rose-400">
            <AlertTriangle className="size-3" /> {s.status === 'DELIVERED' ? 'Delivered late' : 'At risk'}
          </span>
        )}
      </div>
    ),
  }),
  col.accessor('pickupAt', {
    header: 'Schedule',
    cell: ({ row: { original: s } }) => (
      <div className="space-y-0.5 whitespace-nowrap text-[12px] tabular">
        <p>
          <span className="inline-block w-7 text-[10px] font-semibold text-muted-foreground">PU</span>
          {formatSmartDate(s.pickupAt)}
        </p>
        <p>
          <span className="inline-block w-7 text-[10px] font-semibold text-muted-foreground">DEL</span>
          {formatSmartDate(s.deliveryBy)}
        </p>
        {s.eta && s.status === 'IN_TRANSIT' && (
          <p className={s.isLate ? 'text-rose-600 dark:text-rose-400' : 'text-muted-foreground'}>
            <span className="inline-block w-7 text-[10px] font-semibold">ETA</span>
            {formatSmartDate(s.eta)}
          </p>
        )}
      </div>
    ),
  }),
  col.display({
    id: 'driver',
    header: 'Driver · Truck',
    cell: ({ row: { original: s } }) =>
      s.driver ? (
        <div className="flex items-center gap-2">
          <Avatar name={s.driver.name} className="size-7 text-[10px]" />
          <div className="leading-tight">
            <p className="whitespace-nowrap text-[13px]">{s.driver.name}</p>
            <p className="font-mono text-[11px] text-muted-foreground">{s.vehicle?.unitNumber}</p>
          </div>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">Unassigned</span>
      ),
  }),
  col.display({ id: 'progress', header: 'Progress', cell: ({ row }) => <LiveProgress shipment={row.original} /> }),
  col.accessor('rateCents', {
    header: 'Rate',
    meta: { align: 'right' },
    cell: ({ row: { original: s } }) => (
      <div className="tabular">
        <p className="text-[13px] font-medium">{formatMoney(s.rateCents)}</p>
        <p className="text-[11px] text-muted-foreground">
          {formatMoney(Math.round(s.rateCents / Math.max(1, metersToMiles(s.distanceMeters))), { cents: true })}/mi
        </p>
      </div>
    ),
  }),
  col.display({
    id: 'actions',
    header: '',
    meta: { className: 'w-10' },
    cell: ({ row }) => <ShipmentRowActions shipment={row.original} />,
  }),
];
