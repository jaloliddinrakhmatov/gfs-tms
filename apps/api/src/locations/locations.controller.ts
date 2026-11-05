import { Controller, Get } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CITIES } from '../common/geo/cities';

@ApiTags('locations')
@ApiBearerAuth()
@Controller('locations')
export class LocationsController {
  /** Service terminals available as origins/destinations. */
  @Get()
  list() {
    return [...CITIES].sort((a, b) => a.name.localeCompare(b.name));
  }
}
