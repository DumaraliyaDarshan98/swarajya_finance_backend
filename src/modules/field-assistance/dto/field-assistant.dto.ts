import {
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  IsNotEmpty,
  ValidateNested,
  IsEmail,
  Matches,
} from 'class-validator';
import { Type } from 'class-transformer';

class ContactDto {
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'mobile must be 10 digits' })
  mobile?: string;

  @IsOptional()
  @IsEmail()
  emailId?: string;
}

class AddressDto {
  @IsIn(['Present', 'Permanent', 'Work'])
  addressType: 'Present' | 'Permanent' | 'Work';

  @IsString()
  @IsNotEmpty()
  completeAddress: string;

  @IsOptional()
  @IsString()
  landmark?: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsString()
  @IsNotEmpty()
  postalCode: string;
}

class EmergencyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  relationship: string;

  @IsOptional()
  @IsString()
  landline?: string;

  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'mobile must be 10 digits' })
  mobile: string;
}

class EducationDto {
  @IsString()
  @IsNotEmpty()
  educationCategory: string;

  @IsString()
  @IsNotEmpty()
  educationType: string;

  @IsOptional()
  @IsString()
  specialization?: string;

  @IsString()
  @IsNotEmpty()
  institute: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsString()
  @IsNotEmpty()
  from: string;

  @IsString()
  @IsNotEmpty()
  to: string;

  @IsOptional()
  @IsIn(['Part Time', 'Full Time'])
  partOrFullTime?: string;
}

class BankDto {
  @IsString()
  @IsNotEmpty()
  bankName: string;

  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @IsOptional()
  @IsString()
  accountType?: string;

  @IsOptional()
  @IsString()
  branch?: string;

  @IsString()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'Invalid IFSC' })
  ifsc: string;

  @IsOptional()
  @IsString()
  upiId?: string;

  @IsIn(['Active', 'Inactive'])
  status: 'Active' | 'Inactive';
}

class FamilyDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  relationship: string;

  @IsString()
  @IsNotEmpty()
  dateOfBirth: string;

  @IsOptional()
  @IsEmail()
  emailId?: string;

  @IsString()
  @IsNotEmpty()
  gender: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  @IsOptional()
  @Matches(/^[0-9]{10}$/, { message: 'mobile must be 10 digits' })
  mobile?: string;
}

class IdentificationDto {
  @IsIn(['UAN', 'Aadhar Card', 'PAN Card', 'DL', 'PF Number'])
  identificationType: string;

  @IsString()
  @IsNotEmpty()
  identificationNo: string;

  @IsOptional()
  @IsString()
  uploadDocument?: string;
}

class PreviousEmploymentDto {
  @IsString()
  @IsNotEmpty()
  organization: string;

  @IsString()
  @IsNotEmpty()
  designationOrRole: string;

  @IsOptional()
  @IsIn(['Part Time', 'Full Time'])
  partOrFullTime?: string;

  @IsString()
  @IsNotEmpty()
  from: string;

  @IsString()
  @IsNotEmpty()
  to: string;

  @IsOptional()
  totalWorkExperienceYrs?: number;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  country: string;

  @IsOptional()
  @IsEmail()
  hrMailId?: string;

  @IsOptional()
  @Matches(/^[0-9]{10}$/, { message: 'hrContactNo must be 10 digits' })
  hrContactNo?: string;
}

export class UpsertFieldAssistantDto {
  // Personal
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @IsOptional()
  @IsString()
  middleName?: string;

  @IsString()
  @IsNotEmpty()
  lastName: string;

  @IsOptional()
  @IsString()
  fullName?: string;

  @IsString()
  @IsNotEmpty()
  dateOfBirth: string;

  @IsOptional()
  age?: number;

  @IsOptional()
  @IsIn(['Single', 'Married', 'Divorced', 'Widowed'])
  maritalStatus?: string;

  @IsOptional()
  @IsString()
  marriageDate?: string;

  @IsIn(['Male', 'Female', 'Other'])
  gender: string;

  @IsOptional()
  @IsString()
  bloodGroup?: string;

  @IsOptional()
  @IsString()
  nationality?: string;

  // Addresses
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  addresses: AddressDto[];

  // Communication
  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDto)
  officeContact?: ContactDto;

  @IsOptional()
  @ValidateNested()
  @Type(() => ContactDto)
  personalContact?: ContactDto;

  // Emergency
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EmergencyDto)
  emergencyDetails: EmergencyDto[];

  // Education
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => EducationDto)
  educationDetails: EducationDto[];

  // Bank
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BankDto)
  bankDetails: BankDto[];

  // Family
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FamilyDto)
  familyDetails: FamilyDto[];

  // Identification
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IdentificationDto)
  identificationDetails: IdentificationDto[];

  // Previous Employment
  @IsOptional()
  @IsIn(['Fresher', 'Experience'])
  previousEmploymentType?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PreviousEmploymentDto)
  previousEmploymentDetails: PreviousEmploymentDto[];

  // Uploads
  @IsOptional()
  documentUploads?: Record<string, any>;

  // Additional
  @IsOptional()
  @IsIn(['Part Time', 'Full Time'])
  partTimeOrFullTime?: string;

  @IsOptional()
  @IsIn(['Field', 'Choice'])
  fieldOrChoiceDepartment?: string;

  // System
  @IsOptional()
  @IsString()
  fieldAgentId?: string;

  @IsIn(['Active', 'Inactive'])
  status: string;

  @IsOptional()
  @IsString()
  assignCompanyClient?: string;

  @IsOptional()
  @IsString()
  reportingManager?: string;

  @IsOptional()
  @IsString()
  joiningDate?: string;

  @IsOptional()
  @IsString()
  remarks?: string;
}

