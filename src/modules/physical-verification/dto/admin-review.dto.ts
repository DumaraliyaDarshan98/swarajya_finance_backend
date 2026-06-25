import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class AdminReviewNoteDto {
  @IsOptional()
  @IsString()
  note?: string;
}

export class RejectPhysicalVerificationDto {
  @IsString()
  @IsNotEmpty()
  reason: string;

  @IsOptional()
  @IsString()
  note?: string;
}
