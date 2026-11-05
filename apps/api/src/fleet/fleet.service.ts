import { ConflictException, Injectable } from '@nestjs/common';
import type { DriverStatus, Prisma, VehicleStatus } from '@prisma/client';
import { paginate } from '../common/dto/pagination.dto';
import { location } from '../shipments/shipment.mapper';
import { ACTIVE_STATUSES } from '../shipments/shipment-status';
import { PrismaService } from '../prisma/prisma.service';
import { AvailabilityQueryDto, ListDriversQueryDto, ListVehiclesQueryDto } from './fleet.dto';

const ACTIVE_LOAD = {
  where: { status: { in: ACTIVE_STATUSES } },
  select: { id: true, reference: true, status: true, originCode: true, destinationCode: true, progress: true },
  take: 1,
} as const;

function currentLoad(loads: { id: string; reference: string; status: string; originCode: string; destinationCode: string; progress: number }[]) {
  const l = loads[0];
  if (!l) return null;
  return { id: l.id, reference: l.reference, status: l.status, progress: l.progress, origin: location(l.originCode), destination: location(l.destinationCode) };
}

@Injectable()
export class FleetService {
  constructor(private readonly prisma: PrismaService) {}

  async vehicles(q: ListVehiclesQueryDto) {
    const where: Prisma.VehicleWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.equipment ? { equipment: q.equipment } : {}),
      ...(q.search
        ? {
            OR: [
              { unitNumber: { contains: q.search, mode: 'insensitive' } },
              { plate: { contains: q.search, mode: 'insensitive' } },
              { make: { contains: q.search, mode: 'insensitive' } },
              { driver: { name: { contains: q.search, mode: 'insensitive' } } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.vehicle.findMany({
        where,
        include: { driver: { select: { id: true, name: true } }, shipments: ACTIVE_LOAD },
        orderBy: [{ [q.sortBy ?? 'unitNumber']: q.sortBy ? q.sortDir : 'asc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.vehicle.count({ where }),
    ]);
    return paginate(
      rows.map(({ shipments, ...v }) => ({ ...v, currentLoad: currentLoad(shipments) })),
      total,
      q.page,
      q.pageSize,
    );
  }

  async drivers(q: ListDriversQueryDto) {
    const where: Prisma.DriverWhereInput = {
      ...(q.status ? { status: q.status } : {}),
      ...(q.search
        ? {
            OR: [
              { name: { contains: q.search, mode: 'insensitive' } },
              { phone: { contains: q.search } },
              { licenseNumber: { contains: q.search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.driver.findMany({
        where,
        include: {
          vehicle: { select: { id: true, unitNumber: true } },
          shipments: ACTIVE_LOAD,
          _count: { select: { shipments: { where: { status: 'DELIVERED' } } } },
        },
        orderBy: [{ [q.sortBy ?? 'name']: q.sortBy ? q.sortDir : 'asc' }, { id: 'asc' }],
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
      }),
      this.prisma.driver.count({ where }),
    ]);
    return paginate(
      rows.map(({ shipments, _count, ...d }) => ({
        ...d,
        deliveredLoads: _count.shipments,
        currentLoad: currentLoad(shipments),
      })),
      total,
      q.page,
      q.pageSize,
    );
  }

  /** Drivers and trucks that can take a load right now (used by the dispatch dialog). */
  async availability(q: AvailabilityQueryDto) {
    const notBusy = {
      shipments: {
        none: { status: { in: ACTIVE_STATUSES }, ...(q.shipmentId ? { id: { not: q.shipmentId } } : {}) },
      },
    };

    const [drivers, vehicles] = await Promise.all([
      this.prisma.driver.findMany({
        where: { status: { not: 'OFF_DUTY' }, ...notBusy },
        select: { id: true, name: true, rating: true, hosHoursLeft: true, vehicle: { select: { id: true, unitNumber: true } } },
        orderBy: { name: 'asc' },
      }),
      this.prisma.vehicle.findMany({
        where: {
          status: { not: 'MAINTENANCE' },
          ...(q.equipment ? { equipment: q.equipment } : {}),
          ...notBusy,
        },
        select: { id: true, unitNumber: true, make: true, model: true, equipment: true, capacityLbs: true, driverId: true },
        orderBy: { unitNumber: 'asc' },
      }),
    ]);
    return { drivers, vehicles };
  }

  async setVehicleStatus(id: string, status: VehicleStatus) {
    if (status === 'MAINTENANCE') await this.assertNotOnLoad({ vehicleId: id }, 'Truck');
    return this.prisma.vehicle.update({ where: { id }, data: { status } });
  }

  async setDriverStatus(id: string, status: DriverStatus) {
    if (status === 'OFF_DUTY') await this.assertNotOnLoad({ driverId: id }, 'Driver');
    return this.prisma.driver.update({ where: { id }, data: { status } });
  }

  private async assertNotOnLoad(where: Prisma.ShipmentWhereInput, label: string) {
    const load = await this.prisma.shipment.findFirst({
      where: { ...where, status: { in: ACTIVE_STATUSES } },
      select: { reference: true },
    });
    if (load) throw new ConflictException(`${label} is on active load ${load.reference}`);
  }
}
