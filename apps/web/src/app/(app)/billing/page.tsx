'use client';

import { createColumnHelper } from '@tanstack/react-table';
import { differenceInCalendarDays } from 'date-fns';
import { AlertCircle, Banknote, FileText, Receipt, Wallet } from 'lucide-react';
import { Suspense, useState } from 'react';
import { InvoiceDrawer } from '@/components/billing/invoice-drawer';
import { KpiCard, KpiSkeleton } from '@/components/dashboard/kpi-card';
import { DataTable } from '@/components/data-table/data-table';
import { SearchInput } from '@/components/data-table/search-input';
import { PageHeader } from '@/components/page-header';
import { InvoiceStatusBadge } from '@/components/status-badges';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/misc';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useTableState } from '@/hooks/use-table-state';
import { formatDate, formatMoney } from '@/lib/format';
import { useBillingSummary, useInvoices } from '@/lib/queries';
import type { Invoice, InvoiceStatus } from '@/lib/types';
import { cn } from '@/lib/utils';

const col = createColumnHelper<Invoice>();
const columns = [
  col.accessor('number', {
    header: 'Invoice',
    cell: ({ row: { original: i } }) => (
      <div>
        <p className="font-mono text-[13px] font-medium">{i.number}</p>
        <p className="font-mono text-[11px] text-muted-foreground">{i.shipment.reference}</p>
      </div>
    ),
  }),
  col.accessor((i) => i.customer.name, { id: 'customer', header: 'Customer', enableSorting: false, cell: (c) => <span className="text-[13px]">{c.getValue()}</span> }),
  col.display({
    id: 'lane',
    header: 'Lane',
    cell: ({ row: { original: i } }) => (
      <span className="whitespace-nowrap text-[13px] text-muted-foreground">
        {i.shipment.origin.code} → {i.shipment.destination.code}
      </span>
    ),
  }),
  col.accessor('issuedAt', { header: 'Issued', cell: (c) => <span className="whitespace-nowrap text-[13px] tabular">{formatDate(c.getValue())}</span> }),
  col.accessor('dueAt', {
    header: 'Due',
    cell: ({ row: { original: i } }) => {
      const days = differenceInCalendarDays(new Date(), new Date(i.dueAt));
      return (
        <div className="whitespace-nowrap text-[13px] tabular">
          <p>{formatDate(i.dueAt)}</p>
          {i.status === 'OVERDUE' && <p className="text-[11px] font-medium text-rose-600 dark:text-rose-400">{days} days overdue</p>}
          {i.status === 'ISSUED' && days <= 0 && <p className="text-[11px] text-muted-foreground">in {Math.abs(days)} days</p>}
        </div>
      );
    },
  }),
  col.accessor('status', { header: 'Status', cell: (c) => <InvoiceStatusBadge status={c.getValue()} /> }),
  col.accessor('totalCents', { header: 'Total', meta: { align: 'right' }, cell: (c) => <span className="text-[13px] font-medium tabular">{formatMoney(c.getValue(), { cents: true })}</span> }),
  col.display({
    id: 'balance',
    header: 'Balance',
    meta: { align: 'right' },
    cell: ({ row: { original: i } }) => (
      <span className={cn('text-[13px] tabular', i.balanceCents > 0 ? 'font-medium' : 'text-muted-foreground')}>{formatMoney(i.balanceCents, { cents: true })}</span>
    ),
  }),
];

const STATUS_TABS: { key: string; label: string; statuses: InvoiceStatus[] }[] = [
  { key: 'ALL', label: 'All', statuses: [] },
  { key: 'OPEN', label: 'Open', statuses: ['ISSUED'] },
  { key: 'OVERDUE', label: 'Overdue', statuses: ['OVERDUE'] },
  { key: 'PAID', label: 'Paid', statuses: ['PAID'] },
];

function AgingBar({ aging }: { aging: { current: number; d1_30: number; d31_60: number; d60plus: number } }) {
  const buckets = [
    { label: 'Current', value: aging.current, color: 'bg-emerald-500' },
    { label: '1–30 days', value: aging.d1_30, color: 'bg-amber-400' },
    { label: '31–60 days', value: aging.d31_60, color: 'bg-orange-500' },
    { label: '60+ days', value: aging.d60plus, color: 'bg-rose-500' },
  ];
  const total = buckets.reduce((s, b) => s + b.value, 0) || 1;
  return (
    <div className="space-y-4">
      <div className="flex h-3 overflow-hidden rounded-full bg-muted">
        {buckets.map((b) => (
          <div key={b.label} className={cn(b.color, 'transition-all')} style={{ width: `${(b.value / total) * 100}%` }} />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {buckets.map((b) => (
          <div key={b.label}>
            <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className={cn('size-2 rounded-full', b.color)} /> {b.label}
            </p>
            <p className="mt-0.5 text-sm font-semibold tabular">{formatMoney(b.value)}</p>
            <p className="text-[11px] text-muted-foreground tabular">{Math.round((b.value / total) * 100)}%</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function BillingView() {
  const t = useTableState({ sortBy: 'issuedAt', sortDir: 'desc' });
  const tab = t.params.get('status') ?? 'ALL';
  const statuses = STATUS_TABS.find((s) => s.key === tab)?.statuses ?? [];
  const [openId, setOpenId] = useState<string | null>(null);
  const { data: summary } = useBillingSummary();
  const { data, isLoading, isFetching } = useInvoices({
    page: t.page,
    pageSize: t.pageSize,
    search: t.search || undefined,
    sortBy: t.sortBy,
    sortDir: t.sortDir,
    status: statuses,
  });

  return (
    <div className="space-y-5 stagger">
      <PageHeader title="Billing" description="Invoices are generated automatically on delivery by a background worker." />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {!summary ? (
          Array.from({ length: 4 }).map((_, i) => <KpiSkeleton key={i} />)
        ) : (
          <>
            <KpiCard label="Outstanding AR" value={formatMoney(summary.outstandingCents)} icon={Wallet} hint="open + overdue balance" accent="indigo" />
            <KpiCard label="Billed this month" value={formatMoney(summary.billedMtdCents)} icon={Receipt} hint="invoices issued MTD" accent="sky" />
            <KpiCard label="Collected this month" value={formatMoney(summary.collectedMtdCents)} icon={Banknote} hint="payments received MTD" accent="emerald" />
            <KpiCard label="Overdue invoices" value={summary.overdueCount} icon={AlertCircle} hint="past payment terms" accent="rose" />
          </>
        )}
      </div>

      {summary && (
        <Card>
          <CardHeader>
            <div>
              <CardTitle>Receivables aging</CardTitle>
              <CardDescription>Open balance by days past due</CardDescription>
            </div>
          </CardHeader>
          <CardContent>
            <AgingBar aging={summary.aging} />
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden">
        <div className="flex flex-col gap-2 border-b border-border p-3 sm:flex-row sm:items-center sm:justify-between">
          <Tabs value={tab} onValueChange={(v) => t.set({ status: v === 'ALL' ? null : v })}>
            <TabsList>
              {STATUS_TABS.map((s) => (
                <TabsTrigger key={s.key} value={s.key}>
                  {s.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <SearchInput value={t.search} onChange={(v) => t.set({ search: v })} placeholder="Invoice #, load # or customer…" />
        </div>
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          total={data?.meta.total ?? 0}
          pageCount={data?.meta.pageCount ?? 1}
          pagination={t.pagination}
          onPaginationChange={t.setPagination}
          sorting={t.sorting}
          onSortingChange={t.setSorting}
          isLoading={isLoading}
          isFetching={isFetching}
          getRowId={(i) => i.id}
          onRowClick={(i) => setOpenId(i.id)}
          empty={<EmptyState icon={FileText} title="No invoices found" />}
        />
      </Card>

      <InvoiceDrawer id={openId} onClose={() => setOpenId(null)} />
    </div>
  );
}

export default function BillingPage() {
  return (
    <Suspense>
      <BillingView />
    </Suspense>
  );
}
