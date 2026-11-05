import { splitAllInRate } from '../common/money';

/** Builds invoice amounts from a shipment's all-in rate. Components always sum exactly. */
export function buildInvoiceAmounts(rateCents: number, priority: 'STANDARD' | 'EXPEDITED', isLate: boolean) {
  const { lineHaulCents, fuelSurchargeCents } = splitAllInRate(rateCents);
  // Accessorials: expedited loads include a $75 dispatch fee; late delivery gives a 3% credit.
  const expediteFee = priority === 'EXPEDITED' ? 7_500 : 0;
  const lateCredit = isLate ? -Math.round(lineHaulCents * 0.03) : 0;
  const accessorialCents = expediteFee + lateCredit;
  return {
    lineHaulCents,
    fuelSurchargeCents,
    accessorialCents,
    totalCents: lineHaulCents + fuelSurchargeCents + accessorialCents,
  };
}
