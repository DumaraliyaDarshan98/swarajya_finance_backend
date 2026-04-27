import { IsObject, IsOptional, IsString } from 'class-validator';

export class FieldAgentSavePhysicalDetailsDto {
  @IsOptional()
  @IsObject()
  physicalPayload?: Record<string, unknown>;

  @IsOptional()
  @IsString()
  comment?: string;

  /**
   * If true, request will be marked as VERIFIED.
   * Field agent UI uses this on final submit.
   */
  @IsOptional()
  markVerified?: boolean;
}

