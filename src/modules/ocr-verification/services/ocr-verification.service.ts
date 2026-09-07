import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { join } from 'path';
import { randomUUID, createHash } from 'crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync, unlinkSync } from 'fs';
import { OcrVerification } from '../entities/ocr-verification.entity';
import { ListOcrVerificationQueryDto } from '../dto/list-ocr-verification-query.dto';
import { UpdateOcrVerificationDto } from '../dto/update-ocr-verification.dto';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';
import { OcrService } from '../../verification/services/ocr.service';
import { OcrNotificationGateway } from '../gateways/ocr-notification.gateway';
import { RcuTriggersService } from '../../rcu-triggers/services/rcu-triggers.service';
import { ForensicChecksService } from '../../forensic-checks/services/forensic-checks.service';
import { detectForensicFileCategory } from '../../forensic-checks/utils/detect-forensic-file-category';
import { Role } from '../../../common/enums/role.enum';
import type {
  OcrCaseForensicSummary,
  OcrDocumentEntry,
  OcrDocumentsPayload,
  OcrForensicSummary,
  OcrForensicVerdict,
  OcrVerificationStatus,
} from '../interfaces/ocr-documents-payload.interface';

type AuthedUser = { role: Role; clientId?: string };

type UploadedFileLike = {
  buffer: Buffer;
  mimetype?: string;
  originalname?: string;
};

export const OCR_UPLOAD_DIR = join(process.cwd(), 'uploads', 'ocr-verifications');

/** Maps Gemini identify labels → internal OCR / RCU documentType + display label. */
const IDENTIFIED_TYPE_MAP: Array<{
  match: RegExp;
  documentType: string;
  label: string;
}> = [
  { match: /aadhaar|aadhar/i, documentType: 'aadhaar', label: 'Aadhaar Card' },
  { match: /\bpan\b/i, documentType: 'pan', label: 'PAN Card' },
  { match: /voter/i, documentType: 'voter card', label: 'Voter Card' },
  { match: /driving|license|licence/i, documentType: 'driving license', label: 'Driving License' },
  { match: /passport/i, documentType: 'passport', label: 'Passport' },
  { match: /salary/i, documentType: 'salary slip', label: 'Salary Slip' },
  { match: /form\s*16/i, documentType: 'form 16', label: 'Form 16' },
  { match: /bank\s*statement|account\s*statement/i, documentType: 'bank statement', label: 'Bank Statement' },
  { match: /\bitr\b/i, documentType: 'itr', label: 'ITR' },
  { match: /\bgst\b/i, documentType: 'gst', label: 'GST' },
  { match: /trade\s*license/i, documentType: 'trade license', label: 'Trade License' },
  { match: /address\s*proof/i, documentType: 'address proof', label: 'Address Proof' },
  { match: /agreement/i, documentType: 'agreement', label: 'Agreement Copy' },
  { match: /ownership|partnership\s*deed|deed/i, documentType: 'ownership deed', label: 'Ownership Deed' },
];

@Injectable()
export class OcrVerificationService {
  private readonly logger = new Logger(OcrVerificationService.name);

  constructor(
    @InjectRepository(OcrVerification)
    private repo: Repository<OcrVerification>,
    private ocrService: OcrService,
    private ocrGateway: OcrNotificationGateway,
    private rcuTriggersService: RcuTriggersService,
    private forensicChecksService: ForensicChecksService,
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
      mimeType: null,
      documentType: def.documentType,
      extractedData: null,
      extractedText: null,
      confidence: null,
      triggerResults: null,
      checks: null,
      isValid: null,
      ocrSuccess: false,
      ocrError: null,
      uploadedAt: null,
    };
  }

  private defaultPayload(): OcrDocumentsPayload {
    return {
      documents: [],
      extraDocuments: [],
      mergedFile: null,
    };
  }

  private normalizeIdentifiedType(raw: string): { documentType: string; label: string } {
    const text = (raw || '').trim() || 'Other';
    for (const row of IDENTIFIED_TYPE_MAP) {
      if (row.match.test(text)) {
        return { documentType: row.documentType, label: row.label };
      }
    }
    if (/^other$/i.test(text) || /^unknown$/i.test(text)) {
      return { documentType: 'other', label: 'Other Document' };
    }
    return { documentType: text.toLowerCase(), label: text };
  }

  private unlinkStoredFile(storedFileName: string | null | undefined): void {
    if (!storedFileName?.trim()) return;
    const filePath = join(OCR_UPLOAD_DIR, storedFileName);
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath);
      } catch (err) {
        this.logger.warn(`Failed to delete OCR file ${storedFileName}`, err as Error);
      }
    }
  }

  /** Drop legacy empty fixed slots so the list is only uploaded files. */
  private compactPayloadDocuments(payload: OcrDocumentsPayload): void {
    payload.documents = (payload.documents ?? []).filter((d) => !!d.storedFileName);
    payload.extraDocuments = (payload.extraDocuments ?? []).filter((d) => !!d.storedFileName);
  }

  private allUploadedDocs(payload: OcrDocumentsPayload): OcrDocumentEntry[] {
    return [...(payload.documents ?? []), ...(payload.extraDocuments ?? [])].filter(
      (d) => !!d.storedFileName,
    );
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
    confidence: Record<string, number> | null;
    triggerResults: any[] | null;
    checks: any[] | null;
    isValid: boolean | null;
    fileHash: string | null;
    fileSizeBytes: number | null;
    pdfMetadata: Record<string, unknown> | null;
    forensicSignals: any[] | null;
    forensicSummary: OcrForensicSummary | null;
  } {
    const data =
      ocrResponse && typeof ocrResponse === 'object' && 'data' in ocrResponse
        ? (ocrResponse.data as Record<string, unknown>)
        : ocrResponse;

    if (!data || typeof data !== 'object') {
      return {
        extractedData: null,
        extractedText: null,
        confidence: null,
        triggerResults: null,
        checks: null,
        isValid: null,
        fileHash: null,
        fileSizeBytes: null,
        pdfMetadata: null,
        forensicSignals: null,
        forensicSummary: null,
      };
    }

    const extractedData =
      data.extractedData && typeof data.extractedData === 'object'
        ? (data.extractedData as Record<string, unknown>)
        : null;

    let extractedText: string | null = null;
    if (typeof data.extractedText === 'string') {
      extractedText = data.extractedText;
    } else if (data.extractedText != null) {
      extractedText = JSON.stringify(data.extractedText);
    }

    const confidence =
      data.confidence && typeof data.confidence === 'object'
        ? (data.confidence as Record<string, number>)
        : null;

    const triggerResults = Array.isArray(data.triggerResults) ? data.triggerResults : null;
    const checks = Array.isArray(data.checks) ? data.checks : null;
    const isValid = typeof data.isValid === 'boolean' ? data.isValid : null;
    const fileHash = typeof data.fileHash === 'string' ? data.fileHash : null;
    const fileSizeBytes =
      typeof data.fileSizeBytes === 'number' ? data.fileSizeBytes : null;
    const pdfMetadata =
      data.pdfMetadata && typeof data.pdfMetadata === 'object'
        ? (data.pdfMetadata as Record<string, unknown>)
        : null;
    const forensicSignals = Array.isArray(data.forensicSignals)
      ? data.forensicSignals
      : null;
    const forensicSummary =
      data.forensicSummary && typeof data.forensicSummary === 'object'
        ? (data.forensicSummary as OcrForensicSummary)
        : null;

    return {
      extractedData,
      extractedText,
      confidence,
      triggerResults,
      checks,
      isValid,
      fileHash,
      fileSizeBytes,
      pdfMetadata,
      forensicSignals,
      forensicSummary,
    };
  }

  private saveFileToDisk(file: UploadedFileLike): { storedFileName: string; fileHash: string } {
    this.ensureUploadDir();
    const original = file.originalname || 'file';
    const ext = original.includes('.') ? original.split('.').pop() : 'bin';
    const base = original.replace(/\.[^/.]+$/, '');
    const storedFileName = `${randomUUID()}-${this.sanitizeFilename(base)}.${ext}`;
    writeFileSync(join(OCR_UPLOAD_DIR, storedFileName), file.buffer);
    const fileHash = createHash('sha256').update(file.buffer).digest('hex');
    return { storedFileName, fileHash };
  }

  private fuseCaseForensicSummary(docs: OcrDocumentEntry[]): OcrCaseForensicSummary | null {
    const withSummary = docs.filter((d) => d.forensicSummary);
    if (!withSummary.length) return null;

    let worst = withSummary[0];
    for (const d of withSummary) {
      const dScore = d.forensicSummary!.riskScore ?? 0;
      const wScore = worst.forensicSummary!.riskScore ?? 0;
      const dRank = this.verdictRank(d.forensicSummary!.verdict);
      const wRank = this.verdictRank(worst.forensicSummary!.verdict);
      if (dScore > wScore || (dScore === wScore && dRank > wRank)) {
        worst = d;
      }
    }

    const reasons = withSummary
      .flatMap((d) =>
        (d.forensicSummary?.reasons ?? []).map((r) => `${d.label}: ${r}`),
      )
      .slice(0, 15);

    return {
      riskScore: worst.forensicSummary!.riskScore,
      verdict: worst.forensicSummary!.verdict,
      verdictLabel: worst.forensicSummary!.verdictLabel,
      reasons,
      documentCount: docs.length,
      worstDocumentKey: worst.key,
    };
  }

  private verdictRank(v: OcrForensicVerdict | undefined): number {
    switch (v) {
      case 'TEMP':
        return 5;
      case 'SUSPICIOUS':
        return 4;
      case 'MANUAL_REVIEW':
        return 3;
      case 'LIKELY_GENUINE':
        return 2;
      case 'GENUINE':
        return 1;
      default:
        return 0;
    }
  }

  private inferMimeType(fileName: string | null | undefined): string | null {
    const ext = (fileName ?? '').split('.').pop()?.toLowerCase() ?? '';
    const mimeMap: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      jfif: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    return mimeMap[ext] ?? null;
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

  async stats(
    user: AuthedUser,
    clientIdFilter?: string,
  ): Promise<
    APIResponseInterface<{
      total: number;
      draft: number;
      inProgress: number;
      reportGenerated: number;
      failed: number;
    }>
  > {
    const scopedClientId =
      user.role === Role.SUPER_ADMIN
        ? clientIdFilter?.trim() || undefined
        : user.clientId;

    const baseQb = this.repo.createQueryBuilder('ov');
    if (scopedClientId) {
      baseQb.where('ov.client_id = :clientId', { clientId: scopedClientId });
    }

    const total = await baseQb.getCount();

    const rowsQb = this.repo
      .createQueryBuilder('ov')
      .select('ov.status', 'status')
      .addSelect('COUNT(*)', 'count');
    if (scopedClientId) {
      rowsQb.where('ov.client_id = :clientId', { clientId: scopedClientId });
    }
    const rows = await rowsQb
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
    key: string | undefined,
    isExtra: boolean,
    file: UploadedFileLike | undefined,
    user: AuthedUser,
  ): Promise<APIResponseInterface<OcrVerification>> {
    if (!file?.buffer?.length) {
      throw new BadRequestException('No file uploaded');
    }
    return this.appendDocuments(id, [file], user, key, isExtra);
  }

  async appendDocuments(
    id: string,
    files: UploadedFileLike[],
    user: AuthedUser,
    replaceKey?: string,
    isExtra = false,
  ): Promise<APIResponseInterface<OcrVerification>> {
    const validFiles = files.filter((f) => f?.buffer?.length);
    if (!validFiles.length) {
      throw new BadRequestException('No file uploaded');
    }

    const record = await this.findOwned(id, user);
    const payload = this.payloadOf(record);
    this.compactPayloadDocuments(payload);

    // Legacy: replace an existing slot by key when provided and found.
    if (replaceKey?.trim() && validFiles.length === 1) {
      const list = isExtra ? payload.extraDocuments : payload.documents;
      const doc = list.find((d) => d.key === replaceKey.trim());
      if (doc) {
        this.unlinkStoredFile(doc.storedFileName);
        const file = validFiles[0];
        const savedFile = this.saveFileToDisk(file);
        const originalName = file.originalname ?? savedFile.storedFileName;
        Object.assign(doc, {
          fileName: originalName,
          storedFileName: savedFile.storedFileName,
          mimeType: file.mimetype || this.inferMimeType(originalName),
          fileHash: savedFile.fileHash,
          fileSizeBytes: file.buffer.length,
          extractedData: null,
          extractedText: null,
          confidence: null,
          triggerResults: null,
          checks: null,
          isValid: null,
          ocrSuccess: false,
          ocrError: null,
          forensicSignals: null,
          forensicSummary: null,
          pdfMetadata: null,
          uploadedAt: new Date().toISOString(),
        });
        record.documentsPayload = payload;
        const saved = await this.repo.save(record);
        return {
          code: HttpStatus.OK,
          message: 'Document uploaded successfully',
          data: saved,
        };
      }
    }

    for (const file of validFiles) {
      const savedFile = this.saveFileToDisk(file);
      const originalName = file.originalname ?? savedFile.storedFileName;
      const key = `doc_${randomUUID()}`;
      payload.documents.push({
        key,
        label: originalName,
        placeholder: 'Uploaded document',
        fileName: originalName,
        storedFileName: savedFile.storedFileName,
        mimeType: file.mimetype || this.inferMimeType(originalName),
        documentType: 'other',
        extractedData: null,
        extractedText: null,
        confidence: null,
        triggerResults: null,
        checks: null,
        isValid: null,
        ocrSuccess: false,
        ocrError: null,
        fileHash: savedFile.fileHash,
        fileSizeBytes: file.buffer.length,
        pdfMetadata: null,
        forensicSignals: null,
        forensicSummary: null,
        uploadedAt: new Date().toISOString(),
      });
    }

    record.documentsPayload = payload;
    if (record.status === 'REPORT_GENERATED' || record.status === 'FAILED') {
      record.status = 'DRAFT';
      record.progressMessage = null;
      record.reportGeneratedAt = null;
    }
    const saved = await this.repo.save(record);
    return {
      code: HttpStatus.OK,
      message:
        validFiles.length > 1
          ? `${validFiles.length} documents uploaded successfully`
          : 'Document uploaded successfully',
      data: saved,
    };
  }

  async deleteDocument(
    id: string,
    key: string,
    user: AuthedUser,
  ): Promise<APIResponseInterface<OcrVerification>> {
    if (!key?.trim()) {
      throw new BadRequestException('Document key is required');
    }

    const record = await this.findOwned(id, user);
    const payload = this.payloadOf(record);
    const docKey = key.trim();

    const fromMain = payload.documents.findIndex((d) => d.key === docKey);
    const fromExtra = payload.extraDocuments.findIndex((d) => d.key === docKey);

    let removed: OcrDocumentEntry | undefined;
    if (fromMain >= 0) {
      removed = payload.documents.splice(fromMain, 1)[0];
    } else if (fromExtra >= 0) {
      removed = payload.extraDocuments.splice(fromExtra, 1)[0];
    } else {
      throw new NotFoundException('Document not found on this verification');
    }

    this.unlinkStoredFile(removed.storedFileName);
    this.compactPayloadDocuments(payload);
    record.documentsPayload = payload;
    const saved = await this.repo.save(record);
    return {
      code: HttpStatus.OK,
      message: 'Document deleted successfully',
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
    if (payload.mergedFile?.storedFileName) {
      this.unlinkStoredFile(payload.mergedFile.storedFileName);
    }
    const savedFile = this.saveFileToDisk(file);

    payload.mergedFile = {
      fileName: file.originalname ?? savedFile.storedFileName,
      storedFileName: savedFile.storedFileName,
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
    this.compactPayloadDocuments(payload);

    const hasDoc = this.allUploadedDocs(payload).length > 0;

    if (!hasDoc) {
      throw new BadRequestException('Upload at least one document before generating report');
    }

    record.status = 'UPLOADING';
    record.progressMessage = 'Preparing documents for identification...';
    record.documentsPayload = payload;
    await this.repo.save(record);

    this.emitProgress(record);

    this.processOcrInBackground(record.id, record.clientId).catch((err) =>
      this.logger.error(`Background OCR failed for ${record.id}`, err),
    );

    return {
      code: HttpStatus.OK,
      message: 'Report generation started. You can track progress on the listing page.',
      data: record,
    };
  }

  private async processOcrInBackground(recordId: string, clientId: string): Promise<void> {
    const record = await this.repo.findOne({ where: { id: recordId } });
    if (!record) return;

    const payload = this.payloadOf(record);
    this.compactPayloadDocuments(payload);
    const allDocs = this.allUploadedDocs(payload);
    const totalDocs = allDocs.length;

    // --- Phase 1: identify each document ---
    record.status = 'OCR_PROCESSING';
    record.progressMessage = `Identifying documents: 0 / ${totalDocs}...`;
    record.documentsPayload = payload;
    await this.repo.save(record);
    this.emitProgress(record);

    let identified = 0;
    for (const doc of allDocs) {
      identified++;
      record.progressMessage = `Identifying documents: ${identified} / ${totalDocs} — ${doc.fileName ?? doc.label}`;
      await this.repo.save(record);
      this.emitProgress(record);

      try {
        const filePath = join(OCR_UPLOAD_DIR, doc.storedFileName!);
        if (!existsSync(filePath)) {
          this.logger.error(
            `[OCR:PIPELINE] IDENTIFY skip — file missing on disk record=${recordId} key=${doc.key} stored=${doc.storedFileName}`,
          );
          doc.documentType = 'other';
          doc.label = doc.fileName || 'Other Document';
          continue;
        }

        const fileBuffer = readFileSync(filePath);
        const resolvedMimeType =
          doc.mimeType ||
          this.inferMimeType(doc.fileName) ||
          this.inferMimeType(doc.storedFileName);

        this.logger.log(
          `[OCR:PIPELINE] IDENTIFY record=${recordId} file="${doc.fileName}" mime=${resolvedMimeType ?? 'unknown'} size=${fileBuffer.length}`,
        );

        const identifyRes = await this.ocrService.identifyDocument({
          buffer: fileBuffer,
          mimetype: resolvedMimeType || undefined,
          originalname: doc.fileName ?? doc.storedFileName!,
        });
        const mapped = this.normalizeIdentifiedType(
          identifyRes.data?.documentType ?? 'Other',
        );
        doc.documentType = mapped.documentType;
        doc.label = mapped.label;
        this.logger.log(
          `[OCR:PIPELINE] IDENTIFY OK record=${recordId} file="${doc.fileName}" → type="${mapped.documentType}" label="${mapped.label}"`,
        );
      } catch (err: any) {
        this.logger.error(
          `[OCR:PIPELINE] IDENTIFY FAIL record=${recordId} file="${doc.fileName}" key=${doc.key} error="${err?.message ?? err}"`,
          err?.stack,
        );
        doc.documentType = 'other';
        doc.label = doc.fileName || 'Other Document';
      }

      record.documentsPayload = payload;
      await this.repo.save(record);
    }

    // --- Phase 2: fetch RCU triggers for identified types ---
    type DocTriggerBundle = {
      doc: OcrDocumentEntry;
      triggers: Array<{
        code: string;
        text: string;
        risk: string;
        section?: string | null;
      }>;
      matchedKey: string | null;
      matchedLabel: string | null;
    };
    const bundles: DocTriggerBundle[] = [];

    record.progressMessage = `Fetching triggers: 0 / ${totalDocs}...`;
    await this.repo.save(record);
    this.emitProgress(record);

    let fetched = 0;
    for (const doc of allDocs) {
      fetched++;
      record.progressMessage = `Fetching triggers: ${fetched} / ${totalDocs} — ${doc.label}`;
      await this.repo.save(record);
      this.emitProgress(record);

      const rcuMatch = await this.rcuTriggersService.findOcrTriggersForDocumentType(
        doc.documentType,
        [doc.label, doc.fileName ?? ''],
      );

      this.logger.log(
        `RCU OCR triggers for "${doc.label}" (${doc.documentType}): matched=${rcuMatch.matchedKey ?? 'none'} label=${rcuMatch.matchedLabel ?? 'none'} score=${rcuMatch.matchScore} fallbackOther=${rcuMatch.usedFallbackOther} count=${rcuMatch.triggers.length}`,
      );

      if (rcuMatch.matchedLabel && !rcuMatch.usedFallbackOther) {
        // Prefer the admin-configured document type label when matched
        doc.label = rcuMatch.matchedLabel;
      }

      bundles.push({
        doc,
        triggers: rcuMatch.triggers,
        matchedKey: rcuMatch.matchedKey,
        matchedLabel: rcuMatch.matchedLabel,
      });

      record.documentsPayload = payload;
      await this.repo.save(record);
    }

    // --- Phase 3: generate OCR prompt + run verification with triggers + forensics ---
    record.progressMessage = `Running OCR + forensics: 0 / ${totalDocs}...`;
    await this.repo.save(record);
    this.emitProgress(record);

    let processed = 0;
    let hasFailure = false;

    for (const bundle of bundles) {
      const doc = bundle.doc;
      processed++;
      const triggerCount = bundle.triggers.length;
      record.progressMessage =
        triggerCount > 0
          ? `Running OCR + forensics: ${processed} / ${totalDocs} — ${doc.label} (${triggerCount} triggers)`
          : `Running OCR + forensics: ${processed} / ${totalDocs} — ${doc.label}`;
      await this.repo.save(record);
      this.emitProgress(record);

      try {
        const filePath = join(OCR_UPLOAD_DIR, doc.storedFileName!);
        if (!existsSync(filePath)) {
          doc.ocrError = 'File not found on disk';
          doc.ocrSuccess = false;
          hasFailure = true;
          continue;
        }

        const fileBuffer = readFileSync(filePath);
        const resolvedMimeType =
          doc.mimeType ||
          this.inferMimeType(doc.fileName) ||
          this.inferMimeType(doc.storedFileName);

        if (!resolvedMimeType) {
          doc.ocrError = 'Unsupported file type for OCR. Use PDF, JPG, JPEG, PNG, or WEBP.';
          doc.ocrSuccess = false;
          hasFailure = true;
          record.documentsPayload = payload;
          await this.repo.save(record);
          this.logger.warn(`OCR skipped for "${doc.label}" (${doc.key}): unsupported file type`);
          continue;
        }

        // Prefer RCU matched key as documentType for extraction prompts when available
        const ocrDocumentType =
          !bundle.matchedKey || bundle.matchedKey === 'other'
            ? doc.documentType
            : bundle.matchedKey.replace(/[_-]+/g, ' ');

        const fileCategory = detectForensicFileCategory(
          doc.fileName ?? doc.storedFileName,
          resolvedMimeType,
        );
        const forensicConfigs =
          await this.forensicChecksService.getOcrForensicConfigs(fileCategory);

        this.logger.log(
          `[OCR:PIPELINE] Forensics fileCategory=${fileCategory ?? 'unknown'} configs=${forensicConfigs == null ? 'defaults' : forensicConfigs.length} file="${doc.fileName}"`,
        );

        const ocrRes = await this.ocrService.extractSimple(
          {
            buffer: fileBuffer,
            mimetype: resolvedMimeType,
            originalname: doc.fileName ?? doc.storedFileName!,
          },
          ocrDocumentType,
          bundle.triggers,
          forensicConfigs,
          fileCategory,
        );
        const picked = this.pickOcrPayload((ocrRes.data ?? {}) as Record<string, unknown>);
        doc.extractedData = picked.extractedData;
        doc.extractedText = picked.extractedText;
        doc.confidence = picked.confidence;
        doc.triggerResults = picked.triggerResults;
        doc.checks = picked.checks;
        doc.isValid = picked.isValid;
        doc.fileHash = picked.fileHash ?? doc.fileHash ?? null;
        doc.fileSizeBytes = picked.fileSizeBytes ?? doc.fileSizeBytes ?? null;
        doc.pdfMetadata = picked.pdfMetadata;
        doc.forensicSignals = picked.forensicSignals;
        doc.forensicSummary = picked.forensicSummary;
        doc.ocrSuccess = true;
        doc.ocrError = null;
        if (triggerCount === 0) {
          this.logger.warn(
            `OCR completed for "${doc.label}" but no RCU triggers matched (documentType=${doc.documentType}). Ensure the RCU document type is Active + used in OCR and its name resembles the identified type.`,
          );
        }
        if (picked.forensicSummary) {
          this.logger.log(
            `[OCR:PIPELINE] VERIFY+FORENSICS OK record=${recordId} file="${doc.fileName}" type="${doc.documentType}" verdict=${picked.forensicSummary.verdict} score=${picked.forensicSummary.riskScore}`,
          );
        } else {
          this.logger.log(
            `[OCR:PIPELINE] VERIFY OK record=${recordId} file="${doc.fileName}" type="${doc.documentType}" (no forensic summary)`,
          );
        }
      } catch (err: any) {
        const errMsg = err?.message ?? 'OCR extraction failed';
        doc.ocrError = errMsg;
        doc.ocrSuccess = false;
        hasFailure = true;
        this.logger.error(
          `[OCR:PIPELINE] VERIFY FAIL record=${recordId} file="${doc.fileName}" key=${doc.key} type="${doc.documentType}" error="${errMsg}"`,
          err?.stack,
        );
      }

      record.documentsPayload = payload;
      await this.repo.save(record);
    }

    // --- Phase 4: fuse case-level forensic verdict ---
    record.progressMessage = 'Fusing forensic score & verdict...';
    await this.repo.save(record);
    this.emitProgress(record);

    payload.caseForensicSummary = this.fuseCaseForensicSummary(allDocs);

    const failedDocs = allDocs.filter((d) => d.storedFileName && !d.ocrSuccess);
    const failedNames = failedDocs.map((d) => d.label).join(', ');
    record.status = hasFailure ? 'FAILED' : 'REPORT_GENERATED';
    const caseVerdict = payload.caseForensicSummary?.verdictLabel;
    const caseScore = payload.caseForensicSummary?.riskScore;
    record.progressMessage = hasFailure
      ? `Failed: ${failedNames}`
      : caseVerdict
        ? `Report generated — ${caseVerdict} (risk ${caseScore}/100)`
        : 'Report generated successfully';
    record.reportGeneratedAt = hasFailure ? null : new Date();
    record.documentsPayload = payload;
    await this.repo.save(record);
    this.emitProgress(record);
  }

  private emitProgress(record: OcrVerification): void {
    this.ocrGateway.emitProgress(record.clientId, {
      id: record.id,
      status: record.status,
      progressMessage: record.progressMessage ?? '',
    });
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
