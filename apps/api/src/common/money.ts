/**
 * Money helpers. All amounts are integer cents — never floats — to avoid
 * rounding drift in billing (0.1 + 0.2 !== 0.3).
 */

export const RATE_PER_MILE_CENTS = 245; // base line-haul rate: $2.45 / mile
export const MIN_CHARGE_CENTS = 45_000; // $450 minimum per load
export const EXPEDITED_MULTIPLIER = 1.25;
export const REEFER_MULTIPLIER = 1.15;
export const FLATBED_MULTIPLIER = 1.1;
/** Fuel surcharge as a fraction of line haul (simplified DOE-index based FSC). */
export const FUEL_SURCHARGE_RATE = 0.18;

export const METERS_PER_MILE = 1609.344;

export function metersToMiles(meters: number): number {
  return meters / METERS_PER_MILE;
}

/** Banker-safe rounding of a fractional cent amount to an integer number of cents. */
export function roundCents(value: number): number {
  return Math.round(value + Number.EPSILON);
}

/** Multiply an integer cent amount by a ratio and round back to integer cents. */
export function applyRate(cents: number, ratio: number): number {
  if (!Number.isInteger(cents)) throw new TypeError('cents must be an integer');
  return roundCents(cents * ratio);
}

export interface QuoteInput {
  distanceMeters: number;
  equipment: 'DRY_VAN' | 'REEFER' | 'FLATBED';
  priority: 'STANDARD' | 'EXPEDITED';
}

export interface Quote {
  miles: number;
  lineHaulCents: number;
  fuelSurchargeCents: number;
  totalCents: number;
  ratePerMileCents: number;
}

/** Deterministic spot-rate quote for a lane. */
export function quoteRate({ distanceMeters, equipment, priority }: QuoteInput): Quote {
  const miles = metersToMiles(distanceMeters);
  let multiplier = 1;
  if (equipment === 'REEFER') multiplier *= REEFER_MULTIPLIER;
  if (equipment === 'FLATBED') multiplier *= FLATBED_MULTIPLIER;
  if (priority === 'EXPEDITED') multiplier *= EXPEDITED_MULTIPLIER;

  const lineHaulCents = Math.max(
    MIN_CHARGE_CENTS,
    roundCents(miles * RATE_PER_MILE_CENTS * multiplier),
  );
  const fuelSurchargeCents = applyRate(lineHaulCents, FUEL_SURCHARGE_RATE);
  const totalCents = lineHaulCents + fuelSurchargeCents;

  return {
    miles: Math.round(miles),
    lineHaulCents,
    fuelSurchargeCents,
    totalCents,
    ratePerMileCents: miles > 0 ? roundCents(totalCents / miles) : 0,
  };
}

/** Split an all-in rate into line haul + fuel surcharge components (sum is exact). */
export function splitAllInRate(totalCents: number): { lineHaulCents: number; fuelSurchargeCents: number } {
  const lineHaulCents = roundCents(totalCents / (1 + FUEL_SURCHARGE_RATE));
  return { lineHaulCents, fuelSurchargeCents: totalCents - lineHaulCents };
}
