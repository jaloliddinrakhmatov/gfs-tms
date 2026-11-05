import { Badge } from '@/components/ui/badge';
import { DRIVER_STATUS, INVOICE_STATUS, SHIPMENT_STATUS, VEHICLE_STATUS } from '@/lib/constants';
import type { DriverStatus, InvoiceStatus, ShipmentStatus, VehicleStatus } from '@/lib/types';

export function ShipmentStatusBadge({ status }: { status: ShipmentStatus }) {
  const meta = SHIPMENT_STATUS[status];
  return (
    <Badge tone={meta.tone} dot pulse={status === 'IN_TRANSIT'}>
      {meta.label}
    </Badge>
  );
}

export function InvoiceStatusBadge({ status }: { status: InvoiceStatus }) {
  const meta = INVOICE_STATUS[status];
  return (
    <Badge tone={meta.tone} dot>
      {meta.label}
    </Badge>
  );
}

export function VehicleStatusBadge({ status }: { status: VehicleStatus }) {
  const meta = VEHICLE_STATUS[status];
  return <Badge tone={meta.tone} dot>{meta.label}</Badge>;
}

export function DriverStatusBadge({ status }: { status: DriverStatus }) {
  const meta = DRIVER_STATUS[status];
  return <Badge tone={meta.tone} dot>{meta.label}</Badge>;
}
