import { InvoiceStatus, PaymentMethod } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsIn, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

const SORTABLE = ['issuedAt', 'dueAt', 'totalCents', 'number', 'status'] as const;

export class ListInvoicesQueryDto extends PaginationQueryDto {
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsEnum(InvoiceStatus, { each: true })
  status?: InvoiceStatus[];

  @IsOptional() @IsString()
  customerId?: string;

  @IsOptional() @IsIn(SORTABLE)
  declare sortBy?: (typeof SORTABLE)[number];
}

export class RecordPaymentDto {
  /** Amount in cents. */
  @Type(() => Number) @IsInt() @Min(1)
  amountCents: number;

  @IsEnum(PaymentMethod)
  method: PaymentMethod;

  @IsOptional() @IsString() @MaxLength(80)
  reference?: string;
}
