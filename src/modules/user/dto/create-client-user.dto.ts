import {
  IsString,
  IsEmail,
  IsOptional,
  MinLength,
  MaxLength,
  IsUUID,
  Matches,
} from 'class-validator';

export class CreateClientUserDto {
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  fullName: string;

  @IsEmail()
  email: string;

  @IsUUID()
  customRoleId: string;

  @IsOptional()
  @IsString()
  @MinLength(8, { message: 'Password must be at least 8 characters' })
  password?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'Mobile number must be 10 digits' })
  mobileNumber?: string;
}
