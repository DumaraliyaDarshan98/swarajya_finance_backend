import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class CreateRcuCategoryDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  key: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  usedInOcr?: boolean;
}

export class UpdateRcuCategoryDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  key?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  label?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  usedInOcr?: boolean;
}

export class CreateRcuDocumentTypeDto {
  @IsUUID()
  categoryId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  key: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  label: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  sidebarLabel?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  badge?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string;

  @IsOptional()
  @IsString()
  note?: string;

  @IsOptional()
  @IsString()
  infoNote?: string;

  @IsOptional()
  @IsIn(['triggers', 'logic', 'tax-slabs'])
  contentType?: 'triggers' | 'logic' | 'tax-slabs';

  @IsOptional()
  @IsObject()
  logic?: Record<string, unknown>;

  @IsOptional()
  @IsObject()
  taxSlabs?: Record<string, unknown>;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  usedInOcr?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateRcuDocumentTypeDto {
  @IsOptional()
  @IsUUID()
  categoryId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  key?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  label?: string;

  @IsOptional()
  @IsString()
  @MaxLength(150)
  sidebarLabel?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  badge?: string | null;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  icon?: string | null;

  @IsOptional()
  @IsString()
  note?: string | null;

  @IsOptional()
  @IsString()
  infoNote?: string | null;

  @IsOptional()
  @IsIn(['triggers', 'logic', 'tax-slabs'])
  contentType?: 'triggers' | 'logic' | 'tax-slabs';

  @IsOptional()
  @IsObject()
  logic?: Record<string, unknown> | null;

  @IsOptional()
  @IsObject()
  taxSlabs?: Record<string, unknown> | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  usedInOcr?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class CreateRcuTriggerDto {
  @IsUUID()
  documentTypeId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code: string;

  @IsString()
  @IsNotEmpty()
  text: string;

  @IsIn(['HIGH', 'MEDIUM', 'LOW'])
  risk: 'HIGH' | 'MEDIUM' | 'LOW';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  section?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  usedInOcr?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateRcuTriggerDto {
  @IsOptional()
  @IsUUID()
  documentTypeId?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  code?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  text?: string;

  @IsOptional()
  @IsIn(['HIGH', 'MEDIUM', 'LOW'])
  risk?: 'HIGH' | 'MEDIUM' | 'LOW';

  @IsOptional()
  @IsString()
  @MaxLength(200)
  section?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  usedInOcr?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateRcuFlagsDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  usedInOcr?: boolean;
}
