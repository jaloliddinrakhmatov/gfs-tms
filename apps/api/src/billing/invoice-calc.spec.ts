import { buildInvoiceAmounts } from './invoice-calc';

describe('buildInvoiceAmounts', () => {
  it('components always sum to the total', () => {
    for (const rate of [45_000, 199_900, 291_537, 1_000_001]) {
      for (const priority of ['STANDARD', 'EXPEDITED'] as const) {
        for (const late of [false, true]) {
          const a = buildInvoiceAmounts(rate, priority, late);
          expect(a.lineHaulCents + a.fuelSurchargeCents + a.accessorialCents).toBe(a.totalCents);
        }
      }
    }
  });

  it('bills the agreed rate for an on-time standard load', () => {
    expect(buildInvoiceAmounts(291_500, 'STANDARD', false).totalCents).toBe(291_500);
  });

  it('adds an expedite fee and a late-delivery credit', () => {
    const onTime = buildInvoiceAmounts(100_000, 'EXPEDITED', false);
    expect(onTime.accessorialCents).toBe(7_500);
    const late = buildInvoiceAmounts(100_000, 'STANDARD', true);
    expect(late.accessorialCents).toBeLessThan(0);
    expect(late.totalCents).toBeLessThan(100_000);
  });
});
