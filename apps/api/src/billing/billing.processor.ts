import { InjectQueue, OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger, OnModuleInit } from '@nestjs/common';
import type { Job, Queue } from 'bullmq';
import { nextSequence } from '../common/sequence';
import { PrismaService } from '../prisma/prisma.service';
import { RealtimeService } from '../realtime/realtime.service';
import { BILLING_QUEUE, BillingJobs, type GenerateInvoiceJob } from './billing.constants';
import { buildInvoiceAmounts } from './invoice-calc';

/** Background billing worker: invoice generation on delivery + periodic overdue sweep. */
@Processor(BILLING_QUEUE)
export class BillingProcessor extends WorkerHost implements OnModuleInit {
  private readonly logger = new Logger(BillingProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeService,
    @InjectQueue(BILLING_QUEUE) private readonly queue: Queue,
  ) {
    super();
  }

  async onModuleInit() {
    // Idempotent repeatable job (same scheduler id on every boot)
    await this.queue.upsertJobScheduler('overdue-sweep', { every: 5 * 60_000 }, { name: BillingJobs.MARK_OVERDUE });
  }

  async process(job: Job) {
    switch (job.name) {
      case BillingJobs.GENERATE_INVOICE:
        return this.generateInvoice(job.data as GenerateInvoiceJob);
      case BillingJobs.MARK_OVERDUE:
        return this.markOverdue();
      default:
        this.logger.warn(`Unknown job ${job.name}`);
    }
  }

  private async generateInvoice({ shipmentId }: GenerateInvoiceJob) {
    const shipment = await this.prisma.shipment.findUnique({
      where: { id: shipmentId },
      include: { customer: true, invoice: { select: { id: true } } },
    });
    if (!shipment) throw new Error(`Shipment ${shipmentId} not found`);
    if (shipment.invoice) return { skipped: true, reason: 'already invoiced' }; // idempotent
    if (shipment.status !== 'DELIVERED') return { skipped: true, reason: 'not delivered' };

    const isLate = !!shipment.deliveredAt && shipment.deliveredAt > shipment.deliveryBy;
    const amounts = buildInvoiceAmounts(shipment.rateCents, shipment.priority, isLate);
    const issuedAt = new Date();

    const invoice = await this.prisma.$transaction(async (tx) => {
      const seq = await nextSequence(tx, `invoice-${issuedAt.getFullYear()}`);
      return tx.invoice.create({
        data: {
          number: `INV-${issuedAt.getFullYear()}-${String(seq).padStart(5, '0')}`,
          shipmentId: shipment.id,
          customerId: shipment.customerId,
          ...amounts,
          issuedAt,
          dueAt: new Date(issuedAt.getTime() + shipment.customer.paymentTermsDays * 86_400_000),
        },
      });
    });

    this.realtime.invoiceCreated({
      id: invoice.id,
      number: invoice.number,
      totalCents: invoice.totalCents,
      customerName: shipment.customer.name,
    });
    return { invoiceId: invoice.id, number: invoice.number };
  }

  private async markOverdue() {
    const { count } = await this.prisma.invoice.updateMany({
      where: { status: 'ISSUED', dueAt: { lt: new Date() } },
      data: { status: 'OVERDUE' },
    });
    if (count) this.logger.log(`Marked ${count} invoice(s) overdue`);
    return { count };
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job, err: Error) {
    this.logger.error(`Job ${job.name}#${job.id} failed (attempt ${job.attemptsMade}): ${err.message}`);
  }
}
