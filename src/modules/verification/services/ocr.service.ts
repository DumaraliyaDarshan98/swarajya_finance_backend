import {
  BadGatewayException,
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { APIResponseInterface } from '../../../common/interfaces/response.interface';

export type OcrExtractResponse = Record<string, unknown>;
export type OcrRcuTriggerPayload = {
  code: string;
  text: string;
  risk: string;
  section?: string | null;
};
export type OcrForensicConfigPayload = {
  code: string;
  engineKey?: string;
  threatCode: string;
  title: string;
  description: string;
  severity: string;
  score: number;
  category?: string;
  documentTypePattern?: string | null;
};
type UploadedFileLike = {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
};

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);
  // private readonly ocrBaseUrl = (
  //   process.env.OCR_SERVICE_URL || 'https://ocr.swarajyarac.com' || 'http://localhost:3300'
  // ).replace(/\/$/, '');

  private readonly ocrBaseUrl = (
    process.env.OCR_SERVICE_URL || 'https://ocr.swarajyarac.com'
  ).replace(/\/$/, '');

  private readonly apiKey = String(process.env.OCR_SERVICE_API_KEY || '').trim();

  private readonly verifyEndpoint = `${this.ocrBaseUrl}/api/document/verify`;
  private readonly identifyEndpoint = `${this.ocrBaseUrl}/api/document/identify`;
  private readonly healthEndpoint = `${this.ocrBaseUrl}/health`;

  /** Avoid pinging /health on every identify+verify call (major OCR latency). */
  private healthCacheOkUntilMs = 0;
  private static readonly HEALTH_CACHE_TTL_MS = 45_000;

  private authHeaders(): HeadersInit {
    if (!this.apiKey) return {};
    return { 'X-OCR-API-Key': this.apiKey };
  }

  private summarizeBody(body: unknown, maxLen = 800): string {
    if (body == null) return '(empty body / non-JSON)';
    try {
      const text = typeof body === 'string' ? body : JSON.stringify(body);
      return text.length > maxLen ? `${text.slice(0, maxLen)}…` : text;
    } catch {
      return '(unserializable body)';
    }
  }

  private extractErrorMessage(body: unknown, fallback: string): string {
    if (!body || typeof body !== 'object') return fallback;
    const rec = body as Record<string, unknown>;
    if (typeof rec.message === 'string' && rec.message.trim()) return rec.message.trim();
    if (typeof rec.error === 'string' && rec.error.trim()) return rec.error.trim();
    if (Array.isArray(rec.errors) && rec.errors.length) {
      const first = rec.errors[0] as any;
      if (typeof first === 'string') return first;
      if (first?.message) return String(first.message);
    }
    return fallback;
  }

  /** Ping OCR sidecar before starting heavy jobs (cached ~45s). */
  async assertHealthy(): Promise<void> {
    if (Date.now() < this.healthCacheOkUntilMs) return;

    let res: Response;
    try {
      res = await fetch(this.healthEndpoint, {
        method: 'GET',
        headers: this.authHeaders(),
        signal: AbortSignal.timeout(5000),
      });
    } catch (err) {
      this.healthCacheOkUntilMs = 0;
      this.logger.error(
        `[OCR:HEALTH] unreachable endpoint=${this.healthEndpoint}`,
        err instanceof Error ? err.stack : err,
      );
      throw new ServiceUnavailableException(
        `OCR service is unreachable (${this.ocrBaseUrl}). Start ocr_extraction or check OCR_SERVICE_URL.`,
      );
    }
    if (!res.ok) {
      this.healthCacheOkUntilMs = 0;
      throw new ServiceUnavailableException(
        `OCR service unhealthy (HTTP ${res.status}) at ${this.ocrBaseUrl}`,
      );
    }
    this.healthCacheOkUntilMs = Date.now() + OcrService.HEALTH_CACHE_TTL_MS;
  }

  async identifyDocument(
    file: UploadedFileLike | undefined,
  ): Promise<
    APIResponseInterface<{
      documentType: string;
      confidence: number;
      identificationAccepted?: boolean;
      identificationUncertain?: boolean;
      validationStatus?: string;
      validationStatusLabel?: string;
      source?: string;
      evidence?: string[];
      message?: string;
    }>
  > {
    if (!file) throw new BadRequestException('file is required');
    await this.assertHealthy();

    const filename = file.originalname || 'document.pdf';
    const mime = file.mimetype || 'application/octet-stream';
    const size = file.buffer?.length ?? 0;

    this.logger.log(
      `[OCR:IDENTIFY] start file="${filename}" mime=${mime} size=${size} endpoint=${this.identifyEndpoint}`,
    );

    const form = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], { type: mime });
    form.append('file', blob, filename);

    let res: Response;
    try {
      res = await fetch(this.identifyEndpoint, {
        method: 'POST',
        body: form,
        headers: this.authHeaders(),
      });
    } catch (err) {
      this.logger.error(
        `[OCR:IDENTIFY] FAILED to reach service endpoint=${this.identifyEndpoint} file="${filename}"`,
        err instanceof Error ? err.stack : err,
      );
      throw new BadGatewayException(
        `Failed to reach OCR identify service (${this.identifyEndpoint})`,
      );
    }

    let body: any = null;
    try {
      body = await res.json();
    } catch (_e) {
      body = null;
    }

    if (!res.ok) {
      const detail = this.extractErrorMessage(body, 'OCR identify service returned error');
      this.logger.error(
        `[OCR:IDENTIFY] HTTP ${res.status} file="${filename}" detail="${detail}" body=${this.summarizeBody(body)}`,
      );
      throw new BadGatewayException(`OCR /identify HTTP ${res.status}: ${detail}`);
    }

    const documentType = String(body?.documentType ?? 'Other').trim() || 'Other';
    const confidenceRaw = Number(body?.confidence);
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.min(1, Math.max(0, confidenceRaw))
      : 0;
    const identificationAccepted =
      typeof body?.identificationAccepted === 'boolean'
        ? body.identificationAccepted
        : undefined;
    const identificationUncertain =
      typeof body?.identificationUncertain === 'boolean'
        ? body.identificationUncertain
        : undefined;
    const validationStatus =
      typeof body?.validationStatus === 'string' ? body.validationStatus : undefined;
    const validationStatusLabel =
      typeof body?.validationStatusLabel === 'string'
        ? body.validationStatusLabel
        : undefined;

    this.logger.log(
      `[OCR:IDENTIFY] OK file="${filename}" documentType="${documentType}" confidence=${confidence} accepted=${identificationAccepted ?? 'n/a'} status=${validationStatus ?? 'n/a'}`,
    );

    return {
      code: HttpStatus.OK,
      message: String(body?.message ?? 'Document identified'),
      data: {
        documentType,
        confidence,
        ...(identificationAccepted !== undefined ? { identificationAccepted } : {}),
        ...(identificationUncertain !== undefined ? { identificationUncertain } : {}),
        ...(validationStatus ? { validationStatus } : {}),
        ...(validationStatusLabel ? { validationStatusLabel } : {}),
        ...(typeof body?.source === 'string' ? { source: body.source } : {}),
        ...(Array.isArray(body?.evidence) ? { evidence: body.evidence } : {}),
        ...(typeof body?.message === 'string' ? { message: body.message } : {}),
      },
    };
  }

  /**
   * Calls the full /verify endpoint which returns extractedData, triggerResults, checks, confidence.
   */
  async extractSimple(
    file: UploadedFileLike | undefined,
    documentType: string | undefined,
    rcuTriggers?: OcrRcuTriggerPayload[],
    forensicConfigs?: OcrForensicConfigPayload[] | null,
    fileCategory?: string | null,
  ): Promise<APIResponseInterface<OcrExtractResponse>> {
    if (!file) throw new BadRequestException('file is required');
    if (!documentType?.trim())
      throw new BadRequestException('documentType is required');
    await this.assertHealthy();

    const filename = file.originalname || 'document.pdf';
    const mime = file.mimetype || 'application/octet-stream';
    const size = file.buffer?.length ?? 0;
    const triggerCount = rcuTriggers?.length ?? 0;
    const forensicCount =
      forensicConfigs == null ? 'defaults' : String(forensicConfigs.length);

    this.logger.log(
      `[OCR:VERIFY] start file="${filename}" mime=${mime} size=${size} documentType="${documentType}" fileCategory=${fileCategory ?? 'auto'} triggers=${triggerCount} forensics=${forensicCount} endpoint=${this.verifyEndpoint}`,
    );

    const form = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], { type: mime });
    form.append('file', blob, filename);
    form.append('documentType', documentType.trim());
    form.append('useRcuTriggers', 'true');
    form.append('triggers', JSON.stringify(rcuTriggers ?? []));
    if (fileCategory) {
      form.append('fileCategory', fileCategory);
    }
    if (forensicConfigs != null) {
      form.append('forensicConfigs', JSON.stringify(forensicConfigs));
    }

    let res: Response;
    try {
      res = await fetch(this.verifyEndpoint, {
        method: 'POST',
        body: form,
        headers: this.authHeaders(),
      });
    } catch (err) {
      this.logger.error(
        `[OCR:VERIFY] FAILED to reach service endpoint=${this.verifyEndpoint} file="${filename}" documentType="${documentType}"`,
        err instanceof Error ? err.stack : err,
      );
      throw new BadGatewayException(
        `Failed to reach OCR verify service (${this.verifyEndpoint})`,
      );
    }

    let body: unknown = null;
    try {
      body = await res.json();
    } catch (_e) {
      body = null;
    }

    if (!res.ok) {
      const detail = this.extractErrorMessage(body, 'OCR service returned error');
      this.logger.error(
        `[OCR:VERIFY] HTTP ${res.status} file="${filename}" documentType="${documentType}" detail="${detail}" body=${this.summarizeBody(body)}`,
      );
      throw new BadGatewayException(`OCR /verify HTTP ${res.status}: ${detail}`);
    }

    const successFlag =
      body && typeof body === 'object' && 'success' in body
        ? Boolean((body as any).success)
        : true;

    this.logger.log(
      `[OCR:VERIFY] OK HTTP ${res.status} file="${filename}" documentType="${documentType}" success=${successFlag} triggers=${triggerCount}`,
    );

    return {
      code: HttpStatus.OK,
      message: 'OCR extraction completed',
      data: (body ?? {}) as OcrExtractResponse,
    };
  }
}
