import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
} from 'class-validator';

export class CreateInternalUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName: string;

  @IsEmail()
  email: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  employeeType?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  mobileNumber?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  alternateNumber?: string;

  @IsOptional()
  @IsString()
  educationDetails?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  flatPlotNo?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine1?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  addressLine2?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  landmark?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  country?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  state?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  pincode?: string;

  @IsOptional()
  @IsString()
  resumeUrl?: string;

  @IsOptional()
  @IsString()
  panUrl?: string;

  @IsOptional()
  @IsString()
  addressProofUrl?: string;

  @IsOptional()
  @IsString()
  cancelledChequeUrl?: string;

  @IsOptional()
  @IsString()
  cancelledChequeUrl2?: string;

  @IsOptional()
  @IsString()
  offerLetterUrl?: string;

  @IsOptional()
  @IsString()
  marksheet12Url?: string;

  @IsOptional()
  @IsString()
  graduationMarksheetUrl?: string;

  @IsOptional()
  @IsString()
  postGraduateCertUrl?: string;

  @IsOptional()
  @IsString()
  additionalCertUrl?: string;
}
