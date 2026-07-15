import {
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

/** youtube.com / youtu.be watch, embed, shorts, live */
const YOUTUBE_URL_REGEX =
  /^(https?:\/\/)?(www\.|m\.)?(youtube\.com\/(watch\?v=|embed\/|shorts\/|live\/)|youtu\.be\/)[\w\-?=&%.]+$/i;

export class CreateTrainingDto {
  @IsIn(['FIELD_AGENT', 'CLIENT_ADMIN'])
  role: 'FIELD_AGENT' | 'CLIENT_ADMIN';

  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  @Matches(YOUTUBE_URL_REGEX, {
    message: 'videoUrl must be a valid YouTube URL',
  })
  videoUrl: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateTrainingDto {
  @IsOptional()
  @IsIn(['FIELD_AGENT', 'CLIENT_ADMIN'])
  role?: 'FIELD_AGENT' | 'CLIENT_ADMIN';

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  title?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  @Matches(YOUTUBE_URL_REGEX, {
    message: 'videoUrl must be a valid YouTube URL',
  })
  videoUrl?: string;

  @IsOptional()
  @IsString()
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdateTrainingStatusDto {
  @IsBoolean()
  isActive: boolean;
}

export class UpdateTrainingResetConfigDto {
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  durationDays: number;
}

export class CompleteTrainingVideoDto {
  @IsUUID()
  trainingId: string;
}
