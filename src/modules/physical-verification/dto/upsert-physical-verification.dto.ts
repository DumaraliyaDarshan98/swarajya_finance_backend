import {
  IsArray,
  IsBoolean,
  IsIn,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class AddressBlockDto {
  @IsOptional() @IsString() address?: string;
  @IsOptional() @IsString() landmark?: string;
  @IsOptional() @IsString() state?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() pincode?: string;
  @IsOptional() @IsString() businessName?: string;
}

class PartyDetailsDto {
  @IsOptional() @IsString() customerName?: string;
  @IsOptional() @IsString() agreementNumber?: string;
  @IsOptional() @IsString() product?: string;
  @IsOptional() @IsString() mobile?: string;
  @IsOptional() @IsString() alternateNumber?: string;
  @IsOptional() @IsBoolean() hasResidentialAddress?: boolean;
  @IsOptional() @IsBoolean() hasOfficeAddress?: boolean;
  @IsOptional() @ValidateNested() @Type(() => AddressBlockDto) residential?: AddressBlockDto;
  @IsOptional() @ValidateNested() @Type(() => AddressBlockDto) office?: AddressBlockDto;
}

class DocumentTypeVerificationDto {
  @IsOptional() @IsString() documentType?: string;
  @IsOptional() @IsString() documentPrimaryKey?: string;
  @IsOptional() @IsString() remark?: string;
  @IsOptional() @IsString() fileName?: string;
}

export class UpsertPhysicalVerificationDto {
  @IsOptional()
  @IsString()
  physicalVerificationType?: string;

  @IsOptional()
  @IsString()
  fiType?: string;

  @IsOptional()
  @ValidateNested()
  @Type(() => PartyDetailsDto)
  applicant?: PartyDetailsDto;

  @IsOptional()
  @IsBoolean()
  hasCoApplicant?: boolean;

  @IsOptional()
  @ValidateNested()
  @Type(() => PartyDetailsDto)
  coApplicant?: PartyDetailsDto;

  @IsOptional()
  @IsString()
  completeRemark?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => DocumentTypeVerificationDto)
  documentTypeVerifications?: DocumentTypeVerificationDto[];
}

export class SubmitPhysicalVerificationDto {
  @IsOptional()
  @IsIn(['IN_PROGRESS'])
  status?: 'IN_PROGRESS';
}
