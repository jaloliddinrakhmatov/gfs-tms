import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class PaginationQueryDto {
  @IsOptional() @Type(() => Number) @IsInt() @Min(1)
  page: number = 1;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(200)
  pageSize: number = 20;

  @IsOptional() @IsString()
  search?: string;

  @IsOptional() @IsString()
  sortBy?: string;

  @IsOptional() @IsIn(['asc', 'desc'])
  sortDir: 'asc' | 'desc' = 'desc';
}

export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; pageCount: number };
}

export function paginate<T>(data: T[], total: number, page: number, pageSize: number): Paginated<T> {
  return { data, meta: { page, pageSize, total, pageCount: Math.max(1, Math.ceil(total / pageSize)) } };
}
