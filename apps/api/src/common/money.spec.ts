import { applyRate, FUEL_SURCHARGE_RATE, MIN_CHARGE_CENTS, quoteRate, roundCents, splitAllInRate } from './money';

describe('money', () => {
  it('rounds fractional cents to integers', () => {
    expect(roundCents(10.5)).toBe(11);
    expect(roundCents(10.4999)).toBe(10);
  });

  it('applyRate only accepts integer cents', () => {
    expect(applyRate(10_000, 0.18)).toBe(1_800);
    expect(() => applyRate(10.5, 0.1)).toThrow(TypeError);
  });

  it('quotes a lane with line haul + fuel surcharge that sum exactly', () => {
    const q = quoteRate({ distanceMeters: 1_609_344, equipment: 'DRY_VAN', priority: 'STANDARD' }); // 1,000 mi
    expect(q.miles).toBe(1000);
    expect(q.lineHaulCents).toBe(245_000);
    expect(q.fuelSurchargeCents).toBe(Math.round(245_000 * FUEL_SURCHARGE_RATE));
    expect(q.totalCents).toBe(q.lineHaulCents + q.fuelSurchargeCents);
  });

  it('applies equipment and priority multipliers', () => {
    const base = quoteRate({ distanceMeters: 1_609_344, equipment: 'DRY_VAN', priority: 'STANDARD' });
    const reefer = quoteRate({ distanceMeters: 1_609_344, equipment: 'REEFER', priority: 'EXPEDITED' });
    expect(reefer.lineHaulCents).toBe(Math.round(245_000 * 1.15 * 1.25));
    expect(reefer.totalCents).toBeGreaterThan(base.totalCents);
  });

  it('enforces the minimum charge on short hauls', () => {
    const q = quoteRate({ distanceMeters: 20_000, equipment: 'DRY_VAN', priority: 'STANDARD' });
    expect(q.lineHaulCents).toBe(MIN_CHARGE_CENTS);
  });

  it.each([1, 99_999, 291_500, 1_234_567])('splits an all-in rate of %i without losing a cent', (total) => {
    const { lineHaulCents, fuelSurchargeCents } = splitAllInRate(total);
    expect(lineHaulCents + fuelSurchargeCents).toBe(total);
    expect(Number.isInteger(lineHaulCents)).toBe(true);
  });
});
