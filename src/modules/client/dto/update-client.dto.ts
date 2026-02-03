import {
  IsEmail,
  IsOptional,
  IsString,
  Matches,
} from 'class-validator';

export class UpdateClientDto {
  @IsOptional()
  @IsString()
  bankVendorType?: string;

  @IsOptional()
  @IsString()
  bankVendorName?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{10}$/, { message: 'Mobile number must be 10 digits' })
  mobileNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  natureOfServices?: string;

  @IsOptional()
  @IsString()
  address?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'Pin code must be 6 digits' })
  pinCode?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  state?: string;

  @IsOptional()
  @IsString()
  city?: string;

  @IsOptional()
  @IsString()
  bankName?: string;

  @IsOptional()
  @IsString()
  accountHolderName?: string;

  @IsOptional()
  @IsString()
  accountNumber?: string;

  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message: 'IFSC code must be valid (e.g. SBIN0001234)',
  })
  ifscCode?: string;

  @IsOptional()
  @IsString()
  branchName?: string;

  @IsOptional()
  @IsString()
  panNumber?: string;

  @IsOptional()
  @IsString()
  panDocumentUrl?: string;

  @IsOptional()
  @IsString()
  gstNumber?: string;

  @IsOptional()
  @IsString()
  gstDocumentUrl?: string;

  @IsOptional()
  @IsString()
  addressProofUrl?: string;

  @IsOptional()
  @IsString()
  cancelledChequeUrl?: string;

  @IsOptional()
  @IsString()
  taxApprovalUrl?: string;

  @IsOptional()
  @IsString()
  agreementDocumentUrl?: string;

  @IsOptional()
  @IsString()
  attachment1Url?: string;

  @IsOptional()
  @IsString()
  attachment2Url?: string;

  @IsOptional()
  @IsString()
  dsaTrainingAcknowledgeUrl?: string;

  @IsOptional()
  @IsString()
  approvedAttachmentUrl?: string;

  @IsOptional()
  @IsString()
  dueDiligenceDocumentUrl?: string;
}
