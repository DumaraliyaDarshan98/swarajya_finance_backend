import { IsBoolean, IsOptional } from 'class-validator';

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
}
