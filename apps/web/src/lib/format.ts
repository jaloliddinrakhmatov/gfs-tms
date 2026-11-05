import { format, formatDistanceToNowStrict, isToday, isTomorrow, isYesterday } from 'date-fns';

const METERS_PER_MILE = 1609.344;

const usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
const usdCents = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 });
const usdCompact = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  notation: 'compact',
  maximumFractionDigits: 1,
});
const num = new Intl.NumberFormat('en-US');

/** Format integer cents as USD. */
export function formatMoney(cents: number, opts: { cents?: boolean; compact?: boolean } = {}) {
  const dollars = cents / 100;
  if (opts.compact) return usdCompact.format(dollars);
  return (opts.cents ? usdCents : usd).format(dollars);
}

export function formatNumber(n: number) {
  return num.format(n);
}

export function metersToMiles(meters: number) {
  return meters / METERS_PER_MILE;
}

export function formatMiles(meters: number) {
  return `${num.format(Math.round(metersToMiles(meters)))} mi`;
}

export function formatWeight(lbs: number) {
  return `${num.format(lbs)} lbs`;
}

export function formatDuration(seconds: number) {
  const totalMinutes = Math.max(0, Math.round(seconds / 60));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;
  if (days > 0) return `${days}d ${hours}h`;
  if (hours > 0) return `${hours}h ${String(minutes).padStart(2, '0')}m`;
  return `${minutes}m`;
}

export function formatDate(value: string | Date | null | undefined, pattern = 'MMM d, yyyy') {
  if (!value) return '—';
  return format(new Date(value), pattern);
}

/** "Today 14:30", "Tomorrow 08:00", "Nov 12, 09:15" */
export function formatSmartDate(value: string | Date | null | undefined) {
  if (!value) return '—';
  const d = new Date(value);
  const time = format(d, 'HH:mm');
  if (isToday(d)) return `Today ${time}`;
  if (isTomorrow(d)) return `Tomorrow ${time}`;
  if (isYesterday(d)) return `Yesterday ${time}`;
  return format(d, 'MMM d, HH:mm');
}

export function timeAgo(value: string | Date) {
  return `${formatDistanceToNowStrict(new Date(value))} ago`;
}

export function formatPercent(value: number, digits = 0) {
  return `${value.toFixed(digits)}%`;
}
