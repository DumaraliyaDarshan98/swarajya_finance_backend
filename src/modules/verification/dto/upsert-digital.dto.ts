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
  address?: string;

  @IsOptional()
  @IsBoolean()
  doDocumentVerification?: boolean;
}
