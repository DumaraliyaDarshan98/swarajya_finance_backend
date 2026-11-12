import {
  IsBoolean,
  IsObject,
  IsOptional,
} from 'class-validator';
import type {
  FieldAgentSubmission,
  HomeAddressVerification,
  OfficeAddressVerification,
} from '../interfaces/field-agent-submission.interface';

export class SaveFieldAgentSubmissionDto {
  @IsOptional()
  @IsBoolean()
  verifyResidential?: boolean;

  @IsOptional()
  @IsBoolean()
  verifyOffice?: boolean;

  @IsOptional()
  @IsObject()
  agentLocation?: FieldAgentSubmission['agentLocation'];

  @IsOptional()
  @IsObject()
  agentTracking?: FieldAgentSubmission['agentTracking'];

  @IsOptional()
  @IsObject()
  residential?: HomeAddressVerification | null;

  @IsOptional()
  @IsObject()
  office?: OfficeAddressVerification | null;
}
