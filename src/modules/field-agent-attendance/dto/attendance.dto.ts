import { IsIn, IsNumber, IsOptional, IsString, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

export const ATTENDANCE_LOCATION_TYPES = [
  'RESIDENCE',
  'OFFICE',
  'CURRENT_LOCATION',
] as const;

export class CheckInAttendanceDto {
  @IsIn(ATTENDANCE_LOCATION_TYPES)
  locationType: (typeof ATTENDANCE_LOCATION_TYPES)[number];

  @IsOptional()
  @IsString()
  @MaxLength(500)
  locationLabel?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  longitude?: number;
}

export class CheckOutAttendanceDto {
  @Type(() => Number)
  @IsNumber()
  latitude: number;

  @Type(() => Number)
  @IsNumber()
  longitude: number;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  locationLabel?: string;
}

export class ListAttendanceQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsIn(['Present', 'Absent', 'Half Day'])
  status?: 'Present' | 'Absent' | 'Half Day';

  @IsOptional()
  @IsString()
  fromDate?: string;

  @IsOptional()
  @IsString()
  toDate?: string;

  @IsOptional()
  @IsString()
  fieldAgentUserId?: string;

  @IsOptional()
  @Type(() => Number)
  page?: number;

  @IsOptional()
  @Type(() => Number)
  pagePerRecord?: number;
}
