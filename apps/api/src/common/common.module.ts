import { Global, Module } from '@nestjs/common';
import { RoutingService } from './geo/routing.service';

@Global()
@Module({
  providers: [RoutingService],
  exports: [RoutingService],
})
export class CommonModule {}
