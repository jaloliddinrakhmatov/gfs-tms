import { CheckCircle2, CircleDot, FileText, MessageSquare, PackagePlus, Truck, Undo2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { timeAgo } from '@/lib/format';
import type { ShipmentEvent } from '@/lib/types';
import { cn } from '@/lib/utils';

export const EVENT_META: Record<ShipmentEvent['type'], { icon: React.ComponentType<{ className?: string }>; className: string }> = {
  CREATED: { icon: PackagePlus, className: 'bg-sky-500/10 text-sky-600 dark:text-sky-300' },
  ASSIGNED: { icon: CircleDot, className: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-300' },
  UNASSIGNED: { icon: Undo2, className: 'bg-amber-500/10 text-amber-600 dark:text-amber-300' },
  PICKED_UP: { icon: Truck, className: 'bg-violet-500/10 text-violet-600 dark:text-violet-300' },
  DELIVERED: { icon: CheckCircle2, className: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-300' },
  CANCELLED: { icon: XCircle, className: 'bg-rose-500/10 text-rose-600 dark:text-rose-300' },
  NOTE: { icon: MessageSquare, className: 'bg-muted text-muted-foreground' },
};

export function ActivityFeed({
  items,
}: {
  items: { id: string; type: ShipmentEvent['type']; message: string; createdAt: string; actor: string; shipment: { id: string; reference: string } }[];
}) {
  if (!items.length) {
    return (
      <div className="flex flex-col items-center py-8 text-sm text-muted-foreground">
        <FileText className="mb-2 size-5" /> No activity yet
      </div>
    );
  }
  return (
    <ol className="stagger relative space-y-4 before:absolute before:inset-y-2 before:left-[13px] before:w-px before:bg-border">
      {items.map((e) => {
        const meta = EVENT_META[e.type];
        const Icon = meta.icon;
        return (
          <li key={e.id} className="relative flex gap-3">
            <span className={cn('relative z-10 flex size-7 shrink-0 items-center justify-center rounded-full ring-4 ring-card', meta.className)}>
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 pt-0.5">
              <p className="text-[13px] leading-snug">
                <Link href={`/shipments/${e.shipment.id}`} className="font-medium text-primary hover:underline">
                  {e.shipment.reference}
                </Link>{' '}
                <span className="text-foreground/80">{e.message}</span>
              </p>
              <p className="mt-0.5 text-[11px] text-muted-foreground">
                {e.actor} · {timeAgo(e.createdAt)}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
