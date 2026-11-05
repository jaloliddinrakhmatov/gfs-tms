import { BullModule } from '@nestjs/bullmq';
import { Module } from '@nestjs/common';
import { BILLING_QUEUE } from '../billing/billing.constants';
import { ShipmentsController } from './shipments.controller';
import { ShipmentsService } from './shipments.service';

@Module({
  imports: [BullModule.registerQueue({ name: BILLING_QUEUE })],
  controllers: [ShipmentsController],
  providers: [ShipmentsService],
  exports: [ShipmentsService],
})
export class ShipmentsModule {}
