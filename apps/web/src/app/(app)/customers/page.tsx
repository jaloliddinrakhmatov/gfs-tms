'use client';

import { createColumnHelper } from '@tanstack/react-table';
import { Building2, Mail, Phone } from 'lucide-react';
import Link from 'next/link';
import { Suspense } from 'react';
import { DataTable } from '@/components/data-table/data-table';
import { SearchInput } from '@/components/data-table/search-input';
import { PageHeader } from '@/components/page-header';
import { Card } from '@/components/ui/card';
import { Avatar, EmptyState } from '@/components/ui/misc';
import { useTableState } from '@/hooks/use-table-state';
import { formatMoney, formatNumber } from '@/lib/format';
import { useCustomers } from '@/lib/queries';
import type { Customer } from '@/lib/types';

const col = createColumnHelper<Customer>();
const columns = [
  col.accessor('name', {
    header: 'Customer',
    enableSorting: false,
    cell: ({ row: { original: c } }) => (
      <div className="flex items-center gap-3">
        <Avatar name={c.name} className="rounded-lg" />
        <div>
          <p className="text-[13px] font-medium">{c.name}</p>
          <p className="text-xs text-muted-foreground">
            {c.city.name}, {c.city.state}
          </p>
        </div>
      </div>
    ),
  }),
  col.display({
    id: 'contact',
    header: 'Contact',
    cell: ({ row: { original: c } }) => (
      <div className="space-y-0.5 text-xs">
        <p className="text-[13px]">{c.contactName}</p>
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <Mail className="size-3" /> {c.email}
        </p>
        <p className="flex items-center gap-1.5 text-muted-foreground">
          <Phone className="size-3" /> {c.phone}
        </p>
      </div>
    ),
  }),
  col.accessor('paymentTermsDays', { header: 'Terms', enableSorting: false, cell: (i) => <span className="text-[13px]">Net {i.getValue()}</span> }),
  col.accessor('shipmentCount', {
    header: 'Loads',
    enableSorting: false,
    meta: { align: 'right' },
    cell: ({ row: { original: c } }) => (
      <Link href={`/shipments?search=${encodeURIComponent(c.name)}`} className="text-[13px] font-medium text-primary tabular hover:underline">
        {formatNumber(c.shipmentCount)}
      </Link>
    ),
  }),
  col.accessor('lifetimeRevenueCents', {
    header: 'Lifetime revenue',
    enableSorting: false,
    meta: { align: 'right' },
    cell: (i) => <span className="text-[13px] font-medium tabular">{formatMoney(i.getValue())}</span>,
  }),
  col.accessor('openBalanceCents', {
    header: 'Open balance',
    enableSorting: false,
    meta: { align: 'right' },
    cell: (i) => <span className={i.getValue() > 0 ? 'text-[13px] font-medium tabular' : 'text-[13px] text-muted-foreground tabular'}>{formatMoney(i.getValue())}</span>,
  }),
];

function CustomersView() {
  const t = useTableState({ pageSize: 20 });
  const { data, isLoading, isFetching } = useCustomers({ page: t.page, pageSize: t.pageSize, search: t.search || undefined });
  return (
    <div className="space-y-5 stagger">
      <PageHeader title="Customers" description="Shippers, payment terms and account value." />
      <Card className="overflow-hidden">
        <div className="border-b border-border p-3">
          <SearchInput value={t.search} onChange={(v) => t.set({ search: v })} placeholder="Search customers or contacts…" />
        </div>
        <DataTable
          columns={columns}
          data={data?.data ?? []}
          total={data?.meta.total ?? 0}
          pageCount={data?.meta.pageCount ?? 1}
          pagination={t.pagination}
          onPaginationChange={t.setPagination}
          isLoading={isLoading}
          isFetching={isFetching}
          getRowId={(c) => c.id}
          empty={<EmptyState icon={Building2} title="No customers found" />}
        />
      </Card>
    </div>
  );
}

export default function CustomersPage() {
  return (
    <Suspense>
      <CustomersView />
    </Suspense>
  );
}
