import { Injectable, Logger } from '@nestjs/common';
import type { Server } from 'socket.io';

export const ROOMS = {
  /** Dispatchers, admins and accountants: everything on the network */
  OPS: 'ops',
  driver: (driverId: string) => `driver:${driverId}`,
} as const;

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

/**
 * Thin facade over the Socket.IO server so domain services can publish events
 * without depending on the gateway (avoids circular module imports).
 */
@Injectable()
export class RealtimeService {
  private readonly logger = new Logger(RealtimeService.name);
  private server: Server | null = null;

  attach(server: Server) {
    this.server = server;
  }

  private emit(room: string | string[], event: string, payload: unknown) {
    if (!this.server) return;
    this.server.to(room).emit(event, payload);
  }

  positions(batch: VehiclePosition[]) {
    if (batch.length === 0) return;
    this.emit(ROOMS.OPS, 'fleet:positions', batch);
    for (const p of batch) if (p.driverId) this.emit(ROOMS.driver(p.driverId), 'fleet:positions', [p]);
  }

  shipmentUpdated(shipment: { id: string; reference: string; status: string; driverId: string | null }) {
    const rooms = [ROOMS.OPS, ...(shipment.driverId ? [ROOMS.driver(shipment.driverId)] : [])];
    this.emit(rooms, 'shipment:updated', shipment);
  }

  invoiceCreated(invoice: { id: string; number: string; totalCents: number; customerName: string }) {
    this.emit(ROOMS.OPS, 'invoice:created', invoice);
    this.logger.debug(`invoice:created ${invoice.number}`);
  }
}
