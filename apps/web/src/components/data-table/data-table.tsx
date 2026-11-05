'use client';

import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
  type PaginationState,
  type SortingState,
  type Updater,
} from '@tanstack/react-table';
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/misc';
import { formatNumber } from '@/lib/format';
import { cn } from '@/lib/utils';

declare module '@tanstack/react-table' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface ColumnMeta<TData, TValue> {
    className?: string;
    align?: 'left' | 'right';
  }
}

interface DataTableProps<T> {
  columns: ColumnDef<T, any>[]; // eslint-disable-line @typescript-eslint/no-explicit-any
  data: T[];
  total: number;
  pageCount: number;
  pagination: PaginationState;
  onPaginationChange: (p: PaginationState) => void;
  sorting?: SortingState;
  onSortingChange?: (s: SortingState) => void;
  isLoading?: boolean;
  isFetching?: boolean;
  onRowClick?: (row: T) => void;
  getRowId?: (row: T) => string;
  empty?: React.ReactNode;
  rowClassName?: (row: T) => string | undefined;
}

const resolve = <S,>(updater: Updater<S>, prev: S): S =>
  typeof updater === 'function' ? (updater as (p: S) => S)(prev) : updater;

/** Server-driven table: pagination and sorting are delegated to the API. */
export function DataTable<T>({
  columns,
  data,
  total,
  pageCount,
  pagination,
  onPaginationChange,
  sorting = [],
  onSortingChange,
  isLoading,
  isFetching,
  onRowClick,
  getRowId,
  empty,
  rowClassName,
}: DataTableProps<T>) {
  const table = useReactTable({
    data,
    columns,
    pageCount,
    state: { pagination, sorting },
    manualPagination: true,
    manualSorting: true,
    enableSortingRemoval: false,
    getRowId,
    onPaginationChange: (u) => onPaginationChange(resolve(u, pagination)),
    onSortingChange: (u) => onSortingChange?.(resolve(u, sorting)),
    getCoreRowModel: getCoreRowModel(),
  });

  const from = total === 0 ? 0 : pagination.pageIndex * pagination.pageSize + 1;
  const to = Math.min(total, (pagination.pageIndex + 1) * pagination.pageSize);

  return (
    <div className="relative">
      {isFetching && !isLoading && (
        <div className="absolute inset-x-0 top-0 z-10 h-0.5 overflow-hidden">
          <div className="h-full w-1/3 animate-[slide-in_1s_ease-in-out_infinite_alternate] bg-primary/60" />
        </div>
      )}
      <div className="overflow-x-auto scrollbar-thin">
        <table className="w-full text-sm">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-border bg-muted/40">
                {hg.headers.map((header) => {
                  const canSort = header.column.getCanSort() && !!onSortingChange;
                  const sorted = header.column.getIsSorted();
                  const meta = header.column.columnDef.meta;
                  return (
                    <th
                      key={header.id}
                      className={cn(
                        'h-10 whitespace-nowrap px-4 text-left text-[11px] font-medium uppercase tracking-wider text-muted-foreground',
                        meta?.align === 'right' && 'text-right',
                        meta?.className,
                      )}
                    >
                      {header.isPlaceholder ? null : canSort ? (
                        <button
                          type="button"
                          onClick={header.column.getToggleSortingHandler()}
                          className={cn(
                            'inline-flex cursor-pointer items-center gap-1 uppercase transition hover:text-foreground',
                            sorted && 'text-foreground',
                          )}
                        >
                          {flexRender(header.column.columnDef.header, header.getContext())}
                          {sorted === 'asc' ? <ArrowUp className="size-3" /> : sorted === 'desc' ? <ArrowDown className="size-3" /> : <ChevronsUpDown className="size-3 opacity-40" />}
                        </button>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </th>
                  );
                })}
              </tr>
            ))}
          </thead>
          <tbody className={cn('transition-opacity', !isLoading && 'stagger-rows', isFetching && !isLoading && 'opacity-70')}>
            {isLoading ? (
              Array.from({ length: Math.min(pagination.pageSize, 8) }).map((_, i) => (
                <tr key={i} className="border-b border-border last:border-0">
                  {columns.map((_, j) => (
                    <td key={j} className="px-4 py-3.5">
                      <Skeleton className="h-4 w-full max-w-32" />
                    </td>
                  ))}
                </tr>
              ))
            ) : table.getRowModel().rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length}>{empty}</td>
              </tr>
            ) : (
              table.getRowModel().rows.map((row) => (
                <tr
                  key={row.id}
                  onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                  className={cn(
                    'border-b border-border transition-colors last:border-0',
                    onRowClick && 'cursor-pointer hover:bg-muted/50',
                    rowClassName?.(row.original),
                  )}
                >
                  {row.getVisibleCells().map((cell) => (
                    <td
                      key={cell.id}
                      className={cn(
                        'px-4 py-3 align-middle',
                        cell.column.columnDef.meta?.align === 'right' && 'text-right',
                        cell.column.columnDef.meta?.className,
                      )}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="flex flex-col gap-3 border-t border-border px-4 py-3 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <span className="tabular">
          Showing <span className="font-medium text-foreground">{from}–{to}</span> of{' '}
          <span className="font-medium text-foreground">{formatNumber(total)}</span>
        </span>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span>Rows</span>
            <Select value={String(pagination.pageSize)} onValueChange={(v) => onPaginationChange({ pageIndex: 0, pageSize: Number(v) })}>
              <SelectTrigger className="h-8 w-[72px] text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((n) => (
                  <SelectItem key={n} value={String(n)}>
                    {n}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <span className="tabular">
            Page {pagination.pageIndex + 1} of {Math.max(1, pageCount)}
          </span>
          <div className="flex gap-1">
            <Button variant="outline" size="icon-sm" onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} aria-label="Previous page">
              <ChevronLeft />
            </Button>
            <Button variant="outline" size="icon-sm" onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} aria-label="Next page">
              <ChevronRight />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
