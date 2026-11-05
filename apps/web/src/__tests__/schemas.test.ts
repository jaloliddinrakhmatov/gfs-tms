import { loginSchema, shipmentSchema } from '@/lib/schemas';

const valid = {
  customerId: 'c1',
  originCode: 'CHI',
  destinationCode: 'DAL',
  equipment: 'DRY_VAN',
  priority: 'STANDARD',
  commodity: 'Paper products',
  weightLbs: '42000',
  rate: '',
  pickupAt: '2026-11-07T08:00',
  deliveryBy: '2026-11-08T18:00',
};

describe('shipmentSchema', () => {
  it('accepts a valid load and coerces numbers', () => {
    const parsed = shipmentSchema.parse(valid);
    expect(parsed.weightLbs).toBe(42000);
    expect(parsed.rate).toBe('');
  });

  it('rejects identical origin and destination', () => {
    const r = shipmentSchema.safeParse({ ...valid, destinationCode: 'CHI' });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0].path).toEqual(['destinationCode']);
  });

  it('rejects delivery before pickup', () => {
    const r = shipmentSchema.safeParse({ ...valid, deliveryBy: '2026-11-06T08:00' });
    expect(r.success).toBe(false);
    expect(r.error?.issues.find((i) => i.path[0] === 'deliveryBy')?.message).toMatch(/after pickup/);
  });

  it('enforces the legal weight limit', () => {
    const r = shipmentSchema.safeParse({ ...valid, weightLbs: '60000' });
    expect(r.success).toBe(false);
  });
});

describe('loginSchema', () => {
  it('requires a valid email and 8+ char password', () => {
    expect(loginSchema.safeParse({ email: 'nope', password: 'short' }).success).toBe(false);
    expect(loginSchema.safeParse({ email: 'a@b.co', password: 'Demo1234!' }).success).toBe(true);
  });
});
