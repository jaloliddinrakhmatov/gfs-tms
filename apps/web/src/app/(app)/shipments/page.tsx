'use client';

import { Download, PackageSearch, Plus } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Suspense } from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { SearchInput } from '@/components/data-table/search-input';
import { PageHeader } from '@/components/page-header';
import { shipmentColumns } from '@/components/shipments/shipments-columns';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useTableState } from '@/hooks/use-table-state';
import { hasRole, useAuth } from '@/lib/auth-store';
import { SHIPMENT_STATUS } from '@/lib/constants';
import { useShipmentCounts, useShipments } from '@/lib/queries';
import type { Priority, Shipment, ShipmentStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const TABS: { key: string; label: string; statuses: ShipmentStatus[] }[] = [
  { key: 'ALL', label: 'All loads', statuses: [] },
  { key: 'PENDING', label: 'Load board', statuses: ['PENDING'] },
  { key: 'ASSIGNED', label: 'Assigned', statuses: ['ASSIGNED'] },
  { key: 'IN_TRANSIT', label: 'In transit', statuses: ['IN_TRANSIT'] },
  { key: 'DELIVERED', label: 'Delivered', statuses: ['DELIVERED'] },
  { key: 'CANCELLED', label: 'Cancelled', statuses: ['CANCELLED'] },
];

function exportCsv(rows: Shipment[]) {
  const header = ['Reference', 'Status', 'Customer', 'Origin', 'Destination', 'Miles', 'Rate (USD)', 'Pickup', 'Deliver by', 'Driver', 'Truck'];
  const lines = rows.map((s) =>
    [
      s.reference,
      SHIPMENT_STATUS[s.status].label,
      s.customer.name,
      `${s.origin.name}, ${s.origin.state}`,
      `${s.destination.name}, ${s.destination.state}`,
      Math.round(s.distanceMeters / 1609.344),
      (s.rateCents / 100).toFixed(2),
      s.pickupAt,
      s.deliveryBy,
      s.driver?.name ?? '',
      s.vehicle?.unitNumber ?? '',
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(','),
  );
  const blob = new Blob([[header.join(','), ...lines].join('\n')], { type: 'text/csv' });
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `shipments-${Date.now()}.csv` });
  a.click();
  URL.revokeObjectURL(a.href);
}

function ShipmentsView() {
  const router = useRouter();
  const user = useAuth((s) => s.user);
  const t = useTableState({ sortBy: 'createdAt', sortDir: 'desc' });
  const tab = t.params.get('status') ?? 'ALL';
  const priority = (t.params.get('priority') as Priority | null) ?? undefined;
  const statuses = TABS.find((x) => x.key === tab)?.statuses ?? [];

  const { data, isLoading, isFetching } = useShipments({
    page: t.page,
    pageSize: t.pageSize,
    search: t.search || undefined,
    sortBy: t.sortBy,
    sortDir: t.sortDir,
    status: statuses,
    priority,
  });
  const { data: counts } = useShipmentCounts();
  const isDriver = user?.role === 'DRIVER';

  return (
    <div className="space-y-5 stagger">
      <PageHeader
        title={isDriver ? 'My loads' : 'Shipments'}
        description={isDriver ? 'Loads assigned to you. Update pickup and delivery as you go.' : 'Tender, dispatch and track every load across the network.'}
        actions={
          <>
            <Button variant="outline" onClick={() => data && exportCsv(data.data)} disabled={!data?.data.length}>
              <Download /> Export
            </Button>
            {hasRole(user, 'DISPATCHER') && (
              <Button asChild>
                <Link href="/shipments/new">
                  <Plus /> New load
                </Link>
              </Button>
            )}
          </>
        }
      />

      <Card className="overflow-hidden">
        <div className="flex gap-1 overflow-x-auto border-b border-border px-3 scrollbar-thin">
          {TABS.map((x) => {
            const active = x.key === tab;
            const count = x.key === 'ALL' ? (counts ? Object.values(counts).reduce((a, b) => a + b, 0) : undefined) : counts?.[x.key as ShipmentStatus];
            return (
              <button
                key={x.key}
                onClick={() => t.set({ status: x.key === 'ALL' ? null : x.key })}
                className={cn(
                  'relative flex cursor-pointer items-center gap-2 whitespace-nowrap px-3 py-3 text-[13px] font-medium transition-colors',
                  active ? 'text-foreground' : 'text-muted-foreground hover:text-foreground',
                )}
              >
                {x.label}
                {count !== undefined && (
                  <span className={cn('rounded-full px-1.5 text-[11px] tabular', active ? 'bg-primary text-primary-foreground' : 'bg-muted')}>{count}</span>
                )}
                {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-primary" />}
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center">
          <SearchInput value={t.search} onChange={(v) => t.set({ search: v })} placeholder="Search reference, customer, city, driver…" />
          <Select value={priority ?? 'ALL'} onValueChange={(v) => t.set({ priority: v === 'ALL' ? null : v })}>
            <SelectTrigger className="w-full sm:w-44" aria-label="Priority">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All priorities</SelectItem>
              <SelectItem value="STANDARD">Standard</SelectItem>
              <SelectItem value="EXPEDITED">Expedited</SelectItem>
            </SelectContent>
          </Select>
          {(t.search || priority || tab !== 'ALL') && (
            <Button variant="ghost" size="sm" onClick={() => t.set({ search: null, priority: null, status: null })}>
              Reset filters
            </Button>
          )}
        </div>

        <div className="border-t border-border">
          <DataTable
            columns={shipmentColumns}
            data={data?.data ?? []}
            total={data?.meta.total ?? 0}
            pageCount={data?.meta.pageCount ?? 1}
            pagination={t.pagination}
            onPaginationChange={t.setPagination}
            sorting={t.sorting}
            onSortingChange={t.setSorting}
            isLoading={isLoading}
            isFetching={isFetching}
            getRowId={(s) => s.id}
            onRowClick={(s) => router.push(`/shipments/${s.id}`)}
            empty={
              <EmptyState
                icon={PackageSearch}
                title="No loads match your filters"
                description="Try a different status, clear the search, or tender a new load."
              />
            }
          />
        </div>
      </Card>
    </div>
  );
}

export default function ShipmentsPage() {
  return (
    <Suspense>
      <ShipmentsView />
    </Suspense>
  );
}
