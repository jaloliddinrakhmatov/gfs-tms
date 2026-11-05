import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BILLING_QUEUE } from './billing.constants';
import { BillingProcessor } from './billing.processor';
import { InvoicesController } from './invoices.controller';
import { InvoicesService } from './invoices.service';

@Module({
  imports: [BullModule.registerQueue({ name: BILLING_QUEUE })],
  controllers: [InvoicesController],
  providers: [InvoicesService, BillingProcessor],
})
export class BillingModule {}
