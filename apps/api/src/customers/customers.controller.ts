import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles } from '../common/decorators/roles.decorator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';
import { CustomersService } from './customers.service';

@ApiTags('customers')
@ApiBearerAuth()
@Roles('DISPATCHER', 'ACCOUNTANT')
@Controller('customers')
export class CustomersController {
  constructor(private readonly customers: CustomersService) {}

  @Get()
  list(@Query() q: PaginationQueryDto) {
    return this.customers.list(q);
  }

  /** Lightweight list for pickers. */
  @Get('options')
  options() {
    return this.customers.options();
  }
}
