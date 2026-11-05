import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import {
  AddNoteDto,
  AssignShipmentDto,
  CreateShipmentDto,
  ListShipmentsQueryDto,
  QuoteDto,
  UpdateShipmentStatusDto,
} from './dto/shipment.dto';
import { ShipmentsService } from './shipments.service';

@ApiTags('shipments')
@ApiBearerAuth()
@Controller('shipments')
export class ShipmentsController {
  constructor(private readonly shipments: ShipmentsService) {}

  /** Paginated, filterable, sortable load board. Drivers only see their own loads. */
  @Get()
  list(@Query() query: ListShipmentsQueryDto, @CurrentUser() user: AuthUser) {
    return this.shipments.list(query, user);
  }

  @Get('counts')
  counts(@CurrentUser() user: AuthUser) {
    return this.shipments.statusCounts(user);
  }

  /** Instant spot-rate quote and road route for a lane. */
  @Roles('DISPATCHER')
  @Post('quote')
  quote(@Body() dto: QuoteDto) {
    return this.shipments.quote(dto);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.shipments.findOne(id, user);
  }

  @Roles('DISPATCHER')
  @Post()
  create(@Body() dto: CreateShipmentDto, @CurrentUser() user: AuthUser) {
    return this.shipments.create(dto, user);
  }

  @Roles('DISPATCHER')
  @Post(':id/assign')
  assign(@Param('id') id: string, @Body() dto: AssignShipmentDto, @CurrentUser() user: AuthUser) {
    return this.shipments.assign(id, dto, user);
  }

  @Roles('DISPATCHER', 'DRIVER')
  @Patch(':id/status')
  updateStatus(@Param('id') id: string, @Body() dto: UpdateShipmentStatusDto, @CurrentUser() user: AuthUser) {
    return this.shipments.updateStatus(id, dto, user);
  }

  @Roles('DISPATCHER', 'DRIVER')
  @Post(':id/notes')
  addNote(@Param('id') id: string, @Body() dto: AddNoteDto, @CurrentUser() user: AuthUser) {
    return this.shipments.addNote(id, dto.message, user);
  }
}
