'use client';

import type { PaginationState, SortingState } from '@tanstack/react-table';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * Table state (page, size, sort, search, filters) persisted in the URL so views are
 * shareable, survive reloads and work with the browser back button.
 */
export function useTableState(defaults: { pageSize?: number; sortBy?: string; sortDir?: 'asc' | 'desc' } = {}) {
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const set = useCallback(
    (updates: Record<string, string | number | null | undefined>, resetPage = true) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(updates)) {
        if (v === null || v === undefined || v === '') next.delete(k);
        else next.set(k, String(v));
      }
      if (resetPage && !('page' in updates)) next.delete('page');
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [params, router, pathname],
  );

  const page = Number(params.get('page') ?? 1);
  const pageSize = Number(params.get('pageSize') ?? defaults.pageSize ?? 20);
  const sortBy = params.get('sortBy') ?? defaults.sortBy;
  const sortDir = (params.get('sortDir') as 'asc' | 'desc' | null) ?? defaults.sortDir ?? 'desc';
  const search = params.get('search') ?? '';

  const pagination: PaginationState = useMemo(() => ({ pageIndex: page - 1, pageSize }), [page, pageSize]);
  const sorting: SortingState = useMemo(() => (sortBy ? [{ id: sortBy, desc: sortDir === 'desc' }] : []), [sortBy, sortDir]);

  return {
    params,
    set,
    page,
    pageSize,
    sortBy,
    sortDir,
    search,
    pagination,
    sorting,
    setPagination: (p: PaginationState) => set({ page: p.pageIndex + 1, pageSize: p.pageSize }, false),
    setSorting: (s: SortingState) => set({ sortBy: s[0]?.id ?? null, sortDir: s[0] ? (s[0].desc ? 'desc' : 'asc') : null }),
  };
}
