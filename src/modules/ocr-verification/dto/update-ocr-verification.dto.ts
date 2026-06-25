import { Type } from 'class-transformer';
import { IsArray, IsOptional, IsString, ValidateNested } from 'class-validator';

export class OcrExtraDocumentSlotDto {
  @IsString()
  key: string;

  @IsString()
  label: string;

  @IsOptional()
  @IsString()
  placeholder?: string;
}

export class UpdateOcrVerificationDto {
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => OcrExtraDocumentSlotDto)
  extraDocuments?: OcrExtraDocumentSlotDto[];
}
