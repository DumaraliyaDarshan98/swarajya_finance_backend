import {
  IsString,
  IsOptional,
  MinLength,
  MaxLength,
  IsEnum,
  IsUUID,
  Matches,
} from 'class-validator';
import { Role } from '../../../enum/role.enum';

export class UpdateInternalUserDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName?: string;

  @IsOptional()
  @IsEnum(Role)
  role?: Role;

  @IsOptional()
  @IsUUID()
  customRoleId?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  employeeType?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'Mobile number must be 10 digits' })
  mobileNumber?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'Alternate number must be 10 digits' })
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
