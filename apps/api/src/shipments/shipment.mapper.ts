import type { Customer, Driver, Shipment, Vehicle } from '@prisma/client';
import { CITY_BY_CODE } from '../common/geo/cities';

type ShipmentWithRelations = Omit<Shipment, 'route'> & {
  route?: unknown;
  customer: Pick<Customer, 'id' | 'name'>;
  driver: Pick<Driver, 'id' | 'name' | 'phone'> | null;
  vehicle: Pick<Vehicle, 'id' | 'unitNumber'> | null;
};

export const SHIPMENT_LIST_SELECT = {
  id: true,
  reference: true,
  customerId: true,
  originCode: true,
  destinationCode: true,
  status: true,
  priority: true,
  equipment: true,
  commodity: true,
  weightLbs: true,
  rateCents: true,
  distanceMeters: true,
  durationSeconds: true,
  progress: true,
  pickupAt: true,
  deliveryBy: true,
  pickedUpAt: true,
  deliveredAt: true,
  driverId: true,
  vehicleId: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
  customer: { select: { id: true, name: true } },
  driver: { select: { id: true, name: true, phone: true } },
  vehicle: { select: { id: true, unitNumber: true } },
} as const;

export function location(code: string) {
  const c = CITY_BY_CODE.get(code);
  return c
    ? { code: c.code, name: c.name, state: c.state, lat: c.lat, lng: c.lng }
    : { code, name: code, state: '', lat: 0, lng: 0 };
}

/** Remaining real-world drive time and ETA derived from route progress. */
export function computeEta(s: Pick<Shipment, 'status' | 'progress' | 'durationSeconds' | 'deliveryBy' | 'deliveredAt'>, now = new Date()) {
  if (s.status === 'DELIVERED') {
    return { eta: s.deliveredAt, remainingSeconds: 0, isLate: !!s.deliveredAt && s.deliveredAt > s.deliveryBy };
  }
  if (s.status !== 'IN_TRANSIT') return { eta: null, remainingSeconds: s.durationSeconds, isLate: false };
  const remainingSeconds = Math.round(s.durationSeconds * (1 - s.progress));
  const eta = new Date(now.getTime() + remainingSeconds * 1000);
  return { eta, remainingSeconds, isLate: eta > s.deliveryBy };
}

export function toShipmentSummary(s: ShipmentWithRelations) {
  const { route: _route, originCode, destinationCode, ...rest } = s;
  return {
    ...rest,
    origin: location(originCode),
    destination: location(destinationCode),
    ...computeEta(s),
  };
}

export type ShipmentSummary = ReturnType<typeof toShipmentSummary>;
