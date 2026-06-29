import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DigitalVerification } from './entities/digital-verification.entity';
import { UpsertDigitalVerificationDto } from './dto/upsert-digital-verification.dto';
import { ListDigitalVerificationQueryDto } from './dto/list-digital-verification-query.dto';
import { APIResponseInterface } from '../../interface/response.interface';
import { ScrappingService } from '../scrapping/scrapping.service';
import { Role } from '../../enum/role.enum';
import type {
  DigitalVerificationStatus,
  ScrapePayload,
} from './interfaces/scrape-payload.interface';

type AuthedUser = { role: Role; clientId?: string };

@Injectable()
export class DigitalVerificationService {
  constructor(
    @InjectRepository(DigitalVerification)
    private repo: Repository<DigitalVerification>,
    private scrappingService: ScrappingService,
  ) {}

  private normalizeOptional(value?: string | null): string | null {
    if (value == null) return null;
    const trimmed = value.trim();
    return trimmed.length ? trimmed : null;
  }

  private mapDtoToFields(dto: UpsertDigitalVerificationDto): Partial<DigitalVerification> {
    const hasOffice = !!dto.hasOfficeAddress;
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
      companyName: hasOffice ? this.normalizeOptional(dto.companyName) : null,
      gstNumber: hasOffice
        ? (this.normalizeOptional(dto.gstNumber)?.toUpperCase() ?? null)
        : null,
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
          OR dv.residential_city LIKE :term OR dv.gst_number LIKE :term)`,
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

  async stats(user: AuthedUser): Promise<
    APIResponseInterface<{
      total: number;
      draft: number;
      inProgress: number;
      reportGenerated: number;
      failed: number;
    }>
  > {
    const baseQb = this.repo.createQueryBuilder('dv');
    if (user.role !== Role.SUPER_ADMIN) {
      baseQb.where('dv.client_id = :clientId', { clientId: user.clientId });
    }

    const total = await baseQb.getCount();

    const rows = await this.repo
      .createQueryBuilder('dv')
      .select('dv.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where(
        user.role !== Role.SUPER_ADMIN ? 'dv.client_id = :clientId' : '1=1',
        user.role !== Role.SUPER_ADMIN ? { clientId: user.clientId } : {},
      )
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

  async generateReport(
    id: string,
    user: AuthedUser,
  ): Promise<APIResponseInterface<DigitalVerification>> {
    const record = await this.findOwned(id, user);

    record.status = 'IN_PROGRESS';
    await this.repo.save(record);

    const scrapePayload: ScrapePayload = { ...(record.scrapePayload ?? {}) };
    let hasFailure = false;

    if (record.hasOfficeAddress && record.gstNumber?.trim()) {
      try {
        const res = await this.scrappingService.gstSearch(record.gstNumber.trim());
        scrapePayload.gst = {
          source: 'gst-search',
          scrapedAt: new Date().toISOString(),
          success: true,
          data: res.data as unknown as Record<string, unknown>,
        };
      } catch (error: any) {
        hasFailure = true;
        scrapePayload.gst = {
          source: 'gst-search',
          scrapedAt: new Date().toISOString(),
          success: false,
          error: error?.message ?? 'GST verification failed',
        };
      }
    }

    record.scrapePayload = scrapePayload;
    record.status = hasFailure ? 'FAILED' : 'REPORT_GENERATED';
    record.reportGeneratedAt = hasFailure ? null : new Date();

    const saved = await this.repo.save(record);
    return {
      code: HttpStatus.OK,
      message: hasFailure
        ? 'Report generation failed during GST verification'
        : 'Digital verification report generated successfully',
      data: saved,
    };
  }
}
