import {
  IsEmail,
  IsNotEmpty,
  IsString,
  IsOptional,
  Matches,
} from 'class-validator';

export class CreateClientDto {
  // --- Vendor Information ---
  @IsString()
  @IsNotEmpty({ message: 'Bank/Vendor type is required' })
  bankVendorType: string;

  @IsString()
  @IsNotEmpty({ message: 'Bank/Vendor name is required' })
  bankVendorName: string;

  @IsString()
  @IsNotEmpty({ message: 'Mobile number is required' })
  @Matches(/^[0-9]{10}$/, { message: 'Mobile number must be 10 digits' })
  mobileNumber: string;

  @IsEmail({}, { message: 'Please provide a valid email address' })
  @IsNotEmpty({ message: 'Email is required' })
  email: string;

  @IsString()
  @IsNotEmpty({ message: 'Nature of services is required' })
  natureOfServices: string;

  // --- Communication Details ---
  @IsString()
  @IsNotEmpty({ message: 'Address is required' })
  address: string;

  @IsString()
  @IsNotEmpty({ message: 'Pin code is required' })
  @Matches(/^[0-9]{6}$/, { message: 'Pin code must be 6 digits' })
  pinCode: string;

  @IsString()
  @IsOptional()
  country?: string;

  @IsString()
  @IsNotEmpty({ message: 'State is required' })
  state: string;

  @IsString()
  @IsNotEmpty({ message: 'City is required' })
  city: string;

  // --- Bank Details ---
  @IsString()
  @IsNotEmpty({ message: 'Bank name is required' })
  bankName: string;

  @IsString()
  @IsNotEmpty({ message: 'Account holder name is required' })
  accountHolderName: string;

  @IsString()
  @IsNotEmpty({ message: 'Account number is required' })
  accountNumber: string;

  @IsString()
  @IsNotEmpty({ message: 'IFSC code is required' })
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message: 'IFSC code must be valid (e.g. SBIN0001234)',
  })
  ifscCode: string;

  @IsString()
  @IsOptional()
  branchName?: string;

  // --- Document references (optional) ---
  @IsString()
  @IsOptional()
  panNumber?: string;

  @IsString()
  @IsOptional()
  panDocumentUrl?: string;

  @IsString()
  @IsOptional()
  gstNumber?: string;

  @IsString()
  @IsOptional()
  gstDocumentUrl?: string;

  @IsString()
  @IsOptional()
  addressProofUrl?: string;

  @IsString()
  @IsOptional()
  cancelledChequeUrl?: string;

  @IsString()
  @IsOptional()
  taxApprovalUrl?: string;

  @IsString()
  @IsOptional()
  agreementDocumentUrl?: string;

  @IsString()
  @IsOptional()
  attachment1Url?: string;

  @IsString()
  @IsOptional()
  attachment2Url?: string;

  @IsString()
  @IsOptional()
  dsaTrainingAcknowledgeUrl?: string;

  @IsString()
  @IsOptional()
  approvedAttachmentUrl?: string;

  @IsString()
  @IsOptional()
  dueDiligenceDocumentUrl?: string;
}
