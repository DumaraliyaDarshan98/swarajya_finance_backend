import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateFieldAssistantInsuranceDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  providerCompany?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  policyNumber?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  insuranceType?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  coverageAmount?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  premiumAmount?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  startDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  endDate?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  nomineeName?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  nomineeRelation?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string | null;
}
