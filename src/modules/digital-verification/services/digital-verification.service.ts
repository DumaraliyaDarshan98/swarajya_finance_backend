import {
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { DigitalVerification } from '../entities/digital-verification.entity';
import { UpsertDigitalVerificationDto } from '../dto/upsert-digital-verification.dto';
import { ListDigitalVerificationQueryDto } from '../dto/list-digital-verification-query.dto';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';
import { ScrappingService } from '../../scrapping/services/scrapping.service';
import { Role } from '../../../common/enums/role.enum';
import type {
  DigitalVerificationStatus,
  ScrapePayload,
  ScrapeResultEntry,
} from '../interfaces/scrape-payload.interface';
import { businessNamesMatch, normalizeDomain } from '../helpers/business-verification.helper';
import {
  buildMapEmbedFromQuery,
  buildMapEmbedUrl,
  buildStreetViewEmbedUrl,
  buildStreetViewLink,
  geocodeAddress,
  joinAddressParts,
} from '../helpers/address-enrichment.helper';

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

  private async enrichAddressSection(parts: {
    address?: string | null;
    landmark?: string | null;
    city?: string | null;
    state?: string | null;
    pincode?: string | null;
  }): Promise<ScrapeResultEntry> {
    const submittedAddress = joinAddressParts([
      parts.address,
      parts.landmark,
      parts.city,
      parts.state,
      parts.pincode,
    ]);
    const pincode = parts.pincode?.replace(/\D/g, '').slice(0, 6) || null;

    let pincodeFields: Record<string, string> = {};
    let pincodeMessage = '';
    let pincodeError: string | undefined;

    if (pincode) {
      try {
        const res = await this.scrappingService.pincodeLookup(pincode);
        pincodeFields = res.data?.fields ?? {};
        pincodeMessage = res.data?.message ?? '';
      } catch (error: any) {
        pincodeError = error?.message ?? 'Pincode lookup failed';
      }
    }

    const geocodeQuery =
      submittedAddress && submittedAddress !== '.'
        ? submittedAddress
        : pincodeFields.District && pincodeFields.State
          ? `${pincodeFields.District}, ${pincodeFields.State}, India ${pincode ?? ''}`.trim()
          : pincode
            ? `${pincode}, India`
            : '';

    const coords = geocodeQuery ? await geocodeAddress(geocodeQuery) : null;
    const latitude = coords?.latitude ?? null;
    const longitude = coords?.longitude ?? null;

    let mapEmbedUrl = '';
    let streetViewLink: string | null = null;
    let streetViewEmbedUrl: string | null = null;

    if (latitude && longitude) {
      mapEmbedUrl = buildMapEmbedUrl(latitude, longitude);
      streetViewLink = buildStreetViewLink(latitude, longitude);
      streetViewEmbedUrl = buildStreetViewEmbedUrl(latitude, longitude);
    } else if (geocodeQuery) {
      mapEmbedUrl = buildMapEmbedFromQuery(geocodeQuery);
    }

    const pincodeOk = !!pincode && Object.keys(pincodeFields).length > 0;
    const geoOk = !!(latitude && longitude && mapEmbedUrl);
    const success = pincodeOk || geoOk;

    return {
      source: 'postalpincode.in',
      scrapedAt: new Date().toISOString(),
      success,
      data: {
        submittedAddress: submittedAddress || null,
        pincode,
        pincodeFields,
        pincodeMessage,
        latitude,
        longitude,
        mapEmbedUrl,
        streetViewLink,
        streetViewEmbedUrl,
        geocodeQuery: geocodeQuery || null,
      },
      error:
        pincodeError ??
        (success ? undefined : 'Could not fetch pincode details or geocode this address'),
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

    scrapePayload.residentialAddress = await this.enrichAddressSection({
      address: record.residentialAddress,
      landmark: record.residentialLandmark,
      city: record.residentialCity,
      state: record.residentialState,
      pincode: record.residentialPincode,
    });

    if (record.hasOfficeAddress) {
      scrapePayload.officeAddress = await this.enrichAddressSection({
        address: record.officeAddress,
        landmark: record.officeLandmark,
        city: record.officeCity,
        state: record.officeState,
        pincode: record.officePincode,
      });
    }

    if (record.hasBusinessAddress) {
      if (record.gstNumber?.trim()) {
        try {
          const res = await this.scrappingService.gstSearch(record.gstNumber.trim());
          scrapePayload.gst = {
            source: 'knowyourgst',
            scrapedAt: new Date().toISOString(),
            success: true,
            data: res.data as unknown as Record<string, unknown>,
          };
        } catch (error: any) {
          hasFailure = true;
          scrapePayload.gst = {
            source: 'knowyourgst',
            scrapedAt: new Date().toISOString(),
            success: false,
            error: error?.message ?? 'GST verification failed',
          };
        }
      }

      if (record.companyDomain?.trim()) {
        try {
          const res = await this.scrappingService.whoisSearch(record.companyDomain.trim());
          scrapePayload.domain = {
            source: 'whois.com',
            scrapedAt: new Date().toISOString(),
            success: true,
            data: res.data as unknown as Record<string, unknown>,
          };
        } catch (error: any) {
          hasFailure = true;
          scrapePayload.domain = {
            source: 'whois.com',
            scrapedAt: new Date().toISOString(),
            success: false,
            error: error?.message ?? 'WHOIS domain verification failed',
          };
        }
      }

      const gstFields =
        (scrapePayload.gst?.data as { fields?: Record<string, string> } | undefined)?.fields ?? {};
      const gstLegalName =
        gstFields['Legal Name of Business'] ||
        gstFields['Legal Name'] ||
        gstFields['Trade Name'] ||
        '';
      const nameMatched = businessNamesMatch(record.companyName ?? '', gstLegalName);
      scrapePayload.businessMatch = {
        source: 'gst-name-compare',
        scrapedAt: new Date().toISOString(),
        success: scrapePayload.gst?.success ? nameMatched : false,
        data: {
          submittedBusinessName: record.companyName,
          gstLegalName,
          matched: nameMatched,
        },
        error:
          scrapePayload.gst?.success && !nameMatched
            ? 'Submitted business name does not match GST public records'
            : undefined,
      };
      if (scrapePayload.gst?.success && !nameMatched) {
        hasFailure = true;
      }
    }

    record.scrapePayload = scrapePayload;
    record.status = hasFailure ? 'FAILED' : 'REPORT_GENERATED';
    record.reportGeneratedAt = hasFailure ? null : new Date();

    const saved = await this.repo.save(record);
    return {
      code: HttpStatus.OK,
      message: hasFailure
        ? 'Report generation failed during business verification'
        : 'Digital verification report generated successfully',
      data: saved,
    };
  }
}
