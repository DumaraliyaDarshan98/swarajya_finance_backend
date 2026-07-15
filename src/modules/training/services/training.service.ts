import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { Training, TrainingTargetRole } from '../entities/training.entity';
import { UserTraining } from '../entities/user-training.entity';
import { TrainingCertificate } from '../entities/training-certificate.entity';
import { TrainingCompletionHistory } from '../entities/training-completion-history.entity';
import { SuperAdminSettings } from '../../super-admin-settings/entities/super-admin-settings.entity';
import { User } from '../../user/entities/user.entity';
import { Client } from '../../client/entities/client.entity';
import { FieldAssistant } from '../../field-assistance/entities/field-assistant.entity';
import { Role } from '../../../common/enums/role.enum';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';
import {
  CreateTrainingDto,
  UpdateTrainingDto,
  UpdateTrainingStatusDto,
} from '../dto/training.dto';

export const TRAINING_RESET_DURATION_KEY = 'TRAINING_RESET_DURATION_DAYS';
const DEFAULT_RESET_DAYS = 365;

export interface TrainingItemStatus {
  training: Training;
  isCompleted: boolean;
  completedAt: string | null;
  isCurrent: boolean;
  isLocked: boolean;
}

export interface TrainingGateStatus {
  required: boolean;
  /** True only after all videos completed AND certificate generated (valid). */
  completed: boolean;
  /** All videos marked done (certificate may still be pending). */
  allVideosCompleted: boolean;
  certificateGenerated: boolean;
  trainings: TrainingItemStatus[];
  /** Next video the user should watch (null when all videos done). */
  currentTraining: Training | null;
  /** @deprecated Prefer currentTraining — kept for older clients. */
  training: Training | null;
  userTraining: UserTraining | null;
  expiresAt: string | null;
  resetDurationDays: number;
  progress: { completed: number; total: number };
}

@Injectable()
export class TrainingService {
  constructor(
    @InjectRepository(Training)
    private readonly trainingRepo: Repository<Training>,
    @InjectRepository(UserTraining)
    private readonly userTrainingRepo: Repository<UserTraining>,
    @InjectRepository(TrainingCertificate)
    private readonly certificateRepo: Repository<TrainingCertificate>,
    @InjectRepository(TrainingCompletionHistory)
    private readonly historyRepo: Repository<TrainingCompletionHistory>,
    @InjectRepository(SuperAdminSettings)
    private readonly settingsRepo: Repository<SuperAdminSettings>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(FieldAssistant)
    private readonly fieldAssistantRepo: Repository<FieldAssistant>,
    @InjectRepository(Client)
    private readonly clientRepo: Repository<Client>,
  ) {}

  // ---------- Admin CRUD ----------

  async create(
    dto: CreateTrainingDto,
  ): Promise<APIResponseInterface<Training>> {
    const sortOrder =
      dto.sortOrder !== undefined
        ? dto.sortOrder
        : await this.nextSortOrder(dto.role);

    const entity = this.trainingRepo.create({
      role: dto.role,
      title: dto.title.trim(),
      videoUrl: dto.videoUrl.trim(),
      description: dto.description?.trim() || null,
      isActive: dto.isActive ?? true,
      sortOrder,
    });
    const saved = await this.trainingRepo.save(entity);
    return {
      code: HttpStatus.CREATED,
      message: 'Training created successfully',
      data: saved,
    };
  }

  async update(
    id: string,
    dto: UpdateTrainingDto,
  ): Promise<APIResponseInterface<Training>> {
    const row = await this.trainingRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Training not found');

    if (dto.role !== undefined) row.role = dto.role;
    if (dto.title !== undefined) row.title = dto.title.trim();
    if (dto.videoUrl !== undefined) row.videoUrl = dto.videoUrl.trim();
    if (dto.description !== undefined) {
      row.description = dto.description?.trim() || null;
    }
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;

    const saved = await this.trainingRepo.save(row);
    return {
      code: HttpStatus.OK,
      message: 'Training updated successfully',
      data: saved,
    };
  }

  async remove(id: string): Promise<APIResponseInterface<null>> {
    const row = await this.trainingRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Training not found');
    await this.trainingRepo.remove(row);
    return {
      code: HttpStatus.OK,
      message: 'Training deleted successfully',
      data: null,
    };
  }

  async list(role?: string): Promise<APIResponseInterface<Training[]>> {
    const where: any = {};
    if (role === 'FIELD_AGENT' || role === 'CLIENT_ADMIN') {
      where.role = role;
    }
    const rows = await this.trainingRepo.find({
      where,
      order: { role: 'ASC', sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return {
      code: HttpStatus.OK,
      message: 'Training list fetched successfully',
      data: rows,
    };
  }

  async findOne(id: string): Promise<APIResponseInterface<Training>> {
    const row = await this.trainingRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Training not found');
    return {
      code: HttpStatus.OK,
      message: 'Training fetched successfully',
      data: row,
    };
  }

  async changeStatus(
    id: string,
    dto: UpdateTrainingStatusDto,
  ): Promise<APIResponseInterface<Training>> {
    const row = await this.trainingRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Training not found');
    row.isActive = dto.isActive;
    const saved = await this.trainingRepo.save(row);
    return {
      code: HttpStatus.OK,
      message: `Training ${dto.isActive ? 'activated' : 'deactivated'} successfully`,
      data: saved,
    };
  }

  async getResetDuration(): Promise<
    APIResponseInterface<{ durationDays: number }>
  > {
    const days = await this.getResetDurationDays();
    return {
      code: HttpStatus.OK,
      message: 'Training reset duration fetched successfully',
      data: { durationDays: days },
    };
  }

  async updateResetDuration(
    durationDays: number,
  ): Promise<APIResponseInterface<{ durationDays: number }>> {
    const days = Number(durationDays);
    if (!Number.isFinite(days) || days < 1 || days > 3650) {
      throw new BadRequestException(
        'Training reset duration must be between 1 and 3650 days',
      );
    }

    let row = await this.settingsRepo.findOne({
      where: { key: TRAINING_RESET_DURATION_KEY },
    });
    if (!row) {
      row = this.settingsRepo.create({
        key: TRAINING_RESET_DURATION_KEY,
        value: String(Math.floor(days)),
        description:
          'Number of days after which user training expires and must be completed again',
        category: 'TRAINING',
        status: true,
      });
    } else {
      row.value = String(Math.floor(days));
      row.status = true;
      row.category = row.category || 'TRAINING';
      row.description =
        row.description ||
        'Number of days after which user training expires and must be completed again';
    }
    await this.settingsRepo.save(row);

    return {
      code: HttpStatus.OK,
      message: 'Training reset duration updated successfully',
      data: { durationDays: Math.floor(days) },
    };
  }

  // ---------- User flows ----------

  async getAssignedTraining(
    userId: string,
    role: string,
  ): Promise<APIResponseInterface<TrainingGateStatus>> {
    const status = await this.resolveTrainingStatus(userId, role);
    return {
      code: HttpStatus.OK,
      message: 'Assigned training status fetched successfully',
      data: status,
    };
  }

  async getTrainingStatusForLogin(
    userId: string,
    role: string,
  ): Promise<TrainingGateStatus> {
    return this.resolveTrainingStatus(userId, role);
  }

  /** Mark one video complete; unlocks the next video. Does not generate certificate. */
  async completeTraining(
    userId: string,
    role: string,
    trainingId: string,
  ): Promise<
    APIResponseInterface<{
      userTraining: UserTraining;
      status: TrainingGateStatus;
    }>
  > {
    if (role !== Role.FIELD_AGENT && role !== Role.CLIENT_ADMIN) {
      throw new BadRequestException('Training is not required for this role');
    }

    const trainings = await this.getActiveTrainingsForRole(
      role as TrainingTargetRole,
    );
    if (!trainings.length) {
      throw new BadRequestException('No active training assigned for your role');
    }

    const target = trainings.find((t) => t.id === trainingId);
    if (!target) {
      throw new BadRequestException('Training video not found for your role');
    }

    await this.applyExpiryResets(userId, trainings);

    const progressMap = await this.getUserProgressMap(
      userId,
      trainings.map((t) => t.id),
    );

    // Sequential: only current (first incomplete) video can be completed
    const current = trainings.find((t) => !progressMap.get(t.id)?.isCompleted);
    if (!current || current.id !== trainingId) {
      throw new BadRequestException(
        'Please complete the training videos in order',
      );
    }

    const now = new Date();
    let userTraining = progressMap.get(trainingId) || null;
    if (!userTraining) {
      userTraining = this.userTrainingRepo.create({
        userId,
        trainingId,
      });
    }
    userTraining.isCompleted = true;
    userTraining.completedAt = now;
    userTraining.expiresAt = null; // set when certificate is generated
    userTraining = await this.userTrainingRepo.save(userTraining);

    await this.historyRepo.save(
      this.historyRepo.create({
        userId,
        trainingId,
        certificateId: null,
        completedAt: now,
        expiresAt: null,
        resetReason: null,
      }),
    );

    const status = await this.resolveTrainingStatus(userId, role);
    return {
      code: HttpStatus.OK,
      message: status.allVideosCompleted
        ? 'All videos completed. You can generate your certificate now.'
        : 'Video completed. Next training unlocked.',
      data: { userTraining, status },
    };
  }

  /** Generate certificate only after all role videos are completed. */
  async generateCertificate(
    userId: string,
    role: string,
  ): Promise<
    APIResponseInterface<{
      certificate: TrainingCertificate;
      status: TrainingGateStatus;
    }>
  > {
    if (role !== Role.FIELD_AGENT && role !== Role.CLIENT_ADMIN) {
      throw new BadRequestException('Training is not required for this role');
    }

    const trainings = await this.getActiveTrainingsForRole(
      role as TrainingTargetRole,
    );
    if (!trainings.length) {
      throw new BadRequestException('No active training assigned for your role');
    }

    await this.applyExpiryResets(userId, trainings);

    const progressMap = await this.getUserProgressMap(
      userId,
      trainings.map((t) => t.id),
    );
    const allDone = trainings.every((t) => progressMap.get(t.id)?.isCompleted);
    if (!allDone) {
      throw new BadRequestException(
        'Complete all training videos before generating the certificate',
      );
    }

    const existingValid = await this.findValidCertificate(
      userId,
      trainings.map((t) => t.id),
    );
    if (existingValid) {
      throw new BadRequestException('Certificate already generated for this training');
    }

    const user = await this.userRepo.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('User not found');

    const resetDays = await this.getResetDurationDays();
    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setDate(expiresAt.getDate() + resetDays);

    for (const t of trainings) {
      const ut = progressMap.get(t.id);
      if (!ut) continue;
      ut.expiresAt = expiresAt;
      ut.completedAt = ut.completedAt || now;
      ut.isCompleted = true;
      await this.userTrainingRepo.save(ut);
    }

    const certificateNumber = this.buildCertificateNumber();
    const trainingTitle =
      trainings.length === 1
        ? trainings[0].title
        : `${this.roleLabel(role)} Training (${trainings.length} modules)`;

    const certificate = await this.certificateRepo.save(
      this.certificateRepo.create({
        userId,
        trainingId: trainings[0].id,
        userTrainingId: progressMap.get(trainings[0].id)?.id ?? null,
        certificateNumber,
        recipientName: user.fullName,
        trainingTitle,
        role,
        issuedAt: now,
        validUntil: expiresAt,
      }),
    );

    await this.historyRepo.save(
      this.historyRepo.create({
        userId,
        trainingId: trainings[0].id,
        certificateId: certificate.id,
        completedAt: now,
        expiresAt,
        resetReason: null,
      }),
    );

    const status = await this.resolveTrainingStatus(userId, role);
    return {
      code: HttpStatus.OK,
      message: 'Certificate generated successfully',
      data: { certificate, status },
    };
  }

  async getMyCertificates(
    userId: string,
  ): Promise<APIResponseInterface<TrainingCertificate[]>> {
    const rows = await this.certificateRepo.find({
      where: { userId },
      order: { issuedAt: 'DESC' },
    });
    return {
      code: HttpStatus.OK,
      message: 'Certificates fetched successfully',
      data: rows,
    };
  }

  async getCertificateById(
    userId: string,
    certificateId: string,
    isSuperAdmin = false,
  ): Promise<APIResponseInterface<TrainingCertificate>> {
    const row = await this.certificateRepo.findOne({
      where: isSuperAdmin
        ? { id: certificateId }
        : { id: certificateId, userId },
    });
    if (!row) throw new NotFoundException('Certificate not found');
    return {
      code: HttpStatus.OK,
      message: 'Certificate fetched successfully',
      data: row,
    };
  }

  /** Super Admin: certificates for a field agent (by field_assistants.id). */
  async getCertificatesByFieldAssistant(
    fieldAssistantId: string,
  ): Promise<
    APIResponseInterface<{
      subjectName: string;
      subjectType: 'FIELD_AGENT';
      certificates: Array<
        TrainingCertificate & { userName?: string; userEmail?: string }
      >;
    }>
  > {
    const fa = await this.fieldAssistantRepo.findOne({
      where: { id: fieldAssistantId },
    });
    if (!fa) throw new NotFoundException('Field agent not found');

    const subjectName =
      fa.fullName ||
      [fa.firstName, fa.middleName, fa.lastName].filter(Boolean).join(' ') ||
      fa.fieldAgentId ||
      'Field Agent';

    if (!fa.userId) {
      return {
        code: HttpStatus.OK,
        message: 'No login user linked to this field agent yet',
        data: { subjectName, subjectType: 'FIELD_AGENT', certificates: [] },
      };
    }

    const user = await this.userRepo.findOne({ where: { id: fa.userId } });
    const rows = await this.certificateRepo.find({
      where: { userId: fa.userId },
      order: { issuedAt: 'DESC' },
    });

    return {
      code: HttpStatus.OK,
      message: 'Certificates fetched successfully',
      data: {
        subjectName,
        subjectType: 'FIELD_AGENT',
        certificates: rows.map((c) => ({
          ...c,
          userName: user?.fullName,
          userEmail: user?.email,
        })),
      },
    };
  }

  /** Super Admin: certificates for CLIENT_ADMIN users belonging to a client. */
  async getCertificatesByClient(clientId: string): Promise<
    APIResponseInterface<{
      subjectName: string;
      subjectType: 'CLIENT';
      certificates: Array<
        TrainingCertificate & { userName?: string; userEmail?: string }
      >;
    }>
  > {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    if (!client) throw new NotFoundException('Client not found');

    const users = await this.userRepo
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.client', 'client')
      .where('client.id = :clientId', { clientId })
      .andWhere('user.role = :role', { role: Role.CLIENT_ADMIN })
      .getMany();

    const subjectName =
      client.companyName || client.bankVendorName || client.email || 'Client';

    if (!users.length) {
      return {
        code: HttpStatus.OK,
        message: 'No client admin users found for this client',
        data: { subjectName, subjectType: 'CLIENT', certificates: [] },
      };
    }

    const userIds = users.map((u) => u.id);
    const rows = await this.certificateRepo.find({
      where: { userId: In(userIds) },
      order: { issuedAt: 'DESC' },
    });

    const userMap = new Map(users.map((u) => [u.id, u]));
    return {
      code: HttpStatus.OK,
      message: 'Certificates fetched successfully',
      data: {
        subjectName,
        subjectType: 'CLIENT',
        certificates: rows.map((c) => {
          const u = userMap.get(c.userId);
          return {
            ...c,
            userName: u?.fullName,
            userEmail: u?.email,
          };
        }),
      },
    };
  }

  // ---------- Internals ----------

  private async resolveTrainingStatus(
    userId: string,
    role: string,
  ): Promise<TrainingGateStatus> {
    const resetDurationDays = await this.getResetDurationDays();
    const emptyProgress = { completed: 0, total: 0 };

    if (role !== Role.FIELD_AGENT && role !== Role.CLIENT_ADMIN) {
      return {
        required: false,
        completed: true,
        allVideosCompleted: true,
        certificateGenerated: false,
        trainings: [],
        currentTraining: null,
        training: null,
        userTraining: null,
        expiresAt: null,
        resetDurationDays,
        progress: emptyProgress,
      };
    }

    const trainings = await this.getActiveTrainingsForRole(
      role as TrainingTargetRole,
    );
    if (!trainings.length) {
      return {
        required: false,
        completed: true,
        allVideosCompleted: true,
        certificateGenerated: false,
        trainings: [],
        currentTraining: null,
        training: null,
        userTraining: null,
        expiresAt: null,
        resetDurationDays,
        progress: emptyProgress,
      };
    }

    await this.applyExpiryResets(userId, trainings);

    const progressMap = await this.getUserProgressMap(
      userId,
      trainings.map((t) => t.id),
    );

    let foundCurrent = false;
    const items: TrainingItemStatus[] = trainings.map((training) => {
      const ut = progressMap.get(training.id);
      const isCompleted = !!ut?.isCompleted;
      let isCurrent = false;
      let isLocked = false;
      if (!isCompleted) {
        if (!foundCurrent) {
          isCurrent = true;
          foundCurrent = true;
        } else {
          isLocked = true;
        }
      }
      return {
        training,
        isCompleted,
        completedAt: ut?.completedAt ? ut.completedAt.toISOString() : null,
        isCurrent,
        isLocked,
      };
    });

    const completedCount = items.filter((i) => i.isCompleted).length;
    const allVideosCompleted = completedCount === trainings.length;
    const currentTraining =
      items.find((i) => i.isCurrent)?.training ?? null;
    const currentUt = currentTraining
      ? progressMap.get(currentTraining.id) || null
      : null;

    const validCert = await this.findValidCertificate(
      userId,
      trainings.map((t) => t.id),
    );
    const certificateGenerated = !!validCert;

    // App unlocked only after certificate for this cycle
    const completed = allVideosCompleted && certificateGenerated;

    let expiresAt: string | null = null;
    if (validCert?.validUntil) {
      expiresAt = validCert.validUntil.toISOString();
    } else {
      for (const t of trainings) {
        const ut = progressMap.get(t.id);
        if (ut?.expiresAt) {
          expiresAt = ut.expiresAt.toISOString();
          break;
        }
      }
    }

    return {
      required: true,
      completed,
      allVideosCompleted,
      certificateGenerated,
      trainings: items,
      currentTraining,
      training: currentTraining,
      userTraining: currentUt,
      expiresAt,
      resetDurationDays,
      progress: { completed: completedCount, total: trainings.length },
    };
  }

  private async applyExpiryResets(
    userId: string,
    trainings: Training[],
  ): Promise<void> {
    if (!trainings.length) return;
    const ids = trainings.map((t) => t.id);
    const rows = await this.userTrainingRepo.find({
      where: { userId, trainingId: In(ids) },
    });
    const now = new Date();
    for (const userTraining of rows) {
      if (
        userTraining.isCompleted &&
        userTraining.expiresAt &&
        userTraining.expiresAt.getTime() <= now.getTime()
      ) {
        const expiredAt = userTraining.expiresAt;
        const completedAt = userTraining.completedAt || now;
        userTraining.isCompleted = false;
        userTraining.expiresAt = null;
        await this.userTrainingRepo.save(userTraining);
        await this.historyRepo.save(
          this.historyRepo.create({
            userId,
            trainingId: userTraining.trainingId,
            certificateId: null,
            completedAt,
            expiresAt: expiredAt,
            resetReason: 'DURATION_EXPIRED',
          }),
        );
      }
    }
  }

  private async getUserProgressMap(
    userId: string,
    trainingIds: string[],
  ): Promise<Map<string, UserTraining>> {
    const map = new Map<string, UserTraining>();
    if (!trainingIds.length) return map;
    const rows = await this.userTrainingRepo.find({
      where: { userId, trainingId: In(trainingIds) },
    });
    for (const row of rows) {
      map.set(row.trainingId, row);
    }
    return map;
  }

  private async findValidCertificate(
    userId: string,
    trainingIds: string[],
  ): Promise<TrainingCertificate | null> {
    if (!trainingIds.length) return null;
    const rows = await this.certificateRepo.find({
      where: { userId, trainingId: In(trainingIds) },
      order: { issuedAt: 'DESC' },
    });
    const now = Date.now();
    return (
      rows.find(
        (c) => !c.validUntil || c.validUntil.getTime() > now,
      ) || null
    );
  }

  private async getActiveTrainingsForRole(
    role: TrainingTargetRole,
  ): Promise<Training[]> {
    return this.trainingRepo.find({
      where: { role, isActive: true },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  private async nextSortOrder(role: TrainingTargetRole): Promise<number> {
    const last = await this.trainingRepo.findOne({
      where: { role },
      order: { sortOrder: 'DESC' },
    });
    return (last?.sortOrder ?? -1) + 1;
  }

  private async getResetDurationDays(): Promise<number> {
    const row = await this.settingsRepo.findOne({
      where: { key: TRAINING_RESET_DURATION_KEY },
    });
    if (!row || !row.status) return DEFAULT_RESET_DAYS;
    const n = Number(row.value);
    return Number.isFinite(n) && n > 0 ? Math.floor(n) : DEFAULT_RESET_DAYS;
  }

  private buildCertificateNumber(): string {
    const stamp = new Date()
      .toISOString()
      .replace(/[-:TZ.]/g, '')
      .slice(0, 14);
    const rand = Math.floor(Math.random() * 9000 + 1000);
    return `CERT-${stamp}-${rand}`;
  }

  private roleLabel(role: string): string {
    if (role === Role.FIELD_AGENT) return 'Field Agent';
    if (role === Role.CLIENT_ADMIN) return 'Client Admin';
    return role;
  }
}
