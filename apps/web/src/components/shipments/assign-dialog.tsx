'use client';

import { AlertTriangle, Star, Truck, UserRound } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Lane } from '@/components/lane';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { EQUIPMENT } from '@/lib/constants';
import { formatMiles, formatNumber, formatWeight } from '@/lib/format';
import { useAssignShipment, useAvailability } from '@/lib/queries';
import type { Equipment, Location } from '@/lib/types';

export interface AssignableShipment {
  id: string;
  reference: string;
  equipment: Equipment;
  weightLbs: number;
  distanceMeters: number;
  origin: Location;
  destination: Location;
  driver: { id: string } | null;
  vehicle: { id: string } | null;
}

export function AssignDialog({
  shipment,
  open,
  onOpenChange,
}: {
  shipment: AssignableShipment;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { data, isLoading } = useAvailability({ equipment: shipment.equipment, shipmentId: shipment.id }, open);
  const assign = useAssignShipment(shipment.id);
  const [driverId, setDriverId] = useState(shipment.driver?.id ?? '');
  const [vehicleId, setVehicleId] = useState(shipment.vehicle?.id ?? '');

  useEffect(() => {
    if (open) {
      setDriverId(shipment.driver?.id ?? '');
      setVehicleId(shipment.vehicle?.id ?? '');
    }
  }, [open, shipment.driver?.id, shipment.vehicle?.id]);

  const vehicles = useMemo(() => data?.vehicles ?? [], [data]);
  const driver = data?.drivers.find((d) => d.id === driverId);
  const vehicle = vehicles.find((v) => v.id === vehicleId);
  const overweight = vehicle && shipment.weightLbs > vehicle.capacityLbs;
  const lowHos = driver && driver.hosHoursLeft < 4;

  // Pre-select the driver's paired truck when it can haul this load
  const onDriverChange = (id: string) => {
    setDriverId(id);
    const paired = data?.drivers.find((d) => d.id === id)?.vehicle?.id;
    if (paired && vehicles.some((v) => v.id === paired)) setVehicleId(paired);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Dispatch {shipment.reference}</DialogTitle>
          <DialogDescription>Assign a driver and a compatible truck to this load.</DialogDescription>
        </DialogHeader>

        <div className="space-y-5 p-5">
          <div className="flex items-center justify-between gap-4 rounded-lg border border-border bg-muted/40 p-3">
            <Lane origin={shipment.origin} destination={shipment.destination} />
            <div className="text-right text-xs text-muted-foreground">
              <p className="font-medium text-foreground">{EQUIPMENT[shipment.equipment]}</p>
              <p>
                {formatWeight(shipment.weightLbs)} · {formatMiles(shipment.distanceMeters)}
              </p>
            </div>
          </div>

          <Field label="Driver" hint={isLoading ? 'Loading available drivers…' : `${data?.drivers.length ?? 0} drivers available`}>
            <Select value={driverId} onValueChange={onDriverChange} disabled={isLoading}>
              <SelectTrigger aria-label="Driver">
                <SelectValue placeholder="Select a driver" />
              </SelectTrigger>
              <SelectContent>
                {data?.drivers.map((d) => (
                  <SelectItem key={d.id} value={d.id}>
                    <span className="flex items-center gap-2">
                      <UserRound className="size-3.5 text-muted-foreground" />
                      {d.name}
                      <span className="inline-flex items-center gap-0.5 text-xs text-muted-foreground">
                        <Star className="size-3 fill-amber-400 text-amber-400" />
                        {d.rating.toFixed(1)} · {d.hosHoursLeft.toFixed(1)}h HOS
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field label="Truck" hint={`${vehicles.length} ${EQUIPMENT[shipment.equipment].toLowerCase()} units available`}>
            <Select value={vehicleId} onValueChange={setVehicleId} disabled={isLoading}>
              <SelectTrigger aria-label="Truck">
                <SelectValue placeholder="Select a truck" />
              </SelectTrigger>
              <SelectContent>
                {vehicles.map((v) => (
                  <SelectItem key={v.id} value={v.id}>
                    <span className="flex items-center gap-2">
                      <Truck className="size-3.5 text-muted-foreground" />
                      <span className="font-medium">{v.unitNumber}</span>
                      <span className="text-xs text-muted-foreground">
                        {v.make} {v.model} · {formatNumber(v.capacityLbs)} lbs
                      </span>
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          {(overweight || lowHos) && (
            <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
              <AlertTriangle className="size-4 shrink-0" />
              <div className="space-y-0.5">
                {overweight && <p>Load exceeds {vehicle?.unitNumber} capacity — the API will reject this assignment.</p>}
                {lowHos && <p>{driver?.name} has only {driver?.hosHoursLeft.toFixed(1)}h of drive time left today.</p>}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            disabled={!driverId || !vehicleId}
            loading={assign.isPending}
            onClick={() => assign.mutate({ driverId, vehicleId }, { onSuccess: () => onOpenChange(false) })}
          >
            Dispatch load
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
