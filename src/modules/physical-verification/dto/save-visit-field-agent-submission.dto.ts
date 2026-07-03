import {
  IsBoolean,
  IsObject,
  IsOptional,
} from 'class-validator';
import type { AgentDrivingTracking, GeoLocation } from '../interfaces/field-agent-submission.interface';
import type {
  HomeAddressVerification,
  OfficeAddressVerification,
} from '../interfaces/field-agent-submission.interface';

export class SaveVisitFieldAgentSubmissionDto {
  @IsOptional()
  @IsObject()
  agentLocation?: GeoLocation | null;

  @IsOptional()
  @IsObject()
  agentTracking?: AgentDrivingTracking | null;

  @IsOptional()
  @IsObject()
  residential?: HomeAddressVerification | null;

  @IsOptional()
  @IsObject()
  office?: OfficeAddressVerification | null;

  @IsOptional()
  @IsBoolean()
  verifyResidential?: boolean;

  @IsOptional()
  @IsBoolean()
  verifyOffice?: boolean;
}
