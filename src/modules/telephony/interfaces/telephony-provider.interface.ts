import type {
  TelephonyCallType,
  TelephonyMakeCallRequest,
  TelephonyMakeCallResult,
  TelephonyWebhookPayload,
} from './telephony.interface';

/**
 * Abstraction for outbound telephony providers (Exotel, Twilio, Knowlarity, MyOperator).
 */
export interface ITelephonyProvider {
  readonly providerName: string;

  makeCall(request: TelephonyMakeCallRequest): Promise<TelephonyMakeCallResult>;

  getCall(callSid: string): Promise<Record<string, unknown>>;

  downloadRecording(recordingUrl: string): Promise<Buffer>;

  handleWebhook(payload: TelephonyWebhookPayload): TelephonyWebhookPayload;
}

export type TelephonyFlowKey = TelephonyCallType | 'CUSTOM';
