import { IsEmail, IsNotEmpty, IsString, IsPhoneNumber } from 'class-validator';

export class CreateClientDto {
  @IsString()
  @IsNotEmpty({ message: 'Company name is required' })
  companyName: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Contact person name is required' })
  contactPerson: string;

  @IsString()
  @IsNotEmpty({ message: 'Phone number is required' })
  phone: string;
}