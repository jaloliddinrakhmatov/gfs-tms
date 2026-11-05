import { DriverStatus, Equipment, VehicleStatus } from '@prisma/client';
import { IsEnum, IsIn, IsOptional, IsString } from 'class-validator';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

export class ListVehiclesQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(VehicleStatus)
  status?: VehicleStatus;

  @IsOptional() @IsEnum(Equipment)
  equipment?: Equipment;

  @IsOptional() @IsIn(['unitNumber', 'year', 'odometerMi', 'fuelPct', 'status'])
  declare sortBy?: string;
}

export class ListDriversQueryDto extends PaginationQueryDto {
  @IsOptional() @IsEnum(DriverStatus)
  status?: DriverStatus;

  @IsOptional() @IsIn(['name', 'rating', 'hosHoursLeft', 'status'])
  declare sortBy?: string;
}

export class UpdateVehicleStatusDto {
  @IsEnum(VehicleStatus)
  status: VehicleStatus;
}

export class UpdateDriverStatusDto {
  @IsEnum(DriverStatus)
  status: DriverStatus;
}

export class AvailabilityQueryDto {
  @IsOptional() @IsEnum(Equipment)
  equipment?: Equipment;

  @IsOptional() @IsString()
  shipmentId?: string;
}
