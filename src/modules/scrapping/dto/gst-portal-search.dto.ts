import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class GstPortalSearchDto {
  @IsString()
  @IsNotEmpty()
  sessionId: string;

  @IsString()
  @IsOptional()
  captchaCode: string;
}

