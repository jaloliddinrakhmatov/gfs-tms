export type Role = 'ADMIN' | 'DISPATCHER' | 'ACCOUNTANT' | 'DRIVER';
export type ShipmentStatus = 'PENDING' | 'ASSIGNED' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';
export type Priority = 'STANDARD' | 'EXPEDITED';
export type Equipment = 'DRY_VAN' | 'REEFER' | 'FLATBED';
export type InvoiceStatus = 'ISSUED' | 'PAID' | 'OVERDUE' | 'VOID';
export type DriverStatus = 'AVAILABLE' | 'ON_DUTY' | 'OFF_DUTY';
export type VehicleStatus = 'ACTIVE' | 'IDLE' | 'MAINTENANCE';
export type PaymentMethod = 'ACH' | 'WIRE' | 'CARD' | 'CHECK';
export type LatLng = [number, number];

export interface User {
  id: string;
  email: string;
  name: string;
  role: Role;
  driverId: string | null;
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export interface Location {
  code: string;
  name: string;
  state: string;
  lat: number;
  lng: number;
}

export interface Shipment {
  id: string;
  reference: string;
  status: ShipmentStatus;
  priority: Priority;
  equipment: Equipment;
  commodity: string;
  weightLbs: number;
  rateCents: number;
  distanceMeters: number;
  durationSeconds: number;
  progress: number;
  pickupAt: string;
  deliveryBy: string;
  pickedUpAt: string | null;
  deliveredAt: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  origin: Location;
  destination: Location;
  customer: { id: string; name: string };
  driver: { id: string; name: string; phone: string } | null;
  vehicle: { id: string; unitNumber: string } | null;
  eta: string | null;
  remainingSeconds: number;
  isLate: boolean;
}

export interface ShipmentEvent {
  id: string;
  type: 'CREATED' | 'ASSIGNED' | 'UNASSIGNED' | 'PICKED_UP' | 'DELIVERED' | 'CANCELLED' | 'NOTE';
  message: string;
  createdAt: string;
  actor: { id: string; name: string } | null;
}

export interface ShipmentDetail extends Omit<Shipment, 'customer' | 'driver' | 'vehicle'> {
  customer: { id: string; name: string; contactName: string; email: string; phone: string };
  driver: { id: string; name: string; phone: string; rating: number } | null;
  vehicle: { id: string; unitNumber: string; make: string; model: string; plate: string } | null;
  route: LatLng[];
  invoice: { id: string; number: string; status: InvoiceStatus; totalCents: number; dueAt: string } | null;
  events: ShipmentEvent[];
}

export interface Quote {
  miles: number;
  lineHaulCents: number;
  fuelSurchargeCents: number;
  totalCents: number;
  ratePerMileCents: number;
  distanceMeters: number;
  durationSeconds: number;
  route: LatLng[];
  routeSource: 'cache' | 'osrm' | 'estimate';
}

export interface VehiclePosition {
  vehicleId: string;
  unitNumber: string;
  shipmentId: string;
  reference: string;
  driverId: string | null;
  driverName: string | null;
  lat: number;
  lng: number;
  heading: number;
  speedMph: number;
  progress: number;
  remainingSeconds: number;
  originCode: string;
  destinationCode: string;
  updatedAt: string;
}

export interface CurrentLoad {
  id: string;
  reference: string;
  status: ShipmentStatus;
  progress: number;
  origin: Location;
  destination: Location;
}

export interface Vehicle {
  id: string;
  unitNumber: string;
  make: string;
  model: string;
  year: number;
  plate: string;
  vin: string;
  equipment: Equipment;
  capacityLbs: number;
  status: VehicleStatus;
  odometerMi: number;
  fuelPct: number;
  driver: { id: string; name: string } | null;
  currentLoad: CurrentLoad | null;
}

export interface Driver {
  id: string;
  name: string;
  phone: string;
  licenseNumber: string;
  status: DriverStatus;
  rating: number;
  hosHoursLeft: number;
  deliveredLoads: number;
  vehicle: { id: string; unitNumber: string } | null;
  currentLoad: CurrentLoad | null;
}

export interface Availability {
  drivers: { id: string; name: string; rating: number; hosHoursLeft: number; vehicle: { id: string; unitNumber: string } | null }[];
  vehicles: { id: string; unitNumber: string; make: string; model: string; equipment: Equipment; capacityLbs: number; driverId: string | null }[];
}

export interface Customer {
  id: string;
  name: string;
  contactName: string;
  email: string;
  phone: string;
  paymentTermsDays: number;
  city: Location;
  shipmentCount: number;
  lifetimeRevenueCents: number;
  openBalanceCents: number;
}

export interface Invoice {
  id: string;
  number: string;
  status: InvoiceStatus;
  lineHaulCents: number;
  fuelSurchargeCents: number;
  accessorialCents: number;
  totalCents: number;
  paidCents: number;
  balanceCents: number;
  issuedAt: string;
  dueAt: string;
  paidAt: string | null;
  customer: { id: string; name: string; email: string };
  shipment: { id: string; reference: string; commodity: string; deliveredAt: string | null; origin: Location; destination: Location };
}

export interface InvoiceDetail extends Invoice {
  payments: { id: string; amountCents: number; method: PaymentMethod; reference: string | null; createdAt: string }[];
}

export interface BillingSummary {
  outstandingCents: number;
  billedMtdCents: number;
  collectedMtdCents: number;
  overdueCount: number;
  aging: { current: number; d1_30: number; d31_60: number; d60plus: number };
}

export interface Overview {
  kpis: {
    inTransit: number;
    awaitingDispatch: number;
    assigned: number;
    revenue30dCents: number;
    revenueChangePct: number;
    delivered30d: number;
    deliveredChangePct: number;
    onTimeRate: number;
    onTimeChangePts: number;
    ratePerMileCents: number;
    ratePerMileChangePct: number;
    fleetUtilization: number;
    activeVehicles: number;
    totalVehicles: number;
    outstandingCents: number;
  };
  statusCounts: Partial<Record<ShipmentStatus, number>>;
  revenueSeries: { date: string; loads: number; revenueCents: number }[];
  topLanes: { origin: Location; destination: Location; loads: number; revenueCents: number; ratePerMileCents: number }[];
  recentActivity: {
    id: string;
    type: ShipmentEvent['type'];
    message: string;
    createdAt: string;
    actor: string;
    shipment: { id: string; reference: string };
  }[];
}
