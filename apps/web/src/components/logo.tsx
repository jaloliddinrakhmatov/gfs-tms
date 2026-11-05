import { cn } from '@/lib/utils';

export function LogoMark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-8 items-center justify-center rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 shadow-lg shadow-indigo-500/25',
        className,
      )}
    >
      <svg viewBox="0 0 32 32" className="size-[70%]" fill="none" stroke="white" strokeWidth="2.2" strokeLinejoin="round">
        <path d="M5 21h13V9H5zM18 13h4.5l3.5 4.2V21h-8z" />
        <circle cx="9.5" cy="23" r="2" fill="white" stroke="none" />
        <circle cx="21.5" cy="23" r="2" fill="white" stroke="none" />
      </svg>
    </span>
  );
}

export function Logo({ className, subtitle = true }: { className?: string; subtitle?: boolean }) {
  return (
    <div className={cn('flex items-center gap-2.5', className)}>
      <LogoMark />
      <div className="leading-none">
        <p className="text-[15px] font-semibold tracking-tight">GFS TMS</p>
        {subtitle && <p className="mt-1 text-[10px] font-medium uppercase tracking-[0.14em] opacity-60">Logistics Cloud</p>}
      </div>
    </div>
  );
}
