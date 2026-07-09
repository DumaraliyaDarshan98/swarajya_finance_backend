import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { Type } from 'class-transformer';
import type { PhysicalVerificationStatus } from '../interfaces/physical-verification.interface';

export class ListPhysicalVerificationQueryDto {
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
    'DRAFT',
    'IN_PROGRESS',
    'PARTIAL_ASSIGNED',
    'ASSIGNED',
    'AGENT_ASSIGNED',
    'AGENT_DRAFT',
    'AGENT_SUBMITTED',
    'APPROVED',
    'REJECTED',
    'REPORT_GENERATED',
    'FAILED',
  ])
  status?: PhysicalVerificationStatus;

  @IsOptional()
  @IsString()
  physicalVerificationType?: string;

  @IsOptional()
  @IsString()
  fiType?: string;

  @IsOptional()
  @IsIn(['createdAt', 'updatedAt'])
  sortBy?: 'createdAt' | 'updatedAt';

  @IsOptional()
  @IsIn(['ASC', 'DESC'])
  sortDir?: 'ASC' | 'DESC';

  @IsOptional()
  @IsUUID()
  clientId?: string;
}
