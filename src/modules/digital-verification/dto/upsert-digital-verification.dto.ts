import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { normalizeDomain } from '../helpers/business-verification.helper';

const GSTIN_REGEX = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/;
const DOMAIN_REGEX = /^(?:[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?\.)+[a-zA-Z]{2,}$/;
const PAN_REGEX = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
const MOBILE_REGEX = /^[0-9]{10}$/;
const PINCODE_REGEX = /^[0-9]{6}$/;
const AADHAAR_REGEX = /^[0-9]{12}$/;

export class UpsertDigitalVerificationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  loanApplicationNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  loanType?: string;

  @IsString()
  @MinLength(1, { message: 'applicantName is required' })
  @MaxLength(255)
  applicantName: string;

  @IsString()
  @Matches(MOBILE_REGEX, { message: 'mobileNumber must be exactly 10 digits' })
  mobileNumber: string;

  @IsEmail({}, { message: 'emailId must be a valid email' })
  @MaxLength(255)
  emailId: string;

  @Transform(({ value }) => String(value ?? '').trim().toUpperCase())
  @IsString()
  @Matches(PAN_REGEX, { message: 'panNumber must be a valid PAN' })
  panNumber: string;

  @Transform(({ value }) => String(value ?? '').replace(/\D/g, ''))
  @IsString()
  @Matches(AADHAAR_REGEX, { message: 'aadhaarNumber must be 12 digits' })
  aadhaarNumber: string;

  @IsString()
  @MinLength(1, { message: 'residentialAddress is required' })
  residentialAddress: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  residentialLandmark?: string;

  @IsString()
  @MinLength(1, { message: 'residentialState is required' })
  @MaxLength(100)
  residentialState: string;

  @IsString()
  @MinLength(1, { message: 'residentialCity is required' })
  @MaxLength(100)
  residentialCity: string;

  @IsString()
  @Matches(PINCODE_REGEX, { message: 'residentialPincode must be 6 digits' })
  residentialPincode: string;

  @IsOptional()
  @IsBoolean()
  hasOfficeAddress?: boolean;

  @IsOptional()
  @IsBoolean()
  hasBusinessAddress?: boolean;

  @ValidateIf((o) => !!o.hasBusinessAddress)
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  companyName?: string;

  @ValidateIf((o) => !!o.hasBusinessAddress)
  @Transform(({ value }) => normalizeDomain(String(value ?? '')))
  @IsString()
  @MinLength(3)
  @MaxLength(255)
  @Matches(DOMAIN_REGEX, { message: 'companyDomain must be a valid domain' })
  companyDomain?: string;

  @ValidateIf((o) => !!o.hasBusinessAddress)
  @IsString()
  @MaxLength(20)
  @Matches(GSTIN_REGEX, { message: 'gstNumber must be a valid 15-character GSTIN' })
  gstNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  @ValidateIf((o) => !!o.businessPan?.trim())
  @Matches(PAN_REGEX, { message: 'businessPan must be a valid PAN' })
  businessPan?: string;

  @IsOptional()
  @IsString()
  @MaxLength(30)
  cinNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  @ValidateIf((o) => !!o.businessType?.trim())
  @IsIn(['Proprietorship', 'Partnership', 'Private Limited', 'Public Limited', 'LLP', 'Other'])
  businessType?: string;

  @ValidateIf((o) => !!o.hasOfficeAddress)
  @IsString()
  officeAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  officeLandmark?: string;

  @ValidateIf((o) => !!o.hasOfficeAddress)
  @IsString()
  @MaxLength(100)
  officeState?: string;

  @ValidateIf((o) => !!o.hasOfficeAddress)
  @IsString()
  @MaxLength(100)
  officeCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  @ValidateIf((o) => !!o.officePincode?.trim())
  @Matches(PINCODE_REGEX, { message: 'officePincode must be 6 digits' })
  officePincode?: string;
}
