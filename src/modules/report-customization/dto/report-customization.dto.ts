import {
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { PHYSICAL_REPORT_SUB_TYPES } from '../helpers/default-report-templates.helper';

export const REPORT_CUSTOMIZATION_TYPES = [
  'DIGITAL',
  'OCR',
  'TRIANGULATION',
  'PHYSICAL',
] as const;

export class ReportTemplateFieldDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  label: string;

  @IsBoolean()
  visible: boolean;
}

export class ReportTemplateSectionDto {
  @IsString()
  @IsNotEmpty()
  key: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  label: string;

  @IsBoolean()
  visible: boolean;

  @IsInt()
  @Min(1)
  order: number;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportTemplateFieldDto)
  fields?: ReportTemplateFieldDto[];
}

export class CreateReportCustomizationDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @IsIn(REPORT_CUSTOMIZATION_TYPES)
  reportType: (typeof REPORT_CUSTOMIZATION_TYPES)[number];

  @ValidateIf((o) => o.reportType === 'PHYSICAL')
  @IsString()
  @IsIn(PHYSICAL_REPORT_SUB_TYPES)
  physicalSubType?: string | null;

  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportTemplateSectionDto)
  sections: ReportTemplateSectionDto[];

  @IsOptional()
  @IsIn(['Active', 'Inactive'])
  status?: 'Active' | 'Inactive';
}

export class UpdateReportCustomizationDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsIn(REPORT_CUSTOMIZATION_TYPES)
  reportType?: (typeof REPORT_CUSTOMIZATION_TYPES)[number];

  @ValidateIf((o) => (o.reportType ?? 'PHYSICAL') === 'PHYSICAL' && o.physicalSubType != null)
  @IsOptional()
  @IsString()
  @IsIn(PHYSICAL_REPORT_SUB_TYPES)
  physicalSubType?: string | null;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ReportTemplateSectionDto)
  sections?: ReportTemplateSectionDto[];

  @IsOptional()
  @IsIn(['Active', 'Inactive'])
  status?: 'Active' | 'Inactive';
}

export class UpdateReportCustomizationStatusDto {
  @IsIn(['Active', 'Inactive'])
  status: 'Active' | 'Inactive';
}

export class ListReportCustomizationsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(REPORT_CUSTOMIZATION_TYPES)
  reportType?: (typeof REPORT_CUSTOMIZATION_TYPES)[number];

  @IsOptional()
  @IsString()
  physicalSubType?: string;

  @IsOptional()
  @IsIn(['Active', 'Inactive'])
  status?: 'Active' | 'Inactive';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagePerRecord?: number;
}
