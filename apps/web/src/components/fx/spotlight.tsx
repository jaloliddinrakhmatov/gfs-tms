'use client';

import { useEffect, useRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Soft radial glow that follows the pointer inside its parent.
 * The parent must be `relative` (and usually `overflow-hidden`).
 */
export function Spotlight({
  size = 320,
  color = 'color-mix(in oklch, var(--primary) 14%, transparent)',
  className,
}: {
  size?: number;
  color?: string;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const glow = ref.current;
    const host = glow?.parentElement;
    if (!glow || !host) return;
    const move = (e: PointerEvent) => {
      const r = host.getBoundingClientRect();
      glow.style.setProperty('--x', `${e.clientX - r.left}px`);
      glow.style.setProperty('--y', `${e.clientY - r.top}px`);
      glow.style.opacity = '1';
    };
    const leave = () => (glow.style.opacity = '0');
    host.addEventListener('pointermove', move);
    host.addEventListener('pointerleave', leave);
    return () => {
      host.removeEventListener('pointermove', move);
      host.removeEventListener('pointerleave', leave);
    };
  }, []);

  return (
    <div
      ref={ref}
      aria-hidden
      className={cn('pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500', className)}
      style={{ background: `radial-gradient(${size}px circle at var(--x, 50%) var(--y, 50%), ${color}, transparent 70%)` }}
    />
  );
}
