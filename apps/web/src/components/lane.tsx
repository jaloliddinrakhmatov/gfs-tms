import { cn } from '@/lib/utils';
import type { Location } from '@/lib/types';

/** Compact "Chicago, IL → Dallas, TX" with a route glyph. */
export function Lane({ origin, destination, className, compact }: { origin: Location; destination: Location; className?: string; compact?: boolean }) {
  return (
    <div className={cn('flex min-w-0 items-center gap-2', className)}>
      <div className="flex flex-col items-center gap-0.5 py-0.5" aria-hidden>
        <span className="size-1.5 rounded-full border-[1.5px] border-muted-foreground" />
        <span className="h-2.5 w-px bg-border" />
        <span className="size-1.5 rounded-full bg-primary" />
      </div>
      <div className="min-w-0 text-[13px] leading-tight">
        <p className="truncate">
          {origin.name}
          {!compact && <span className="text-muted-foreground">, {origin.state}</span>}
        </p>
        <p className="truncate">
          {destination.name}
          {!compact && <span className="text-muted-foreground">, {destination.state}</span>}
        </p>
      </div>
    </div>
  );
}
