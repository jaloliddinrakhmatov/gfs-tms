import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';

@ApiTags('analytics')
@ApiBearerAuth()
@Roles('DISPATCHER', 'ACCOUNTANT')
@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  /** KPIs, 30-day revenue series, top lanes and the activity feed for the dashboard. */
  @Get('overview')
  overview() {
    return this.analytics.overview();
  }
}
