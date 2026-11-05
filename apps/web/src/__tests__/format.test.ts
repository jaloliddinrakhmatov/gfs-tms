import { formatDuration, formatMiles, formatMoney, formatWeight } from '@/lib/format';

describe('format helpers', () => {
  it('formats integer cents as USD', () => {
    expect(formatMoney(291_500)).toBe('$2,915');
    expect(formatMoney(291_537, { cents: true })).toBe('$2,915.37');
    expect(formatMoney(16_781_400, { compact: true })).toBe('$167.8K');
  });

  it('formats distances and weights', () => {
    expect(formatMiles(1_609_344)).toBe('1,000 mi');
    expect(formatWeight(42000)).toBe('42,000 lbs');
  });

  it.each([
    [59, '1m'],
    [3_600, '1h 00m'],
    [22_380, '6h 13m'],
    [100_000, '1d 3h'],
  ])('formats %i seconds as %s', (s, out) => expect(formatDuration(s)).toBe(out));
});
