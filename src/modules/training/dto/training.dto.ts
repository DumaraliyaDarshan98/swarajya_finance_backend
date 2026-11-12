import {
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
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

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  passingMarks?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  averagePassingMarks?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  failMarks?: number;
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

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  passingMarks?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  averagePassingMarks?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(100)
  failMarks?: number;
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

export class TrainingQuestionOptionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  key: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  text: string;
}

export class CreateTrainingQuestionDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  questionText: string;

  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => TrainingQuestionOptionDto)
  options: TrainingQuestionOptionDto[];

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  correctOptionKey: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateTrainingQuestionDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  questionText?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ValidateNested({ each: true })
  @Type(() => TrainingQuestionOptionDto)
  options?: TrainingQuestionOptionDto[];

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  correctOptionKey?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class ExamAnswerDto {
  @IsUUID()
  questionId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  selectedOptionKey: string;
}

export class SubmitTrainingExamDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => ExamAnswerDto)
  answers: ExamAnswerDto[];
}
