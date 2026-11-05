import { Injectable } from '@nestjs/common';
import type { Prisma } from '@prisma/client';
import { paginate, PaginationQueryDto } from '../common/dto/pagination.dto';
import { location } from '../shipments/shipment.mapper';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CustomersService {
  constructor(private readonly prisma: PrismaService) {}

  async list(q: PaginationQueryDto) {
    const where: Prisma.CustomerWhereInput = q.search
      ? {
          OR: [
            { name: { contains: q.search, mode: 'insensitive' } },
            { contactName: { contains: q.search, mode: 'insensitive' } },
            { email: { contains: q.search, mode: 'insensitive' } },
          ],
        }
      : {};
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.customer.findMany({
        where,
        orderBy: { name: 'asc' },
        skip: (q.page - 1) * q.pageSize,
        take: q.pageSize,
        include: { _count: { select: { shipments: true } } },
      }),
      this.prisma.customer.count({ where }),
    ]);

    const ids = rows.map((r) => r.id);
    const [revenue, open] = await Promise.all([
      this.prisma.invoice.groupBy({
        by: ['customerId'],
        where: { customerId: { in: ids }, status: { not: 'VOID' } },
        _sum: { totalCents: true },
      }),
      this.prisma.invoice.groupBy({
        by: ['customerId'],
        where: { customerId: { in: ids }, status: { in: ['ISSUED', 'OVERDUE'] } },
        _sum: { totalCents: true, paidCents: true },
      }),
    ]);
    const revenueBy = new Map(revenue.map((r) => [r.customerId, r._sum.totalCents ?? 0]));
    const openBy = new Map(open.map((r) => [r.customerId, (r._sum.totalCents ?? 0) - (r._sum.paidCents ?? 0)]));

    return paginate(
      rows.map(({ _count, cityCode, ...c }) => ({
        ...c,
        city: location(cityCode),
        shipmentCount: _count.shipments,
        lifetimeRevenueCents: revenueBy.get(c.id) ?? 0,
        openBalanceCents: openBy.get(c.id) ?? 0,
      })),
      total,
      q.page,
      q.pageSize,
    );
  }

  options() {
    return this.prisma.customer.findMany({
      select: { id: true, name: true, paymentTermsDays: true },
      orderBy: { name: 'asc' },
    });
  }
}
