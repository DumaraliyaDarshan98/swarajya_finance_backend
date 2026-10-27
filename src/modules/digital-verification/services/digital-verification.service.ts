import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DigitalVerification } from '../entities/digital-verification.entity';
import { UpsertDigitalVerificationDto } from '../dto/upsert-digital-verification.dto';
import { ListDigitalVerificationQueryDto } from '../dto/list-digital-verification-query.dto';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';
import { Role } from '../../../common/enums/role.enum';
import type { DigitalVerificationStatus } from '../interfaces/scrape-payload.interface';
import { normalizeDomain } from '../helpers/business-verification.helper';
import { VerificationEnrichmentService } from '../../verification-enrichment/services/verification-enrichment.service';
import { NotificationService } from '../../notification/services/notification.service';
import { User } from '../../user/entities/user.entity';

type AuthedUser = { sub?: string; role: Role; clientId?: string };

@Injectable()
export class DigitalVerificationService {
  private readonly logger = new Logger(DigitalVerificationService.name);

  constructor(
    @InjectRepository(DigitalVerification)
    private repo: Repository<DigitalVerification>,
    @InjectRepository(User)
    private userRepo: Repository<User>,
    private enrichment: VerificationEnrichmentService,
    private notificationService: NotificationService,
  ) {}

  private normalizeOptional(value?: string | null): string | null {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private mapDtoToFields(dto: UpsertDigitalVerificationDto): Partial<DigitalVerification> {
    const hasOffice = !!dto.hasOfficeAddress;
    const hasBusiness = !!dto.hasBusinessAddress;
    return {
      loanApplicationNo: this.normalizeOptional(dto.loanApplicationNo),
      loanType: this.normalizeOptional(dto.loanType),
      applicantName: this.normalizeOptional(dto.applicantName),
      mobileNumber: this.normalizeOptional(dto.mobileNumber),
      emailId: this.normalizeOptional(dto.emailId),
      panNumber: this.normalizeOptional(dto.panNumber)?.toUpperCase() ?? null,
      aadhaarNumber: this.normalizeOptional(dto.aadhaarNumber),
      residentialAddress: this.normalizeOptional(dto.residentialAddress),
      residentialLandmark: this.normalizeOptional(dto.residentialLandmark),
      residentialState: this.normalizeOptional(dto.residentialState),
      residentialCity: this.normalizeOptional(dto.residentialCity),
      residentialPincode: this.normalizeOptional(dto.residentialPincode),
      hasOfficeAddress: hasOffice,
      hasBusinessAddress: hasBusiness,
      companyName: hasBusiness ? this.normalizeOptional(dto.companyName) : null,
      companyDomain: hasBusiness
        ? normalizeDomain(this.normalizeOptional(dto.companyDomain) ?? '') || null
        : null,
      gstNumber: hasBusiness
        ? (this.normalizeOptional(dto.gstNumber)?.toUpperCase() ?? null)
        : null,
      businessPan: hasBusiness
        ? (this.normalizeOptional(dto.businessPan)?.toUpperCase() ?? null)
        : null,
      cinNumber: hasBusiness
        ? (this.normalizeOptional(dto.cinNumber)?.toUpperCase() ?? null)
        : null,
      businessType: hasBusiness ? this.normalizeOptional(dto.businessType) : null,
      officeAddress: hasOffice ? this.normalizeOptional(dto.officeAddress) : null,
      officeLandmark: hasOffice ? this.normalizeOptional(dto.officeLandmark) : null,
      officeState: hasOffice ? this.normalizeOptional(dto.officeState) : null,
      officeCity: hasOffice ? this.normalizeOptional(dto.officeCity) : null,
      officePincode: hasOffice ? this.normalizeOptional(dto.officePincode) : null,
    };
  }

  private async findOwned(id: string, user: AuthedUser): Promise<DigitalVerification> {
    const record = await this.repo.findOne({ where: { id } });
    if (!record) {
      throw new NotFoundException('Digital verification not found');
    }
    if (user.role !== Role.SUPER_ADMIN && record.clientId !== user.clientId) {
      throw new ForbiddenException('You can only access your own client verifications');
    }
    return record;
  }

  async list(
    query: ListDigitalVerificationQueryDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<DigitalVerification[]>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const skip = (page - 1) * limit;
    const sortBy = query.sortBy ?? 'updatedAt';
    const sortDir = query.sortDir ?? 'DESC';

    const qb = this.repo
      .createQueryBuilder('dv')
      .orderBy(`dv.${sortBy}`, sortDir as 'ASC' | 'DESC')
      .skip(skip)
      .take(limit);

    if (user.role === Role.SUPER_ADMIN) {
      qb.leftJoinAndSelect('dv.client', 'client');
      if (query.clientId?.trim()) {
        qb.andWhere('dv.client_id = :filterClientId', {
          filterClientId: query.clientId.trim(),
        });
      }
    } else {
      qb.andWhere('dv.client_id = :clientId', { clientId: user.clientId });
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        `(dv.loan_application_no LIKE :term OR dv.applicant_name LIKE :term OR dv.loan_type LIKE :term
          OR dv.pan_number LIKE :term OR dv.mobile_number LIKE :term OR dv.email_id LIKE :term
          OR dv.residential_city LIKE :term OR dv.gst_number LIKE :term
          OR dv.company_domain LIKE :term OR dv.company_name LIKE :term)`,
        { term },
      );
    }

    if (query.status) {
      qb.andWhere('dv.status = :status', { status: query.status });
    }

    const [list, total] = await qb.getManyAndCount();
    return {
      code: HttpStatus.OK,
      message: 'Digital verifications fetched successfully',
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

    const baseQb = this.repo.createQueryBuilder('dv');
    if (scopedClientId) {
      baseQb.where('dv.client_id = :clientId', { clientId: scopedClientId });
    }

    const total = await baseQb.getCount();

    const rowsQb = this.repo
      .createQueryBuilder('dv')
      .select('dv.status', 'status')
      .addSelect('COUNT(*)', 'count');
    if (scopedClientId) {
      rowsQb.where('dv.client_id = :clientId', { clientId: scopedClientId });
    }
    const rows = await rowsQb
      .groupBy('dv.status')
      .getRawMany<{ status: DigitalVerificationStatus; count: string }>();

    const byStatus = new Map(rows.map((r) => [r.status, Number(r.count) || 0]));

    return {
      code: HttpStatus.OK,
      message: 'Digital verification stats fetched successfully',
      data: {
        total,
        draft: byStatus.get('DRAFT') ?? 0,
        inProgress: byStatus.get('IN_PROGRESS') ?? 0,
        reportGenerated: byStatus.get('REPORT_GENERATED') ?? 0,
        failed: byStatus.get('FAILED') ?? 0,
      },
    };
  }

  async create(
    dto: UpsertDigitalVerificationDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<DigitalVerification>> {
    if (!user.clientId) {
      throw new ForbiddenException('Client context missing');
    }

    const entity = this.repo.create({
      clientId: user.clientId,
      client: { id: user.clientId } as any,
      ...this.mapDtoToFields(dto),
      status: 'DRAFT',
      scrapePayload: null,
      reportGeneratedAt: null,
    });

    const saved = await this.repo.save(entity);
    return {
      code: HttpStatus.CREATED,
      message: 'Digital verification created successfully',
      data: saved,
    };
  }

  async getById(
    id: string,
    user: AuthedUser,
  ): Promise<APIResponseInterface<DigitalVerification>> {
    const record = await this.findOwned(id, user);
    if (user.role === Role.SUPER_ADMIN) {
      const withClient = await this.repo.findOne({
        where: { id: record.id },
        relations: ['client'],
      });
      return {
        code: HttpStatus.OK,
        message: 'Digital verification fetched successfully',
        data: withClient ?? record,
      };
    }
    return {
      code: HttpStatus.OK,
      message: 'Digital verification fetched successfully',
      data: record,
    };
  }

  async delete(id: string, user: AuthedUser): Promise<APIResponseInterface<null>> {
    const record = await this.findOwned(id, user);
    await this.repo.remove(record);
    return {
      code: HttpStatus.OK,
      message: 'Digital verification deleted successfully',
      data: null,
    };
  }

  async update(
    id: string,
    dto: UpsertDigitalVerificationDto,
    user: AuthedUser,
  ): Promise<APIResponseInterface<DigitalVerification>> {
    const record = await this.findOwned(id, user);
    Object.assign(record, this.mapDtoToFields(dto));
    const saved = await this.repo.save(record);
    return {
      code: HttpStatus.OK,
      message: 'Digital verification updated successfully',
      data: saved,
    };
  }

  /**
   * Fire-and-forget: GST / who.is / address scrapes run in background.
   * Returns immediately so client-admin is not blocked by Puppeteer.
   */
  async generateReport(
    id: string,
    user: AuthedUser,
  ): Promise<APIResponseInterface<DigitalVerification>> {
    const record = await this.findOwned(id, user);

    record.status = 'IN_PROGRESS';
    record.reportGeneratedAt = null;
    await this.repo.save(record);

    this.processDigitalInBackground(record.id, user.sub).catch((err) =>
      this.logger.error(
        `Background digital report failed for ${record.id}`,
        err instanceof Error ? err.stack : String(err),
      ),
    );

    return {
      code: HttpStatus.OK,
      message:
        'Report generation started. GST, WHOIS, address, and related sites are checked in the background ? track status on the listing page.',
      data: record,
    };
  }

  private async processDigitalInBackground(
    recordId: string,
    requestedByUserId?: string,
  ): Promise<void> {
    const record = await this.repo.findOne({ where: { id: recordId } });
    if (!record) return;

    this.logger.log(
      `[DIGITAL] background scrape start id=${recordId} domain=${record.companyDomain ?? '-'} gst=${record.gstNumber ?? '-'}`,
    );

    try {
      const { scrapePayload, hasFailure, cascadeNotes } =
        await this.enrichment.enrichFromDetails({
          applicantName: record.applicantName,
          mobileNumber: record.mobileNumber,
          emailId: record.emailId,
          panNumber: record.panNumber,
          aadhaarNumber: record.aadhaarNumber,
          companyName: record.hasBusinessAddress ? record.companyName : null,
          companyDomain: record.hasBusinessAddress ? record.companyDomain : null,
          gstNumber: record.hasBusinessAddress ? record.gstNumber : null,
          businessPan: record.hasBusinessAddress ? record.businessPan : null,
          residential: {
            address: record.residentialAddress,
            landmark: record.residentialLandmark,
            city: record.residentialCity,
            state: record.residentialState,
            pincode: record.residentialPincode,
          },
          office: record.hasOfficeAddress
            ? {
                address: record.officeAddress,
                landmark: record.officeLandmark,
                city: record.officeCity,
                state: record.officeState,
                pincode: record.officePincode,
              }
            : null,
        });

      // Always generate the report once the scrape pipeline finishes.
      // Per-site failures stay on scrapePayload for the UI; they must not mark the case FAILED.
      record.scrapePayload = scrapePayload;
      record.status = 'REPORT_GENERATED';
      record.reportGeneratedAt = new Date();
      await this.repo.save(record);

      this.logger.log(
        `[DIGITAL] background scrape done id=${recordId} status=${record.status} partial=${hasFailure} domainSource=${scrapePayload?.domain?.source ?? '-'} domainOk=${scrapePayload?.domain?.success ?? false} notes=${cascadeNotes.join(' | ') || 'none'}`,
      );

      await this.notifyDigitalReportReady(record, requestedByUserId);
    } catch (err) {
      record.status = 'FAILED';
      record.reportGeneratedAt = null;
      await this.repo.save(record).catch(() => undefined);
      this.logger.error(
        `[DIGITAL] background scrape error id=${recordId}`,
        err instanceof Error ? err.stack : String(err),
      );
      await this.notifyDigitalReportReady(record, requestedByUserId).catch(
        () => undefined,
      );
      throw err;
    }
  }

  private async notifyDigitalReportReady(
    record: DigitalVerification,
    requestedByUserId?: string,
  ): Promise<void> {
    if (!record.clientId) return;

    const frontendUrl = (
      process.env.FRONTEND_URL ||
      process.env.APP_FRONTEND_URL ||
      'http://localhost:4200'
    ).replace(/\/$/, '');

    const isSuccess = record.status === 'REPORT_GENERATED';
    const partial =
      isSuccess && record.scrapePayload?.pipeline?.success === false;
    const ctaUrl = `${frontendUrl}/client-admin/digital-report/${record.id}`;
    const applicant = record.applicantName?.trim() || 'applicant';
    const loanRef = record.loanApplicationNo?.trim();
    const subject = isSuccess
      ? partial
        ? 'Digital verification report generated (partial scrapes)'
        : 'Digital verification report generated'
      : 'Digital verification report failed';
    const messageText = isSuccess
      ? `Digital report generated for ${applicant}${loanRef ? ` (${loanRef})` : ''}. ID: ${record.id}${
          partial
            ? ' Some public-site checks did not complete ? open the report for details.'
            : ''
        }`
      : `Digital report generation failed for ${applicant}${loanRef ? ` (${loanRef})` : ''}. ID: ${record.id}. Open the case to review errors.`;

    const recipients = await this.userRepo.find({
      where: {
        role: Role.CLIENT_ADMIN,
        client: { id: record.clientId } as any,
      },
    });

    const seen = new Set<string>();
    for (const admin of recipients) {
      if (!admin?.id || seen.has(admin.id)) continue;
      seen.add(admin.id);
      await this.notificationService
        .sendSystemNotification({
          userId: admin.id,
          toEmail: admin.email,
          subject,
          title: subject,
          messageText,
          icon: isSuccess ? 'success' : 'warning',
          ctaUrl,
          ctaLabel: 'Open digital report',
        })
        .catch((e) =>
          this.logger.warn(
            `Notify CLIENT_ADMIN ${admin.id} failed: ${e?.message ?? e}`,
          ),
        );
    }

    if (requestedByUserId && !seen.has(requestedByUserId)) {
      const requester = await this.userRepo.findOne({
        where: { id: requestedByUserId },
      });
      if (
        requester &&
        (requester.role === Role.CLIENT_USER ||
          requester.role === Role.CLIENT_ADMIN)
      ) {
        await this.notificationService
          .sendSystemNotification({
            userId: requester.id,
            toEmail: requester.email,
            subject,
            title: subject,
            messageText,
            icon: isSuccess ? 'success' : 'warning',
            ctaUrl,
            ctaLabel: 'Open digital report',
          })
          .catch((e) =>
            this.logger.warn(
              `Notify requester ${requester.id} failed: ${e?.message ?? e}`,
            ),
          );
      }
    }
  }
}
