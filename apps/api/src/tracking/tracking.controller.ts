import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { PositionsStore } from './positions.store';

@ApiTags('tracking')
@ApiBearerAuth()
@Controller('tracking')
export class TrackingController {
  constructor(private readonly store: PositionsStore) {}

  /** Latest GPS fix for every moving truck (live updates arrive over WebSocket). */
  @Get('positions')
  async positions(@CurrentUser() user: AuthUser) {
    const all = await this.store.all();
    return user.role === 'DRIVER' ? all.filter((p) => p.driverId === user.driverId) : all;
  }
}
