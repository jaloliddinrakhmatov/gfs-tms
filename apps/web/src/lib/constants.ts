import type { DriverStatus, Equipment, InvoiceStatus, Priority, Role, ShipmentStatus, VehicleStatus } from './types';

type Tone = 'neutral' | 'amber' | 'blue' | 'violet' | 'green' | 'red';

export const SHIPMENT_STATUS: Record<ShipmentStatus, { label: string; tone: Tone; color: string }> = {
  PENDING: { label: 'Pending', tone: 'amber', color: '#f59e0b' },
  ASSIGNED: { label: 'Assigned', tone: 'blue', color: '#3b82f6' },
  IN_TRANSIT: { label: 'In transit', tone: 'violet', color: '#6366f1' },
  DELIVERED: { label: 'Delivered', tone: 'green', color: '#10b981' },
  CANCELLED: { label: 'Cancelled', tone: 'neutral', color: '#94a3b8' },
};

export const INVOICE_STATUS: Record<InvoiceStatus, { label: string; tone: Tone }> = {
  ISSUED: { label: 'Open', tone: 'blue' },
  PAID: { label: 'Paid', tone: 'green' },
  OVERDUE: { label: 'Overdue', tone: 'red' },
  VOID: { label: 'Void', tone: 'neutral' },
};

export const VEHICLE_STATUS: Record<VehicleStatus, { label: string; tone: Tone }> = {
  ACTIVE: { label: 'On load', tone: 'violet' },
  IDLE: { label: 'Available', tone: 'green' },
  MAINTENANCE: { label: 'Maintenance', tone: 'amber' },
};

export const DRIVER_STATUS: Record<DriverStatus, { label: string; tone: Tone }> = {
  AVAILABLE: { label: 'Available', tone: 'green' },
  ON_DUTY: { label: 'On duty', tone: 'violet' },
  OFF_DUTY: { label: 'Off duty', tone: 'neutral' },
};

export const EQUIPMENT: Record<Equipment, string> = {
  DRY_VAN: "Dry van 53'",
  REEFER: "Reefer 53'",
  FLATBED: "Flatbed 48'",
};

export const PRIORITY: Record<Priority, string> = { STANDARD: 'Standard', EXPEDITED: 'Expedited' };

export const ROLE_LABEL: Record<Role, string> = {
  ADMIN: 'Administrator',
  DISPATCHER: 'Dispatcher',
  ACCOUNTANT: 'Accountant',
  DRIVER: 'Driver',
};

export const DEMO_ACCOUNTS = [
  { email: 'dispatcher@gfs.demo', role: 'DISPATCHER' as Role, hint: 'Dispatch loads, live map' },
  { email: 'accountant@gfs.demo', role: 'ACCOUNTANT' as Role, hint: 'Invoices, payments, AR' },
  { email: 'driver@gfs.demo', role: 'DRIVER' as Role, hint: 'Own loads only' },
  { email: 'admin@gfs.demo', role: 'ADMIN' as Role, hint: 'Full access' },
];
export const DEMO_PASSWORD = 'Demo1234!';
