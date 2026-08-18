import { Type } from 'class-transformer';
import { IsNumber, IsOptional, IsString, IsUUID, MaxLength, Min } from 'class-validator';

export class CreateWithdrawalDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(1)
  amount: number;

  @IsUUID()
  bankAccountId: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  remarks?: string;
}
