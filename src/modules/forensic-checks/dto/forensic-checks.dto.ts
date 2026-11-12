import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

const CATEGORIES = ['PDF', 'IMAGE', 'DOC', 'ZIP'] as const;
const SEVERITIES = ['low', 'medium', 'high'] as const;

export class CreateForensicCheckDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  code: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  engineKey?: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  threatCode: string;

  @IsIn(CATEGORIES)
  category: (typeof CATEGORIES)[number];

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  description: string;

  @IsIn(SEVERITIES)
  severity: (typeof SEVERITIES)[number];

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  score: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  documentTypePattern?: string | null;

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

export class UpdateForensicCheckDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  code?: string;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  engineKey?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  threatCode?: string;

  @IsOptional()
  @IsIn(CATEGORIES)
  category?: (typeof CATEGORIES)[number];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;

  @IsOptional()
  @IsIn(SEVERITIES)
  severity?: (typeof SEVERITIES)[number];

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100)
  score?: number;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  documentTypePattern?: string | null;

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

export class UpdateForensicFlagsDto {
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsBoolean()
  usedInOcr?: boolean;
}
