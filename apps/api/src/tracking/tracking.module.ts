import { Module } from '@nestjs/common';
import { ShipmentsModule } from '../shipments/shipments.module';
import { PositionsStore } from './positions.store';
import { SimulatorService } from './simulator.service';
import { TrackingController } from './tracking.controller';
import { TrackingGateway } from './tracking.gateway';

@Module({
  imports: [ShipmentsModule],
  controllers: [TrackingController],
  providers: [TrackingGateway, PositionsStore, SimulatorService],
})
export class TrackingModule {}
