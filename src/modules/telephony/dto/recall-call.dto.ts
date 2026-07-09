import { IsOptional, IsUUID } from 'class-validator';

export class RecallCallDto {
  @IsUUID()
  physicalVerificationId: string;

  @IsOptional()
  @IsUUID()
  visitId?: string;
}
