import { IsBoolean, IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateSettingDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  key?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  value?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  description?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string | null;

  @IsOptional()
  @IsBoolean()
  status?: boolean;
}
