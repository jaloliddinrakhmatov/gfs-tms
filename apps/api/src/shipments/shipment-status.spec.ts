import { ConflictException } from '@nestjs/common';
import type { ShipmentStatus } from '@prisma/client';
import { assertTransition, canTransition, SHIPMENT_TRANSITIONS } from './shipment-status';

describe('shipment lifecycle', () => {
  it.each<[ShipmentStatus, ShipmentStatus]>([
    ['PENDING', 'ASSIGNED'],
    ['ASSIGNED', 'IN_TRANSIT'],
    ['ASSIGNED', 'PENDING'],
    ['IN_TRANSIT', 'DELIVERED'],
    ['PENDING', 'CANCELLED'],
  ])('allows %s → %s', (from, to) => expect(canTransition(from, to)).toBe(true));

  it.each<[ShipmentStatus, ShipmentStatus]>([
    ['PENDING', 'DELIVERED'],
    ['IN_TRANSIT', 'CANCELLED'],
    ['DELIVERED', 'IN_TRANSIT'],
    ['CANCELLED', 'PENDING'],
  ])('rejects %s → %s', (from, to) => {
    expect(canTransition(from, to)).toBe(false);
    expect(() => assertTransition(from, to)).toThrow(ConflictException);
  });

  it('treats DELIVERED and CANCELLED as terminal states', () => {
    expect(SHIPMENT_TRANSITIONS.DELIVERED).toHaveLength(0);
    expect(SHIPMENT_TRANSITIONS.CANCELLED).toHaveLength(0);
  });
});
