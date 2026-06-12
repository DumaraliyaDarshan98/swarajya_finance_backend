import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class GstSearchDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/, {
    message: 'Invalid GST number format',
  })
  gstNumber: string;
}

