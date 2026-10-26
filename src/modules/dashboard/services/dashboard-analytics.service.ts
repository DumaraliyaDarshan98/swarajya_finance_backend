import { ForbiddenException, HttpStatus, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Client } from '../../client/entities/client.entity';
import { User } from '../../user/entities/user.entity';
import { DigitalVerification } from '../../digital-verification/entities/digital-verification.entity';
import { OcrVerification } from '../../ocr-verification/entities/ocr-verification.entity';
import { PhysicalVerification } from '../../physical-verification/entities/physical-verification.entity';
import { AuditLog } from '../../audit-log/entities/audit-log.entity';
import { Role as RoleEntity } from '../../role/entities/role.entity';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';
import { Role } from '../../../common/enums/role.enum';
import { AuthedUser } from '../../../common/interfaces/authed-user.interface';

export type ChartPoint = { label: string; value: number };

@Injectable()
export class DashboardAnalyticsService {
  constructor(
    @InjectRepository(Client) private readonly clientRepo: Repository<Client>,
    @InjectRepository(User) private readonly userRepo: Repository<User>,
    @InjectRepository(DigitalVerification)
    private readonly digitalRepo: Repository<DigitalVerification>,
    @InjectRepository(OcrVerification)
    private readonly ocrRepo: Repository<OcrVerification>,
    @InjectRepository(PhysicalVerification)
    private readonly physicalRepo: Repository<PhysicalVerification>,
    @InjectRepository(AuditLog) private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(RoleEntity) private readonly roleRepo: Repository<RoleEntity>,
  ) {}

  async platformAnalytics(
    user: AuthedUser,
  ): Promise<APIResponseInterface<Record<string, unknown>>> {
    if (user.role !== Role.SUPER_ADMIN && user.role !== Role.INTERNAL_USER) {
      throw new ForbiddenException('Platform analytics require platform access');
    }

    const clients = await this.clientRepo.find({
      relations: ['subscriptionPlan'],
    });

    const planMap = new Map<
      string,
      { planId: string; title: string; amount: number; clientCount: number; revenue: number }
    >();
    let mrr = 0;
    let subscribed = 0;
    for (const c of clients) {
      const plan = c.subscriptionPlan;
      if (!plan?.id) continue;
      subscribed += 1;
      const amount = Number(plan.amount ?? 0);
      mrr += amount;
      const key = plan.id;
      const row = planMap.get(key) || {
        planId: plan.id,
        title: plan.title || 'Plan',
        amount,
        clientCount: 0,
        revenue: 0,
      };
      row.clientCount += 1;
      row.revenue += amount;
      planMap.set(key, row);
    }

    const clientsTrend = this.monthTrend(
      clients.map((c) => c.createdAt).filter(Boolean) as Date[],
      6,
    );

    const [digital, ocr, physical, auditRecent] = await Promise.all([
      this.statusBreakdown(this.digitalRepo),
      this.statusBreakdown(this.ocrRepo),
      this.statusBreakdown(this.physicalRepo),
      this.auditDailyTrend(undefined, 14),
    ]);

    const verificationMix: ChartPoint[] = [
      { label: 'Digital', value: digital.total },
      { label: 'OCR', value: ocr.total },
      { label: 'Physical', value: physical.total },
    ];

    const performance: ChartPoint[] = [
      { label: 'Reports', value: digital.reportGenerated + ocr.reportGenerated + physical.reportGenerated },
      { label: 'In progress', value: digital.inProgress + ocr.inProgress + physical.inProgress },
      { label: 'Failed', value: digital.failed + ocr.failed + physical.failed },
      { label: 'Draft', value: digital.draft + ocr.draft + physical.draft },
    ];

    const totalCases = verificationMix.reduce((s, p) => s + p.value, 0);
    const reports =
      digital.reportGenerated + ocr.reportGenerated + physical.reportGenerated;
    const failed = digital.failed + ocr.failed + physical.failed;
    const done = reports + failed;

    return {
      code: HttpStatus.OK,
      message: 'Platform analytics fetched',
      data: {
        revenue: {
          mrr: Math.round(mrr * 100) / 100,
          currency: 'INR',
          subscribedClients: subscribed,
          unsubscribedClients: Math.max(0, clients.length - subscribed),
          totalClients: clients.length,
          byPlan: Array.from(planMap.values()).sort((a, b) => b.revenue - a.revenue),
        },
        clientsTrend,
        verificationMix,
        performance,
        auditTrend: auditRecent,
        kpis: {
          totalCases,
          successRate: done ? Math.round((reports / done) * 100) : 0,
          reports,
          failed,
        },
      },
    };
  }

  async clientAnalytics(
    user: AuthedUser,
  ): Promise<APIResponseInterface<Record<string, unknown>>> {
    if (
      user.role !== Role.CLIENT_ADMIN &&
      user.role !== Role.CLIENT_USER &&
      user.role !== Role.SUPER_ADMIN
    ) {
      throw new ForbiddenException('Client analytics require client access');
    }
    const clientId = user.clientId;
    if (!clientId) throw new ForbiddenException('Client context missing');

    const client = await this.clientRepo.findOne({
      where: { id: clientId },
      relations: ['subscriptionPlan'],
    });
    if (!client) throw new ForbiddenException('Client not found');

    const plan = client.subscriptionPlan;
    const amount = Number(plan?.amount ?? 0);
    const maxUsers = client.setting?.maxUsers ?? null;
    const maxRoles = client.setting?.maxRoles ?? null;

    const [usersTotal, rolesTotal, digital, ocr, physical, auditTrend] =
      await Promise.all([
        this.userRepo
          .createQueryBuilder('u')
          .where('u.client_id = :clientId', { clientId })
          .getCount(),
        this.roleRepo
          .createQueryBuilder('r')
          .where('r.client_id = :clientId', { clientId })
          .getCount(),
        this.statusBreakdown(this.digitalRepo, clientId),
        this.statusBreakdown(this.ocrRepo, clientId),
        this.statusBreakdown(this.physicalRepo, clientId),
        this.auditDailyTrend(clientId, 14),
      ]);

    const verificationMix: ChartPoint[] = [
      { label: 'Digital', value: digital.total },
      { label: 'OCR', value: ocr.total },
      { label: 'Physical', value: physical.total },
    ];

    const performance: ChartPoint[] = [
      {
        label: 'Reports',
        value:
          digital.reportGenerated + ocr.reportGenerated + physical.reportGenerated,
      },
      {
        label: 'In progress',
        value: digital.inProgress + ocr.inProgress + physical.inProgress,
      },
      { label: 'Failed', value: digital.failed + ocr.failed + physical.failed },
      { label: 'Draft', value: digital.draft + ocr.draft + physical.draft },
    ];

    const reports =
      digital.reportGenerated + ocr.reportGenerated + physical.reportGenerated;
    const failed = digital.failed + ocr.failed + physical.failed;
    const done = reports + failed;
    const totalCases = verificationMix.reduce((s, p) => s + p.value, 0);

    return {
      code: HttpStatus.OK,
      message: 'Client analytics fetched',
      data: {
        subscription: {
          planId: plan?.id ?? null,
          planTitle: plan?.title ?? 'No plan',
          amount,
          currency: 'INR',
          features: {
            digitalFlow: !!client.setting?.digitalFlow,
            ocr: !!client.setting?.ocr,
            physical: !!client.setting?.physical,
            triangulation: !!client.setting?.triangulation,
          },
        },
        usage: {
          users: usersTotal,
          maxUsers,
          roles: rolesTotal,
          maxRoles,
          userUtilization:
            maxUsers && maxUsers > 0
              ? Math.min(100, Math.round((usersTotal / maxUsers) * 100))
              : null,
          roleUtilization:
            maxRoles && maxRoles > 0
              ? Math.min(100, Math.round((rolesTotal / maxRoles) * 100))
              : null,
        },
        verificationMix,
        performance,
        auditTrend,
        kpis: {
          totalCases,
          successRate: done ? Math.round((reports / done) * 100) : 0,
          reports,
          failed,
          planAmount: amount,
        },
      },
    };
  }

  private async statusBreakdown(
    repo: Repository<any>,
    clientId?: string,
  ): Promise<{
    total: number;
    draft: number;
    inProgress: number;
    reportGenerated: number;
    failed: number;
  }> {
    const qb = repo.createQueryBuilder('r').select('r.status', 'status').addSelect('COUNT(*)', 'cnt');
    if (clientId) {
      qb.where('r.client_id = :clientId', { clientId });
    }
    qb.groupBy('r.status');
    const rows = await qb.getRawMany<{ status: string; cnt: string }>();
    const out = {
      total: 0,
      draft: 0,
      inProgress: 0,
      reportGenerated: 0,
      failed: 0,
    };
    for (const row of rows) {
      const n = Number(row.cnt) || 0;
      out.total += n;
      const s = String(row.status || '').toUpperCase();
      if (s === 'DRAFT') out.draft += n;
      else if (s === 'REPORT_GENERATED' || s === 'APPROVED') out.reportGenerated += n;
      else if (s === 'FAILED' || s === 'REJECTED') out.failed += n;
      else out.inProgress += n;
    }
    return out;
  }

  private monthTrend(dates: Date[], months: number): ChartPoint[] {
    const now = new Date();
    const buckets: ChartPoint[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const label = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
      buckets.push({ label, value: 0 });
      (buckets[buckets.length - 1] as any)._key = key;
    }
    for (const dt of dates) {
      const d = new Date(dt);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      const hit = buckets.find((b: any) => b._key === key);
      if (hit) hit.value += 1;
    }
    return buckets.map(({ label, value }) => ({ label, value }));
  }

  private async auditDailyTrend(
    clientId: string | undefined,
    days: number,
  ): Promise<ChartPoint[]> {
    const since = new Date();
    since.setDate(since.getDate() - (days - 1));
    since.setHours(0, 0, 0, 0);

    const qb = this.auditRepo
      .createQueryBuilder('a')
      .select("DATE_FORMAT(a.created_at, '%Y-%m-%d')", 'day')
      .addSelect('COUNT(*)', 'cnt')
      .where('a.created_at >= :since', { since });
    if (clientId) {
      qb.andWhere('a.client_id = :clientId', { clientId });
    }
    qb.groupBy('day').orderBy('day', 'ASC');
    const rows = await qb.getRawMany<{ day: string; cnt: string }>();
    const map = new Map(rows.map((r) => [r.day, Number(r.cnt) || 0]));

    const out: ChartPoint[] = [];
    for (let i = 0; i < days; i++) {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
      const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' });
      out.push({ label, value: map.get(key) ?? 0 });
    }
    return out;
  }
}
