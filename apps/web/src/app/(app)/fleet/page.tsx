'use client';

import { createColumnHelper } from '@tanstack/react-table';
import { Fuel, MoreHorizontal, Star, Truck, UserRound, Wrench } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { SearchInput } from '@/components/data-table/search-input';
import { PageHeader } from '@/components/page-header';
import { DriverStatusBadge, VehicleStatusBadge } from '@/components/status-badges';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, EmptyState, Progress } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTableState } from '@/hooks/use-table-state';
import { hasRole, useAuth } from '@/lib/auth-store';
import { DRIVER_STATUS, EQUIPMENT, VEHICLE_STATUS } from '@/lib/constants';
import { formatNumber } from '@/lib/format';
import { useDrivers, useSetDriverStatus, useSetVehicleStatus, useVehicles } from '@/lib/queries';
import type { CurrentLoad, Driver, DriverStatus, Vehicle, VehicleStatus } from '@/lib/types';

function LoadCell({ load }: { load: CurrentLoad | null }) {
  if (!load) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <Link href={`/shipments/${load.id}`} onClick={(e) => e.stopPropagation()} className="group block w-40">
      <p className="font-mono text-xs font-medium text-primary group-hover:underline">{load.reference}</p>
      <p className="truncate text-[11px] text-muted-foreground">
        {load.origin.name} → {load.destination.name}
      </p>
      {load.status === 'IN_TRANSIT' && <Progress value={load.progress * 100} className="mt-1 h-1" />}
    </Link>
  );
}

const vcol = createColumnHelper<Vehicle>();
const dcol = createColumnHelper<Driver>();

function VehicleActions({ v }: { v: Vehicle }) {
  const set = useSetVehicleStatus();
  const can = hasRole(useAuth((s) => s.user), 'DISPATCHER');
  if (!can) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Truck actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {v.status !== 'MAINTENANCE' ? (
          <DropdownMenuItem disabled={!!v.currentLoad} onSelect={() => set.mutate({ id: v.id, status: 'MAINTENANCE' })}>
            <Wrench /> Send to maintenance
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem onSelect={() => set.mutate({ id: v.id, status: 'IDLE' })}>
            <Truck /> Return to service
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function DriverActions({ d }: { d: Driver }) {
  const set = useSetDriverStatus();
  const can = hasRole(useAuth((s) => s.user), 'DISPATCHER');
  if (!can) return null;
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-sm" aria-label="Driver actions">
          <MoreHorizontal />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {d.status === 'OFF_DUTY' ? (
          <DropdownMenuItem onSelect={() => set.mutate({ id: d.id, status: 'AVAILABLE' })}>
            <UserRound /> Set available
          </DropdownMenuItem>
        ) : (
          <DropdownMenuItem disabled={!!d.currentLoad} onSelect={() => set.mutate({ id: d.id, status: 'OFF_DUTY' })}>
            <UserRound /> Set off duty
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

const vehicleColumns = [
  vcol.accessor('unitNumber', {
    header: 'Unit',
    cell: ({ row: { original: v } }) => (
      <div className="flex items-center gap-3">
        <span className="flex size-9 items-center justify-center rounded-lg bg-muted">
          <Truck className="size-4 text-muted-foreground" />
        </span>
        <div>
          <p className="font-mono text-[13px] font-semibold">{v.unitNumber}</p>
          <p className="whitespace-nowrap text-xs text-muted-foreground">
            {v.year} {v.make} {v.model}
          </p>
        </div>
      </div>
    ),
  }),
  vcol.accessor('status', { header: 'Status', cell: (i) => <VehicleStatusBadge status={i.getValue()} /> }),
  vcol.accessor('equipment', {
    header: 'Equipment',
    enableSorting: false,
    cell: ({ row: { original: v } }) => (
      <div className="text-[13px]">
        <p>{EQUIPMENT[v.equipment]}</p>
        <p className="text-xs text-muted-foreground">{formatNumber(v.capacityLbs)} lbs</p>
      </div>
    ),
  }),
  vcol.display({
    id: 'driver',
    header: 'Paired driver',
    cell: ({ row: { original: v } }) =>
      v.driver ? (
        <div className="flex items-center gap-2">
          <Avatar name={v.driver.name} className="size-6 text-[9px]" />
          <span className="text-[13px]">{v.driver.name}</span>
        </div>
      ) : (
        <span className="text-xs text-muted-foreground">Unpaired</span>
      ),
  }),
  vcol.display({ id: 'load', header: 'Current load', cell: ({ row }) => <LoadCell load={row.original.currentLoad} /> }),
  vcol.accessor('fuelPct', {
    header: 'Fuel',
    cell: (i) => (
      <div className="flex w-24 items-center gap-2">
        <Fuel className="size-3.5 text-muted-foreground" />
        <Progress value={i.getValue()} tone={i.getValue() < 25 ? 'danger' : i.getValue() < 50 ? 'warning' : 'success'} className="h-1" />
        <span className="text-[11px] tabular text-muted-foreground">{i.getValue()}%</span>
      </div>
    ),
  }),
  vcol.accessor('odometerMi', {
    header: 'Odometer',
    meta: { align: 'right' },
    cell: (i) => <span className="text-[13px] tabular">{formatNumber(i.getValue())} mi</span>,
  }),
  vcol.accessor('plate', { header: 'Plate', enableSorting: false, cell: (i) => <span className="font-mono text-xs">{i.getValue()}</span> }),
  vcol.display({ id: 'actions', header: '', meta: { className: 'w-10' }, cell: ({ row }) => <VehicleActions v={row.original} /> }),
];

const driverColumns = [
  dcol.accessor('name', {
    header: 'Driver',
    cell: ({ row: { original: d } }) => (
      <div className="flex items-center gap-3">
        <Avatar name={d.name} />
        <div>
          <p className="text-[13px] font-medium">{d.name}</p>
          <p className="text-xs text-muted-foreground">{d.phone}</p>
        </div>
      </div>
    ),
  }),
  dcol.accessor('status', { header: 'Status', cell: (i) => <DriverStatusBadge status={i.getValue()} /> }),
  dcol.accessor('rating', {
    header: 'Rating',
    cell: (i) => (
      <span className="inline-flex items-center gap-1 text-[13px] tabular">
        <Star className="size-3.5 fill-amber-400 text-amber-400" /> {i.getValue().toFixed(1)}
      </span>
    ),
  }),
  dcol.accessor('hosHoursLeft', {
    header: 'HOS left',
    cell: (i) => (
      <div className="flex w-28 items-center gap-2">
        <Progress value={(i.getValue() / 11) * 100} tone={i.getValue() < 3 ? 'danger' : i.getValue() < 6 ? 'warning' : 'success'} className="h-1" />
        <span className="text-[11px] tabular text-muted-foreground">{i.getValue().toFixed(1)}h</span>
      </div>
    ),
  }),
  dcol.display({ id: 'truck', header: 'Truck', cell: ({ row }) => <span className="font-mono text-xs">{row.original.vehicle?.unitNumber ?? '—'}</span> }),
  dcol.display({ id: 'load', header: 'Current load', cell: ({ row }) => <LoadCell load={row.original.currentLoad} /> }),
  dcol.display({
    id: 'delivered',
    header: 'Delivered',
    meta: { align: 'right' },
    cell: ({ row }) => <span className="text-[13px] tabular">{row.original.deliveredLoads}</span>,
  }),
  dcol.accessor('licenseNumber', { header: 'CDL', enableSorting: false, cell: (i) => <span className="font-mono text-xs text-muted-foreground">{i.getValue()}</span> }),
  dcol.display({ id: 'actions', header: '', meta: { className: 'w-10' }, cell: ({ row }) => <DriverActions d={row.original} /> }),
];

function FleetView() {
  const t = useTableState({ pageSize: 20 });
  const tab = t.params.get('tab') === 'drivers' ? 'drivers' : 'trucks';
  const status = t.params.get('filter') ?? undefined;

  const vehicles = useVehicles({ page: t.page, pageSize: t.pageSize, search: t.search || undefined, sortBy: t.sortBy, sortDir: t.sortDir, status: tab === 'trucks' ? (status as VehicleStatus) : undefined });
  const drivers = useDrivers({ page: t.page, pageSize: t.pageSize, search: t.search || undefined, sortBy: t.sortBy, sortDir: t.sortDir, status: tab === 'drivers' ? (status as DriverStatus) : undefined });
  const q = tab === 'trucks' ? vehicles : drivers;
  const statusOptions = tab === 'trucks' ? VEHICLE_STATUS : DRIVER_STATUS;

  return (
    <div className="space-y-5 stagger">
      <PageHeader title="Fleet" description="Power units, drivers, hours-of-service and current assignments." />
      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center">
          <Tabs value={tab} onValueChange={(v) => t.set({ tab: v === 'drivers' ? 'drivers' : null, filter: null, sortBy: null, sortDir: null, search: null })}>
            <TabsList>
              <TabsTrigger value="trucks">
                <Truck className="size-3.5" /> Trucks
              </TabsTrigger>
              <TabsTrigger value="drivers">
                <UserRound className="size-3.5" /> Drivers
              </TabsTrigger>
            </TabsList>
          </Tabs>
          <div className="flex flex-1 flex-col gap-2 sm:flex-row sm:justify-end">
            <SearchInput value={t.search} onChange={(v) => t.set({ search: v })} placeholder={tab === 'trucks' ? 'Unit, plate, make, driver…' : 'Name, phone, CDL…'} />
            <Select value={status ?? 'ALL'} onValueChange={(v) => t.set({ filter: v === 'ALL' ? null : v })}>
              <SelectTrigger className="w-full sm:w-40" aria-label="Status filter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All statuses</SelectItem>
                {Object.entries(statusOptions).map(([k, v]) => (
                  <SelectItem key={k} value={k}>
                    {v.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {tab === 'trucks' ? (
          <DataTable
            columns={vehicleColumns}
            data={vehicles.data?.data ?? []}
            total={vehicles.data?.meta.total ?? 0}
            pageCount={vehicles.data?.meta.pageCount ?? 1}
            pagination={t.pagination}
            onPaginationChange={t.setPagination}
            sorting={t.sorting}
            onSortingChange={t.setSorting}
            isLoading={q.isLoading}
            isFetching={q.isFetching}
            getRowId={(v) => v.id}
            empty={<EmptyState icon={Truck} title="No trucks found" />}
          />
        ) : (
          <DataTable
            columns={driverColumns}
            data={drivers.data?.data ?? []}
            total={drivers.data?.meta.total ?? 0}
            pageCount={drivers.data?.meta.pageCount ?? 1}
            pagination={t.pagination}
            onPaginationChange={t.setPagination}
            sorting={t.sorting}
            onSortingChange={t.setSorting}
            isLoading={q.isLoading}
            isFetching={q.isFetching}
            getRowId={(d) => d.id}
            empty={<EmptyState icon={UserRound} title="No drivers found" />}
          />
        )}
      </Card>
    </div>
  );
}

export default function FleetPage() {
  return (
    <Suspense>
      <FleetView />
    </Suspense>
  );
}
