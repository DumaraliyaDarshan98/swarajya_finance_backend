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
import { PhysicalVerification } from '../entities/physical-verification.entity';
import { PhysicalVerificationVisit } from '../entities/physical-verification-visit.entity';
import { PhysicalLog, PhysicalLogAction } from '../entities/physical-log.entity';
import { AssignFieldAgentDto } from '../dto/assign-field-agent.dto';
import { SaveVisitFieldAgentSubmissionDto } from '../dto/save-visit-field-agent-submission.dto';
import { UpdateAgentTrackingDto } from '../dto/update-agent-tracking.dto';
import { AdminReviewNoteDto, RejectPhysicalVerificationDto } from '../dto/admin-review.dto';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';
import { Role } from '../../../common/enums/role.enum';
import { User } from '../../user/entities/user.entity';
import { FieldAssistant } from '../../field-assistance/entities/field-assistant.entity';
import {
  allVisitsApproved,
  buildVisitsFromParent,
  rollupParentStatus,
} from '../helpers/visit-workflow.helper';
import { PHYSICAL_UPLOAD_DIR } from './physical-verification.service';

type AuthedUser = { role: Role; clientId?: string; sub?: string };
type UploadedFileLike = { buffer: Buffer; mimetype: string; originalname: string; size: number };

const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Injectable()
export class PhysicalVerificationVisitService {
  constructor(
    @InjectRepository(PhysicalVerification)
    private parentRepo: Repository<PhysicalVerification>,
    @InjectRepository(PhysicalVerificationVisit)
    private visitRepo: Repository<PhysicalVerificationVisit>,
    @InjectRepository(PhysicalLog)
    private logRepo: Repository<PhysicalLog>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    @InjectRepository(FieldAssistant)
    private fieldAssistantRepo: Repository<FieldAssistant>,
  ) {}

  async createVisitsForParent(
    parent: PhysicalVerification,
    userId?: string,
  ): Promise<PhysicalVerificationVisit[]> {
    const specs = buildVisitsFromParent(parent);
    if (!specs.length) {
      throw new BadRequestException('At least one address (residential or office) is required');
    }

    await this.visitRepo.delete({ physicalVerificationId: parent.id });

    const visits = specs.map((spec) =>
      this.visitRepo.create({
        physicalVerificationId: parent.id,
        addressType: spec.addressType,
        addressSnapshot: spec.addressSnapshot,
        status: 'IN_PROGRESS',
      }),
    );

    const saved = await this.visitRepo.save(visits);

    for (const visit of saved) {
      await this.addLog(
        parent.id,
        visit.id,
        'SUBMITTED',
        `${visit.addressType} address visit created for field verification`,
        userId,
        { addressType: visit.addressType },
      );
    }

    return saved;
  }

  async listVisitsForParent(
    parentId: string,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerificationVisit[]>> {
    await this.findParentOwned(parentId, user);
    const visits = await this.visitRepo.find({
      where: { physicalVerificationId: parentId },
      order: { addressType: 'ASC', createdAt: 'ASC' },
    });
    return {
      code: HttpStatus.OK,
      message: 'Physical verification visits fetched successfully',
      data: visits,
    };
  }

  async listAssignedVisits(
    user: AuthedUser,
    page = 1,
    limit = 10,
    search?: string,
  ): Promise<APIResponseInterface<PhysicalVerificationVisit[]>> {
    if (user.role !== Role.FIELD_AGENT || !user.sub) {
      throw new ForbiddenException('Only field agents can list assigned visits');
    }

    const skip = (page - 1) * limit;
    const qb = this.visitRepo
      .createQueryBuilder('v')
      .leftJoinAndSelect('v.parent', 'parent')
      .where('v.assigned_field_agent_user_id = :agentUserId', { agentUserId: user.sub })
      .orderBy('v.updatedAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (search?.trim()) {
      const term = `%${search.trim()}%`;
      qb.andWhere(
        `(parent.customer_name LIKE :term OR parent.agreement_number LIKE :term OR parent.mobile LIKE :term)`,
        { term },
      );
    }

    const [list, total] = await qb.getManyAndCount();
    return {
      code: HttpStatus.OK,
      message: 'Assigned visits fetched successfully',
      data: list,
      pagination: { total, page, pagePerRecord: limit },
    };
  }

  async getVisitById(
    visitId: string,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerificationVisit>> {
    const visit = await this.findVisitOwned(visitId, user);
    const parent = await this.parentRepo.findOne({
      where: { id: visit.physicalVerificationId },
      relations: ['client'],
    });
    return {
      code: HttpStatus.OK,
      message: 'Visit fetched successfully',
      data: { ...visit, parent: parent ?? undefined } as PhysicalVerificationVisit,
    };
  }

  async assignVisitAgent(
    visitId: string,
    dto: AssignFieldAgentDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerificationVisit>> {
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can assign field agents');
    }

    const visit = await this.visitRepo.findOne({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visit not found');

    const parent = await this.parentRepo.findOne({
      where: { id: visit.physicalVerificationId },
    });
    if (!parent) throw new NotFoundException('Parent case not found');
    if (parent.status === 'REPORT_GENERATED') {
      throw new BadRequestException('Parent case is already completed');
    }

    const agentUser = await this.userRepo.findOne({ where: { id: dto.fieldAgentUserId } });
    if (!agentUser || agentUser.role !== Role.FIELD_AGENT) {
      throw new BadRequestException('Selected user is not an active field agent');
    }

    const isReassign = ['AGENT_ASSIGNED', 'AGENT_DRAFT', 'AGENT_SUBMITTED', 'APPROVED', 'REJECTED'].includes(
      visit.status,
    );
    const previousAgentName = visit.assignedFieldAgentName;

    visit.assignedFieldAgentUserId = agentUser.id;
    visit.assignedFieldAgentName = agentUser.fullName?.trim() || agentUser.email;
    visit.assignedAt = new Date();
    visit.status = 'AGENT_ASSIGNED';
    visit.fieldAgentSubmission = null;
    visit.rejectionReason = null;
    visit.adminReviewNote = null;

    const saved = await this.visitRepo.save(visit);
    await this.syncParentFromVisits(visit.physicalVerificationId);

    const performerName = await this.resolvePerformerName(user.sub);
    const label = visit.addressType === 'RESIDENTIAL' ? 'Residential' : 'Office';
    await this.addLog(
      visit.physicalVerificationId,
      saved.id,
      isReassign ? 'AGENT_REASSIGNED' : 'AGENT_ASSIGNED',
      isReassign
        ? `${performerName ?? 'Super admin'} reassigned ${label} visit from ${previousAgentName ?? 'previous agent'} to ${saved.assignedFieldAgentName}`
        : `${performerName ?? 'Super admin'} assigned ${label} visit to ${saved.assignedFieldAgentName}`,
      user.sub,
      { addressType: saved.addressType, note: dto.note?.trim() || null },
    );

    return {
      code: HttpStatus.OK,
      message: isReassign ? 'Visit agent reassigned successfully' : 'Visit agent assigned successfully',
      data: saved,
    };
  }

  async saveVisitSubmission(
    visitId: string,
    dto: SaveVisitFieldAgentSubmissionDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerificationVisit>> {
    if (user.role !== Role.FIELD_AGENT) {
      throw new ForbiddenException('Only field agents can save verification details');
    }

    const visit = await this.findVisitOwned(visitId, user);
    this.assertVisitEditable(visit);

    const existing = visit.fieldAgentSubmission ?? {
      agentLocation: null,
      agentTracking: null,
      residential: null,
      office: null,
    };

    visit.fieldAgentSubmission = {
      ...existing,
      agentLocation: dto.agentLocation ?? existing.agentLocation,
      agentTracking: dto.agentTracking !== undefined ? dto.agentTracking : existing.agentTracking,
      residential:
        visit.addressType === 'RESIDENTIAL'
          ? (dto.residential !== undefined ? dto.residential : existing.residential)
          : null,
      office:
        visit.addressType === 'OFFICE'
          ? (dto.office !== undefined ? dto.office : existing.office)
          : null,
      savedAt: new Date().toISOString(),
    };
    visit.status = 'AGENT_DRAFT';
    const saved = await this.visitRepo.save(visit);
    await this.syncParentFromVisits(visit.physicalVerificationId);

    return {
      code: HttpStatus.OK,
      message: 'Verification draft saved successfully',
      data: saved,
    };
  }

  async submitVisitSubmission(
    visitId: string,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerificationVisit>> {
    if (user.role !== Role.FIELD_AGENT) {
      throw new ForbiddenException('Only field agents can submit verification details');
    }

    const visit = await this.findVisitOwned(visitId, user);
    this.assertVisitEditable(visit);
    if (!visit.fieldAgentSubmission) {
      throw new BadRequestException('Please save verification details before submitting');
    }

    visit.fieldAgentSubmission = {
      ...visit.fieldAgentSubmission,
      submittedAt: new Date().toISOString(),
    };
    visit.status = 'AGENT_SUBMITTED';
    const saved = await this.visitRepo.save(visit);
    await this.syncParentFromVisits(visit.physicalVerificationId);

    return {
      code: HttpStatus.OK,
      message: 'Verification details submitted successfully',
      data: saved,
    };
  }

  async updateVisitTracking(
    visitId: string,
    dto: UpdateAgentTrackingDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerificationVisit>> {
    const visit = await this.findVisitOwned(visitId, user);
    if (user.role === Role.FIELD_AGENT) {
      this.assertVisitEditable(visit);
    } else if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Not allowed to update agent tracking');
    }

    const capturedAt = dto.capturedAt ?? new Date().toISOString();
    const point = { latitude: String(dto.latitude), longitude: String(dto.longitude), capturedAt };
    const existing = visit.fieldAgentSubmission ?? {
      agentLocation: null,
      agentTracking: null,
      residential: null,
      office: null,
    };

    visit.fieldAgentSubmission = {
      ...existing,
      agentLocation: point,
      agentTracking: {
        isDriving: dto.isDriving ?? existing.agentTracking?.isDriving ?? false,
        destination:
          dto.destination ??
          existing.agentTracking?.destination ??
          (visit.addressType === 'RESIDENTIAL' ? 'residential' : 'office'),
        startedAt: existing.agentTracking?.startedAt,
        stoppedAt:
          dto.isDriving === false
            ? new Date().toISOString()
            : existing.agentTracking?.stoppedAt,
        routeHistory:
          dto.isDriving === false
            ? (existing.agentTracking?.routeHistory ?? [])
            : [...(existing.agentTracking?.routeHistory ?? []), point].slice(-100),
      },
    };

    if (user.role === Role.FIELD_AGENT && visit.status === 'AGENT_ASSIGNED') {
      visit.status = 'AGENT_DRAFT';
    }

    const saved = await this.visitRepo.save(visit);
    await this.syncParentFromVisits(visit.physicalVerificationId);
    return { code: HttpStatus.OK, message: 'Agent location updated', data: saved };
  }

  async startVisitTrip(
    visitId: string,
    dto: UpdateAgentTrackingDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerificationVisit>> {
    if (user.role !== Role.FIELD_AGENT) {
      throw new ForbiddenException('Only field agents can start a trip');
    }

    const visit = await this.findVisitOwned(visitId, user);
    if (visit.status !== 'AGENT_ASSIGNED') {
      throw new BadRequestException('Trip can only be started for newly assigned visits');
    }

    const capturedAt = dto.capturedAt ?? new Date().toISOString();
    const point = { latitude: String(dto.latitude), longitude: String(dto.longitude), capturedAt };
    const destination = visit.addressType === 'RESIDENTIAL' ? 'residential' : 'office';

    visit.fieldAgentSubmission = {
      agentLocation: point,
      agentTracking: {
        isDriving: true,
        destination,
        startedAt: capturedAt,
        routeHistory: [point],
      },
      residential: null,
      office: null,
    };
    visit.status = 'AGENT_DRAFT';

    const saved = await this.visitRepo.save(visit);
    await this.syncParentFromVisits(visit.physicalVerificationId);

    const performerName = await this.resolvePerformerName(user.sub);
    const label = visit.addressType === 'RESIDENTIAL' ? 'Residential' : 'Office';
    await this.addLog(
      visit.physicalVerificationId,
      saved.id,
      'TRIP_STARTED',
      `${performerName ?? 'Field agent'} started trip to ${label} address`,
      user.sub,
      { addressType: visit.addressType, latitude: point.latitude, longitude: point.longitude },
    );

    return {
      code: HttpStatus.OK,
      message: 'Trip started successfully',
      data: saved,
    };
  }

  async endVisitTrip(
    visitId: string,
    dto: UpdateAgentTrackingDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerificationVisit>> {
    if (user.role !== Role.FIELD_AGENT) {
      throw new ForbiddenException('Only field agents can end a trip');
    }

    const visit = await this.findVisitOwned(visitId, user);
    if (!visit.fieldAgentSubmission?.agentTracking?.isDriving) {
      throw new BadRequestException('No active trip to end');
    }

    const capturedAt = dto.capturedAt ?? new Date().toISOString();
    const point = { latitude: String(dto.latitude), longitude: String(dto.longitude), capturedAt };
    const existing = visit.fieldAgentSubmission;

    visit.fieldAgentSubmission = {
      ...existing,
      agentLocation: point,
      agentTracking: {
        ...existing.agentTracking!,
        isDriving: false,
        stoppedAt: capturedAt,
        routeHistory: [...(existing.agentTracking?.routeHistory ?? []), point].slice(-100),
      },
    };

    const saved = await this.visitRepo.save(visit);
    await this.syncParentFromVisits(visit.physicalVerificationId);

    const performerName = await this.resolvePerformerName(user.sub);
    await this.addLog(
      visit.physicalVerificationId,
      saved.id,
      'TRIP_ENDED',
      `${performerName ?? 'Field agent'} ended trip and opened verification form`,
      user.sub,
    );

    return {
      code: HttpStatus.OK,
      message: 'Trip ended successfully',
      data: saved,
    };
  }

  async declineVisitAssignment(
    visitId: string,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerificationVisit>> {
    if (user.role !== Role.FIELD_AGENT) {
      throw new ForbiddenException('Only field agents can decline assigned visits');
    }

    const visit = await this.findVisitOwned(visitId, user);
    if (!['AGENT_ASSIGNED', 'AGENT_DRAFT'].includes(visit.status)) {
      throw new BadRequestException('This visit cannot be removed from your list');
    }

    const agentName = visit.assignedFieldAgentName;
    visit.assignedFieldAgentUserId = null;
    visit.assignedFieldAgentName = null;
    visit.assignedAt = null;
    visit.fieldAgentSubmission = null;
    visit.rejectionReason = null;
    visit.adminReviewNote = null;
    visit.status = 'IN_PROGRESS';

    const saved = await this.visitRepo.save(visit);
    await this.syncParentFromVisits(visit.physicalVerificationId);

    const performerName = await this.resolvePerformerName(user.sub);
    const label = visit.addressType === 'RESIDENTIAL' ? 'Residential' : 'Office';
    await this.addLog(
      visit.physicalVerificationId,
      saved.id,
      'AGENT_DECLINED',
      `${performerName ?? agentName ?? 'Field agent'} removed ${label} visit from their assigned list`,
      user.sub,
      { addressType: visit.addressType },
    );

    return {
      code: HttpStatus.OK,
      message: 'Visit removed from your list successfully',
      data: saved,
    };
  }

  async approveVisit(
    visitId: string,
    dto: AdminReviewNoteDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerificationVisit>> {
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can approve visits');
    }
    const visit = await this.visitRepo.findOne({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visit not found');
    if (visit.status !== 'AGENT_SUBMITTED') {
      throw new BadRequestException('Only submitted visits can be approved');
    }
    visit.status = 'APPROVED';
    visit.adminReviewNote = dto.note?.trim() || null;
    visit.rejectionReason = null;
    const saved = await this.visitRepo.save(visit);
    await this.syncParentFromVisits(visit.physicalVerificationId);
    return { code: HttpStatus.OK, message: 'Visit approved successfully', data: saved };
  }

  async rejectVisit(
    visitId: string,
    dto: RejectPhysicalVerificationDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerificationVisit>> {
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can reject visits');
    }
    const visit = await this.visitRepo.findOne({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visit not found');
    if (!['AGENT_SUBMITTED', 'APPROVED'].includes(visit.status)) {
      throw new BadRequestException('Only submitted or approved visits can be rejected');
    }
    visit.status = 'REJECTED';
    visit.rejectionReason = dto.reason.trim();
    visit.adminReviewNote = dto.note?.trim() || null;
    const saved = await this.visitRepo.save(visit);
    await this.syncParentFromVisits(visit.physicalVerificationId);
    return { code: HttpStatus.OK, message: 'Visit rejected successfully', data: saved };
  }

  async uploadVisitFile(
    visitId: string,
    key: string,
    file: UploadedFileLike | undefined,
    user: AuthedUser,
  ): Promise<APIResponseInterface<{ key: string; url: string }>> {
    if (user.role !== Role.FIELD_AGENT) {
      throw new ForbiddenException('Only field agents can upload verification files');
    }
    if (!file?.buffer?.length) throw new BadRequestException('File is required');
    if (file.size > MAX_FILE_SIZE) throw new BadRequestException('File exceeds maximum size of 10MB');
    if (!file.mimetype || !ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException('Invalid file type');
    }

    const visit = await this.findVisitOwned(visitId, user);
    this.assertVisitEditable(visit);

    if (!existsSync(PHYSICAL_UPLOAD_DIR)) mkdirSync(PHYSICAL_UPLOAD_DIR, { recursive: true });
    const ext = extname(file.originalname || '') || '.bin';
    const storedFileName = `${visitId}-${key.replace(/[^a-zA-Z0-9._-]/g, '_')}-${randomUUID()}${ext}`;
    writeFileSync(join(PHYSICAL_UPLOAD_DIR, storedFileName), file.buffer);

    return {
      code: HttpStatus.OK,
      message: 'File uploaded successfully',
      data: { key, url: `/api/physical-verifications/files/view/${storedFileName}` },
    };
  }

  async syncParentFromVisits(parentId: string): Promise<PhysicalVerification> {
    const parent = await this.parentRepo.findOne({ where: { id: parentId } });
    if (!parent) throw new NotFoundException('Physical verification not found');
    const visits = await this.visitRepo.find({ where: { physicalVerificationId: parentId } });
    if (visits.length) {
      parent.status = rollupParentStatus(visits);
      return this.parentRepo.save(parent);
    }
    return parent;
  }

  async getVisitsForParentId(parentId: string): Promise<PhysicalVerificationVisit[]> {
    return this.visitRepo.find({
      where: { physicalVerificationId: parentId },
      order: { addressType: 'ASC', createdAt: 'ASC' },
    });
  }

  async assertAllVisitsApproved(parentId: string): Promise<PhysicalVerificationVisit[]> {
    const visits = await this.getVisitsForParentId(parentId);
    if (!visits.length) throw new BadRequestException('No address visits found for this case');
    if (!allVisitsApproved(visits)) {
      throw new BadRequestException('All address visits must be approved before generating report');
    }
    return visits;
  }

  private async findParentOwned(id: string, user: AuthedUser): Promise<PhysicalVerification> {
    const record = await this.parentRepo.findOne({ where: { id } });
    if (!record) throw new NotFoundException('Physical verification not found');
    if (user.role !== Role.SUPER_ADMIN && record.clientId !== user.clientId) {
      throw new ForbiddenException('You can only access your own client verifications');
    }
    return record;
  }

  private async findVisitOwned(visitId: string, user: AuthedUser): Promise<PhysicalVerificationVisit> {
    const visit = await this.visitRepo.findOne({ where: { id: visitId } });
    if (!visit) throw new NotFoundException('Visit not found');
    if (user.role === Role.FIELD_AGENT) {
      if (!user.sub || visit.assignedFieldAgentUserId !== user.sub) {
        throw new ForbiddenException('This visit is not assigned to you');
      }
      return visit;
    }
    const parent = await this.parentRepo.findOne({
      where: { id: visit.physicalVerificationId },
    });
    if (!parent) throw new NotFoundException('Parent case not found');
    if (user.role !== Role.SUPER_ADMIN && parent.clientId !== user.clientId) {
      throw new ForbiddenException('You can only access your own client verifications');
    }
    return visit;
  }

  private assertVisitEditable(visit: PhysicalVerificationVisit): void {
    if (!['AGENT_ASSIGNED', 'AGENT_DRAFT'].includes(visit.status)) {
      throw new BadRequestException('Visit submission is locked');
    }
  }

  private async resolvePerformerName(userId?: string): Promise<string | null> {
    if (!userId) return null;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    return user?.fullName?.trim() || user?.email?.trim() || null;
  }

  private async addLog(
    physicalVerificationId: string,
    visitId: string | null,
    action: PhysicalLogAction,
    message: string,
    performedByUserId?: string | null,
    metadata?: Record<string, unknown> | null,
  ): Promise<void> {
    const log = this.logRepo.create({
      physicalVerificationId,
      physicalVerificationVisitId: visitId,
      action,
      message,
      performedByUserId: performedByUserId ?? null,
      performedByName: await this.resolvePerformerName(performedByUserId ?? undefined),
      metadata: metadata ?? null,
    });
    await this.logRepo.save(log);
  }
}
