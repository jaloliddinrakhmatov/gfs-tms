'use client';

import { format } from 'date-fns';
import { Area, AreaChart, Bar, CartesianGrid, ComposedChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatMoney } from '@/lib/format';

type Point = { date: string; loads: number; revenueCents: number };

function ChartTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-lg border border-border bg-popover px-3 py-2 text-xs shadow-xl">
      <p className="mb-1 font-medium">{format(new Date(`${p.date}T12:00:00Z`), 'EEE, MMM d')}</p>
      <p className="flex items-center gap-2 text-muted-foreground">
        <span className="size-2 rounded-full bg-[var(--chart-1)]" /> Revenue
        <span className="ml-auto pl-4 font-medium text-foreground tabular">{formatMoney(p.revenueCents)}</span>
      </p>
      <p className="flex items-center gap-2 text-muted-foreground">
        <span className="size-2 rounded-full bg-[var(--chart-2)]" /> Loads delivered
        <span className="ml-auto pl-4 font-medium text-foreground tabular">{p.loads}</span>
      </p>
    </div>
  );
}

export function RevenueChart({ data }: { data: Point[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <ComposedChart data={data} margin={{ top: 8, right: 4, left: -8, bottom: 0 }}>
        <defs>
          <linearGradient id="rev" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-1)" stopOpacity={0.28} />
            <stop offset="100%" stopColor="var(--chart-1)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid vertical={false} stroke="var(--chart-grid)" />
        <XAxis
          dataKey="date"
          tickLine={false}
          axisLine={false}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickFormatter={(d: string) => format(new Date(`${d}T12:00:00Z`), 'MMM d')}
          minTickGap={28}
        />
        <YAxis
          yAxisId="rev"
          tickLine={false}
          axisLine={false}
          width={56}
          tick={{ fontSize: 11, fill: 'var(--muted-foreground)' }}
          tickFormatter={(v: number) => formatMoney(v, { compact: true })}
        />
        <YAxis yAxisId="loads" orientation="right" hide domain={[0, (max: number) => max * 3]} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--border)', strokeWidth: 1 }} />
        {/* Animations disabled: a container resize mid-animation leaves the path at a stale width */}
        <Bar yAxisId="loads" dataKey="loads" fill="var(--chart-2)" opacity={0.35} radius={[3, 3, 0, 0]} barSize={8} isAnimationActive={false} />
        <Area
          yAxisId="rev"
          type="monotone"
          dataKey="revenueCents"
          stroke="var(--chart-1)"
          strokeWidth={2.25}
          fill="url(#rev)"
          isAnimationActive={false}
          activeDot={{ r: 4, strokeWidth: 2, stroke: 'var(--card)' }}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}

export function Sparkline({ data }: { data: number[] }) {
  return (
    <ResponsiveContainer width="100%" height={36}>
      <AreaChart data={data.map((v, i) => ({ i, v }))} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <Area type="monotone" dataKey="v" stroke="var(--chart-1)" strokeWidth={1.5} fill="var(--chart-1)" fillOpacity={0.08} />
      </AreaChart>
    </ResponsiveContainer>
  );
}
