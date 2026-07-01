import { IsNotEmpty, IsString, Matches } from 'class-validator';

export class PincodeSearchDto {
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{6}$/, { message: 'Pincode must be exactly 6 digits' })
  pincode: string;
}
