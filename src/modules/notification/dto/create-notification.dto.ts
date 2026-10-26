import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from 'class-validator';

export class CreateNotificationDto {
  @IsUUID()
  userId: string;

  @IsString()
  @MaxLength(180)
  title: string;

  @IsString()
  body: string;

  @IsOptional()
  @IsIn(['danger', 'warning', 'primary', 'success', 'info'])
  icon?: 'danger' | 'warning' | 'primary' | 'success' | 'info';

  @IsOptional()
  @IsString()
  @MaxLength(500)
  ctaUrl?: string;
}
