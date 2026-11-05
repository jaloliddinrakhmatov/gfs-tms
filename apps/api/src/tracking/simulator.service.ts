import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnApplicationShutdown,
} from '@nestjs/common';
import type Redis from 'ioredis';
import { randomUUID } from 'node:crypto';
import { AppConfig } from '../config/app-config.service';
import { cumulativeDistances, pointAlongRoute, type LatLng } from '../common/geo/route';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService, type VehiclePosition } from '../realtime/realtime.service';
import { REDIS } from '../redis/redis.module';
import { SYSTEM_USER } from '../common/decorators/current-user.decorator';
import { RoutingService } from '../common/geo/routing.service';
import { ACTIVE_STATUSES } from '../shipments/shipment-status';
import { ShipmentsService } from '../shipments/shipments.service';
import { PositionsStore } from './positions.store';

const LOCK_KEY = 'tms:simulator:leader';
/** Keep roughly this many trucks rolling by auto-picking-up assigned loads. */
const AUTOPILOT_TARGET_IN_TRANSIT = 10;

const DEMO_COMMODITIES = {
  DRY_VAN: ['Packaged foods', 'Consumer electronics', 'Paper products', 'Retail merchandise'],
  REEFER: ['Fresh produce', 'Dairy products', 'Frozen poultry'],
  FLATBED: ['Steel coils', 'Lumber', 'Construction machinery'],
} as const;

const pick = <T>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];

/**
 * Simulates GPS telematics for in-transit loads by advancing each truck along its real
 * road polyline. Only one API instance runs the simulation at a time (Redis leader lock),
 * so it is safe to scale the API horizontally.
 */
@Injectable()
export class SimulatorService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(SimulatorService.name);
  private readonly instanceId = randomUUID();
  private readonly routeCache = new Map<string, { route: LatLng[]; cumulative: number[] }>();
  private timer: NodeJS.Timeout | null = null;
  private ticking = false;
  private tickCount = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly shipments: ShipmentsService,
    private readonly realtime: RealtimeService,
    private readonly store: PositionsStore,
    @Inject(REDIS) private readonly redis: Redis,
  ) {}

  onApplicationBootstrap() {
    if (!this.config.get('SIMULATOR_ENABLED')) return;
    const tickMs = this.config.get('SIMULATOR_TICK_MS');
    this.logger.log(`Telematics simulator on (tick ${tickMs}ms, ${this.config.get('SIMULATOR_TIME_SCALE')}x)`);
    this.timer = setInterval(() => void this.tick(), tickMs);
  }

  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }

  private async isLeader(ttlMs: number): Promise<boolean> {
    const acquired = await this.redis.set(LOCK_KEY, this.instanceId, 'PX', ttlMs, 'NX');
    if (acquired) return true;
    if ((await this.redis.get(LOCK_KEY)) === this.instanceId) {
      await this.redis.pexpire(LOCK_KEY, ttlMs);
      return true;
    }
    return false;
  }

  async tick() {
    if (this.ticking) return; // never overlap ticks
    this.ticking = true;
    try {
      const tickMs = this.config.get('SIMULATOR_TICK_MS');
      if (!(await this.isLeader(tickMs * 3))) return;
      this.tickCount++;

      const active = await this.prisma.shipment.findMany({
        where: { status: 'IN_TRANSIT', vehicleId: { not: null } },
        select: {
          id: true,
          reference: true,
          route: true,
          progress: true,
          durationSeconds: true,
          originCode: true,
          destinationCode: true,
          driverId: true,
          driver: { select: { name: true } },
          vehicle: { select: { id: true, unitNumber: true } },
        },
      });

      const simulatedSeconds = (tickMs / 1000) * this.config.get('SIMULATOR_TIME_SCALE');
      const positions: VehiclePosition[] = [];
      const progressUpdates: { id: string; progress: number }[] = [];
      const delivered: string[] = [];
      const now = Date.now();

      for (const s of active) {
        if (!s.vehicle) continue;
        const progress = Math.min(1, s.progress + simulatedSeconds / Math.max(60, s.durationSeconds));
        if (progress >= 1) {
          delivered.push(s.id);
          continue;
        }
        progressUpdates.push({ id: s.id, progress });

        const geometry = this.geometry(s.id, s.route as LatLng[]);
        const { position, heading } = pointAlongRoute(geometry.route, progress, geometry.cumulative);
        positions.push({
          vehicleId: s.vehicle.id,
          unitNumber: s.vehicle.unitNumber,
          shipmentId: s.id,
          reference: s.reference,
          driverId: s.driverId,
          driverName: s.driver?.name ?? null,
          lat: +position[0].toFixed(5),
          lng: +position[1].toFixed(5),
          heading: Math.round(heading),
          speedMph: this.speedFor(s.id, now),
          progress: +progress.toFixed(4),
          remainingSeconds: Math.round(s.durationSeconds * (1 - progress)),
          originCode: s.originCode,
          destinationCode: s.destinationCode,
          updatedAt: new Date(now).toISOString(),
        });
      }

      if (progressUpdates.length) {
        await this.prisma.$transaction(
          progressUpdates.map((u) =>
            this.prisma.shipment.updateMany({
              where: { id: u.id, status: 'IN_TRANSIT' },
              data: { progress: u.progress },
            }),
          ),
        );
      }

      for (const id of delivered) {
        this.routeCache.delete(id);
        try {
          await this.shipments.markDelivered(id);
        } catch (err) {
          if (!(err instanceof ConflictException)) throw err; // already delivered elsewhere
        }
      }

      await this.store.replace(positions);
      this.realtime.positions(positions);

      // Every ~20s keep the network busy for the demo
      if (this.tickCount % 10 === 0) {
        await this.autopilot(active.length - delivered.length).catch((err: Error) =>
          this.logger.warn(`Autopilot skipped: ${err.message}`),
        );
      }
    } catch (err) {
      this.logger.error(`Simulator tick failed: ${(err as Error).message}`);
    } finally {
      this.ticking = false;
    }
  }

  /**
   * Demo autopilot: keeps ~10 trucks rolling so the live map never goes quiet.
   * 1) picks up the oldest ASSIGNED load, otherwise
   * 2) tenders a synthetic load for an idle driver + paired truck and dispatches it.
   * Pending loads on the board are left alone for the human dispatcher.
   */
  private async autopilot(inTransit: number) {
    if (!this.config.get('SIMULATOR_AUTOPILOT') || inTransit >= AUTOPILOT_TARGET_IN_TRANSIT) return;

    const next = await this.prisma.shipment.findFirst({
      where: { status: 'ASSIGNED', vehicleId: { not: null }, driverId: { not: null } },
      orderBy: { pickupAt: 'asc' },
      select: { id: true },
    });
    if (next) {
      await this.shipments.updateStatus(next.id, { status: 'IN_TRANSIT' }, SYSTEM_USER);
      return;
    }

    const crews = await this.prisma.driver.findMany({
      where: {
        status: 'AVAILABLE',
        shipments: { none: { status: { in: ACTIVE_STATUSES } } },
        vehicle: { is: { status: { not: 'MAINTENANCE' }, shipments: { none: { status: { in: ACTIVE_STATUSES } } } } },
      },
      include: { vehicle: true },
    });
    const customers = await this.prisma.customer.findMany({ select: { id: true } });
    if (!crews.length || !customers.length) return;

    const crew = pick(crews);
    const vehicle = crew.vehicle!;
    const [originCode, destinationCode] = pick(RoutingService.cachedLanes()).split('-');
    const route = RoutingService.fromCache(originCode, destinationCode)!;
    const now = Date.now();

    const load = await this.shipments.create(
      {
        customerId: pick(customers).id,
        originCode,
        destinationCode,
        equipment: vehicle.equipment,
        priority: Math.random() < 0.2 ? 'EXPEDITED' : 'STANDARD',
        commodity: pick(DEMO_COMMODITIES[vehicle.equipment]),
        weightLbs: Math.min(vehicle.capacityLbs, Math.round((15_000 + Math.random() * 28_000) / 100) * 100),
        pickupAt: new Date(now + 15 * 60_000).toISOString(),
        deliveryBy: new Date(now + route.durationSeconds * 1000 * 1.6).toISOString(),
      },
      SYSTEM_USER,
    );
    await this.shipments.assign(load.id, { driverId: crew.id, vehicleId: vehicle.id }, SYSTEM_USER);
    this.logger.log(`Autopilot tendered ${load.reference} ${originCode}→${destinationCode} for ${crew.name}`);
  }

  private geometry(id: string, route: LatLng[]) {
    let g = this.routeCache.get(id);
    if (!g) {
      g = { route, cumulative: cumulativeDistances(route) };
      this.routeCache.set(id, g);
    }
    return g;
  }

  /** Smooth, per-truck speed variation between ~52 and ~68 mph. */
  private speedFor(id: string, now: number) {
    let hash = 0;
    for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) | 0;
    const phase = (hash % 1000) / 159;
    return Math.round(60 + Math.sin(now / 45_000 + phase) * 6 + Math.sin(now / 9_000 + phase * 2) * 2);
  }
}
