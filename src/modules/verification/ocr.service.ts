import {
  BadGatewayException,
  BadRequestException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import type { APIResponseInterface } from '../../interface/response.interface';

type OcrExtractSimpleResponse = Record<string, unknown>;
type UploadedFileLike = {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
};

@Injectable()
export class OcrService {
  private readonly endpoint = 'https://ocr.swarajyarac.com/api/document/extract-simple';
  
  // private readonly endpoint = 'http://localhost:5000/api/document/extract-simple';
  
  async extractSimple(
    file: UploadedFileLike | undefined,
    documentType: string | undefined,
  ): Promise<APIResponseInterface<OcrExtractSimpleResponse>> {
    if (!file) throw new BadRequestException('file is required');
    if (!documentType?.trim())
      throw new BadRequestException('documentType is required');

    const form = new FormData();
    const blob = new Blob([new Uint8Array(file.buffer)], {
      type: file.mimetype || 'application/octet-stream',
    });
    form.append('file', blob);
    form.append('documentType', documentType.trim());

    let res: Response;
    try {
      res = await fetch(this.endpoint, { method: 'POST', body: form });
    } catch (_e) {
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
      data: (body ?? {}) as OcrExtractSimpleResponse,
    };
  }
}

