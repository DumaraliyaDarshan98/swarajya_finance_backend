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
type UploadedFileLike = {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
};

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  // private readonly verifyEndpoint = 'http://localhost:3300/api/document/verify';
  // private readonly identifyEndpoint = 'http://localhost:3300/api/document/identify';
  // private readonly verifyEndpoint = 'https://ocr.swarajyarac.com/api/document/extract-simple';
  private readonly verifyEndpoint = 'https://ocr.swarajyarac.com/api/document/verify';
  private readonly identifyEndpoint = 'https://ocr.swarajyarac.com/api/document/identify';

  /**
   * Classify document type only (no full OCR / RCU).
   */
  async identifyDocument(
    file: UploadedFileLike | undefined,
  ): Promise<APIResponseInterface<{ documentType: string; confidence: number }>> {
    if (!file) throw new BadRequestException('file is required');

    const form = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], {
      type: file.mimetype || 'application/octet-stream',
    });
    const filename = file.originalname || 'document.pdf';
    form.append('file', blob, filename);

    let res: Response;
    try {
      res = await fetch(this.identifyEndpoint, { method: 'POST', body: form });
      this.logger.log(`OCR /identify response status: ${res.status}`);
    } catch (_e) {
      this.logger.error('Failed to reach OCR identify service', _e);
      throw new BadGatewayException('Failed to reach OCR service');
    }

    let body: any = null;
    try {
      body = await res.json();
    } catch (_e) {
      body = null;
    }

    if (!res.ok) {
      const msg =
        typeof body === 'object' && body && 'message' in body
          ? String(body.message)
          : 'OCR identify service returned error';
      throw new BadGatewayException(msg);
    }

    const documentType = String(body?.documentType ?? 'Other').trim() || 'Other';
    const confidenceRaw = Number(body?.confidence);
    const confidence = Number.isFinite(confidenceRaw)
      ? Math.min(1, Math.max(0, confidenceRaw))
      : 0;

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
  ): Promise<APIResponseInterface<OcrExtractResponse>> {
    if (!file) throw new BadRequestException('file is required');
    if (!documentType?.trim())
      throw new BadRequestException('documentType is required');

    const form = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], {
      type: file.mimetype || 'application/octet-stream',
    });
    const filename = file.originalname || 'document.pdf';
    form.append('file', blob, filename);
    form.append('documentType', documentType.trim());
    form.append('useRcuTriggers', 'true');
    form.append('triggers', JSON.stringify(rcuTriggers ?? []));

    let res: Response;
    try {
      res = await fetch(this.verifyEndpoint, { method: 'POST', body: form });
      this.logger.log(`OCR /verify response status: ${res.status} for ${documentType}`);
    } catch (_e) {
      this.logger.error('Failed to reach OCR service', _e);
      throw new BadGatewayException('Failed to reach OCR service');
    }

    let body: unknown = null;
    try {
      body = await res.json();
    } catch (_e) {
      body = null;
    }

    if (!res.ok) {
      const msg =
        typeof body === 'object' && body && 'message' in body
          ? String((body as any).message)
          : 'OCR service returned error';
      throw new BadGatewayException(msg);
    }

    return {
      code: HttpStatus.OK,
      message: 'OCR extraction completed',
      data: (body ?? {}) as OcrExtractResponse,
    };
  }
}
