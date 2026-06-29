import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { VerificationRequest } from './entities/verification-request.entity';
import { APIResponseInterface } from '../../interface/response.interface';
import { ListVerificationRequestsQueryDto } from './dto/list-verification-requests.dto';
import { UpsertDigitalVerificationDto } from './dto/upsert-digital.dto';
import { UpsertDocumentVerificationDto } from './dto/upsert-document.dto';
import { UpsertPhysicalVerificationDto } from './dto/upsert-physical.dto';
import { Role } from '../../enum/role.enum';
import type { VerificationStatus } from './entities/verification-request.entity';

type AuthedUser = { role: Role; clientId?: string };
type DocKey =
  | 'panCard'
  | 'aadhaarCard'
  | 'addressProof'
  | 'joiningLetter'
  | 'salarySlip'
  | 'ownershipDeed'
  | 'form16'
  | 'accountStatement'
  | 'passportPhoto';

@Injectable()
export class VerificationService {
  constructor(
    @InjectRepository(VerificationRequest)
    private repo: Repository<VerificationRequest>,
  ) {}

  async list(
    query: ListVerificationRequestsQueryDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<VerificationRequest[]>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('vr')
      .orderBy(`vr.${query.sortBy ?? 'updatedAt'}`, (query.sortDir ?? 'DESC') as any)
      .skip(skip)
      .take(limit);

    if (user.role !== Role.SUPER_ADMIN) {
      qb.andWhere('vr.client_id = :clientId', { clientId: user.clientId });
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        '(vr.loan_application_no LIKE :term OR vr.applicant_name LIKE :term OR vr.pan_number LIKE :term OR vr.mobile_number LIKE :term)',
        { term },
      );
    }

    if (query.status) {
      qb.andWhere('vr.status = :status', { status: query.status });
    }

    const [list, total] = await qb.getManyAndCount();
    return {
      code: HttpStatus.OK,
      message: 'Verification requests fetched successfully',
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
    const baseQb = this.repo.createQueryBuilder('vr');
    if (user.role !== Role.SUPER_ADMIN) {
      baseQb.where('vr.client_id = :clientId', { clientId: user.clientId });
    }

    const total = await baseQb.getCount();

    const rows = await this.repo
      .createQueryBuilder('vr')
      .select('vr.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where(
        user.role !== Role.SUPER_ADMIN ? 'vr.client_id = :clientId' : '1=1',
        user.role !== Role.SUPER_ADMIN ? { clientId: user.clientId } : {},
      )
      .groupBy('vr.status')
      .getRawMany<{ status: VerificationStatus; count: string }>();

    const byStatus = new Map<string, number>(
      rows.map((r) => [r.status, Number(r.count) || 0]),
    );

    return {
      code: HttpStatus.OK,
      message: 'Verification request stats fetched successfully',
      data: {
        total,
        draft: byStatus.get('DRAFT') ?? 0,
        inProgress: byStatus.get('IN_PROGRESS') ?? 0,
        reportGenerated: byStatus.get('REPORT_GENERATED') ?? 0,
        failed: byStatus.get('FAILED') ?? 0,
      },
    };
  }

  async createDigital(
    dto: UpsertDigitalVerificationDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<VerificationRequest>> {
    if (!user.clientId) throw new ForbiddenException('Client context missing');

    const entity = this.repo.create({
      clientId: user.clientId,
      client: { id: user.clientId } as any,
      loanApplicationNo: dto.loanApplicationNo ?? null,
      loanType: dto.loanType ?? null,
      applicantName: dto.applicantName ?? null,
      mobileNumber: dto.mobileNumber ?? null,
      emailId: dto.emailId ?? null,
      panNumber: dto.panNumber ?? null,
      address: dto.address ?? null,
      doDocumentVerification: !!dto.doDocumentVerification,
      status: this.computeStatus({
        doDocumentVerification: !!dto.doDocumentVerification,
      }),
    });
    const saved = await this.repo.save(entity);
    return {
      code: HttpStatus.CREATED,
      message: 'Digital verification saved',
      data: saved,
    };
  }

  async getById(
    id: string,
    user: AuthedUser,
  ): Promise<APIResponseInterface<VerificationRequest>> {
    const vr = await this.repo.findOne({ where: { id } });
    if (!vr) throw new NotFoundException('Verification request not found');
    if (user.role !== Role.SUPER_ADMIN && vr.clientId !== user.clientId) {
      throw new ForbiddenException('You can only view your client records');
    }
    return {
      code: HttpStatus.OK,
      message: 'Verification request fetched',
      data: vr,
    };
  }

  async updateDigital(
    id: string,
    dto: UpsertDigitalVerificationDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<VerificationRequest>> {
    const vr = await this.repo.findOne({ where: { id } });
    if (!vr) throw new NotFoundException('Verification request not found');
    if (user.role !== Role.SUPER_ADMIN && vr.clientId !== user.clientId) {
      throw new ForbiddenException('You can only update your client records');
    }

    if (dto.loanApplicationNo !== undefined)
      vr.loanApplicationNo = dto.loanApplicationNo ?? null;
    if (dto.loanType !== undefined) vr.loanType = dto.loanType ?? null;
    if (dto.applicantName !== undefined)
      vr.applicantName = dto.applicantName ?? null;
    if (dto.mobileNumber !== undefined)
      vr.mobileNumber = dto.mobileNumber ?? null;
    if (dto.emailId !== undefined) vr.emailId = dto.emailId ?? null;
    if (dto.panNumber !== undefined) vr.panNumber = dto.panNumber ?? null;
    if (dto.address !== undefined) vr.address = dto.address ?? null;
    if (dto.doDocumentVerification !== undefined) {
      vr.doDocumentVerification = !!dto.doDocumentVerification;
      if (!vr.doDocumentVerification) {
        // If they disable doc verification, keep existing payload but stop gating.
        vr.doPhysicalVerification = false;
      }
    }

    vr.status = this.computeStatus(vr);
    const saved = await this.repo.save(vr);
    return {
      code: HttpStatus.OK,
      message: 'Digital verification updated',
      data: saved,
    };
  }

  async updateDocument(
    id: string,
    dto: UpsertDocumentVerificationDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<VerificationRequest>> {
    const vr = await this.repo.findOne({ where: { id } });
    if (!vr) throw new NotFoundException('Verification request not found');
    if (user.role !== Role.SUPER_ADMIN && vr.clientId !== user.clientId) {
      throw new ForbiddenException('You can only update your client records');
    }

    if (dto.documentPayload !== undefined)
      vr.documentPayload = dto.documentPayload ?? null;
    if (dto.doPhysicalVerification !== undefined) {
      vr.doPhysicalVerification = !!dto.doPhysicalVerification;
    }

    vr.status = this.computeStatus(vr);
    const saved = await this.repo.save(vr);
    return {
      code: HttpStatus.OK,
      message: 'Document verification updated',
      data: saved,
    };
  }

  async updatePhysical(
    id: string,
    dto: UpsertPhysicalVerificationDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<VerificationRequest>> {
    const vr = await this.repo.findOne({ where: { id } });
    if (!vr) throw new NotFoundException('Verification request not found');
    if (user.role !== Role.SUPER_ADMIN && vr.clientId !== user.clientId) {
      throw new ForbiddenException('You can only update your client records');
    }

    if (dto.physicalPayload !== undefined)
      vr.physicalPayload = dto.physicalPayload ?? null;
    vr.status = this.computeStatus(vr);
    const saved = await this.repo.save(vr);
    return {
      code: HttpStatus.OK,
      message: 'Physical verification updated',
      data: saved,
    };
  }

  async generateReport(
    id: string,
    user: AuthedUser,
  ): Promise<APIResponseInterface<Record<string, unknown>>> {
    const vr = await this.repo.findOne({ where: { id } });
    if (!vr) throw new NotFoundException('Verification request not found');
    if (user.role !== Role.SUPER_ADMIN && vr.clientId !== user.clientId) {
      throw new ForbiddenException(
        'You can only generate reports for your client records',
      );
    }

    // Static mock data as provided (stored and returned as-is).
    const report: Record<string, unknown> = {
      reportId: 'KYC-2026-000123',
      generatedAt: '2026-03-18T11:45:00Z',
      applicant: {
        fullName: 'Vishal Kumar',
        mobile: '9876543210',
        email: 'vishal.kumar@gmail.com',
        address: 'Ahmedabad, Gujarat, India',
      },
      verification: {
        pan: {
          input: 'ABCDE1234F',
          masked: 'ABCDE****F',
          status: 'VERIFIED',
          isValid: true,
          nameOnPan: 'VISHAL KUMAR',
          category: 'Individual',
          panStatus: 'Active',
          aadhaarLinked: true,
          lastUpdated: '2026-03-18T11:42:10Z',
          source: 'Karza API',
          remarks: 'PAN is valid and active as per Income Tax records',
        },
        aadhaar: {
          input: '123412341234',
          masked: 'XXXX-XXXX-1234',
          status: 'VERIFIED',
          verificationType: 'OTP',
          isValid: true,
          nameOnAadhaar: 'VISHAL KUMAR',
          dob: '1995-08-15',
          gender: 'Male',
          mobileLinked: true,
          addressMatched: true,
          lastUpdated: '2026-03-18T11:43:20Z',
          source: 'Signzy API',
          remarks: 'Aadhaar verified successfully via OTP',
        },
        mobile: {
          input: '9876543210',
          status: 'VERIFIED',
          isValid: true,
          operator: 'Airtel',
          circle: 'Gujarat',
          country: 'India',
          isRoaming: false,
          isActive: true,
          verificationType: 'OTP',
          lastUpdated: '2026-03-18T11:41:05Z',
          source: 'IDfy API',
          remarks: 'Mobile number is active and OTP verified',
        },
        email: {
          input: 'vishal.kumar@gmail.com',
          status: 'VERIFIED',
          isValid: true,
          domain: 'gmail.com',
          isDisposable: false,
          isBusiness: false,
          smtpCheck: true,
          mxRecordFound: true,
          lastUpdated: '2026-03-18T11:41:30Z',
          source: 'Signzy API',
          remarks: 'Email is valid and reachable',
        },
      },
      consistencyCheck: {
        nameMatchAcrossDocuments: true,
        dobMatch: true,
        mobileLinkedToAadhaar: true,
        duplicateRecordFound: false,
      },
      riskAnalysis: {
        riskScore: 12,
        riskLevel: 'LOW',
        fraudFlags: [],
        remarks: 'No risk indicators detected',
      },
      summary: {
        panStatus: 'VERIFIED',
        aadhaarStatus: 'VERIFIED',
        mobileStatus: 'VERIFIED',
        emailStatus: 'VERIFIED',
        overallStatus: 'VERIFIED',
      },
      system: {
        providersUsed: ['Karza', 'Signzy', 'IDfy'],
        processingTimeMs: 1850,
        apiMode: 'SANDBOX',
        version: 'v1.0',
      },
    };

    vr.reportJson = report;
    vr.reportGeneratedAt = new Date();
    vr.status = 'REPORT_GENERATED';
    await this.repo.save(vr);

    return {
      code: HttpStatus.OK,
      message: 'Report generated successfully',
      data: report,
    };
  }

  async attachDocument(
    id: string,
    key: string,
    filename: string,
    originalName: string | undefined,
    user: AuthedUser,
  ): Promise<APIResponseInterface<{ url: string }>> {
    const allowed: Set<string> = new Set<DocKey>([
      'panCard',
      'aadhaarCard',
      'addressProof',
      'joiningLetter',
      'salarySlip',
      'ownershipDeed',
      'form16',
      'accountStatement',
      'passportPhoto',
    ]);

    if (!allowed.has(key)) {
      throw new ForbiddenException('Invalid document key');
    }

    const vr = await this.repo.findOne({ where: { id } });
    if (!vr) throw new NotFoundException('Verification request not found');
    if (user.role !== Role.SUPER_ADMIN && vr.clientId !== user.clientId) {
      throw new ForbiddenException('You can only update your client records');
    }

    const prefix = process.env.API_PREFIX || 'api';
    const url = `/${prefix}/verification-requests/documents/view/${filename}`;

    const current =
      (vr.documentPayload && typeof vr.documentPayload === 'object'
        ? (vr.documentPayload as Record<string, unknown>)
        : {}) ?? {};

    const existing = (current as any)[key];
    const existingObj =
      existing && typeof existing === 'object'
        ? (existing as Record<string, unknown>)
        : {};

    vr.documentPayload = {
      ...current,
      [key]: {
        ...existingObj,
        url,
        fileName: originalName || '',
      },
    };
    vr.status = this.computeStatus(vr);
    await this.repo.save(vr);

    return {
      code: HttpStatus.CREATED,
      message: 'Document uploaded successfully',
      data: { url },
    };
  }

  private computeStatus(input: Partial<VerificationRequest>): VerificationStatus {
    if (input.status === 'REPORT_GENERATED') return 'REPORT_GENERATED';
    if (input.status === 'FAILED') return 'FAILED';

    const hasDoc = !!input.doDocumentVerification;
    const hasDocPayload =
      input.documentPayload != null &&
      typeof input.documentPayload === 'object' &&
      Object.keys(input.documentPayload).length > 0;

    const hasPhysical = !!input.doPhysicalVerification;
    const hasPhysicalPayload =
      input.physicalPayload != null &&
      typeof input.physicalPayload === 'object' &&
      Object.keys(input.physicalPayload).length > 0;

    if (hasDoc || hasDocPayload || hasPhysical || hasPhysicalPayload) {
      return 'IN_PROGRESS';
    }
    return 'DRAFT';
  }
}
