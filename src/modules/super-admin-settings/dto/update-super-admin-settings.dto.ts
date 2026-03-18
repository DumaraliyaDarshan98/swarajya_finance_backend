import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';

export class UpdateSuperAdminSettingsDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  maxClientUsers?: number | null;

  @IsOptional()
  @IsBoolean()
  sendEmailNotifications?: boolean;

  @IsOptional()
  @IsBoolean()
  sendSmsNotifications?: boolean;
}
