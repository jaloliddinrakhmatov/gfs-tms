'use client';

import Link from 'next/link';
import { Cell, Pie, PieChart, ResponsiveContainer } from 'recharts';
import { AnimatedNumber } from '@/components/fx/animated-number';
import { SHIPMENT_STATUS } from '@/lib/constants';
import { formatNumber } from '@/lib/format';
import type { ShipmentStatus } from '@/lib/types';

const ORDER: ShipmentStatus[] = ['PENDING', 'ASSIGNED', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'];

export function StatusBreakdown({ counts }: { counts: Partial<Record<ShipmentStatus, number>> }) {
  // Delivered dominates totals; show the live pipeline in the donut and delivered in the legend
  const active = ORDER.filter((s) => s !== 'DELIVERED' && s !== 'CANCELLED').map((s) => ({
    status: s,
    value: counts[s] ?? 0,
  }));
  const totalActive = active.reduce((s, d) => s + d.value, 0);

  return (
    <div className="flex items-center gap-6">
      <div className="relative size-36 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={active} dataKey="value" innerRadius="70%" outerRadius="100%" paddingAngle={3} stroke="none" startAngle={90} endAngle={-270}>
              {active.map((d) => (
                <Cell key={d.status} fill={SHIPMENT_STATUS[d.status].color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <AnimatedNumber value={totalActive} className="text-2xl font-semibold tabular" />
          <span className="text-[11px] text-muted-foreground">active loads</span>
        </div>
      </div>
      <ul className="stagger flex-1 space-y-2">
        {ORDER.map((s) => (
          <li key={s}>
            <Link href={`/shipments?status=${s}`} className="group flex items-center gap-2 text-sm">
              <span className="size-2.5 rounded-sm transition-transform duration-300 group-hover:scale-125" style={{ background: SHIPMENT_STATUS[s].color }} />
              <span className="text-muted-foreground group-hover:text-foreground">{SHIPMENT_STATUS[s].label}</span>
              <span className="ml-auto font-medium tabular">{formatNumber(counts[s] ?? 0)}</span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
