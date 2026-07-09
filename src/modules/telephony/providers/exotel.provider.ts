import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios, { type AxiosInstance, type AxiosError } from 'axios';
import type { ITelephonyProvider } from '../interfaces/telephony-provider.interface';
import type {
  TelephonyCallType,
  TelephonyMakeCallRequest,
  TelephonyMakeCallResult,
  TelephonyWebhookPayload,
} from '../interfaces/telephony.interface';

/**
 * Official Exotel payload for:
 *   "Outgoing call to connect a number to a call flow"
 *   POST /v1/Accounts/{sid}/Calls/connect
 *
 * Docs (flow mode) support ONLY:
 *   From, CallerId, Url, CallType?, TimeLimit?, TimeOut?, StatusCallback?, CustomField?
 *
 * Do NOT send (belong to two-number connect / cause HTTP 400 Code 34001):
 *   To, Record, RecordingChannels, StatusCallbackEvents, StatusCallbackContentType
 *
 * Recording for flow calls must be enabled inside the Exotel applet/flow itself.
 *
 * Official curl sample:
 *   curl -X POST 'https://<key>:<token>@api.exotel.com/v1/Accounts/<sid>/Calls/connect' \
 *     -d 'From=09876543210' \
 *     -d 'CallerId=0XXXXXX4890' \
 *     -d 'Url=http://my.exotel.com/<sid>/exoml/start_voice/<app_id>' \
 *     -d 'CallType=trans'
 */
export interface ExotelFlowCallPayload {
  /** Customer number dialed first. Prefer 0XXXXXXXXXX (India) or +91XXXXXXXXXX. */
  From: string;
  /** Your ExoPhone — digits only, e.g. 07948502892 */
  CallerId: string;
  /** Flow URL: http://my.exotel.com/{sid}/exoml/start_voice/{app_id} */
  Url: string;
  /** Transactional outbound call */
  CallType: 'trans';
  /** Our call-record UUID (max 128 chars), echoed to applets / StatusCallback */
  CustomField?: string;
  /** Public webhook for CallSid, Status, RecordingUrl, DateUpdated */
  StatusCallback?: string;
}

@Injectable()
export class ExotelProvider implements ITelephonyProvider {
  readonly providerName = 'exotel';
  private readonly logger = new Logger(ExotelProvider.name);
  private readonly http: AxiosInstance;
  private readonly accountSid: string;
  private readonly apiSubdomain: string;
  private readonly apiKey: string;
  private readonly apiToken: string;

  constructor(private readonly config: ConfigService) {
    this.accountSid = (this.config.get<string>('exotel.accountSid') ?? '').trim();
    this.apiSubdomain = (this.config.get<string>('exotel.apiSubdomain') ?? 'api.exotel.com').trim();
    this.apiKey = (this.config.get<string>('exotel.apiKey') ?? '').trim();
    this.apiToken = (this.config.get<string>('exotel.apiToken') ?? '').trim();

    // Regional endpoints (official):
    //   Singapore → https://api.exotel.com
    //   Mumbai    → https://api.in.exotel.com
    this.http = axios.create({
      baseURL: `https://${this.apiSubdomain}/v1/Accounts/${this.accountSid}`,
      auth: {
        username: this.apiKey,
        password: this.apiToken,
      },
      // Explicit form encoding — never send JSON to this v1 endpoint
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Accept: 'application/json',
      },
      timeout: 30000,
      // Prevent axios from transforming form body into JSON
      transformRequest: [
        (data) => (typeof data === 'string' ? data : data),
      ],
    });
  }

  /** Required credentials — fail fast with a clear message. */
  private assertConfig(): void {
    const missing: string[] = [];
    if (!this.accountSid) missing.push('EXOTEL_ACCOUNT_SID');
    if (!this.apiKey) missing.push('EXOTEL_API_KEY');
    if (!this.apiToken) missing.push('EXOTEL_API_TOKEN');
    if (!this.config.get<string>('exotel.callerId')?.trim()) missing.push('EXOTEL_CALLER_ID');

    if (missing.length) {
      const message = `Exotel config incomplete. Missing: ${missing.join(', ')}`;
      console.error('[EXOTEL] ERROR:', message);
      throw new Error(message);
    }
  }

  /**
   * Normalize ExoPhone / CallerId.
   * Official samples use digits with leading 0, no dashes: 0XXXXXX4890
   * Input:  "079-485-02892"  →  "07948502892"
   */
  normalizeCallerId(callerId: string): string {
    return callerId.replace(/[\s\-()]/g, '').trim();
  }

  /**
   * Normalize customer mobile for Exotel flow connect.
   *
   * Official samples accept both:
   *   From=09876543210
   *   From=+919876543210
   *
   * We use India local format 0XXXXXXXXXX (matches Exotel response From field).
   * Accepts: 9913209490 | 09913209490 | +919913209490 | 91-9913209490
   */
  normalizePhoneNumber(mobile: string): string {
    let digits = mobile.replace(/\D/g, '');

    if (digits.length === 12 && digits.startsWith('91')) {
      digits = digits.slice(2);
    }
    if (digits.length === 11 && digits.startsWith('0')) {
      return digits;
    }
    if (digits.length === 10) {
      return `0${digits}`;
    }

    console.warn('[EXOTEL] Unexpected mobile format:', { input: mobile, digits });
    return digits || mobile.trim();
  }

  /**
   * Optional public StatusCallback from EXOTEL_WEBHOOK.
   * Exotel docs: webhook receives CallSid, Status, RecordingUrl, DateUpdated.
   * HTTPS is strongly preferred; localhost / private hosts are never sent.
   */
  private resolveStatusCallback(): string | null {
    const raw = (this.config.get<string>('exotel.webhook') ?? '').trim().replace(/\/$/, '');
    if (!raw) {
      console.warn(
        '[EXOTEL] WARNING: EXOTEL_WEBHOOK not set — StatusCallback omitted. Call still dials; no status/recording webhook.',
      );
      return null;
    }

    const lower = raw.toLowerCase();
    if (
      lower.includes('localhost') ||
      lower.includes('127.0.0.1') ||
      lower.includes('0.0.0.0') ||
      /^https?:\/\/(10\.|192\.168\.|172\.(1[6-9]|2\d|3[0-1])\.)/.test(lower)
    ) {
      console.warn(
        '[EXOTEL] WARNING: EXOTEL_WEBHOOK is not publicly reachable:',
        raw,
        '— StatusCallback omitted. Use ngrok or production HTTPS.',
      );
      return null;
    }

    // Reject obvious placeholders that would fail Exotel URL validation
    if (lower.includes('xxxx.ngrok') || lower.includes('your-') || lower.includes('example.com')) {
      console.warn(
        '[EXOTEL] WARNING: EXOTEL_WEBHOOK looks like a placeholder:',
        raw,
        '— StatusCallback omitted until a real public URL is set.',
      );
      return null;
    }

    if (lower.endsWith('/exotel/webhook')) {
      return raw;
    }
    return `${raw}/exotel/webhook`;
  }

  /**
   * Official flow URL format (do not URL-encode the whole Url value beyond form encoding):
   *   http://my.exotel.com/{AccountSid}/exoml/start_voice/{AppId}
   * AppId comes from Exotel Dashboard → App Bazaar → My Apps.
   */
  private resolveFlowUrl(callType: TelephonyCallType): string {
    const flowMap: Record<TelephonyCallType, string | undefined> = {
      INITIAL_SUBMISSION: this.config.get<string>('exotel.flowAppIdInitialSubmission'),
      AGENT_ASSIGNED: this.config.get<string>('exotel.flowAppIdAgentAssigned'),
      FINAL_REPORT: this.config.get<string>('exotel.flowAppIdFinalReport'),
      RECALL: this.config.get<string>('exotel.flowAppIdRecall'),
      CUSTOM: this.config.get<string>('exotel.flowAppIdCustom'),
    };

    const appId = flowMap[callType]?.trim();
    if (!appId) {
      throw new Error(
        `Exotel flow App ID missing for call type "${callType}". Set EXOTEL_FLOW_APP_ID_* in .env`,
      );
    }

    return `http://my.exotel.com/${this.accountSid}/exoml/start_voice/${appId}`;
  }

  /**
   * Build form fields exactly as official Exotel flow-connect sample.
   * URLSearchParams will apply application/x-www-form-urlencoded encoding
   * (including encoding Url's : / characters) — that is correct; do not double-encode.
   */
  buildCallPayload(request: TelephonyMakeCallRequest): ExotelFlowCallPayload {
    const from = this.normalizePhoneNumber(request.customerMobile);
    const callerId = this.normalizeCallerId(this.config.get<string>('exotel.callerId') ?? '');
    const flowUrl = this.resolveFlowUrl(request.callType);
    const statusCallback = this.resolveStatusCallback();

    // CustomField max 128 chars per Exotel docs
    const customField = request.callRecordId.slice(0, 128);

    const payload: ExotelFlowCallPayload = {
      From: from,
      CallerId: callerId,
      Url: flowUrl,
      CallType: 'trans',
      CustomField: customField,
    };

    if (statusCallback) {
      payload.StatusCallback = statusCallback;
    }

    return payload;
  }

  /** Convert payload object → wire-format form body string. */
  private toFormBody(payload: ExotelFlowCallPayload): string {
    const params = new URLSearchParams();
    // Preserve a stable, documented field order (matches Exotel samples)
    params.set('From', payload.From);
    params.set('CallerId', payload.CallerId);
    params.set('Url', payload.Url);
    params.set('CallType', payload.CallType);
    if (payload.CustomField) {
      params.set('CustomField', payload.CustomField);
    }
    if (payload.StatusCallback) {
      params.set('StatusCallback', payload.StatusCallback);
    }
    return params.toString();
  }

  private parseExotelDate(value?: string | null): Date | null {
    if (!value?.trim()) return null;
    const parsed = new Date(value.replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private mapStatus(status?: string | null): TelephonyMakeCallResult['status'] {
    const normalized = (status ?? 'queued').toLowerCase().replace(/-/g, '_');
    switch (normalized) {
      case 'queued':
        return 'QUEUED';
      case 'ringing':
        return 'RINGING';
      case 'in_progress':
        return 'IN_PROGRESS';
      case 'answered':
        return 'ANSWERED';
      case 'completed':
        return 'COMPLETED';
      case 'failed':
        return 'FAILED';
      case 'busy':
        return 'BUSY';
      case 'no_answer':
        return 'NO_ANSWER';
      default:
        return 'INITIATED';
    }
  }

  private extractExotelErrorMessage(data: unknown, fallback: string): string {
    if (!data || typeof data !== 'object') return fallback;
    const obj = data as {
      RestException?: { Message?: string; Status?: number; Code?: number | string };
      message?: string;
      Message?: string;
      Code?: number | string;
    };
    const code = obj.RestException?.Code ?? obj.Code;
    const msg =
      obj.RestException?.Message ?? obj.message ?? obj.Message ?? fallback;
    return code != null ? `Code ${code}: ${msg}` : msg;
  }

  /**
   * Place outbound call → connect answered party to Exotel voice flow.
   * Strictly follows official Exotel "connect number to call flow" API.
   */
  async makeCall(request: TelephonyMakeCallRequest): Promise<TelephonyMakeCallResult> {
    console.log('[EXOTEL] ========== makeCall START (flow connect) ==========');
    console.log('[EXOTEL] Business request:', {
      callType: request.callType,
      customerMobile: request.customerMobile,
      physicalVerificationId: request.physicalVerificationId,
      callRecordId: request.callRecordId,
    });

    this.assertConfig();

    const payload = this.buildCallPayload(request);
    const encodedBody = this.toFormBody(payload);
    const endpoint = `https://${this.apiSubdomain}/v1/Accounts/${this.accountSid}/Calls/connect`;

    console.log('[EXOTEL] Endpoint:', endpoint);
    console.log('[EXOTEL] Method: POST');
    console.log('[EXOTEL] Content-Type: application/x-www-form-urlencoded');
    console.log('[EXOTEL] Payload (decoded):', payload);
    console.log('[EXOTEL] Encoded body (wire):', encodedBody);
    console.log('[EXOTEL] Auth: Basic (API_KEY:***REDACTED***)');
    console.log('[EXOTEL] Notes:', {
      recordParam: 'NOT SENT — enable recording inside Exotel flow/applet',
      recordingChannels: 'NOT SENT — not valid for flow-connect endpoint',
      statusCallbackEvents: 'NOT SENT — causes 400 on this endpoint',
      fromFormat: '0XXXXXXXXXX (India local)',
      callerIdFormat: 'digits only, no dashes',
      flowUrlFormat: 'http://my.exotel.com/{sid}/exoml/start_voice/{app_id}',
    });

    try {
      const response = await this.http.post('/Calls/connect', encodedBody, {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
      });

      const callData =
        response.data?.Call ??
        response.data?.TwilioResponse?.Call ??
        response.data;

      const callSid = callData?.Sid ?? callData?.CallSid ?? null;
      const status = this.mapStatus(callData?.Status);
      const startTime = this.parseExotelDate(callData?.StartTime ?? callData?.DateCreated);
      const requestId =
        response.headers?.['x-request-id'] ??
        response.headers?.['x-exotel-request-id'] ??
        response.headers?.['request-id'] ??
        null;

      console.log('[EXOTEL] SUCCESS');
      console.log('[EXOTEL] HTTP Status:', response.status);
      console.log('[EXOTEL] Request ID:', requestId);
      console.log('[EXOTEL] Call SID:', callSid);
      console.log('[EXOTEL] Call Status:', status);
      console.log('[EXOTEL] Response Body:', response.data);
      console.log('[EXOTEL] ========== makeCall END (SUCCESS) ==========');

      return {
        callSid: callSid ? String(callSid) : null,
        status,
        providerRequest: { ...payload, _encodedBody: encodedBody },
        providerResponse: response.data as Record<string, unknown>,
        startTime,
      };
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      const httpStatus = axiosError.response?.status ?? null;
      const responseBody = axiosError.response?.data ?? null;
      const responseHeaders = axiosError.response?.headers ?? null;
      const errorMessage = this.extractExotelErrorMessage(
        responseBody,
        axiosError.message ?? 'Exotel API call failed',
      );

      console.error('[EXOTEL] ERROR: makeCall failed');
      console.error('[EXOTEL] HTTP Status:', httpStatus);
      console.error('[EXOTEL] Response Body:', responseBody);
      console.error('[EXOTEL] Response Headers:', responseHeaders);
      console.error('[EXOTEL] Request URL:', endpoint);
      console.error('[EXOTEL] Request Payload (decoded):', payload);
      console.error('[EXOTEL] Encoded body (wire):', encodedBody);
      console.error('[EXOTEL] Error message:', errorMessage);
      console.error('[EXOTEL] ========== makeCall END (FAILED) ==========');

      this.logger.error(`Exotel makeCall failed [${httpStatus}]: ${errorMessage}`);
      throw new Error(errorMessage);
    }
  }

  async getCall(callSid: string): Promise<Record<string, unknown>> {
    console.log('[EXOTEL] getCall:', callSid);
    try {
      const response = await this.http.get(`/Calls/${encodeURIComponent(callSid)}.json`);
      console.log('[EXOTEL] getCall SUCCESS:', response.data?.Call ?? response.data);
      return (response.data?.Call ?? response.data) as Record<string, unknown>;
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      console.error('[EXOTEL] getCall ERROR:', {
        httpStatus: axiosError.response?.status,
        body: axiosError.response?.data,
        message: axiosError.message,
      });
      throw error;
    }
  }

  async downloadRecording(recordingUrl: string): Promise<Buffer> {
    console.log('[EXOTEL] downloadRecording:', recordingUrl);
    try {
      const response = await axios.get<ArrayBuffer>(recordingUrl, {
        responseType: 'arraybuffer',
        auth: {
          username: this.apiKey,
          password: this.apiToken,
        },
        timeout: 60000,
      });

      const buffer = Buffer.from(response.data);
      console.log('[EXOTEL] downloadRecording SUCCESS: bytes=', buffer.length);
      return buffer;
    } catch (error: unknown) {
      const axiosError = error as AxiosError;
      console.error('[EXOTEL] downloadRecording ERROR:', {
        httpStatus: axiosError.response?.status,
        body: axiosError.response?.data,
        message: axiosError.message,
        url: recordingUrl,
      });
      throw error;
    }
  }

  handleWebhook(payload: TelephonyWebhookPayload): TelephonyWebhookPayload {
    console.log('[EXOTEL] handleWebhook payload received:', payload ?? null);
    return payload ?? ({} as TelephonyWebhookPayload);
  }
}
