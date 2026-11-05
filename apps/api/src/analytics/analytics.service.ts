import { Injectable } from '@nestjs/common';
import { metersToMiles } from '../common/money';
import { location } from '../shipments/shipment.mapper';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 86_400_000;

function pctChange(current: number, previous: number) {
  if (previous === 0) return current === 0 ? 0 : 100;
  return +(((current - previous) / previous) * 100).toFixed(1);
}

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async overview() {
    const now = new Date();
    const d30 = new Date(now.getTime() - 30 * DAY);
    const d60 = new Date(now.getTime() - 60 * DAY);
    const d90 = new Date(now.getTime() - 90 * DAY);

    const [statusGroups, current, previous, vehicles, busyVehicles, series, lanes, activity, outstanding] =
      await Promise.all([
        this.prisma.shipment.groupBy({ by: ['status'], _count: { _all: true } }),
        this.periodStats(d30, now),
        this.periodStats(d60, d30),
        this.prisma.vehicle.count({ where: { status: { not: 'MAINTENANCE' } } }),
        this.prisma.vehicle.count({ where: { shipments: { some: { status: { in: ['ASSIGNED', 'IN_TRANSIT'] } } } } }),
        this.dailySeries(d30),
        this.topLanes(d90),
        this.prisma.shipmentEvent.findMany({
          take: 14,
          orderBy: { createdAt: 'desc' },
          include: {
            shipment: { select: { id: true, reference: true } },
            actor: { select: { name: true } },
          },
        }),
        this.prisma.invoice.aggregate({
          where: { status: { in: ['ISSUED', 'OVERDUE'] } },
          _sum: { totalCents: true, paidCents: true },
        }),
      ]);

    const statusCounts = Object.fromEntries(statusGroups.map((g) => [g.status, g._count._all])) as Record<string, number>;

    return {
      kpis: {
        inTransit: statusCounts.IN_TRANSIT ?? 0,
        awaitingDispatch: statusCounts.PENDING ?? 0,
        assigned: statusCounts.ASSIGNED ?? 0,
        revenue30dCents: current.revenueCents,
        revenueChangePct: pctChange(current.revenueCents, previous.revenueCents),
        delivered30d: current.delivered,
        deliveredChangePct: pctChange(current.delivered, previous.delivered),
        onTimeRate: current.onTimeRate,
        onTimeChangePts: +(current.onTimeRate - previous.onTimeRate).toFixed(1),
        ratePerMileCents: current.ratePerMileCents,
        ratePerMileChangePct: pctChange(current.ratePerMileCents, previous.ratePerMileCents),
        fleetUtilization: vehicles ? Math.round((busyVehicles / vehicles) * 100) : 0,
        activeVehicles: busyVehicles,
        totalVehicles: vehicles,
        outstandingCents: (outstanding._sum.totalCents ?? 0) - (outstanding._sum.paidCents ?? 0),
      },
      statusCounts,
      revenueSeries: series,
      topLanes: lanes,
      recentActivity: activity.map((e) => ({
        id: e.id,
        type: e.type,
        message: e.message,
        createdAt: e.createdAt,
        actor: e.actor?.name ?? 'System',
        shipment: e.shipment,
      })),
    };
  }

  private async periodStats(from: Date, to: Date) {
    const delivered = await this.prisma.shipment.findMany({
      where: { status: 'DELIVERED', deliveredAt: { gte: from, lt: to } },
      select: { rateCents: true, distanceMeters: true, deliveredAt: true, deliveryBy: true },
    });
    const revenueCents = delivered.reduce((s, d) => s + d.rateCents, 0);
    const miles = delivered.reduce((s, d) => s + metersToMiles(d.distanceMeters), 0);
    const onTime = delivered.filter((d) => d.deliveredAt && d.deliveredAt <= d.deliveryBy).length;
    return {
      delivered: delivered.length,
      revenueCents,
      onTimeRate: delivered.length ? +((onTime / delivered.length) * 100).toFixed(1) : 100,
      ratePerMileCents: miles ? Math.round(revenueCents / miles) : 0,
    };
  }

  private async dailySeries(since: Date) {
    const rows = await this.prisma.$queryRaw<{ day: Date; loads: number; revenue: bigint }[]>`
      SELECT date_trunc('day', "deliveredAt") AS day,
             COUNT(*)::int AS loads,
             COALESCE(SUM("rateCents"), 0)::bigint AS revenue
      FROM "Shipment"
      WHERE "status" = 'DELIVERED' AND "deliveredAt" >= ${since}
      GROUP BY 1 ORDER BY 1`;
    const byDay = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), r]));

    const out: { date: string; loads: number; revenueCents: number }[] = [];
    const start = new Date(Date.UTC(since.getUTCFullYear(), since.getUTCMonth(), since.getUTCDate()));
    for (let t = start.getTime() + DAY; t <= Date.now(); t += DAY) {
      const key = new Date(t).toISOString().slice(0, 10);
      const r = byDay.get(key);
      out.push({ date: key, loads: r?.loads ?? 0, revenueCents: Number(r?.revenue ?? 0) });
    }
    return out;
  }

  private async topLanes(since: Date) {
    const groups = await this.prisma.shipment.groupBy({
      by: ['originCode', 'destinationCode'],
      where: { status: { not: 'CANCELLED' }, createdAt: { gte: since } },
      _count: { _all: true },
      _sum: { rateCents: true, distanceMeters: true },
      orderBy: { _sum: { rateCents: 'desc' } },
      take: 6,
    });
    return groups.map((g) => {
      const miles = metersToMiles(g._sum.distanceMeters ?? 0);
      return {
        origin: location(g.originCode),
        destination: location(g.destinationCode),
        loads: g._count._all,
        revenueCents: g._sum.rateCents ?? 0,
        ratePerMileCents: miles ? Math.round((g._sum.rateCents ?? 0) / miles) : 0,
      };
    });
  }
}
