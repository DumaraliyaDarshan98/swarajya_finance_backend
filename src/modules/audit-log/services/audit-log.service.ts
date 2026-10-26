import { ForbiddenException, HttpStatus, Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditAction, AuditLog } from '../entities/audit-log.entity';
import { GeoLookupService } from './geo-lookup.service';
import { ListAuditLogsQueryDto } from '../dto/list-audit-logs-query.dto';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';
import {
  buildPagination,
  parsePagination,
} from '../../../common/utils/pagination.util';
import { Role } from '../../../common/enums/role.enum';
import { AuthedUser } from '../../../common/interfaces/authed-user.interface';

export type WriteAuditInput = {
  action: AuditAction;
  module: string;
  description: string;
  entityType?: string | null;
  entityId?: string | null;
  userId?: string | null;
  userEmail?: string | null;
  userName?: string | null;
  userRole?: string | null;
  clientId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  method?: string | null;
  path?: string | null;
  statusCode?: number | null;
  metadata?: Record<string, unknown> | null;
  /** When true, skip geo lookup (already known / private). */
  skipGeo?: boolean;
};

@Injectable()
export class AuditLogService {
  private readonly logger = new Logger(AuditLogService.name);

  constructor(
    @InjectRepository(AuditLog)
    private readonly repo: Repository<AuditLog>,
    private readonly geoLookup: GeoLookupService,
  ) {}

  /**
   * Fire-and-forget safe write. Never throws to callers.
   */
  async log(input: WriteAuditInput): Promise<void> {
    try {
      let city: string | null = null;
      let region: string | null = null;
      let country: string | null = null;
      let locationLabel: string | null = null;

      if (!input.skipGeo) {
        const geo = await this.geoLookup.lookup(input.ipAddress);
        city = geo.city;
        region = geo.region;
        country = geo.country;
        locationLabel = geo.locationLabel;
      }

      const row = this.repo.create({
        action: input.action,
        module: input.module || 'GENERAL',
        description: input.description,
        entityType: input.entityType ?? null,
        entityId: input.entityId ?? null,
        userId: input.userId ?? null,
        userEmail: input.userEmail ?? null,
        userName: input.userName ?? null,
        userRole: input.userRole ?? null,
        clientId: input.clientId ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
        city,
        region,
        country,
        locationLabel,
        method: input.method ?? null,
        path: input.path ?? null,
        statusCode: input.statusCode ?? null,
        metadata: input.metadata ?? null,
      });
      await this.repo.save(row);
    } catch (err) {
      this.logger.warn(
        `Failed to write audit log: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  /** Non-blocking wrapper */
  logAsync(input: WriteAuditInput): void {
    void this.log(input);
  }

  async findAll(
    query: ListAuditLogsQueryDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<AuditLog[]>> {
    const { page, limit, skip } = parsePagination(query, {
      page: 1,
      limit: 20,
      maxLimit: 100,
    });

    const qb = this.repo.createQueryBuilder('a');

    const isPlatform =
      user.role === Role.SUPER_ADMIN || user.role === Role.INTERNAL_USER;

    if (!isPlatform) {
      if (!user.clientId) {
        throw new ForbiddenException('Client context is missing');
      }
      qb.andWhere('a.client_id = :clientId', { clientId: user.clientId });
    } else if (query.clientId) {
      qb.andWhere('a.client_id = :clientId', { clientId: query.clientId });
    }

    if (query.action) {
      qb.andWhere('a.action = :action', { action: query.action.toUpperCase() });
    }
    if (query.module) {
      qb.andWhere('a.module = :module', { module: query.module });
    }
    if (query.userId) {
      qb.andWhere('a.user_id = :userId', { userId: query.userId });
    }
    if (query.userRole) {
      qb.andWhere('a.user_role = :userRole', { userRole: query.userRole });
    }
    if (query.from) {
      const from = new Date(query.from);
      if (!Number.isNaN(from.getTime())) {
        qb.andWhere('a.created_at >= :from', { from });
      }
    }
    if (query.to) {
      const to = new Date(query.to);
      if (!Number.isNaN(to.getTime())) {
        qb.andWhere('a.created_at <= :to', { to });
      }
    }
    if (query.search?.trim()) {
      const q = `%${query.search.trim().toLowerCase()}%`;
      qb.andWhere(
        `(LOWER(a.description) LIKE :q OR LOWER(COALESCE(a.user_email,'')) LIKE :q OR LOWER(COALESCE(a.user_name,'')) LIKE :q OR LOWER(COALESCE(a.ip_address,'')) LIKE :q OR LOWER(COALESCE(a.location_label,'')) LIKE :q OR LOWER(COALESCE(a.path,'')) LIKE :q)`,
        { q },
      );
    }

    const sortOrder =
      (query.sortOrder || 'DESC').toUpperCase() === 'ASC' ? 'ASC' : 'DESC';
    qb.orderBy('a.created_at', sortOrder).skip(skip).take(limit);

    const [rows, total] = await qb.getManyAndCount();

    return {
      code: HttpStatus.OK,
      message: 'Audit logs fetched successfully',
      data: rows,
      pagination: buildPagination(total, page, limit),
    };
  }

  async getFilterOptions(
    user: AuthedUser,
  ): Promise<
    APIResponseInterface<{
      actions: string[];
      modules: string[];
    }>
  > {
    const isPlatform =
      user.role === Role.SUPER_ADMIN || user.role === Role.INTERNAL_USER;

    const qbActions = this.repo
      .createQueryBuilder('a')
      .select('DISTINCT a.action', 'action');
    const qbModules = this.repo
      .createQueryBuilder('a')
      .select('DISTINCT a.module', 'module');

    if (!isPlatform) {
      if (!user.clientId) {
        throw new ForbiddenException('Client context is missing');
      }
      qbActions.andWhere('a.client_id = :clientId', { clientId: user.clientId });
      qbModules.andWhere('a.client_id = :clientId', { clientId: user.clientId });
    }

    const [actionRows, moduleRows] = await Promise.all([
      qbActions.getRawMany<{ action: string }>(),
      qbModules.getRawMany<{ module: string }>(),
    ]);

    return {
      code: HttpStatus.OK,
      message: 'Filter options fetched',
      data: {
        actions: actionRows.map((r) => r.action).filter(Boolean).sort(),
        modules: moduleRows.map((r) => r.module).filter(Boolean).sort(),
      },
    };
  }
}
