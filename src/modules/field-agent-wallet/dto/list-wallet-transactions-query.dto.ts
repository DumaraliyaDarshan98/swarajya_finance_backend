import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListWalletTransactionsQueryDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  verificationType?: string;

  @IsOptional()
  @IsUUID()
  fieldAgentUserId?: string;
}
