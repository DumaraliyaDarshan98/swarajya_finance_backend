import { IsObject, IsOptional } from 'class-validator';

export class UpsertPhysicalVerificationDto {
  @IsOptional()
  @IsObject()
  physicalPayload?: Record<string, any>;
}
