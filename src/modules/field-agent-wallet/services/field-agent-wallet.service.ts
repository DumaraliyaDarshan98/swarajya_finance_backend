import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, IsNull, Repository } from 'typeorm';
import { FieldAgentWallet } from '../entities/field-agent-wallet.entity';
import { FieldAgentWalletTransaction } from '../entities/field-agent-wallet-transaction.entity';
import {
  FieldAgentWithdrawalRequest,
  WithdrawalRequestStatus,
} from '../entities/field-agent-withdrawal-request.entity';
import { ListWalletTransactionsQueryDto } from '../dto/list-wallet-transactions-query.dto';
import { CreateWithdrawalDto } from '../dto/create-withdrawal.dto';
import { ListWithdrawalsQueryDto } from '../dto/list-withdrawals-query.dto';
import { ReviewWithdrawalDto } from '../dto/review-withdrawal.dto';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';
import { Role } from '../../../common/enums/role.enum';
import { PHYSICAL_CASE_REWARD_AMOUNT } from '../constants';
import { PhysicalVerification } from '../../physical-verification/entities/physical-verification.entity';
import { PhysicalVerificationVisit } from '../../physical-verification/entities/physical-verification-visit.entity';
import { FieldAssistant } from '../../field-assistance/entities/field-assistant.entity';
import { FieldAssistantBankAccount } from '../../field-assistance/entities/field-assistant-bank-account.entity';
import { User } from '../../user/entities/user.entity';
import { MailService } from '../../mail/services/mail.service';

type AuthedUser = { role: Role; clientId?: string; sub?: string };

export interface WalletBankAccountView {
  id: string;
  bankName: string;
  accountNumber: string;
  accountType: string | null;
  branch: string | null;
  ifsc: string;
  upiId: string | null;
  status: 'Active' | 'Inactive';
}

export interface WalletSummary {
  balance: number;
  reservedBalance: number;
  availableBalance: number;
  totalWithdrawn: number;
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
  reservedBalance: number;
  availableBalance: number;
  totalWithdrawn: number;
  totalEarned: number;
  completedCasesCount: number;
  thisMonthEarning: number;
}

export interface FieldAgentDashboardStats {
  completedCases: number;
  pendingCases: number;
  monthEarning: number;
  walletBalance: number;
  reservedBalance: number;
  earningPerCase: number;
}

export interface WithdrawalRequestView {
  id: string;
  fieldAgentUserId: string;
  fieldAgentName: string;
  fieldAgentCode: string | null;
  fieldAgentEmail: string | null;
  amount: number;
  status: WithdrawalRequestStatus;
  remarks: string | null;
  adminRemarks: string | null;
  reviewedAt: string | null;
  createdAt: string;
  account: {
    id: string | null;
    bankName: string;
    accountNumber: string;
    accountType: string | null;
    branch: string | null;
    ifsc: string;
    upiId: string | null;
  };
}

@Injectable()
export class FieldAgentWalletService {
  constructor(
    @InjectRepository(FieldAgentWallet)
    private walletRepo: Repository<FieldAgentWallet>,
    @InjectRepository(FieldAgentWalletTransaction)
    private txRepo: Repository<FieldAgentWalletTransaction>,
    @InjectRepository(FieldAgentWithdrawalRequest)
    private withdrawalRepo: Repository<FieldAgentWithdrawalRequest>,
    @InjectRepository(PhysicalVerification)
    private physicalRepo: Repository<PhysicalVerification>,
    @InjectRepository(FieldAssistant)
    private fieldAssistantRepo: Repository<FieldAssistant>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private dataSource: DataSource,
    private mailService: MailService,
  ) {}

  private toNumber(value: number | string | null | undefined): number {
    if (value == null) return 0;
    return Number(value) || 0;
  }

  private roundMoney(value: number): number {
    return Math.round((Number(value) || 0) * 100) / 100;
  }

  private availableBalance(wallet: FieldAgentWallet): number {
    const available =
      this.toNumber(wallet.balance) - this.toNumber(wallet.reservedBalance);
    return this.roundMoney(Math.max(0, available));
  }

  private formatDate(date: Date): string {
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
  }

  private formatDateTime(date: Date | null | undefined): string | null {
    if (!date) return null;
    const d = new Date(date);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} ${hours}:${minutes}`;
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

  private mapBankAccount(account: FieldAssistantBankAccount): WalletBankAccountView {
    return {
      id: account.id,
      bankName: account.bankName,
      accountNumber: account.accountNumber,
      accountType: account.accountType ?? null,
      branch: account.branch ?? null,
      ifsc: account.ifsc,
      upiId: account.upiId ?? null,
      status: account.status,
    };
  }

  private mapWithdrawal(row: FieldAgentWithdrawalRequest): WithdrawalRequestView {
    return {
      id: row.id,
      fieldAgentUserId: row.fieldAgentUserId,
      fieldAgentName: row.fieldAgentName ?? 'Field Agent',
      fieldAgentCode: row.fieldAgentCode ?? null,
      fieldAgentEmail: row.fieldAgentEmail ?? null,
      amount: this.toNumber(row.amount),
      status: row.status,
      remarks: row.remarks ?? null,
      adminRemarks: row.adminRemarks ?? null,
      reviewedAt: this.formatDateTime(row.reviewedAt),
      createdAt: this.formatDateTime(row.createdAt) ?? '',
      account: {
        id: row.bankAccountId ?? null,
        bankName: row.bankName,
        accountNumber: row.accountNumber,
        accountType: row.accountType ?? null,
        branch: row.branch ?? null,
        ifsc: row.ifsc,
        upiId: row.upiId ?? null,
      },
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
      .andWhere('tx.status = :status', { status: 'CREDITED' })
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
      reservedBalance: 0,
      totalWithdrawn: 0,
      totalEarned: 0,
      completedCasesCount: 0,
    });
    return this.walletRepo.save(wallet);
  }

  private resolveAgentEmail(user?: User | null, assistant?: FieldAssistant | null): string | null {
    return (
      user?.email?.trim() ||
      assistant?.officeEmailId?.trim() ||
      assistant?.personalEmailId?.trim() ||
      null
    );
  }

  private async sendReviewEmail(
    request: FieldAgentWithdrawalRequest,
    decision: 'APPROVED' | 'REJECTED',
  ): Promise<void> {
    const email = request.fieldAgentEmail?.trim();
    if (!email) return;

    const name = request.fieldAgentName?.trim() || 'Field Agent';
    const amount = this.toNumber(request.amount);

    try {
      if (decision === 'APPROVED') {
        await this.mailService.sendFieldAgentWithdrawalApproved({
          email,
          name,
          amount,
          requestId: request.id,
          bankName: request.bankName,
          accountNumber: request.accountNumber,
          ifsc: request.ifsc,
          adminRemarks: request.adminRemarks,
        });
      } else {
        await this.mailService.sendFieldAgentWithdrawalRejected({
          email,
          name,
          amount,
          requestId: request.id,
          adminRemarks: request.adminRemarks,
        });
      }
    } catch {
      // Mail failure should not roll back the wallet decision.
    }
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
    const reservedBalance = this.roundMoney(this.toNumber(wallet.reservedBalance));
    const balance = this.roundMoney(this.toNumber(wallet.balance));

    return {
      code: HttpStatus.OK,
      message: 'Wallet summary fetched successfully',
      data: {
        balance,
        reservedBalance,
        availableBalance: this.availableBalance(wallet),
        totalWithdrawn: this.roundMoney(this.toNumber(wallet.totalWithdrawn)),
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
        walletBalance: this.availableBalance(wallet),
        reservedBalance: this.roundMoney(this.toNumber(wallet.reservedBalance)),
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
      .where('tx.status = :status', { status: 'CREDITED' })
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

    if (query.verificationType?.trim()) {
      qb.andWhere('tx.verification_type LIKE :verificationType', {
        verificationType: `%${query.verificationType.trim()}%`,
      });
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
      .andWhere('tx.status = :status', { status: 'CREDITED' })
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
            reservedBalance: 0,
            availableBalance: 0,
            totalWithdrawn: 0,
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
          reservedBalance: this.toNumber(wallet.reservedBalance),
          availableBalance: this.availableBalance(wallet),
          totalWithdrawn: this.toNumber(wallet.totalWithdrawn),
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

  async getAdminAgentOverview(
    fieldAgentUserId: string,
    user: AuthedUser,
  ): Promise<APIResponseInterface<AgentWalletOverview>> {
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can view agent wallet overview');
    }

    const agent = await this.userRepo.findOne({ where: { id: fieldAgentUserId, role: Role.FIELD_AGENT } });
    if (!agent) {
      throw new NotFoundException('Field agent not found');
    }

    const wallet = await this.getOrCreateWallet(fieldAgentUserId);
    const assistant = await this.fieldAssistantRepo.findOne({ where: { userId: fieldAgentUserId } });
    const name = wallet.fieldAgentName?.trim() || agent.fullName?.trim() || agent.email?.trim() || 'Field Agent';

    return {
      code: HttpStatus.OK,
      message: 'Agent wallet fetched successfully',
      data: {
        fieldAgentUserId,
        fieldAgentName: name,
        fieldAgentCode: wallet.fieldAgentCode ?? assistant?.fieldAgentId ?? null,
        balance: this.toNumber(wallet.balance),
        reservedBalance: this.toNumber(wallet.reservedBalance),
        availableBalance: this.availableBalance(wallet),
        totalWithdrawn: this.toNumber(wallet.totalWithdrawn),
        totalEarned: this.toNumber(wallet.totalEarned),
        completedCasesCount: wallet.completedCasesCount ?? 0,
        thisMonthEarning: await this.getThisMonthEarning(fieldAgentUserId),
      },
    };
  }

  async getAdminSummary(user: AuthedUser): Promise<
    APIResponseInterface<{
      totalAgents: number;
      totalCompletedCases: number;
      totalWalletBalance: number;
      totalReservedBalance: number;
      totalAvailableBalance: number;
      totalWithdrawn: number;
      totalEarned: number;
      thisMonthEarning: number;
      earningPerCase: number;
      pendingWithdrawals: number;
    }>
  > {
    if (user.role !== Role.SUPER_ADMIN) {
      throw new ForbiddenException('Only super admin can view wallet summary');
    }

    const wallets = await this.walletRepo.find();
    const totalWalletBalance = wallets.reduce((sum, w) => sum + this.toNumber(w.balance), 0);
    const totalReservedBalance = wallets.reduce(
      (sum, w) => sum + this.toNumber(w.reservedBalance),
      0,
    );
    const totalWithdrawn = wallets.reduce((sum, w) => sum + this.toNumber(w.totalWithdrawn), 0);
    const totalEarned = wallets.reduce((sum, w) => sum + this.toNumber(w.totalEarned), 0);
    const totalCompletedCases = wallets.reduce((sum, w) => sum + (w.completedCasesCount ?? 0), 0);

    const monthResult = await this.txRepo
      .createQueryBuilder('tx')
      .select('COALESCE(SUM(tx.amount), 0)', 'total')
      .where('tx.completed_at >= :monthStart', { monthStart: this.monthStart() })
      .andWhere('tx.status = :status', { status: 'CREDITED' })
      .getRawOne<{ total: string }>();

    const totalAgents = await this.userRepo.count({ where: { role: Role.FIELD_AGENT } });
    const pendingWithdrawals = await this.withdrawalRepo.count({ where: { status: 'PENDING' } });

    return {
      code: HttpStatus.OK,
      message: 'Admin wallet summary fetched successfully',
      data: {
        totalAgents,
        totalCompletedCases,
        totalWalletBalance: this.roundMoney(totalWalletBalance),
        totalReservedBalance: this.roundMoney(totalReservedBalance),
        totalAvailableBalance: this.roundMoney(totalWalletBalance - totalReservedBalance),
        totalWithdrawn: this.roundMoney(totalWithdrawn),
        totalEarned,
        thisMonthEarning: this.toNumber(monthResult?.total),
        earningPerCase: PHYSICAL_CASE_REWARD_AMOUNT,
        pendingWithdrawals,
      },
    };
  }

  async getMyWithdrawContext(user: AuthedUser): Promise<
    APIResponseInterface<{
      availableBalance: number;
      reservedBalance: number;
      balance: number;
      accounts: WalletBankAccountView[];
      activeAccount: WalletBankAccountView | null;
    }>
  > {
    if (user.role !== Role.FIELD_AGENT || !user.sub) {
      throw new ForbiddenException('Only field agents can access withdraw details');
    }

    const wallet = await this.getOrCreateWallet(user.sub);
    const assistant = await this.fieldAssistantRepo.findOne({
      where: { userId: user.sub },
      relations: ['bankDetails'],
    });

    const accounts = (assistant?.bankDetails ?? []).map((account) => this.mapBankAccount(account));
    const activeAccount = accounts.find((account) => account.status === 'Active') ?? null;

    return {
      code: HttpStatus.OK,
      message: 'Withdraw context fetched successfully',
      data: {
        availableBalance: this.availableBalance(wallet),
        reservedBalance: this.roundMoney(this.toNumber(wallet.reservedBalance)),
        balance: this.roundMoney(this.toNumber(wallet.balance)),
        accounts,
        activeAccount,
      },
    };
  }

  async createWithdrawal(
    dto: CreateWithdrawalDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<WithdrawalRequestView>> {
    if (user.role !== Role.FIELD_AGENT || !user.sub) {
      throw new ForbiddenException('Only field agents can create withdrawal requests');
    }

    const amount = this.roundMoney(dto.amount);
    if (amount < 1) {
      throw new BadRequestException('Withdrawal amount must be at least ₹1');
    }

    const assistant = await this.fieldAssistantRepo.findOne({
      where: { userId: user.sub },
      relations: ['bankDetails'],
    });
    if (!assistant) {
      throw new BadRequestException('Field agent profile not found');
    }

    const bankAccount = (assistant.bankDetails || []).find((b) => b.id === dto.bankAccountId);
    if (!bankAccount) {
      throw new BadRequestException('Selected bank account was not found on your profile');
    }

    const agentUser = await this.userRepo.findOne({ where: { id: user.sub } });
    const agentName =
      assistant.fullName?.trim() ||
      agentUser?.fullName?.trim() ||
      agentUser?.email?.trim() ||
      'Field Agent';
    const agentEmail = this.resolveAgentEmail(agentUser, assistant);

    const saved = await this.dataSource.transaction(async (manager) => {
      let wallet = await manager.findOne(FieldAgentWallet, {
        where: { fieldAgentUserId: user.sub },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) {
        wallet = manager.create(FieldAgentWallet, {
          fieldAgentUserId: user.sub,
          fieldAgentName: agentName,
          fieldAgentCode: assistant.fieldAgentId ?? null,
          balance: 0,
          reservedBalance: 0,
          totalWithdrawn: 0,
          totalEarned: 0,
          completedCasesCount: 0,
        });
        wallet = await manager.save(wallet);
      }

      const available = this.availableBalance(wallet);
      if (amount > available) {
        throw new BadRequestException(
          `Insufficient available balance. Available: ₹${available.toFixed(2)}`,
        );
      }

      wallet.reservedBalance = this.roundMoney(this.toNumber(wallet.reservedBalance) + amount);
      wallet.fieldAgentName = agentName;
      if (assistant.fieldAgentId) {
        wallet.fieldAgentCode = assistant.fieldAgentId;
      }
      await manager.save(wallet);

      const request = manager.create(FieldAgentWithdrawalRequest, {
        fieldAgentUserId: user.sub,
        fieldAgentName: agentName,
        fieldAgentCode: assistant.fieldAgentId ?? null,
        fieldAgentEmail: agentEmail,
        amount,
        status: 'PENDING',
        bankAccountId: bankAccount.id,
        bankName: bankAccount.bankName,
        accountNumber: bankAccount.accountNumber,
        accountType: bankAccount.accountType ?? null,
        branch: bankAccount.branch ?? null,
        ifsc: bankAccount.ifsc,
        upiId: bankAccount.upiId ?? null,
        remarks: dto.remarks?.trim() || null,
      });
      return manager.save(request);
    });

    return {
      code: HttpStatus.CREATED,
      message: 'Withdrawal request submitted successfully. Amount has been reserved.',
      data: this.mapWithdrawal(saved),
    };
  }

  async listWithdrawals(
    query: ListWithdrawalsQueryDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<WithdrawalRequestView[]>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const skip = (page - 1) * limit;

    const qb = this.withdrawalRepo
      .createQueryBuilder('wr')
      .orderBy('wr.created_at', 'DESC')
      .skip(skip)
      .take(limit);

    if (user.role === Role.FIELD_AGENT) {
      if (!user.sub) throw new ForbiddenException('Field agent identity missing');
      qb.andWhere('wr.field_agent_user_id = :agentUserId', { agentUserId: user.sub });
    } else if (user.role === Role.SUPER_ADMIN) {
      if (query.fieldAgentUserId?.trim()) {
        qb.andWhere('wr.field_agent_user_id = :filterAgentId', {
          filterAgentId: query.fieldAgentUserId.trim(),
        });
      }
    } else {
      throw new ForbiddenException('Access denied');
    }

    if (query.status) {
      qb.andWhere('wr.status = :status', { status: query.status });
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        `(wr.field_agent_name LIKE :term OR wr.field_agent_code LIKE :term
          OR wr.field_agent_email LIKE :term OR wr.bank_name LIKE :term
          OR wr.account_number LIKE :term OR wr.ifsc LIKE :term)`,
        { term },
      );
    }

    const [rows, total] = await qb.getManyAndCount();

    return {
      code: HttpStatus.OK,
      message: 'Withdrawal requests fetched successfully',
      data: rows.map((row) => this.mapWithdrawal(row)),
      pagination: { total, page, pagePerRecord: limit },
    };
  }

  async reviewWithdrawal(
    id: string,
    decision: 'APPROVED' | 'REJECTED',
    dto: ReviewWithdrawalDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<WithdrawalRequestView>> {
    if (user.role !== Role.SUPER_ADMIN || !user.sub) {
      throw new ForbiddenException('Only super admin can review withdrawal requests');
    }

    const reviewerId = user.sub;
    const adminRemarks = dto.remarks?.trim() || null;
    if (decision === 'REJECTED' && !adminRemarks) {
      throw new BadRequestException('Please provide a reason for rejecting the request');
    }

    const updated = await this.dataSource.transaction(async (manager) => {
      const request = await manager.findOne(FieldAgentWithdrawalRequest, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!request) {
        throw new NotFoundException('Withdrawal request not found');
      }
      if (request.status !== 'PENDING') {
        throw new BadRequestException('This withdrawal request has already been reviewed');
      }

      const amount = this.roundMoney(this.toNumber(request.amount));
      const wallet = await manager.findOne(FieldAgentWallet, {
        where: { fieldAgentUserId: request.fieldAgentUserId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!wallet) {
        throw new BadRequestException('Agent wallet not found');
      }

      const reserved = this.toNumber(wallet.reservedBalance);
      if (reserved < amount) {
        throw new BadRequestException('Reserved wallet amount is insufficient for this request');
      }

      if (decision === 'APPROVED') {
        const balance = this.toNumber(wallet.balance);
        if (balance < amount) {
          throw new BadRequestException('Wallet balance is insufficient to deduct this amount');
        }
        wallet.balance = this.roundMoney(balance - amount);
        wallet.reservedBalance = this.roundMoney(reserved - amount);
        wallet.totalWithdrawn = this.roundMoney(this.toNumber(wallet.totalWithdrawn) + amount);
      } else {
        wallet.reservedBalance = this.roundMoney(reserved - amount);
      }

      await manager.save(wallet);

      request.status = decision;
      request.adminRemarks = adminRemarks;
      request.reviewedBy = reviewerId;
      request.reviewedAt = new Date();
      return manager.save(request);
    });

    await this.sendReviewEmail(updated, decision);

    return {
      code: HttpStatus.OK,
      message:
        decision === 'APPROVED'
          ? 'Withdrawal request approved. Amount deducted and agent notified.'
          : 'Withdrawal request rejected. Reserved amount released and agent notified.',
      data: this.mapWithdrawal(updated),
    };
  }
}
