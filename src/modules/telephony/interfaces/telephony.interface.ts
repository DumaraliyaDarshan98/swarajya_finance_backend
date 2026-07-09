export type TelephonyCallType =
  | 'INITIAL_SUBMISSION'
  | 'AGENT_ASSIGNED'
  | 'FINAL_REPORT'
  | 'RECALL'
  | 'CUSTOM';

export type TelephonyCallStatus =
  | 'INITIATED'
  | 'QUEUED'
  | 'RINGING'
  | 'IN_PROGRESS'
  | 'ANSWERED'
  | 'COMPLETED'
  | 'FAILED'
  | 'BUSY'
  | 'NO_ANSWER';

export interface TelephonyMakeCallRequest {
  customerMobile: string;
  callType: TelephonyCallType;
  physicalVerificationId: string;
  visitId?: string | null;
  callRecordId: string;
  createdBy?: string | null;
}

export interface TelephonyMakeCallResult {
  callSid: string | null;
  status: TelephonyCallStatus;
  providerRequest: Record<string, unknown>;
  providerResponse: Record<string, unknown>;
  startTime?: Date | null;
}

export interface TelephonyWebhookPayload {
  CallSid?: string;
  Status?: string;
  RecordingUrl?: string;
  DateCreated?: string;
  DateUpdated?: string;
  StartTime?: string;
  EndTime?: string;
  Duration?: string | number;
  ConversationDuration?: string | number;
  To?: string;
  From?: string;
  CustomField?: string;
  EventType?: string;
  Direction?: string;
  [key: string]: unknown;
}
