import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { OcrVerification } from './entities/ocr-verification.entity';
import { ListOcrVerificationQueryDto } from './dto/list-ocr-verification-query.dto';
import { UpdateOcrVerificationDto } from './dto/update-ocr-verification.dto';
import { APIResponseInterface } from '../../interface/response.interface';
import { OcrService } from '../verification/ocr.service';
import { Role } from '../../enum/role.enum';
import type {
  OcrDocumentEntry,
  OcrDocumentsPayload,
  OcrVerificationStatus,
} from './interfaces/ocr-documents-payload.interface';

type AuthedUser = { role: Role; clientId?: string };

type UploadedFileLike = {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
};

export const OCR_UPLOAD_DIR = join(process.cwd(), 'uploads', 'ocr-verifications');

const DOCUMENT_DEFINITIONS: {
  key: string;
  label: string;
  placeholder: string;
  documentType: string;
}[] = [
  { key: 'pan', label: 'PAN Card', placeholder: 'Upload PAN card', documentType: 'pan' },
  { key: 'aadhaar', label: 'Aadhaar Card', placeholder: 'Upload Aadhar card', documentType: 'aadhaar' },
  {
    key: 'addressProof',
    label: 'Address Proof',
    placeholder: 'Upload address proof',
    documentType: 'other',
  },
  {
    key: 'salarySlip',
    label: 'Salary Slip / Joining Letter',
    placeholder: 'Upload Salary Slip / Joining Letter',
    documentType: 'salary slip',
  },
  {
    key: 'ownershipDeed',
    label: 'Ownership / Partnership Deed',
    placeholder: 'Ownership / Partnership deed',
    documentType: 'other',
  },
  { key: 'form16', label: 'Form 16', placeholder: 'Upload from 16', documentType: 'form 16' },
  {
    key: 'accountStatement',
    label: 'Account Statement',
    placeholder: 'Upload account statement',
    documentType: 'bank statement',
  },
  {
    key: 'agreement',
    label: 'Agreement Copy',
    placeholder: 'Upload Agreement Copy',
    documentType: 'other',
  },
  {
    key: 'others',
    label: 'Others Document',
    placeholder: 'Upload Others Document',
    documentType: 'other',
  },
];

@Injectable()
export class OcrVerificationService {
  constructor(
    @InjectRepository(OcrVerification)
    private repo: Repository<OcrVerification>,
    private ocrService: OcrService,
  ) {}

  private ensureUploadDir(): void {
    if (!existsSync(OCR_UPLOAD_DIR)) {
      mkdirSync(OCR_UPLOAD_DIR, { recursive: true });
    }
  }

  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
  }

  private emptyDocumentEntry(def: {
    key: string;
    label: string;
    placeholder: string;
    documentType: string;
  }): OcrDocumentEntry {
    return {
      key: def.key,
      label: def.label,
      placeholder: def.placeholder,
      fileName: null,
      storedFileName: null,
      documentType: def.documentType,
      extractedData: null,
      extractedText: null,
      ocrSuccess: false,
      ocrError: null,
      uploadedAt: null,
    };
  }

  private defaultPayload(): OcrDocumentsPayload {
    return {
      documents: DOCUMENT_DEFINITIONS.map((d) => this.emptyDocumentEntry(d)),
      extraDocuments: [],
      mergedFile: null,
    };
  }

  private async findOwned(id: string, user: AuthedUser): Promise<OcrVerification> {
    const record = await this.repo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('OCR verification not found');
    }
    if (user.role !== Role.SUPER_ADMIN && record.clientId !== user.clientId) {
      throw new ForbiddenException('You can only access your own client OCR verifications');
    }
    return record;
  }

  private payloadOf(record: OcrVerification): OcrDocumentsPayload {
    return record.documentsPayload ?? this.defaultPayload();
  }

  private pickOcrPayload(ocrResponse: Record<string, unknown>): {
    extractedData: Record<string, unknown> | null;
    extractedText: string | null;
  } {
    const data =
      ocrResponse && typeof ocrResponse === 'object' && 'data' in ocrResponse
        ? (ocrResponse.data as Record<string, unknown>)
        : ocrResponse;

    if (!data || typeof data !== 'object') {
      return { extractedData: null, extractedText: null };
    }

    const extractedData =
      data.extractedData && typeof data.extractedData === 'object'
        ? (data.extractedData as Record<string, unknown>)
        : (data as Record<string, unknown>);

    let extractedText: string | null = null;
    if (typeof data.extractedText === 'string') {
      extractedText = data.extractedText;
    } else if (data.extractedText != null) {
      extractedText = JSON.stringify(data.extractedText);
    }

    return { extractedData, extractedText };
  }

  private saveFileToDisk(file: UploadedFileLike): string {
    this.ensureUploadDir();
    const original = file.originalname || 'file';
    const ext = original.includes('.') ? original.split('.').pop() : 'bin';
    const base = original.replace(/\.[^/.]+$/, '');
    const storedFileName = `${randomUUID()}-${this.sanitizeFilename(base)}.${ext}`;
    writeFileSync(join(OCR_UPLOAD_DIR, storedFileName), file.buffer);
    return storedFileName;
  }

  async list(
    query: ListOcrVerificationQueryDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<OcrVerification[]>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? 'updatedAt';
    const sortDir = query.sortDir ?? 'DESC';

    const qb = this.repo
      .createQueryBuilder('ov')
      .orderBy(`ov.${sortBy}`, sortDir as 'ASC' | 'DESC')
      .skip(skip)
      .take(limit);

    if (user.role === Role.SUPER_ADMIN) {
      qb.leftJoinAndSelect('ov.client', 'client');
      if (query.clientId?.trim()) {
        qb.andWhere('ov.client_id = :filterClientId', {
          filterClientId: query.clientId.trim(),
        });
      }
    } else {
      qb.andWhere('ov.client_id = :clientId', { clientId: user.clientId });
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere('CAST(ov.documents_payload AS CHAR) LIKE :term', { term });
    }

    if (query.status) {
      qb.andWhere('ov.status = :status', { status: query.status });
    }

    const [list, total] = await qb.getManyAndCount();
    return {
      code: HttpStatus.OK,
      message: 'OCR verifications fetched successfully',
      data: list,
      pagination: { total, page, pagePerRecord: limit },
    };
  }

  async stats(user: AuthedUser): Promise<
    APIResponseInterface<{
      total: number;
      draft: number;
      inProgress: number;
      reportGenerated: number;
      failed: number;
    }>
  > {
    const baseQb = this.repo.createQueryBuilder('ov');
    if (user.role !== Role.SUPER_ADMIN) {
      baseQb.where('ov.client_id = :clientId', { clientId: user.clientId });
    }

    const total = await baseQb.getCount();

    const rows = await this.repo
      .createQueryBuilder('ov')
      .select('ov.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where(
        user.role !== Role.SUPER_ADMIN ? 'ov.client_id = :clientId' : '1=1',
        user.role !== Role.SUPER_ADMIN ? { clientId: user.clientId } : {},
      )
      .groupBy('ov.status')
      .getRawMany<{ status: OcrVerificationStatus; count: string }>();

    const byStatus = new Map(rows.map((r) => [r.status, Number(r.count) || 0]));

    return {
      code: HttpStatus.OK,
      message: 'OCR verification stats fetched successfully',
      data: {
        total,
        draft: byStatus.get('DRAFT') ?? 0,
        inProgress: byStatus.get('IN_PROGRESS') ?? 0,
        reportGenerated: byStatus.get('REPORT_GENERATED') ?? 0,
        failed: byStatus.get('FAILED') ?? 0,
      },
    };
  }

  async create(user: AuthedUser): Promise<APIResponseInterface<OcrVerification>> {
    if (!user.clientId) {
      throw new ForbiddenException('Client context missing');
    }

    const entity = this.repo.create({
      clientId: user.clientId,
      client: { id: user.clientId } as any,
      documentsPayload: this.defaultPayload(),
      status: 'DRAFT',
      reportGeneratedAt: null,
    });

    const saved = await this.repo.save(entity);
    return {
      code: HttpStatus.CREATED,
      message: 'OCR verification created successfully',
      data: saved,
    };
  }

  async getById(id: string, user: AuthedUser): Promise<APIResponseInterface<OcrVerification>> {
    const record = await this.findOwned(id, user);
    if (user.role === Role.SUPER_ADMIN) {
      const withClient = await this.repo.findOne({
        where: { id: record.id },
        relations: ['client'],
      });
      return {
        code: HttpStatus.OK,
        message: 'OCR verification fetched successfully',
        data: withClient ?? record,
      };
    }
    return {
      code: HttpStatus.OK,
      message: 'OCR verification fetched successfully',
      data: record,
    };
  }

  async update(
    id: string,
    dto: UpdateOcrVerificationDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<OcrVerification>> {
    const record = await this.findOwned(id, user);
    const payload = this.payloadOf(record);

    if (dto.extraDocuments) {
      const existingByKey = new Map(payload.extraDocuments.map((d) => [d.key, d]));
      payload.extraDocuments = dto.extraDocuments.map((slot) => {
        const prev = existingByKey.get(slot.key);
        if (prev) return { ...prev, label: slot.label, placeholder: slot.placeholder ?? prev.placeholder };
        return {
          ...this.emptyDocumentEntry({
            key: slot.key,
            label: slot.label,
            placeholder: slot.placeholder ?? 'Upload additional document',
            documentType: 'other',
          }),
        };
      });
    }

    record.documentsPayload = payload;
    const saved = await this.repo.save(record);
    return {
      code: HttpStatus.OK,
      message: 'OCR verification updated successfully',
      data: saved,
    };
  }

  async uploadDocument(
    id: string,
    key: string,
    isExtra: boolean,
    file: UploadedFileLike | undefined,
    user: AuthedUser,
  ): Promise<APIResponseInterface<OcrVerification>> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded');
    }

    const record = await this.findOwned(id, user);
    const payload = this.payloadOf(record);
    const list = isExtra ? payload.extraDocuments : payload.documents;
    const doc = list.find((d) => d.key === key);
    if (!doc) {
      throw new BadRequestException(`Document slot "${key}" not found`);
    }

    const storedFileName = this.saveFileToDisk(file);
    const originalName = file.originalname ?? storedFileName;

    let ocrSuccess = false;
    let ocrError: string | null = null;
    let extractedData: Record<string, unknown> | null = null;
    let extractedText: string | null = null;

    try {
      const ocrRes = await this.ocrService.extractSimple(file, doc.documentType);
      const picked = this.pickOcrPayload((ocrRes.data ?? {}) as Record<string, unknown>);
      extractedData = picked.extractedData;
      extractedText = picked.extractedText;
      ocrSuccess = true;
    } catch (err: any) {
      ocrError = err?.message ?? 'OCR extraction failed';
    }

    Object.assign(doc, {
      fileName: originalName,
      storedFileName,
      extractedData,
      extractedText,
      ocrSuccess,
      ocrError,
      uploadedAt: new Date().toISOString(),
    });

    record.documentsPayload = payload;
    const saved = await this.repo.save(record);
    return {
      code: HttpStatus.OK,
      message: ocrSuccess
        ? 'Document uploaded and OCR extracted successfully'
        : 'Document uploaded; OCR extraction failed',
      data: saved,
    };
  }

  async uploadMerged(
    id: string,
    file: UploadedFileLike | undefined,
    user: AuthedUser,
  ): Promise<APIResponseInterface<OcrVerification>> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded');
    }

    const record = await this.findOwned(id, user);
    const payload = this.payloadOf(record);
    const storedFileName = this.saveFileToDisk(file);

    payload.mergedFile = {
      fileName: file.originalname ?? storedFileName,
      storedFileName,
      uploadedAt: new Date().toISOString(),
    };

    record.documentsPayload = payload;
    const saved = await this.repo.save(record);
    return {
      code: HttpStatus.OK,
      message: 'Merged document uploaded successfully',
      data: saved,
    };
  }

  async generateReport(
    id: string,
    user: AuthedUser,
  ): Promise<APIResponseInterface<OcrVerification>> {
    const record = await this.findOwned(id, user);
    const payload = this.payloadOf(record);

    const hasDoc =
      payload.documents.some((d) => d.storedFileName) ||
      payload.extraDocuments.some((d) => d.storedFileName) ||
      !!payload.mergedFile?.storedFileName;

    if (!hasDoc) {
      throw new BadRequestException('Upload at least one document before generating report');
    }

    const hasOcrFailure = [...payload.documents, ...payload.extraDocuments].some(
      (d) => d.storedFileName && !d.ocrSuccess,
    );

    record.status = hasOcrFailure ? 'FAILED' : 'REPORT_GENERATED';
    record.reportGeneratedAt = hasOcrFailure ? null : new Date();
    record.documentsPayload = payload;

    const saved = await this.repo.save(record);
    return {
      code: HttpStatus.OK,
      message: hasOcrFailure
        ? 'Report marked failed — one or more OCR extractions failed'
        : 'OCR verification report generated successfully',
      data: saved,
    };
  }

  async delete(id: string, user: AuthedUser): Promise<APIResponseInterface<null>> {
    const record = await this.findOwned(id, user);
    await this.repo.remove(record);
    return {
      code: HttpStatus.OK,
      message: 'OCR verification deleted successfully',
      data: null,
    };
  }
}
