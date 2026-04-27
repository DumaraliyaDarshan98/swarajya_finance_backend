import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PhysicalVerificationRequest } from './entities/physical-verification-request.entity';
import { PhysicalVerificationStatusHistory } from './entities/physical-verification-status-history.entity';
import { PhysicalVerificationSelfie } from './entities/physical-verification-selfie.entity';
import { FieldAgentWallet } from './entities/field-agent-wallet.entity';
import { FieldAgentWalletTransaction } from './entities/field-agent-wallet-transaction.entity';
import { APIResponseInterface } from '../../interface/response.interface';
import { ListPhysicalRequestsQueryDto } from './dto/list-physical-requests.dto';
import { SuperAdminSettings } from '../super-admin-settings/entities/super-admin-settings.entity';
import { VerificationRequest } from '../verification/entities/verification-request.entity';

type AuthedUser = { role: string; clientId?: string; fieldAssistantId?: string; sub?: string };

const SETTING_PRICE_KEY = 'PHYSICAL_VERIFICATION_PRICE';

@Injectable()
export class PhysicalVerificationService {
  constructor(
    @InjectRepository(PhysicalVerificationRequest)
    private readonly reqRepo: Repository<PhysicalVerificationRequest>,
    @InjectRepository(PhysicalVerificationStatusHistory)
    private readonly histRepo: Repository<PhysicalVerificationStatusHistory>,
    @InjectRepository(PhysicalVerificationSelfie)
    private readonly selfieRepo: Repository<PhysicalVerificationSelfie>,
    @InjectRepository(FieldAgentWallet)
    private readonly walletRepo: Repository<FieldAgentWallet>,
    @InjectRepository(FieldAgentWalletTransaction)
    private readonly txnRepo: Repository<FieldAgentWalletTransaction>,
    @InjectRepository(SuperAdminSettings)
    private readonly settingsRepo: Repository<SuperAdminSettings>,
    @InjectRepository(VerificationRequest)
    private readonly verificationRepo: Repository<VerificationRequest>,
  ) {}

  async ensureForVerification(input: {
    verificationRequestId: string;
    clientId: string;
  }): Promise<PhysicalVerificationRequest> {
    const existing = await this.reqRepo.findOne({
      where: { verificationRequestId: input.verificationRequestId },
    });
    if (existing) return existing;

    const created = this.reqRepo.create({
      verificationRequestId: input.verificationRequestId,
      clientId: input.clientId,
      status: 'PENDING',
      pricePaise: 0,
    });
    const saved = await this.reqRepo.save(created);

    await this.histRepo.save(
      this.histRepo.create({
        requestId: saved.id,
        fromStatus: null,
        toStatus: 'PENDING',
        comment: 'Physical verification requested',
        changedByRole: 'SYSTEM',
        changedById: null,
      }),
    );

    return saved;
  }

  async listSuperAdmin(
    query: ListPhysicalRequestsQueryDto,
  ): Promise<APIResponseInterface<PhysicalVerificationRequest[]>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const skip = (page - 1) * limit;

    const qb = this.reqRepo
      .createQueryBuilder('pvr')
      .orderBy('pvr.updated_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (query.status) qb.andWhere('pvr.status = :status', { status: query.status });

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere('(pvr.verification_request_id LIKE :term)', { term });
    }

    const [list, total] = await qb.getManyAndCount();
    return {
      code: HttpStatus.OK,
      message: 'Physical verification requests fetched',
      data: list,
      pagination: { total, page, pagePerRecord: limit },
    };
  }

  async getDetailsSuperAdmin(
    id: string,
  ): Promise<APIResponseInterface<PhysicalVerificationRequest & { history: any[]; selfies: any[] }>> {
    const req = await this.reqRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Physical request not found');

    const history = await this.histRepo.find({
      where: { requestId: id },
      order: { createdAt: 'ASC' as any },
    });
    const selfies = await this.selfieRepo.find({
      where: { requestId: id },
      order: { createdAt: 'ASC' as any },
    });

    return {
      code: HttpStatus.OK,
      message: 'Physical request fetched',
      data: Object.assign(req, {
        history,
        selfies,
        verification: await this.verificationRepo.findOne({
          where: { id: req.verificationRequestId },
        }),
      }),
    };
  }

  private async getPricePaise(): Promise<number> {
    const row = await this.settingsRepo.findOne({ where: { key: SETTING_PRICE_KEY } });
    const priceInr = row?.value ? Number(row.value) : 50;
    return Math.max(0, Math.round((Number.isFinite(priceInr) ? priceInr : 50) * 100));
  }

  async assign(
    id: string,
    fieldAssistantId: string,
    comment: string | undefined,
    changedBy: AuthedUser,
    mode: 'ASSIGN' | 'REASSIGN',
  ): Promise<APIResponseInterface<PhysicalVerificationRequest>> {
    const req = await this.reqRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Physical request not found');

    const from = req.status;
    req.assignedFieldAssistantId = fieldAssistantId;
    req.status = mode === 'REASSIGN' ? 'REASSIGNED' : 'ASSIGNED';
    if (!req.pricePaise) req.pricePaise = await this.getPricePaise();

    const saved = await this.reqRepo.save(req);
    await this.histRepo.save(
      this.histRepo.create({
        requestId: saved.id,
        fromStatus: from,
        toStatus: saved.status,
        comment: comment ?? (mode === 'REASSIGN' ? 'Reassigned' : 'Assigned'),
        changedByRole: changedBy.role,
        changedById: changedBy.sub ?? null,
      }),
    );

    return {
      code: HttpStatus.OK,
      message: 'Request assigned',
      data: saved,
    };
  }

  async approveOrDecline(
    id: string,
    action: 'APPROVE' | 'DECLINE',
    comment: string | undefined,
    changedBy: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerificationRequest>> {
    const req = await this.reqRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Physical request not found');

    const from = req.status;
    req.status = action === 'APPROVE' ? 'APPROVED' : 'DECLINED';
    req.adminComment = comment ?? null;
    if (!req.pricePaise) req.pricePaise = await this.getPricePaise();

    const saved = await this.reqRepo.save(req);
    await this.histRepo.save(
      this.histRepo.create({
        requestId: saved.id,
        fromStatus: from,
        toStatus: saved.status,
        comment: comment ?? (action === 'APPROVE' ? 'Approved' : 'Declined'),
        changedByRole: changedBy.role,
        changedById: changedBy.sub ?? null,
      }),
    );

    if (action === 'APPROVE') {
      if (!saved.assignedFieldAssistantId) {
        throw new BadRequestException('Cannot approve without assigned field agent');
      }
      await this.creditWallet(saved.assignedFieldAssistantId, saved.pricePaise, saved.id);
    }

    return { code: HttpStatus.OK, message: 'Request updated', data: saved };
  }

  private async creditWallet(fieldAssistantId: string, amountPaise: number, requestId: string): Promise<void> {
    if (!amountPaise || amountPaise <= 0) return;

    let wallet = await this.walletRepo.findOne({ where: { fieldAssistantId } });
    if (!wallet) {
      wallet = await this.walletRepo.save(
        this.walletRepo.create({ fieldAssistantId, balancePaise: 0 }),
      );
    }

    wallet.balancePaise += amountPaise;
    await this.walletRepo.save(wallet);

    await this.txnRepo.save(
      this.txnRepo.create({
        walletId: wallet.id,
        fieldAssistantId,
        type: 'CREDIT',
        amountPaise,
        referenceType: 'PHYSICAL_REQUEST',
        referenceId: requestId,
        note: 'Physical verification payout',
      }),
    );
  }

  // ===== Field Agent APIs =====

  async listForFieldAgent(
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerificationRequest[]>> {
    const faId = user.fieldAssistantId || user.sub;
    if (!faId) throw new ForbiddenException('Field agent context missing');

    const list = await this.reqRepo.find({
      where: { assignedFieldAssistantId: faId },
      order: { updatedAt: 'DESC' as any },
    });
    return { code: HttpStatus.OK, message: 'Assigned requests fetched', data: list };
  }

  async getForFieldAgent(id: string, user: AuthedUser): Promise<APIResponseInterface<any>> {
    const faId = user.fieldAssistantId || user.sub;
    if (!faId) throw new ForbiddenException('Field agent context missing');

    const req = await this.reqRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Physical request not found');
    if (req.assignedFieldAssistantId !== faId) {
      throw new ForbiddenException('You can only view your assigned requests');
    }

    const history = await this.histRepo.find({
      where: { requestId: id },
      order: { createdAt: 'ASC' as any },
    });
    const selfies = await this.selfieRepo.find({
      where: { requestId: id },
      order: { createdAt: 'ASC' as any },
    });

    const verification = await this.verificationRepo.findOne({
      where: { id: req.verificationRequestId },
    });

    return {
      code: HttpStatus.OK,
      message: 'Request fetched',
      data: { ...req, history, selfies, verification },
    };
  }

  async savePhysicalDetailsForFieldAgent(
    id: string,
    input: { physicalPayload?: Record<string, unknown>; comment?: string; markVerified?: boolean },
    user: AuthedUser,
  ): Promise<APIResponseInterface<any>> {
    const faId = user.fieldAssistantId || user.sub;
    if (!faId) throw new ForbiddenException('Field agent context missing');

    const req = await this.reqRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Physical request not found');
    if (req.assignedFieldAssistantId !== faId) {
      throw new ForbiddenException('You can only update your assigned requests');
    }

    const verification = await this.verificationRepo.findOne({
      where: { id: req.verificationRequestId },
    });
    if (!verification) throw new NotFoundException('Verification request not found');

    if (input.physicalPayload !== undefined) {
      verification.physicalPayload = input.physicalPayload as any;
      await this.verificationRepo.save(verification);
    }

    const from = req.status;
    if (input.comment !== undefined) req.agentComment = input.comment ?? null;

    if (input.markVerified) {
      req.status = 'VERIFIED';
    }
    const saved = await this.reqRepo.save(req);

    if (input.markVerified || input.comment != null) {
      await this.histRepo.save(
        this.histRepo.create({
          requestId: saved.id,
          fromStatus: from,
          toStatus: saved.status,
          comment: input.comment ?? null,
          changedByRole: user.role,
          changedById: faId,
        }),
      );
    }

    return {
      code: HttpStatus.OK,
      message: 'Physical details saved',
      data: { request: saved, verification },
    };
  }

  async updateStatusForFieldAgent(
    id: string,
    status: 'IN_PROGRESS' | 'VERIFIED',
    comment: string | undefined,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerificationRequest>> {
    const faId = user.fieldAssistantId || user.sub;
    if (!faId) throw new ForbiddenException('Field agent context missing');

    const req = await this.reqRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Physical request not found');
    if (req.assignedFieldAssistantId !== faId) {
      throw new ForbiddenException('You can only update your assigned requests');
    }

    const from = req.status;
    if (status === 'IN_PROGRESS') {
      req.status = 'IN_PROGRESS';
    } else {
      req.status = 'VERIFIED';
    }
    req.agentComment = comment ?? null;
    const saved = await this.reqRepo.save(req);

    await this.histRepo.save(
      this.histRepo.create({
        requestId: saved.id,
        fromStatus: from,
        toStatus: saved.status,
        comment: comment ?? null,
        changedByRole: user.role,
        changedById: faId,
      }),
    );

    return { code: HttpStatus.OK, message: 'Status updated', data: saved };
  }

  async updateLocationForFieldAgent(
    id: string,
    loc: { lat: number; lng: number; accuracy?: number },
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerificationRequest>> {
    const faId = user.fieldAssistantId || user.sub;
    if (!faId) throw new ForbiddenException('Field agent context missing');

    const req = await this.reqRepo.findOne({ where: { id } });
    if (!req) throw new NotFoundException('Physical request not found');
    if (req.assignedFieldAssistantId !== faId) {
      throw new ForbiddenException('You can only update your assigned requests');
    }

    req.currentLocation = {
      lat: loc.lat,
      lng: loc.lng,
      accuracy: loc.accuracy ?? null,
      capturedAt: new Date().toISOString(),
    };
    const saved = await this.reqRepo.save(req);
    return { code: HttpStatus.OK, message: 'Location updated', data: saved };
  }

  async addSelfie(
    requestId: string,
    url: string,
    fileName: string | undefined,
    mime: string | undefined,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerificationSelfie>> {
    const faId = user.fieldAssistantId || user.sub;
    if (!faId) throw new ForbiddenException('Field agent context missing');

    const req = await this.reqRepo.findOne({ where: { id: requestId } });
    if (!req) throw new NotFoundException('Physical request not found');
    if (req.assignedFieldAssistantId !== faId) {
      throw new ForbiddenException('You can only update your assigned requests');
    }

    const entity = await this.selfieRepo.save(
      this.selfieRepo.create({
        requestId,
        url,
        fileName: fileName ?? null,
        mime: mime ?? null,
      }),
    );
    return { code: HttpStatus.CREATED, message: 'Selfie uploaded', data: entity };
  }

  async getWallet(fieldAssistantId: string): Promise<APIResponseInterface<any>> {
    let wallet = await this.walletRepo.findOne({ where: { fieldAssistantId } });
    if (!wallet) {
      wallet = await this.walletRepo.save(
        this.walletRepo.create({ fieldAssistantId, balancePaise: 0 }),
      );
    }

    const txns = await this.txnRepo.find({
      where: { fieldAssistantId },
      order: { createdAt: 'DESC' as any },
      take: 100,
    });
    return {
      code: HttpStatus.OK,
      message: 'Wallet fetched',
      data: { wallet, transactions: txns },
    };
  }
}

