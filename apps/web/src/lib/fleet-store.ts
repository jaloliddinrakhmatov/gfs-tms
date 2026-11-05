import { create } from 'zustand';
import type { VehiclePosition } from './types';

interface FleetState {
  positions: Record<string, VehiclePosition>; // by vehicleId
  byShipment: Record<string, VehiclePosition>; // by shipmentId
  lastUpdate: number | null;
  connected: boolean;
  selectedVehicleId: string | null;
  replace: (batch: VehiclePosition[]) => void;
  setConnected: (connected: boolean) => void;
  select: (vehicleId: string | null) => void;
}

export const useFleet = create<FleetState>((set) => ({
  positions: {},
  byShipment: {},
  lastUpdate: null,
  connected: false,
  selectedVehicleId: null,
  // Each simulator tick carries the full set of moving trucks, so we replace (drops delivered ones).
  replace: (batch) =>
    set({
      positions: Object.fromEntries(batch.map((p) => [p.vehicleId, p])),
      byShipment: Object.fromEntries(batch.map((p) => [p.shipmentId, p])),
      lastUpdate: Date.now(),
    }),
  setConnected: (connected) => set({ connected }),
  select: (selectedVehicleId) => set({ selectedVehicleId }),
}));
