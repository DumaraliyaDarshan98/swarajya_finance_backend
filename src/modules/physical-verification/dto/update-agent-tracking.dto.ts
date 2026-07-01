import { IsBoolean, IsIn, IsNumber, IsOptional, IsString } from 'class-validator';

export class UpdateAgentTrackingDto {
  @IsNumber()
  latitude!: number;

  @IsNumber()
  longitude!: number;

  @IsOptional()
  @IsBoolean()
  isDriving?: boolean;

  @IsOptional()
  @IsIn(['residential', 'office'])
  destination?: 'residential' | 'office';

  @IsOptional()
  @IsString()
  capturedAt?: string;
}
