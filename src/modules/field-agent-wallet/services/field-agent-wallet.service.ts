import {
  ForbiddenException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { FieldAgentWallet } from '../entities/field-agent-wallet.entity';
import { FieldAgentWalletTransaction } from '../entities/field-agent-wallet-transaction.entity';
import { ListWalletTransactionsQueryDto } from '../dto/list-wallet-transactions-query.dto';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';
import { Role } from '../../../common/enums/role.enum';
import { PHYSICAL_CASE_REWARD_AMOUNT } from '../constants';
import { PhysicalVerification } from '../../physical-verification/entities/physical-verification.entity';
import { PhysicalVerificationVisit } from '../../physical-verification/entities/physical-verification-visit.entity';
import { FieldAssistant } from '../../field-assistance/entities/field-assistant.entity';
import { User } from '../../user/entities/user.entity';

type AuthedUser = { role: Role; clientId?: string; sub?: string };

export interface WalletSummary {
  balance: number;
  totalEarned: number;
  completedCasesCount: number;
  thisMonthEarning: number;
  earningPerCase: number;
}

export interface WalletTransactionView {
  id: string;
  loanNo: string;
  customerName: string;
  product: string;
  location: string;
  rcuManager: string;
  completedDate: string;
  verificationType: string;
  amount: number;
  status: 'Credited';
  fieldAgentUserId?: string;
  fieldAgentName?: string;
}

export interface AgentWalletOverview {
  fieldAgentUserId: string;
  fieldAgentName: string;
  fieldAgentCode: string | null;
  balance: number;
  totalEarned: number;
  completedCasesCount: number;
  thisMonthEarning: number;
}

export interface FieldAgentDashboardStats {
  completedCases: number;
  pendingCases: number;
  monthEarning: number;
  walletBalance: number;
  earningPerCase: number;
}

@Injectable()
export class FieldAgentWalletService {
  constructor(
    @InjectRepository(FieldAgentWallet)
    private walletRepo: Repository<FieldAgentWallet>,
    @InjectRepository(FieldAgentWalletTransaction)
    private txRepo: Repository<FieldAgentWalletTransaction>,
    @InjectRepository(PhysicalVerification)
    private physicalRepo: Repository<PhysicalVerification>,
    @InjectRepository(FieldAssistant)
    private fieldAssistantRepo: Repository<FieldAssistant>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
  ) {}

  private toNumber(value: number | string | null | undefined): number {
    if (value == null) return 0;
    return Number(value) || 0;
  }

  private formatDate(date: Date): string {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private mapTransaction(tx: FieldAgentWalletTransaction): WalletTransactionView {
    return {
      id: tx.id,
      loanNo: tx.loanNo ?? '—',
      customerName: tx.customerName ?? '—',
      product: tx.product ?? '—',
      location: tx.location ?? '—',
      rcuManager: tx.rcuManager ?? '—',
      completedDate: this.formatDate(tx.completedAt),
      verificationType: tx.verificationType ?? '—',
      amount: this.toNumber(tx.amount),
      status: 'Credited',
      fieldAgentUserId: tx.fieldAgentUserId,
      fieldAgentName: tx.fieldAgentName ?? undefined,
    };
  }

  private monthStart(): Date {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  }

  private async getThisMonthEarning(fieldAgentUserId: string): Promise<number> {
    const result = await this.txRepo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'total')
      .where('tx.field_agent_user_id = :fieldAgentUserId', { fieldAgentUserId })
      .andWhere('tx.completed_at >= :monthStart', { monthStart: this.monthStart() })
      .getRawOne<{ total: string }>();
    return this.toNumber(result?.total);
  }

  private async getOrCreateWallet(
    fieldAgentUserId: string,
    fieldAgentName?: string | null,
    fieldAgentCode?: string | null,
  ): Promise<FieldAgentWallet> {
    let wallet = await this.walletRepo.findOne({ where: { fieldAgentUserId } });
    if (wallet) {
      if (fieldAgentName && !wallet.fieldAgentName) {
        wallet.fieldAgentName = fieldAgentName;
      }
      if (fieldAgentCode && !wallet.fieldAgentCode) {
        wallet.fieldAgentCode = fieldAgentCode;
      }
      if (fieldAgentName || fieldAgentCode) {
        wallet = await this.walletRepo.save(wallet);
      }
      return wallet;
    }

    wallet = this.walletRepo.create({
      fieldAgentUserId,
      fieldAgentName: fieldAgentName ?? null,
      fieldAgentCode: fieldAgentCode ?? null,
      balance: 0,
      totalEarned: 0,
      completedCasesCount: 0,
    });
    return this.walletRepo.save(wallet);
  }

  async creditForPhysicalCompletion(
    record: PhysicalVerification,
    visits: PhysicalVerificationVisit[] = [],
  ): Promise<void> {
    if (visits.length) {
      for (const visit of visits) {
        await this.creditAgentForVisit(record, visit);
      }
      return;
    }
    await this.creditAgentForVisit(record, null);
  }

  private async creditAgentForVisit(
    record: PhysicalVerification,
    visit: PhysicalVerificationVisit | null,
  ): Promise<void> {
    const agentUserId = visit?.assignedFieldAgentUserId ?? record.assignedFieldAgentUserId;
    if (!agentUserId) return;

    const existing = visit?.id
      ? await this.txRepo.findOne({ where: { physicalVerificationVisitId: visit.id } })
      : await this.txRepo.findOne({
          where: { physicalVerificationId: record.id, physicalVerificationVisitId: IsNull() },
        });
    if (existing) return;

    const agentUser = await this.userRepo.findOne({ where: { id: agentUserId } });
    const fieldAssistant = await this.fieldAssistantRepo.findOne({
      where: { userId: agentUserId },
    });

    const withClient = await this.physicalRepo.findOne({
      where: { id: record.id },
      relations: ['client'],
    });

    const agentName =
      visit?.assignedFieldAgentName?.trim() ||
      record.assignedFieldAgentName?.trim() ||
      agentUser?.fullName?.trim() ||
      agentUser?.email?.trim() ||
      'Field Agent';

    const wallet = await this.getOrCreateWallet(
      agentUserId,
      agentName,
      fieldAssistant?.fieldAgentId ?? null,
    );

    const tx = this.txRepo.create({
      fieldAgentUserId: agentUserId,
      fieldAgentName: agentName,
      physicalVerificationId: record.id,
      physicalVerificationVisitId: visit?.id ?? null,
      amount: PHYSICAL_CASE_REWARD_AMOUNT,
      status: 'CREDITED',
      loanNo: record.agreementNumber,
      customerName: record.customerName,
      product: record.product,
      location: visit?.addressSnapshot?.city ?? record.city,
      rcuManager: withClient?.client?.companyName ?? null,
      verificationType: record.physicalVerificationType,
      completedAt: record.reportGeneratedAt ?? new Date(),
    });
    await this.txRepo.save(tx);

    wallet.balance = this.toNumber(wallet.balance) + PHYSICAL_CASE_REWARD_AMOUNT;
    wallet.totalEarned = this.toNumber(wallet.totalEarned) + PHYSICAL_CASE_REWARD_AMOUNT;
    wallet.completedCasesCount = (wallet.completedCasesCount ?? 0) + 1;
    wallet.fieldAgentName = agentName;
    if (fieldAssistant?.fieldAgentId) {
      wallet.fieldAgentCode = fieldAssistant.fieldAgentId;
    }
    await this.walletRepo.save(wallet);
  }

  async getMySummary(user: AuthedUser): Promise<APIResponseInterface<WalletSummary>> {
    if (user.role !== Role.FIELD_AGENT || !user.sub) {
      throw new ForbiddenException('Only field agents can access wallet summary');
    }

    const wallet = await this.getOrCreateWallet(user.sub);
    const thisMonthEarning = await this.getThisMonthEarning(user.sub);

    return {
      code: HttpStatus.OK,
      message: 'Wallet summary fetched successfully',
      data: {
        balance: this.toNumber(wallet.balance),
        totalEarned: this.toNumber(wallet.totalEarned),
        completedCasesCount: wallet.completedCasesCount ?? 0,
        thisMonthEarning,
        earningPerCase: PHYSICAL_CASE_REWARD_AMOUNT,
      },
    };
  }

  async getMyDashboard(user: AuthedUser): Promise<APIResponseInterface<FieldAgentDashboardStats>> {
    if (user.role !== Role.FIELD_AGENT || !user.sub) {
      throw new ForbiddenException('Only field agents can access dashboard stats');
    }

    const wallet = await this.getOrCreateWallet(user.sub);
    const thisMonthEarning = await this.getThisMonthEarning(user.sub);

    const statusRows = await this.physicalRepo
      .createQueryBuilder('pv')
      .select('pv.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('pv.assigned_field_agent_user_id = :agentUserId', { agentUserId: user.sub })
      .groupBy('pv.status')
      .getRawMany<{ status: string; count: string }>();

    const byStatus = new Map(statusRows.map((r) => [r.status, Number(r.count) || 0]));
    const pendingCases =
      (byStatus.get('AGENT_ASSIGNED') ?? 0) +
      (byStatus.get('AGENT_DRAFT') ?? 0) +
      (byStatus.get('AGENT_SUBMITTED') ?? 0) +
      (byStatus.get('APPROVED') ?? 0);

    return {
      code: HttpStatus.OK,
      message: 'Field agent dashboard stats fetched successfully',
      data: {
        completedCases: wallet.completedCasesCount ?? 0,
        pendingCases,
        monthEarning: thisMonthEarning,
        walletBalance: this.toNumber(wallet.balance),
        earningPerCase: PHYSICAL_CASE_REWARD_AMOUNT,
      },
    };
  }

  async listTransactions(
    query: ListWalletTransactionsQueryDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<WalletTransactionView[]>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const skip = (page - 1) * limit;

    const qb = this.txRepo
      .createQueryBuilder('tx')
      .orderBy('tx.completed_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (user.role === Role.FIELD_AGENT) {
      if (!user.sub) throw new ForbiddenException('Field agent identity missing');
      qb.andWhere('tx.field_agent_user_id = :agentUserId', { agentUserId: user.sub });
    } else if (user.role === Role.SUPER_ADMIN) {
      if (query.fieldAgentUserId?.trim()) {
        qb.andWhere('tx.field_agent_user_id = :filterAgentId', {
          filterAgentId: query.fieldAgentUserId.trim(),
        });
      }
    } else {
      throw new ForbiddenException('Access denied');
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        `(tx.loan_no LIKE :term OR tx.customer_name LIKE :term OR tx.product LIKE :term
          OR tx.location LIKE :term OR tx.verification_type LIKE :term OR tx.field_agent_name LIKE :term)`,
        { term },
      );
    }

    const [rows, total] = await qb.getManyAndCount();

    return {
      code: HttpStatus.OK,
      message: 'Wallet transactions fetched successfully',
      data: rows.map((tx) => this.mapTransaction(tx)),
      pagination: { total, page, pagePerRecord: limit },
    };
  }

  async listAgentOverviews(user: AuthedUser): Promise<APIResponseInterface<AgentWalletOverview[]>> {
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can view agent wallet overview');
    }

    const agents = await this.userRepo.find({
      where: { role: Role.FIELD_AGENT },
      order: { fullName: 'ASC' },
    });

    const wallets = await this.walletRepo.find();
    const walletByUserId = new Map(wallets.map((w) => [w.fieldAgentUserId, w]));

    const monthStart = this.monthStart();
    const monthRows = await this.txRepo
      .createQueryBuilder('tx')
      .select('tx.field_agent_user_id', 'fieldAgentUserId')
      .addSelect('COALESCE(SUM(tx.amount), 0)', 'total')
      .where('tx.completed_at >= :monthStart', { monthStart })
      .groupBy('tx.field_agent_user_id')
      .getRawMany<{ fieldAgentUserId: string; total: string }>();
    const monthByAgent = new Map(monthRows.map((r) => [r.fieldAgentUserId, this.toNumber(r.total)]));

    const assistants = await this.fieldAssistantRepo.find();
    const codeByUserId = new Map(
      assistants.filter((a) => a.userId).map((a) => [a.userId as string, a.fieldAgentId]),
    );

    const data: AgentWalletOverview[] = await Promise.all(
      agents.map(async (agent) => {
        const wallet = walletByUserId.get(agent.id);
        const name = agent.fullName?.trim() || agent.email?.trim() || 'Field Agent';
        if (!wallet) {
          return {
            fieldAgentUserId: agent.id,
            fieldAgentName: name,
            fieldAgentCode: codeByUserId.get(agent.id) ?? null,
            balance: 0,
            totalEarned: 0,
            completedCasesCount: 0,
            thisMonthEarning: monthByAgent.get(agent.id) ?? 0,
          };
        }
        return {
          fieldAgentUserId: agent.id,
          fieldAgentName: wallet.fieldAgentName ?? name,
          fieldAgentCode: wallet.fieldAgentCode ?? codeByUserId.get(agent.id) ?? null,
          balance: this.toNumber(wallet.balance),
          totalEarned: this.toNumber(wallet.totalEarned),
          completedCasesCount: wallet.completedCasesCount ?? 0,
          thisMonthEarning: monthByAgent.get(agent.id) ?? 0,
        };
      }),
    );

    return {
      code: HttpStatus.OK,
      message: 'Agent wallet overview fetched successfully',
      data,
    };
  }

  async getAdminSummary(user: AuthedUser): Promise<
    APIResponseInterface<{
      totalAgents: number;
      totalCompletedCases: number;
      totalWalletBalance: number;
      totalEarned: number;
      thisMonthEarning: number;
      earningPerCase: number;
    }>
  > {
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can view wallet summary');
    }

    const wallets = await this.walletRepo.find();
    const totalWalletBalance = wallets.reduce((sum, w) => sum + this.toNumber(w.balance), 0);
    const totalEarned = wallets.reduce((sum, w) => sum + this.toNumber(w.totalEarned), 0);
    const totalCompletedCases = wallets.reduce((sum, w) => sum + (w.completedCasesCount ?? 0), 0);

    const monthResult = await this.txRepo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'total')
      .where('tx.completed_at >= :monthStart', { monthStart: this.monthStart() })
      .getRawOne<{ total: string }>();

    const totalAgents = await this.userRepo.count({ where: { role: Role.FIELD_AGENT } });

    return {
      code: HttpStatus.OK,
      message: 'Admin wallet summary fetched successfully',
      data: {
        totalAgents,
        totalCompletedCases,
        totalWalletBalance,
        totalEarned,
        thisMonthEarning: this.toNumber(monthResult?.total),
        earningPerCase: PHYSICAL_CASE_REWARD_AMOUNT,
      },
    };
  }
}
