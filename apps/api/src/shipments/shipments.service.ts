import { InjectQueue } from '@nestjs/bullmq';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, type ShipmentStatus } from '@prisma/client';
import type { Queue } from 'bullmq';
import { BILLING_QUEUE, BillingJobs, type GenerateInvoiceJob } from '../billing/billing.constants';
import { actorIdOf, type AuthUser } from '../common/decorators/current-user.decorator';
import { paginate } from '../common/dto/pagination.dto';
import { CITY_BY_CODE } from '../common/geo/cities';
import { RoutingService } from '../common/geo/routing.service';
import { quoteRate } from '../common/money';
import { nextSequence } from '../common/sequence';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import {
  AssignShipmentDto,
  CreateShipmentDto,
  ListShipmentsQueryDto,
  QuoteDto,
  UpdateShipmentStatusDto,
} from './dto/shipment.dto';
import { SHIPMENT_LIST_SELECT, toShipmentSummary } from './shipment.mapper';
import { ACTIVE_STATUSES, assertTransition } from './shipment-status';

@Injectable()
export class ShipmentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly routing: RoutingService,
    private readonly realtime: RealtimeService,
    @InjectQueue(BILLING_QUEUE) private readonly billingQueue: Queue<GenerateInvoiceJob>,
  ) {}

  // ───────────────────────────── Queries ─────────────────────────────

  async list(query: ListShipmentsQueryDto, user: AuthUser) {
    const where: Prisma.ShipmentWhereInput = {
      ...(query.status?.length ? { status: { in: query.status } } : {}),
      ...(query.priority ? { priority: query.priority } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
      ...(user.role === 'DRIVER' ? { driverId: user.driverId ?? '__none__' } : {}),
    };

    const term = query.search?.trim();
    if (term) {
      const upper = term.toUpperCase();
      where.OR = [
        { reference: { contains: term, mode: 'insensitive' } },
        { commodity: { contains: term, mode: 'insensitive' } },
        { customer: { name: { contains: term, mode: 'insensitive' } } },
        { driver: { name: { contains: term, mode: 'insensitive' } } },
        { originCode: upper },
        { destinationCode: upper },
        ...this.citiesMatching(term).flatMap((code) => [{ originCode: code }, { destinationCode: code }]),
      ];
    }

    const orderBy = { [query.sortBy ?? 'createdAt']: query.sortDir } as Prisma.ShipmentOrderByWithRelationInput;
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.shipment.findMany({
        where,
        orderBy: [orderBy, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        select: SHIPMENT_LIST_SELECT,
      }),
      this.prisma.shipment.count({ where }),
    ]);

    return paginate(rows.map(toShipmentSummary), total, query.page, query.pageSize);
  }

  async statusCounts(user: AuthUser) {
    const groups = await this.prisma.shipment.groupBy({
      by: ['status'],
      _count: { _all: true },
      where: user.role === 'DRIVER' ? { driverId: user.driverId ?? '__none__' } : undefined,
    });
    const counts: Record<ShipmentStatus, number> = {
      PENDING: 0,
      ASSIGNED: 0,
      IN_TRANSIT: 0,
      DELIVERED: 0,
      CANCELLED: 0,
    };
    for (const g of groups) counts[g.status] = g._count._all;
    return counts;
  }

  async findOne(id: string, user: AuthUser) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id },
      include: {
        customer: { select: { id: true, name: true, contactName: true, email: true, phone: true } },
        driver: { select: { id: true, name: true, phone: true, rating: true } },
        vehicle: { select: { id: true, unitNumber: true, make: true, model: true, plate: true } },
        invoice: { select: { id: true, number: true, status: true, totalCents: true, dueAt: true } },
        events: {
          orderBy: { createdAt: 'desc' },
          include: { actor: { select: { id: true, name: true } } },
        },
      },
    });
    if (!shipment) throw new NotFoundException('Shipment not found');
    if (user.role === 'DRIVER' && shipment.driverId !== user.driverId) {
      throw new ForbiddenException('This load is not assigned to you');
    }
    const { events, invoice, route, ...rest } = shipment;
    return {
      ...toShipmentSummary({ ...rest, customer: rest.customer, driver: rest.driver, vehicle: rest.vehicle }),
      customer: rest.customer,
      driver: rest.driver,
      vehicle: rest.vehicle,
      route: route as [number, number][],
      invoice,
      events,
    };
  }

  async quote(dto: QuoteDto) {
    this.assertLane(dto.originCode, dto.destinationCode);
    const route = await this.routing.resolve(dto.originCode, dto.destinationCode);
    return {
      ...quoteRate({ distanceMeters: route.distanceMeters, equipment: dto.equipment, priority: dto.priority }),
      distanceMeters: route.distanceMeters,
      durationSeconds: route.durationSeconds,
      route: route.route,
      routeSource: route.source,
    };
  }

  // ───────────────────────────── Commands ─────────────────────────────

  async create(dto: CreateShipmentDto, user: AuthUser) {
    this.assertLane(dto.originCode, dto.destinationCode);
    const pickupAt = new Date(dto.pickupAt);
    const deliveryBy = new Date(dto.deliveryBy);
    if (deliveryBy <= pickupAt) throw new BadRequestException('deliveryBy must be after pickupAt');

    const customer = await this.prisma.customer.findUnique({ where: { id: dto.customerId } });
    if (!customer) throw new BadRequestException('Customer not found');

    const route = await this.routing.resolve(dto.originCode, dto.destinationCode);
    const rateCents =
      dto.rateCents ??
      quoteRate({ distanceMeters: route.distanceMeters, equipment: dto.equipment, priority: dto.priority })
        .totalCents;

    const shipment = await this.prisma.$transaction(async (tx) => {
      const seq = await nextSequence(tx, 'shipment');
      return tx.shipment.create({
        data: {
          reference: `GFS-${String(100000 + seq)}`,
          customerId: dto.customerId,
          originCode: dto.originCode,
          destinationCode: dto.destinationCode,
          priority: dto.priority,
          equipment: dto.equipment,
          commodity: dto.commodity.trim(),
          weightLbs: dto.weightLbs,
          rateCents,
          distanceMeters: route.distanceMeters,
          durationSeconds: route.durationSeconds,
          route: route.route,
          pickupAt,
          deliveryBy,
          notes: dto.notes?.trim() || null,
          events: {
            create: {
              type: 'CREATED',
              message: `Load tendered by ${customer.name}`,
              actorId: actorIdOf(user),
            },
          },
        },
        select: SHIPMENT_LIST_SELECT,
      });
    });

    this.publish(shipment);
    return toShipmentSummary(shipment);
  }

  async assign(id: string, dto: AssignShipmentDto, user: AuthUser) {
    const result = await this.prisma.$transaction(async (tx) => {
      const shipment = await tx.shipment.findUnique({ where: { id } });
      if (!shipment) throw new NotFoundException('Shipment not found');
      if (shipment.status !== 'PENDING' && shipment.status !== 'ASSIGNED') {
        throw new ConflictException(`Cannot assign a ${shipment.status.toLowerCase()} shipment`);
      }

      const [driver, vehicle] = await Promise.all([
        tx.driver.findUnique({ where: { id: dto.driverId } }),
        tx.vehicle.findUnique({ where: { id: dto.vehicleId } }),
      ]);
      if (!driver) throw new BadRequestException('Driver not found');
      if (!vehicle) throw new BadRequestException('Vehicle not found');
      if (driver.status === 'OFF_DUTY') throw new ConflictException(`${driver.name} is off duty`);
      if (vehicle.status === 'MAINTENANCE') throw new ConflictException(`${vehicle.unitNumber} is in maintenance`);
      if (vehicle.equipment !== shipment.equipment) {
        throw new ConflictException(
          `${vehicle.unitNumber} is ${vehicle.equipment.replace('_', ' ').toLowerCase()}, load requires ${shipment.equipment.replace('_', ' ').toLowerCase()}`,
        );
      }
      if (shipment.weightLbs > vehicle.capacityLbs) {
        throw new ConflictException(`Load exceeds ${vehicle.unitNumber} capacity (${vehicle.capacityLbs} lbs)`);
      }

      const busy = await tx.shipment.findFirst({
        where: {
          id: { not: id },
          status: { in: ACTIVE_STATUSES },
          OR: [{ driverId: driver.id }, { vehicleId: vehicle.id }],
        },
        select: { reference: true, driverId: true },
      });
      if (busy) {
        const who = busy.driverId === driver.id ? driver.name : vehicle.unitNumber;
        throw new ConflictException(`${who} is already on load ${busy.reference}`);
      }

      // Release previously assigned resources on re-assignment
      if (shipment.driverId && shipment.driverId !== driver.id) {
        await tx.driver.update({ where: { id: shipment.driverId }, data: { status: 'AVAILABLE' } });
      }
      if (shipment.vehicleId && shipment.vehicleId !== vehicle.id) {
        await tx.vehicle.update({ where: { id: shipment.vehicleId }, data: { status: 'IDLE' } });
      }

      await tx.driver.update({ where: { id: driver.id }, data: { status: 'ON_DUTY' } });
      await tx.vehicle.update({ where: { id: vehicle.id }, data: { status: 'ACTIVE' } });

      return tx.shipment.update({
        where: { id },
        data: {
          status: 'ASSIGNED',
          driverId: driver.id,
          vehicleId: vehicle.id,
          events: {
            create: {
              type: 'ASSIGNED',
              message: `Dispatched to ${driver.name} · ${vehicle.unitNumber}`,
              actorId: actorIdOf(user),
            },
          },
        },
        select: SHIPMENT_LIST_SELECT,
      });
    });

    this.publish(result);
    return toShipmentSummary(result);
  }

  async updateStatus(id: string, dto: UpdateShipmentStatusDto, user: AuthUser) {
    const current = await this.prisma.shipment.findUnique({ where: { id } });
    if (!current) throw new NotFoundException('Shipment not found');
    if (user.role === 'DRIVER') {
      if (current.driverId !== user.driverId) throw new ForbiddenException('This load is not assigned to you');
      if (dto.status === 'CANCELLED' || dto.status === 'PENDING') {
        throw new ForbiddenException('Drivers can only update pickup and delivery');
      }
    }
    assertTransition(current.status, dto.status);

    switch (dto.status) {
      case 'IN_TRANSIT':
        return this.transition(id, current.status, dto.status, {
          data: { pickedUpAt: new Date(), progress: 0 },
          event: { type: 'PICKED_UP', message: 'Picked up — en route to consignee' },
          actorId: actorIdOf(user),
        });
      case 'DELIVERED':
        return this.markDelivered(id, actorIdOf(user));
      case 'CANCELLED':
        return this.transition(id, current.status, dto.status, {
          data: {},
          event: { type: 'CANCELLED', message: dto.reason ? `Cancelled: ${dto.reason}` : 'Load cancelled' },
          actorId: actorIdOf(user),
          release: true,
        });
      case 'PENDING':
        return this.transition(id, current.status, dto.status, {
          data: { driverId: null, vehicleId: null },
          event: { type: 'UNASSIGNED', message: dto.reason ? `Unassigned: ${dto.reason}` : 'Returned to load board' },
          actorId: actorIdOf(user),
          release: true,
        });
    }
  }

  /** Called by both users and the live tracking simulator. Idempotent per shipment. */
  async markDelivered(id: string, actorId: string | null = null) {
    const summary = await this.transition(id, 'IN_TRANSIT', 'DELIVERED', {
      data: { deliveredAt: new Date(), progress: 1 },
      event: { type: 'DELIVERED', message: 'Delivered — POD captured' },
      actorId,
      release: true,
    });
    await this.billingQueue.add(
      BillingJobs.GENERATE_INVOICE,
      { shipmentId: id },
      { jobId: `invoice-${id}`, attempts: 5, backoff: { type: 'exponential', delay: 2000 }, removeOnComplete: 1000 },
    );
    return summary;
  }

  async addNote(id: string, message: string, user: AuthUser) {
    const shipment = await this.prisma.shipment.findUnique({ where: { id }, select: { driverId: true } });
    if (!shipment) throw new NotFoundException('Shipment not found');
    if (user.role === 'DRIVER' && shipment.driverId !== user.driverId) {
      throw new ForbiddenException('This load is not assigned to you');
    }
    return this.prisma.shipmentEvent.create({
      data: { shipmentId: id, type: 'NOTE', message: message.trim(), actorId: user.id },
      include: { actor: { select: { id: true, name: true } } },
    });
  }

  // ───────────────────────────── Internals ─────────────────────────────

  /**
   * Compare-and-set status transition: the UPDATE only applies if the row is still in
   * the expected state, so concurrent writers (user + simulator) cannot double-apply.
   */
  private async transition(
    id: string,
    from: ShipmentStatus,
    to: ShipmentStatus,
    opts: {
      data: Prisma.ShipmentUncheckedUpdateManyInput;
      event: { type: Prisma.ShipmentEventCreateManyInput['type']; message: string };
      actorId: string | null;
      release?: boolean;
    },
  ) {
    const updated = await this.prisma.$transaction(async (tx) => {
      const before = await tx.shipment.findUnique({ where: { id }, select: { driverId: true, vehicleId: true } });
      const { count } = await tx.shipment.updateMany({
        where: { id, status: from },
        data: { ...opts.data, status: to },
      });
      if (count === 0) throw new ConflictException('Shipment was modified by someone else — refresh and retry');

      await tx.shipmentEvent.create({
        data: { shipmentId: id, type: opts.event.type, message: opts.event.message, actorId: opts.actorId },
      });

      if (opts.release && before) {
        if (before.driverId) await tx.driver.update({ where: { id: before.driverId }, data: { status: 'AVAILABLE' } });
        if (before.vehicleId) await tx.vehicle.update({ where: { id: before.vehicleId }, data: { status: 'IDLE' } });
      }
      return tx.shipment.findUniqueOrThrow({ where: { id }, select: SHIPMENT_LIST_SELECT });
    });

    this.publish(updated);
    return toShipmentSummary(updated);
  }

  private publish(s: { id: string; reference: string; status: string; driverId: string | null }) {
    this.realtime.shipmentUpdated({ id: s.id, reference: s.reference, status: s.status, driverId: s.driverId });
  }

  private assertLane(origin: string, destination: string) {
    if (!CITY_BY_CODE.has(origin)) throw new BadRequestException(`Unknown origin ${origin}`);
    if (!CITY_BY_CODE.has(destination)) throw new BadRequestException(`Unknown destination ${destination}`);
    if (origin === destination) throw new BadRequestException('Origin and destination must differ');
  }

  private citiesMatching(term: string) {
    const t = term.toLowerCase();
    return [...CITY_BY_CODE.values()].filter((c) => c.name.toLowerCase().includes(t)).map((c) => c.code);
  }
}
