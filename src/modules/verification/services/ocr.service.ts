import {
  BadGatewayException,
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
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

  private readonly verifyEndpoint = 'http://localhost:3300/api/document/verify';
  private readonly identifyEndpoint = 'http://localhost:3300/api/document/identify';
  // private readonly verifyEndpoint = 'https://ocr.swarajyarac.com/api/document/extract-simple';
  // private readonly verifyEndpoint = 'https://ocr.swarajyarac.com/api/document/verify';
  // private readonly identifyEndpoint = 'https://ocr.swarajyarac.com/api/document/identify';

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

  /**
   * Classify document type only (no full OCR / RCU).
   */
  async identifyDocument(
    file: UploadedFileLike | undefined,
  ): Promise<APIResponseInterface<{ documentType: string; confidence: number }>> {
    if (!file) throw new BadRequestException('file is required');

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
      res = await fetch(this.identifyEndpoint, { method: 'POST', body: form });
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

    this.logger.log(
      `[OCR:IDENTIFY] OK file="${filename}" documentType="${documentType}" confidence=${confidence}`,
    );

    return {
      code: HttpStatus.OK,
      message: 'Document identified',
      data: { documentType, confidence },
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
      res = await fetch(this.verifyEndpoint, { method: 'POST', body: form });
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
