import { IsOptional, IsString } from 'class-validator';

/**
 * Exotel StatusCallback payload (form-urlencoded or JSON).
 * Validation is intentionally loose because Exotel may add fields over time.
 */
export class ExotelWebhookDto {
  @IsOptional()
  @IsString()
  CallSid?: string;

  @IsOptional()
  @IsString()
  Status?: string;

  @IsOptional()
  @IsString()
  RecordingUrl?: string;

  @IsOptional()
  @IsString()
  DateCreated?: string;

  @IsOptional()
  @IsString()
  DateUpdated?: string;

  @IsOptional()
  @IsString()
  StartTime?: string;

  @IsOptional()
  @IsString()
  EndTime?: string;

  @IsOptional()
  Duration?: string | number;

  @IsOptional()
  ConversationDuration?: string | number;

  @IsOptional()
  @IsString()
  To?: string;

  @IsOptional()
  @IsString()
  From?: string;

  @IsOptional()
  @IsString()
  CustomField?: string;

  @IsOptional()
  @IsString()
  EventType?: string;

  @IsOptional()
  @IsString()
  Direction?: string;
}
