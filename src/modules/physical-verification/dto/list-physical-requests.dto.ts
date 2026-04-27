import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';

export class ListPhysicalRequestsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn([
    'PENDING',
    'ASSIGNED',
    'IN_PROGRESS',
    'VERIFIED',
    'APPROVED',
    'DECLINED',
    'REASSIGNED',
  ])
  status?:
    | 'PENDING'
    | 'ASSIGNED'
    | 'IN_PROGRESS'
    | 'VERIFIED'
    | 'APPROVED'
    | 'DECLINED'
    | 'REASSIGNED';
}

