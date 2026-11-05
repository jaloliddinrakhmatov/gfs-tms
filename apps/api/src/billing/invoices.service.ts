import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { AuthUser } from '../common/decorators/current-user.decorator';
import { paginate } from '../common/dto/pagination.dto';
import { location } from '../shipments/shipment.mapper';
import { PrismaService } from '../prisma/prisma.service';
import { ListInvoicesQueryDto, RecordPaymentDto } from './dto/billing.dto';

const INVOICE_INCLUDE = {
  customer: { select: { id: true, name: true, email: true } },
  shipment: {
    select: { id: true, reference: true, originCode: true, destinationCode: true, deliveredAt: true, commodity: true },
  },
} satisfies Prisma.InvoiceInclude;

type InvoiceRow = Prisma.InvoiceGetPayload<{ include: typeof INVOICE_INCLUDE }>;

function toInvoice(i: InvoiceRow) {
  const { originCode, destinationCode, ...shipment } = i.shipment;
  return {
    ...i,
    balanceCents: i.totalCents - i.paidCents,
    shipment: { ...shipment, origin: location(originCode), destination: location(destinationCode) },
  };
}

@Injectable()
export class InvoicesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(query: ListInvoicesQueryDto) {
    const where: Prisma.InvoiceWhereInput = {
      ...(query.status?.length ? { status: { in: query.status } } : {}),
      ...(query.customerId ? { customerId: query.customerId } : {}),
    };
    const term = query.search?.trim();
    if (term) {
      where.OR = [
        { number: { contains: term, mode: 'insensitive' } },
        { customer: { name: { contains: term, mode: 'insensitive' } } },
        { shipment: { reference: { contains: term, mode: 'insensitive' } } },
      ];
    }
    const [rows, total] = await this.prisma.$transaction([
      this.prisma.invoice.findMany({
        where,
        include: INVOICE_INCLUDE,
        orderBy: [{ [query.sortBy ?? 'issuedAt']: query.sortDir }, { id: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.invoice.count({ where }),
    ]);
    return paginate(rows.map(toInvoice), total, query.page, query.pageSize);
  }

  /** Accounts-receivable summary with aging buckets. */
  async summary() {
    const now = Date.now();
    const open = await this.prisma.invoice.findMany({
      where: { status: { in: ['ISSUED', 'OVERDUE'] } },
      select: { totalCents: true, paidCents: true, dueAt: true },
    });
    const aging = { current: 0, d1_30: 0, d31_60: 0, d60plus: 0 };
    let outstanding = 0;
    for (const i of open) {
      const balance = i.totalCents - i.paidCents;
      outstanding += balance;
      const daysPast = Math.floor((now - i.dueAt.getTime()) / 86_400_000);
      if (daysPast <= 0) aging.current += balance;
      else if (daysPast <= 30) aging.d1_30 += balance;
      else if (daysPast <= 60) aging.d31_60 += balance;
      else aging.d60plus += balance;
    }

    const monthStart = new Date();
    monthStart.setDate(1);
    monthStart.setHours(0, 0, 0, 0);
    const [billedMtd, collectedMtd, overdueCount] = await Promise.all([
      this.prisma.invoice.aggregate({
        _sum: { totalCents: true },
        where: { issuedAt: { gte: monthStart }, status: { not: 'VOID' } },
      }),
      this.prisma.payment.aggregate({ _sum: { amountCents: true }, where: { createdAt: { gte: monthStart } } }),
      this.prisma.invoice.count({ where: { status: 'OVERDUE' } }),
    ]);

    return {
      outstandingCents: outstanding,
      billedMtdCents: billedMtd._sum.totalCents ?? 0,
      collectedMtdCents: collectedMtd._sum.amountCents ?? 0,
      overdueCount,
      aging,
    };
  }

  async findOne(id: string) {
    const invoice = await this.prisma.invoice.findUnique({
      where: { id },
      include: { ...INVOICE_INCLUDE, payments: { orderBy: { createdAt: 'desc' } } },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return { ...toInvoice(invoice), payments: invoice.payments };
  }

  /**
   * Records a payment exactly once per Idempotency-Key. Retries with the same key return
   * the original result; a row lock on the invoice prevents concurrent over-payment.
   */
  async recordPayment(invoiceId: string, dto: RecordPaymentDto, idempotencyKey: string | undefined, user: AuthUser) {
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 100) {
      throw new BadRequestException('Idempotency-Key header (8–100 chars) is required');
    }

    const existing = await this.prisma.payment.findUnique({ where: { idempotencyKey } });
    if (existing) {
      if (existing.invoiceId !== invoiceId || existing.amountCents !== dto.amountCents) {
        throw new ConflictException('Idempotency-Key was already used for a different request');
      }
      return { replayed: true, invoice: await this.findOne(invoiceId) };
    }

    try {
      await this.prisma.$transaction(async (tx) => {
        const [invoice] = await tx.$queryRaw<{ id: string; status: string; totalCents: number; paidCents: number }[]>`
          SELECT "id", "status", "totalCents", "paidCents" FROM "Invoice" WHERE "id" = ${invoiceId} FOR UPDATE`;
        if (!invoice) throw new NotFoundException('Invoice not found');
        if (invoice.status === 'PAID' || invoice.status === 'VOID') {
          throw new ConflictException(`Invoice is already ${invoice.status.toLowerCase()}`);
        }
        const balance = invoice.totalCents - invoice.paidCents;
        if (dto.amountCents > balance) {
          throw new BadRequestException(`Payment exceeds open balance of ${(balance / 100).toFixed(2)}`);
        }

        await tx.payment.create({
          data: {
            invoiceId,
            amountCents: dto.amountCents,
            method: dto.method,
            reference: dto.reference,
            idempotencyKey,
            recordedById: user.id,
          },
        });
        const paidCents = invoice.paidCents + dto.amountCents;
        const fullyPaid = paidCents >= invoice.totalCents;
        await tx.invoice.update({
          where: { id: invoiceId },
          data: { paidCents, ...(fullyPaid ? { status: 'PAID', paidAt: new Date() } : {}) },
        });
      });
    } catch (err) {
      // A concurrent retry with the same key won the race — treat as a replay.
      if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
        return { replayed: true, invoice: await this.findOne(invoiceId) };
      }
      throw err;
    }

    return { replayed: false, invoice: await this.findOne(invoiceId) };
  }
}
