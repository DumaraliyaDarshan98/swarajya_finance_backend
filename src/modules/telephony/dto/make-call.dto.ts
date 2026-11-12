import { IsIn, IsOptional, IsUUID } from 'class-validator';
import type { TelephonyCallType } from '../interfaces/telephony.interface';

const CALL_TYPES: TelephonyCallType[] = [
  'INITIAL_SUBMISSION',
  'AGENT_ASSIGNED',
  'FINAL_REPORT',
  'RECALL',
  'CUSTOM',
];

export class MakeCallDto {
  @IsUUID()
  physicalVerificationId: string;

  @IsOptional()
  @IsUUID()
  visitId?: string;

  @IsIn(CALL_TYPES)
  callType: TelephonyCallType;
}
