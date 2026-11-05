import { Body, Controller, Get, Headers, Param, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiHeader, ApiTags } from '@nestjs/swagger';
import { CurrentUser, type AuthUser } from '../common/decorators/current-user.decorator';
import { Roles } from '../common/decorators/roles.decorator';
import { ListInvoicesQueryDto, RecordPaymentDto } from './dto/billing.dto';
import { InvoicesService } from './invoices.service';

@ApiTags('billing')
@ApiBearerAuth()
@Roles('ACCOUNTANT', 'DISPATCHER')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoices: InvoicesService) {}

  @Get()
  list(@Query() query: ListInvoicesQueryDto) {
    return this.invoices.list(query);
  }

  @Get('summary')
  summary() {
    return this.invoices.summary();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.invoices.findOne(id);
  }

  @Roles('ACCOUNTANT')
  @ApiHeader({ name: 'Idempotency-Key', required: true, description: 'Unique key per payment attempt' })
  @Post(':id/payments')
  recordPayment(
    @Param('id') id: string,
    @Body() dto: RecordPaymentDto,
    @Headers('idempotency-key') key: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    return this.invoices.recordPayment(id, dto, key, user);
  }
}
