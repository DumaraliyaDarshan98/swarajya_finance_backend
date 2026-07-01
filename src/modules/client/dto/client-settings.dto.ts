import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class ClientSettingsDto {
  @IsOptional()
  @IsBoolean()
  digitalFlow?: boolean;

  @IsOptional()
  @IsBoolean()
  physical?: boolean;

  @IsOptional()
  @IsBoolean()
  ocr?: boolean;

  @IsOptional()
  @IsBoolean()
  triangulation?: boolean;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxUsers?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  maxRoles?: number | null;
}
