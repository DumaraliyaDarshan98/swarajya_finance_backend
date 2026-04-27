import { IsIn, IsOptional, IsString } from 'class-validator';

export class UpdatePhysicalStatusDto {
  @IsIn(['IN_PROGRESS', 'VERIFIED'])
  status: 'IN_PROGRESS' | 'VERIFIED';

  @IsOptional()
  @IsString()
  comment?: string;
}

