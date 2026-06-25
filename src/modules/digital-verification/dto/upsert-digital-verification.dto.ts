import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class UpsertDigitalVerificationDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  loanApplicationNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  loanType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  applicantName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobileNumber?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  emailId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(50)
  panNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  aadhaarNumber?: string;

  @IsOptional()
  @IsString()
  residentialAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  residentialLandmark?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  residentialState?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  residentialCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  residentialPincode?: string;

  @IsOptional()
  @IsBoolean()
  hasOfficeAddress?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  companyName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  gstNumber?: string;

  @IsOptional()
  @IsString()
  officeAddress?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  officeLandmark?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  officeState?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  officeCity?: string;

  @IsOptional()
  @IsString()
  @MaxLength(10)
  officePincode?: string;
}
