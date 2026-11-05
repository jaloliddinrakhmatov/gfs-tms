import { Equipment, Priority, ShipmentStatus } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto';

export class QuoteDto {
  /** @example CHI */
  @IsString() @Length(3, 3)
  originCode: string;

  /** @example DAL */
  @IsString() @Length(3, 3)
  destinationCode: string;

  @IsEnum(Equipment)
  equipment: Equipment = Equipment.DRY_VAN;

  @IsEnum(Priority)
  priority: Priority = Priority.STANDARD;
}

export class CreateShipmentDto extends QuoteDto {
  @IsString()
  customerId: string;

  /** @example Packaged foods */
  @IsString() @MinLength(2) @MaxLength(80)
  commodity: string;

  /** Gross weight in pounds (legal max for a 53' trailer ≈ 45,000 lbs). */
  @Type(() => Number) @IsInt() @Min(100) @Max(48_000)
  weightLbs: number;

  /** All-in rate in cents. If omitted, the system quote is used. */
  @IsOptional() @Type(() => Number) @IsInt() @Min(10_000) @Max(5_000_000)
  rateCents?: number;

  @IsDateString()
  pickupAt: string;

  @IsDateString()
  deliveryBy: string;

  @IsOptional() @IsString() @MaxLength(500)
  notes?: string;
}

const SORTABLE = ['createdAt', 'pickupAt', 'deliveryBy', 'rateCents', 'weightLbs', 'reference', 'status'] as const;

export class ListShipmentsQueryDto extends PaginationQueryDto {
  /** Comma-separated list, e.g. `PENDING,ASSIGNED` */
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.split(',').filter(Boolean) : value))
  @IsEnum(ShipmentStatus, { each: true })
  status?: ShipmentStatus[];

  @IsOptional() @IsEnum(Priority)
  priority?: Priority;

  @IsOptional() @IsString()
  customerId?: string;

  @IsOptional() @IsIn(SORTABLE)
  declare sortBy?: (typeof SORTABLE)[number];
}

export class AssignShipmentDto {
  @IsString()
  driverId: string;

  @IsString()
  vehicleId: string;
}

export class UpdateShipmentStatusDto {
  @IsIn(['PENDING', 'IN_TRANSIT', 'DELIVERED', 'CANCELLED'])
  status: 'PENDING' | 'IN_TRANSIT' | 'DELIVERED' | 'CANCELLED';

  @IsOptional() @IsString() @MaxLength(300)
  reason?: string;
}

export class AddNoteDto {
  @IsString() @MinLength(1) @MaxLength(500)
  message: string;
}
