import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import {
  AvailabilityQueryDto,
  ListDriversQueryDto,
  ListVehiclesQueryDto,
  UpdateDriverStatusDto,
  UpdateVehicleStatusDto,
} from './fleet.dto';
import { FleetService } from './fleet.service';

@ApiTags('fleet')
@ApiBearerAuth()
@Roles('DISPATCHER', 'ACCOUNTANT')
@Controller('fleet')
export class FleetController {
  constructor(private readonly fleet: FleetService) {}

  @Get('vehicles')
  vehicles(@Query() q: ListVehiclesQueryDto) {
    return this.fleet.vehicles(q);
  }

  @Get('drivers')
  drivers(@Query() q: ListDriversQueryDto) {
    return this.fleet.drivers(q);
  }

  @Roles('DISPATCHER')
  @Get('availability')
  availability(@Query() q: AvailabilityQueryDto) {
    return this.fleet.availability(q);
  }

  @Roles('DISPATCHER')
  @Patch('vehicles/:id/status')
  setVehicleStatus(@Param('id') id: string, @Body() dto: UpdateVehicleStatusDto) {
    return this.fleet.setVehicleStatus(id, dto.status);
  }

  @Roles('DISPATCHER')
  @Patch('drivers/:id/status')
  setDriverStatus(@Param('id') id: string, @Body() dto: UpdateDriverStatusDto) {
    return this.fleet.setDriverStatus(id, dto.status);
  }
}
