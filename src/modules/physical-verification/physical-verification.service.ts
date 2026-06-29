import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { join, extname } from 'path';
import { randomUUID } from 'crypto';
import { PhysicalVerification } from './entities/physical-verification.entity';
import { PhysicalLog, PhysicalLogAction } from './entities/physical-log.entity';
import { UpsertPhysicalVerificationDto } from './dto/upsert-physical-verification.dto';
import { ListPhysicalVerificationQueryDto } from './dto/list-physical-verification-query.dto';
import { AssignFieldAgentDto } from './dto/assign-field-agent.dto';
import { SaveFieldAgentSubmissionDto } from './dto/save-field-agent-submission.dto';
import { AdminReviewNoteDto, RejectPhysicalVerificationDto } from './dto/admin-review.dto';
import { APIResponseInterface } from '../../interface/response.interface';
import { Role } from '../../enum/role.enum';
import type {
  PhysicalPartyDetails,
  PhysicalVerificationStatus,
  DocumentTypeVerification,
} from './interfaces/physical-verification.interface';
import type { FieldAgentSubmission } from './interfaces/field-agent-submission.interface';
import { buildPhysicalReport } from './helpers/build-report.helper';
import { User } from '../user/entities/user.entity';
import { FieldAssistant } from '../field-assistance/entities/field-assistant.entity';
import { FieldAgentWalletService } from '../field-agent-wallet/field-agent-wallet.service';

type AuthedUser = { role: Role; clientId?: string; sub?: string };

export const PHYSICAL_UPLOAD_DIR = join(process.cwd(), 'uploads', 'physical-verifications');
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

type UploadedFileLike = { buffer: Buffer; mimetype: string; originalname: string; size: number };

const emptyParty = (): PhysicalPartyDetails => ({
  customerName: '',
  agreementNumber: '',
  product: '',
  mobile: '',
  alternateNumber: '',
  hasResidentialAddress: true,
  hasOfficeAddress: false,
  residential: { address: '', landmark: '', state: '', city: '', pincode: '' },
  office: { address: '', landmark: '', state: '', city: '', pincode: '', businessName: '' },
});

@Injectable()
export class PhysicalVerificationService {
  constructor(
    @InjectRepository(PhysicalVerification)
    private repo: Repository<PhysicalVerification>,
    @InjectRepository(PhysicalLog)
    private logRepo: Repository<PhysicalLog>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(FieldAssistant)
    private fieldAssistantRepo: Repository<FieldAssistant>,
    private fieldAgentWalletService: FieldAgentWalletService,
  ) {}

  private normalizeOptional(value?: string | null): string | null {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private mergeParty(
    base: PhysicalPartyDetails | null | undefined,
    dto?: Partial<PhysicalPartyDetails>,
  ): PhysicalPartyDetails {
    const current = base ?? emptyParty();
    if (!dto) return current;
    return {
      ...current,
      ...dto,
      residential: { ...current.residential, ...(dto.residential ?? {}) },
      office: { ...current.office, ...(dto.office ?? {}) },
    };
  }

  private syncSearchFields(record: PhysicalVerification): void {
    const a = record.applicant;
    record.agreementNumber = this.normalizeOptional(a?.agreementNumber);
    record.customerName = this.normalizeOptional(a?.customerName);
    record.product = this.normalizeOptional(a?.product);
    record.mobile = this.normalizeOptional(a?.mobile);
    record.city = this.normalizeOptional(a?.residential?.city);
  }

  private mapDtoToFields(
    dto: UpsertPhysicalVerificationDto,
    existing?: PhysicalVerification,
  ): Partial<PhysicalVerification> {
    const applicant = this.mergeParty(existing?.applicant, dto.applicant as any);
    const coApplicant = dto.hasCoApplicant
      ? this.mergeParty(existing?.coApplicant ?? emptyParty(), dto.coApplicant as any)
      : emptyParty();

    return {
      physicalVerificationType: this.normalizeOptional(dto.physicalVerificationType),
      fiType: this.normalizeOptional(dto.fiType),
      applicant,
      hasCoApplicant: !!dto.hasCoApplicant,
      coApplicant: dto.hasCoApplicant ? coApplicant : emptyParty(),
      completeRemark: this.normalizeOptional(dto.completeRemark),
      documentTypeVerifications: (dto.documentTypeVerifications ?? []) as DocumentTypeVerification[],
    };
  }

  private async findOwned(id: string, user: AuthedUser): Promise<PhysicalVerification> {
    const record = await this.repo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('Physical verification not found');
    }
    if (user.role === Role.FIELD_AGENT) {
      if (!user.sub || record.assignedFieldAgentUserId !== user.sub) {
        throw new ForbiddenException('This case is not assigned to you');
      }
      return record;
    }
    if (user.role !== Role.SUPER_ADMIN && record.clientId !== user.clientId) {
      throw new ForbiddenException('You can only access your own client verifications');
    }
    return record;
  }

  private async resolvePerformerName(userId?: string): Promise<string | null> {
    if (!userId) return null;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    return user?.fullName?.trim() || user?.email?.trim() || null;
  }

  private async addLog(
    physicalVerificationId: string,
    action: PhysicalLogAction,
    message: string,
    performedByUserId?: string | null,
    metadata?: Record<string, unknown> | null,
  ): Promise<void> {
    const performedByName = await this.resolvePerformerName(performedByUserId ?? undefined);
    const log = this.logRepo.create({
      physicalVerificationId,
      action,
      message,
      performedByUserId: performedByUserId ?? null,
      performedByName,
      metadata: metadata ?? null,
    });
    await this.logRepo.save(log);
  }

  async list(
    query: ListPhysicalVerificationQueryDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerification[]>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? 'updatedAt';
    const sortDir = query.sortDir ?? 'DESC';

    const qb = this.repo
      .createQueryBuilder('pv')
      .orderBy(`pv.${sortBy}`, sortDir as 'ASC' | 'DESC')
      .skip(skip)
      .take(limit);

    if (user.role === Role.FIELD_AGENT) {
      if (!user.sub) {
        throw new ForbiddenException('Field agent identity missing');
      }
      qb.andWhere('pv.assigned_field_agent_user_id = :agentUserId', {
        agentUserId: user.sub,
      });
    } else if (user.role === Role.SUPER_ADMIN) {
      qb.leftJoinAndSelect('pv.client', 'client');
      if (query.clientId?.trim()) {
        qb.andWhere('pv.client_id = :filterClientId', {
          filterClientId: query.clientId.trim(),
        });
      }
    } else {
      qb.andWhere('pv.client_id = :clientId', { clientId: user.clientId });
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        `(pv.agreement_number LIKE :term OR pv.customer_name LIKE :term OR pv.product LIKE :term
          OR pv.mobile LIKE :term OR pv.city LIKE :term OR pv.physical_verification_type LIKE :term
          OR pv.assigned_field_agent_name LIKE :term)`,
        { term },
      );
    }

    if (query.status) {
      qb.andWhere('pv.status = :status', { status: query.status });
    }
    if (query.physicalVerificationType?.trim()) {
      qb.andWhere('pv.physical_verification_type = :pvt', {
        pvt: query.physicalVerificationType.trim(),
      });
    }
    if (query.fiType?.trim()) {
      qb.andWhere('pv.fi_type = :fiType', { fiType: query.fiType.trim() });
    }

    const [list, total] = await qb.getManyAndCount();
    return {
      code: HttpStatus.OK,
      message: 'Physical verifications fetched successfully',
      data: list,
      pagination: { total, page, pagePerRecord: limit },
    };
  }

  private async assertFieldAgentEditable(record: PhysicalVerification): Promise<void> {
    if (!['AGENT_ASSIGNED', 'AGENT_DRAFT'].includes(record.status)) {
      throw new BadRequestException('Field agent submission is locked for this case');
    }
  }

  private mergeFieldAgentSubmission(
    record: PhysicalVerification,
    dto: SaveFieldAgentSubmissionDto,
  ): FieldAgentSubmission {
    const existing = record.fieldAgentSubmission ?? {
      agentLocation: null,
      verifyResidential: !!record.applicant?.hasResidentialAddress,
      verifyOffice: !!record.applicant?.hasOfficeAddress,
      residential: null,
      office: null,
    };

    return {
      ...existing,
      verifyResidential: dto.verifyResidential ?? existing.verifyResidential,
      verifyOffice: dto.verifyOffice ?? existing.verifyOffice,
      agentLocation: dto.agentLocation ?? existing.agentLocation,
      residential: dto.residential !== undefined ? dto.residential : existing.residential,
      office: dto.office !== undefined ? dto.office : existing.office,
      savedAt: new Date().toISOString(),
    };
  }

  private ensureUploadDir(): void {
    if (!existsSync(PHYSICAL_UPLOAD_DIR)) {
      mkdirSync(PHYSICAL_UPLOAD_DIR, { recursive: true });
    }
  }

  async stats(user: AuthedUser): Promise<
    APIResponseInterface<{
      total: number;
      draft: number;
      inProgress: number;
      agentAssigned: number;
      agentDraft: number;
      agentSubmitted: number;
      approved: number;
      rejected: number;
      reportGenerated: number;
      failed: number;
    }>
  > {
    const qb = this.repo
      .createQueryBuilder('pv')
      .select('pv.status', 'status')
      .addSelect('COUNT(*)', 'count');

    if (user.role === Role.FIELD_AGENT) {
      if (!user.sub) {
        throw new ForbiddenException('Field agent identity missing');
      }
      qb.where('pv.assigned_field_agent_user_id = :agentUserId', { agentUserId: user.sub });
    } else if (user.role !== Role.SUPER_ADMIN) {
      qb.where('pv.client_id = :clientId', { clientId: user.clientId });
    }

    const rows = await qb
      .groupBy('pv.status')
      .getRawMany<{ status: PhysicalVerificationStatus; count: string }>();

    const byStatus = new Map(rows.map((r) => [r.status, Number(r.count) || 0]));
    const total = [...byStatus.values()].reduce((a, b) => a + b, 0);

    return {
      code: HttpStatus.OK,
      message: 'Physical verification stats fetched successfully',
      data: {
        total,
        draft: byStatus.get('DRAFT') ?? 0,
        inProgress: byStatus.get('IN_PROGRESS') ?? 0,
        agentAssigned: byStatus.get('AGENT_ASSIGNED') ?? 0,
        agentDraft: byStatus.get('AGENT_DRAFT') ?? 0,
        agentSubmitted: byStatus.get('AGENT_SUBMITTED') ?? 0,
        approved: byStatus.get('APPROVED') ?? 0,
        rejected: byStatus.get('REJECTED') ?? 0,
        reportGenerated: byStatus.get('REPORT_GENERATED') ?? 0,
        failed: byStatus.get('FAILED') ?? 0,
      },
    };
  }

  async create(
    dto: UpsertPhysicalVerificationDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerification>> {
    if (!user.clientId) {
      throw new ForbiddenException('Client context missing');
    }

    const entity = this.repo.create({
      clientId: user.clientId,
      client: { id: user.clientId } as any,
      ...this.mapDtoToFields(dto),
      status: 'DRAFT',
      reportPayload: null,
      reportGeneratedAt: null,
    });
    this.syncSearchFields(entity);

    const saved = await this.repo.save(entity);
    await this.addLog(
      saved.id,
      'CREATED',
      'Physical verification case created',
      user.sub,
    );
    return {
      code: HttpStatus.CREATED,
      message: 'Physical verification created successfully',
      data: saved,
    };
  }

  async getById(
    id: string,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerification>> {
    const record = await this.findOwned(id, user);
    if (user.role === Role.SUPER_ADMIN) {
      const withClient = await this.repo.findOne({
        where: { id: record.id },
        relations: ['client'],
      });
      return {
        code: HttpStatus.OK,
        message: 'Physical verification fetched successfully',
        data: withClient ?? record,
      };
    }
    return {
      code: HttpStatus.OK,
      message: 'Physical verification fetched successfully',
      data: record,
    };
  }

  async getLogs(
    id: string,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalLog[]>> {
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can view activity logs');
    }
    await this.findOwned(id, user);
    const logs = await this.logRepo.find({
      where: { physicalVerificationId: id },
      order: { createdAt: 'DESC' },
    });
    return {
      code: HttpStatus.OK,
      message: 'Activity logs fetched successfully',
      data: logs,
    };
  }

  async update(
    id: string,
    dto: UpsertPhysicalVerificationDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerification>> {
    const record = await this.findOwned(id, user);
    if (record.status === 'REPORT_GENERATED') {
      throw new BadRequestException('Completed verifications cannot be edited');
    }
    Object.assign(record, this.mapDtoToFields(dto, record));
    this.syncSearchFields(record);
    const saved = await this.repo.save(record);
    return {
      code: HttpStatus.OK,
      message: 'Physical verification updated successfully',
      data: saved,
    };
  }

  async submit(
    id: string,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerification>> {
    const record = await this.findOwned(id, user);
    if (record.status === 'REPORT_GENERATED') {
      throw new BadRequestException('Verification is already completed');
    }
    if (['AGENT_ASSIGNED', 'AGENT_DRAFT', 'AGENT_SUBMITTED', 'APPROVED', 'REJECTED'].includes(record.status)) {
      throw new BadRequestException('Case is already in field agent workflow');
    }
    record.status = 'IN_PROGRESS';
    const saved = await this.repo.save(record);
    await this.addLog(
      saved.id,
      'SUBMITTED',
      'Case submitted for physical verification',
      user.sub,
    );
    return {
      code: HttpStatus.OK,
      message: 'Physical verification submitted for field processing',
      data: saved,
    };
  }

  async assignFieldAgent(
    id: string,
    dto: AssignFieldAgentDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerification>> {
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can assign field agents');
    }

    const record = await this.repo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('Physical verification not found');
    }
    if (
      ![
        'IN_PROGRESS',
        'AGENT_ASSIGNED',
        'AGENT_DRAFT',
        'AGENT_SUBMITTED',
        'APPROVED',
        'REJECTED',
      ].includes(record.status)
    ) {
      throw new BadRequestException(
        'Field agent can only be assigned when case is in progress or under review',
      );
    }

    const agentUser = await this.userRepo.findOne({
      where: { id: dto.fieldAgentUserId },
    });
    if (!agentUser || agentUser.role !== Role.FIELD_AGENT) {
      throw new BadRequestException('Selected user is not an active field agent');
    }

    const fieldAssistant = await this.fieldAssistantRepo.findOne({
      where: { userId: agentUser.id },
    });

    const isReassign = [
      'AGENT_ASSIGNED',
      'AGENT_DRAFT',
      'AGENT_SUBMITTED',
      'APPROVED',
      'REJECTED',
    ].includes(record.status);
    const previousAgentName = record.assignedFieldAgentName;

    record.assignedFieldAgentUserId = agentUser.id;
    record.assignedFieldAgentName = agentUser.fullName?.trim() || agentUser.email;
    record.assignedAt = new Date();
    record.status = 'AGENT_ASSIGNED';
    record.fieldAgentSubmission = null;
    record.rejectionReason = null;
    record.adminReviewNote = null;

    const saved = await this.repo.save(record);

    const performerName = await this.resolvePerformerName(user.sub);
    const agentLabel = saved.assignedFieldAgentName ?? 'field agent';
    const message = isReassign
      ? `${performerName ?? 'Super admin'} reassigned case from ${previousAgentName ?? 'previous agent'} to ${agentLabel}`
      : `${performerName ?? 'Super admin'} assigned case to field agent ${agentLabel}`;

    await this.addLog(
      saved.id,
      isReassign ? 'AGENT_REASSIGNED' : 'AGENT_ASSIGNED',
      message,
      user.sub,
      {
        fieldAgentUserId: agentUser.id,
        fieldAgentName: saved.assignedFieldAgentName,
        fieldAgentId: fieldAssistant?.fieldAgentId ?? null,
        note: dto.note?.trim() || null,
        previousAgentName: isReassign ? previousAgentName : null,
      },
    );

    return {
      code: HttpStatus.OK,
      message: isReassign
        ? 'Field agent reassigned successfully'
        : 'Field agent assigned successfully',
      data: saved,
    };
  }

  async uploadFieldFile(
    id: string,
    key: string,
    file: UploadedFileLike | undefined,
    user: AuthedUser,
  ): Promise<APIResponseInterface<{ key: string; url: string }>> {
    if (user.role !== Role.FIELD_AGENT) {
      throw new ForbiddenException('Only field agents can upload verification files');
    }
    if (!file?.buffer?.length) {
      throw new BadRequestException('File is required');
    }
    if (file.size > MAX_FILE_SIZE) {
      throw new BadRequestException('File exceeds maximum size of 10MB');
    }
    if (!file.mimetype || !ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type');
    }

    const record = await this.findOwned(id, user);
    await this.assertFieldAgentEditable(record);

    this.ensureUploadDir();
    const ext = extname(file.originalname || '') || '.bin';
    const storedFileName = `${id}-${key.replace(/[^a-zA-Z0-9._-]/g, '_')}-${randomUUID()}${ext}`;
    writeFileSync(join(PHYSICAL_UPLOAD_DIR, storedFileName), file.buffer);
    const url = `/api/physical-verifications/files/view/${storedFileName}`;

    return {
      code: HttpStatus.OK,
      message: 'File uploaded successfully',
      data: { key, url },
    };
  }

  async saveFieldAgentSubmission(
    id: string,
    dto: SaveFieldAgentSubmissionDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerification>> {
    if (user.role !== Role.FIELD_AGENT) {
      throw new ForbiddenException('Only field agents can save verification details');
    }

    const record = await this.findOwned(id, user);
    await this.assertFieldAgentEditable(record);

    record.fieldAgentSubmission = this.mergeFieldAgentSubmission(record, dto);
    record.status = 'AGENT_DRAFT';
    const saved = await this.repo.save(record);

    const performerName = await this.resolvePerformerName(user.sub);
    await this.addLog(
      saved.id,
      'AGENT_DRAFT_SAVED',
      `${performerName ?? 'Field agent'} saved verification draft`,
      user.sub,
    );

    return {
      code: HttpStatus.OK,
      message: 'Verification draft saved successfully',
      data: saved,
    };
  }

  async submitFieldAgentSubmission(
    id: string,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerification>> {
    if (user.role !== Role.FIELD_AGENT) {
      throw new ForbiddenException('Only field agents can submit verification details');
    }

    const record = await this.findOwned(id, user);
    await this.assertFieldAgentEditable(record);

    if (!record.fieldAgentSubmission) {
      throw new BadRequestException('Please save verification details before submitting');
    }

    record.fieldAgentSubmission = {
      ...record.fieldAgentSubmission,
      submittedAt: new Date().toISOString(),
    };
    record.status = 'AGENT_SUBMITTED';
    const saved = await this.repo.save(record);

    const performerName = await this.resolvePerformerName(user.sub);
    await this.addLog(
      saved.id,
      'AGENT_SUBMITTED',
      `${performerName ?? 'Field agent'} submitted field verification details`,
      user.sub,
    );

    return {
      code: HttpStatus.OK,
      message: 'Verification details submitted successfully',
      data: saved,
    };
  }

  async approve(
    id: string,
    dto: AdminReviewNoteDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerification>> {
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can approve verifications');
    }

    const record = await this.repo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Physical verification not found');
    if (record.status !== 'AGENT_SUBMITTED') {
      throw new BadRequestException('Only submitted agent verifications can be approved');
    }

    record.status = 'APPROVED';
    record.adminReviewNote = dto.note?.trim() || null;
    record.rejectionReason = null;
    const saved = await this.repo.save(record);

    const performerName = await this.resolvePerformerName(user.sub);
    await this.addLog(
      saved.id,
      'APPROVED',
      `${performerName ?? 'Super admin'} approved field agent verification`,
      user.sub,
      { note: dto.note?.trim() || null },
    );

    return {
      code: HttpStatus.OK,
      message: 'Physical verification approved successfully',
      data: saved,
    };
  }

  async reject(
    id: string,
    dto: RejectPhysicalVerificationDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerification>> {
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can reject verifications');
    }

    const record = await this.repo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Physical verification not found');
    if (!['AGENT_SUBMITTED', 'APPROVED'].includes(record.status)) {
      throw new BadRequestException('Only submitted or approved verifications can be rejected');
    }

    record.status = 'REJECTED';
    record.rejectionReason = dto.reason.trim();
    record.adminReviewNote = dto.note?.trim() || null;
    const saved = await this.repo.save(record);

    const performerName = await this.resolvePerformerName(user.sub);
    await this.addLog(
      saved.id,
      'REJECTED',
      `${performerName ?? 'Super admin'} rejected field agent verification: ${dto.reason.trim()}`,
      user.sub,
      { reason: dto.reason.trim(), note: dto.note?.trim() || null },
    );

    return {
      code: HttpStatus.OK,
      message: 'Physical verification rejected successfully',
      data: saved,
    };
  }

  async complete(
    id: string,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerification>> {
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can complete and generate report');
    }

    const record = await this.repo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Physical verification not found');
    if (record.status === 'REPORT_GENERATED') {
      return {
        code: HttpStatus.OK,
        message: 'Physical verification already completed',
        data: record,
      };
    }

    if (!['AGENT_SUBMITTED', 'APPROVED'].includes(record.status)) {
      throw new BadRequestException(
        'Case must be submitted by field agent or approved before completion',
      );
    }

    record.reportPayload = buildPhysicalReport(record);
    record.status = 'REPORT_GENERATED';
    record.reportGeneratedAt = new Date();
    const saved = await this.repo.save(record);

    await this.fieldAgentWalletService.creditForPhysicalCompletion(saved);

    const performerName = await this.resolvePerformerName(user.sub);
    await this.addLog(
      saved.id,
      'COMPLETED',
      `${performerName ?? 'Super admin'} completed physical verification and generated report`,
      user.sub,
    );

    return {
      code: HttpStatus.OK,
      message: 'Physical verification completed successfully',
      data: saved,
    };
  }

  async delete(id: string, user: AuthedUser): Promise<APIResponseInterface<null>> {
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can delete verifications');
    }
    const record = await this.repo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('Physical verification not found');
    }
    await this.repo.remove(record);
    return {
      code: HttpStatus.OK,
      message: 'Physical verification deleted successfully',
      data: null,
    };
  }
}
