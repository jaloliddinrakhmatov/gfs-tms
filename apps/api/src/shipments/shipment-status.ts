import { ConflictException } from '@nestjs/common';
import type { ShipmentStatus } from '@prisma/client';

/** Allowed lifecycle transitions — the single source of truth for shipment state. */
export const SHIPMENT_TRANSITIONS: Readonly<Record<ShipmentStatus, readonly ShipmentStatus[]>> = {
  PENDING: ['ASSIGNED', 'CANCELLED'],
  ASSIGNED: ['IN_TRANSIT', 'PENDING', 'CANCELLED'],
  IN_TRANSIT: ['DELIVERED'],
  DELIVERED: [],
  CANCELLED: [],
};

export const ACTIVE_STATUSES: ShipmentStatus[] = ['ASSIGNED', 'IN_TRANSIT'];

export function canTransition(from: ShipmentStatus, to: ShipmentStatus): boolean {
  return SHIPMENT_TRANSITIONS[from].includes(to);
}

export function assertTransition(from: ShipmentStatus, to: ShipmentStatus): void {
  if (!canTransition(from, to)) {
    throw new ConflictException(`Cannot change shipment status from ${from} to ${to}`);
  }
}
