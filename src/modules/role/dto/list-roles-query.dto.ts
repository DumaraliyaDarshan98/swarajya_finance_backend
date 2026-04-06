import { IsOptional, IsUUID, IsInt, Min, Max, IsBoolean } from 'class-validator';
import { Type } from 'class-transformer';

export class ListRolesQueryDto {
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
  @IsUUID()
  clientId?: string; // for super admin: filter by client; for client admin: only their client

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  internalOnly?: boolean;
}
