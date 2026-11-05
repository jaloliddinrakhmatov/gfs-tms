'use client';

import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Spotlight } from '@/components/fx/spotlight';
import { Skeleton } from '@/components/ui/misc';
import { cn } from '@/lib/utils';

export function KpiCard({
  label,
  value,
  icon: Icon,
  change,
  changeSuffix = '%',
  hint,
  invert,
  accent = 'indigo',
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ComponentType<{ className?: string }>;
  change?: number;
  changeSuffix?: string;
  hint?: React.ReactNode;
  invert?: boolean;
  accent?: 'indigo' | 'emerald' | 'amber' | 'sky' | 'violet' | 'rose';
}) {
  const positive = (change ?? 0) >= 0;
  const good = invert ? !positive : positive;
  const accents = {
    indigo: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300',
    emerald: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300',
    amber: 'bg-amber-500/10 text-amber-600 dark:text-amber-300',
    sky: 'bg-sky-500/10 text-sky-600 dark:text-sky-300',
    violet: 'bg-violet-500/10 text-violet-600 dark:text-violet-300',
    rose: 'bg-rose-500/10 text-rose-600 dark:text-rose-300',
  };
  return (
    <Card className="card-lift group relative overflow-hidden p-4">
      <Spotlight size={220} />
      <div className="relative flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <span
          className={cn(
            'flex size-7 items-center justify-center rounded-lg transition-transform duration-500 [transition-timing-function:var(--ease-spring)] group-hover:-rotate-6 group-hover:scale-115',
            accents[accent],
          )}
        >
          <Icon className="size-4" />
        </span>
      </div>
      <p className="relative mt-2 text-2xl font-semibold tracking-tight tabular">{value}</p>
      <div className="relative mt-1 flex items-center gap-1.5 text-xs">
        {change !== undefined && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 rounded px-1 py-px font-medium tabular',
              good ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400',
            )}
          >
            {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
            {Math.abs(change).toFixed(1)}
            {changeSuffix}
          </span>
        )}
        {hint && <span className="truncate text-muted-foreground">{hint}</span>}
      </div>
    </Card>
  );
}

export function KpiSkeleton() {
  return (
    <Card className="space-y-3 p-4">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-28" />
      <Skeleton className="h-3 w-20" />
    </Card>
  );
}
