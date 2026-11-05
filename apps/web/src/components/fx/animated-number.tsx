'use client';

import { animate, useReducedMotion } from 'motion/react';
import { useEffect, useRef } from 'react';

/**
 * Counts from the previously displayed value to `value`. Writes straight to the
 * DOM node so a 60fps tween never re-renders React.
 */
export function AnimatedNumber({
  value,
  format = (n) => Math.round(n).toLocaleString('en-US'),
  duration = 1.2,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  const formatRef = useRef(format);
  formatRef.current = format;
  const reduce = useReducedMotion();

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (reduce) {
      shown.current = value;
      node.textContent = formatRef.current(value);
      return;
    }
    const controls = animate(shown.current, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        shown.current = v;
        node.textContent = formatRef.current(v);
      },
    });
    return () => controls.stop();
  }, [value, duration, reduce]);

  return (
    <span ref={ref} className={className} aria-label={format(value)}>
      {format(0)}
    </span>
  );
}
