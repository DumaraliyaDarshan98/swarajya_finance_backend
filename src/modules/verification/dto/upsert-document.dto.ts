import { IsBoolean, IsObject, IsOptional } from 'class-validator';

export class UpsertDocumentVerificationDto {
  @IsOptional()
  @IsObject()
  documentPayload?: Record<string, any>;

  @IsOptional()
  @IsBoolean()
  doPhysicalVerification?: boolean;
}
