import {
  IsBoolean,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { Transform } from 'class-transformer';

export class PortalTestScrapeDto {
  /** Portal from master list (preferred). */
  @IsOptional()
  @IsUUID()
  portalId?: string;

  /**
   * Built-in scrape strategy when no portal row exists
   * (e.g. gst-knowyourgst, whois, pincode).
   */
  @IsOptional()
  @IsString()
  @MaxLength(40)
  strategy?: string;

  /** Key/value inputs required by the portal scrape strategy */
  @IsOptional()
  @IsObject()
  inputs?: Record<string, string>;
}

export class PortalValidateAllDto {
  /** Optional sample inputs reused for field-scrape portals during batch validate */
  @IsOptional()
  @IsObject()
  sampleInputs?: {
    gstNumber?: string;
    domain?: string;
    pincode?: string;
  };

  /** When true, also attempt field scrapes for known strategies (slower). */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true' || value === 1 || value === '1')
  @IsBoolean()
  runFieldScrapes?: boolean;

  @IsOptional()
  @IsString()
  @MaxLength(80)
  stateFilter?: string;
}
