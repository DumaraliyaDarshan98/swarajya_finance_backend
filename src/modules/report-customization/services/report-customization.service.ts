import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';
import {
  ReportCustomization,
  ReportCustomizationType,
  ReportTemplateSection,
} from '../entities/report-customization.entity';
import {
  CreateReportCustomizationDto,
  ListReportCustomizationsQueryDto,
  UpdateReportCustomizationDto,
} from '../dto/report-customization.dto';
import {
  buildDefaultTemplatePayload,
  PHYSICAL_REPORT_SUB_TYPES,
} from '../helpers/default-report-templates.helper';

@Injectable()
export class ReportCustomizationService {
  constructor(
    @InjectRepository(ReportCustomization)
    private readonly repo: Repository<ReportCustomization>,
  ) {}

  private normalizeSections(sections: ReportTemplateSection[]): ReportTemplateSection[] {
    return [...sections]
      .map((s, index) => ({
        ...s,
        order: s.order ?? index + 1,
        fields: s.fields?.map((f) => ({ ...f })) ?? undefined,
      }))
      .sort((a, b) => a.order - b.order)
      .map((s, index) => ({ ...s, order: index + 1 }));
  }

  private assertTypeRules(
    reportType: ReportCustomizationType,
    physicalSubType?: string | null,
  ): string | null {
    if (reportType === 'PHYSICAL') {
      if (!physicalSubType) {
        throw new BadRequestException(
          'physicalSubType is required for PHYSICAL report customization',
        );
      }
      if (!PHYSICAL_REPORT_SUB_TYPES.includes(physicalSubType as any)) {
        throw new BadRequestException(
          `Invalid physicalSubType. Allowed: ${PHYSICAL_REPORT_SUB_TYPES.join(', ')}`,
        );
      }
      return physicalSubType;
    }
    return null;
  }

  private async deactivateOthers(
    reportType: ReportCustomizationType,
    physicalSubType: string | null,
    exceptId?: string,
  ): Promise<void> {
    const qb = this.repo
      .createQueryBuilder()
      .update(ReportCustomization)
      .set({ status: 'Inactive' })
      .where('report_type = :reportType', { reportType })
      .andWhere('status = :status', { status: 'Active' });

    if (physicalSubType) {
      qb.andWhere('physical_sub_type = :physicalSubType', { physicalSubType });
    } else {
      qb.andWhere('physical_sub_type IS NULL');
    }

    if (exceptId) {
      qb.andWhere('id != :exceptId', { exceptId });
    }

    await qb.execute();
  }

  async list(
    query: ListReportCustomizationsQueryDto,
  ): Promise<APIResponseInterface<ReportCustomization[]>> {
    const page = query.page ?? 1;
    const pagePerRecord = query.pagePerRecord ?? 20;

    const qb = this.repo.createQueryBuilder('rc').orderBy('rc.updatedAt', 'DESC');

    if (query.reportType) {
      qb.andWhere('rc.reportType = :reportType', { reportType: query.reportType });
    }
    if (query.physicalSubType) {
      qb.andWhere('rc.physicalSubType = :physicalSubType', {
        physicalSubType: query.physicalSubType,
      });
    }
    if (query.status) {
      qb.andWhere('rc.status = :status', { status: query.status });
    }
    if (query.search?.trim()) {
      qb.andWhere('(rc.name LIKE :search OR rc.title LIKE :search)', {
        search: `%${query.search.trim()}%`,
      });
    }

    const [rows, total] = await qb
      .skip((page - 1) * pagePerRecord)
      .take(pagePerRecord)
      .getManyAndCount();

    return {
      code: HttpStatus.OK,
      message: 'Report customizations fetched successfully',
      data: rows,
      pagination: { total, page, pagePerRecord },
    };
  }

  async findOne(id: string): Promise<APIResponseInterface<ReportCustomization>> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Report customization not found');
    return {
      code: HttpStatus.OK,
      message: 'Report customization fetched successfully',
      data: row,
    };
  }

  async getDefaults(
    reportType: ReportCustomizationType,
    physicalSubType?: string | null,
  ): Promise<APIResponseInterface<ReturnType<typeof buildDefaultTemplatePayload>>> {
    if (!['DIGITAL', 'OCR', 'TRIANGULATION', 'PHYSICAL'].includes(reportType)) {
      throw new BadRequestException('Invalid reportType');
    }
    const sub =
      reportType === 'PHYSICAL'
        ? this.assertTypeRules(reportType, physicalSubType || 'PD')
        : null;
    return {
      code: HttpStatus.OK,
      message: 'Default report template fetched successfully',
      data: buildDefaultTemplatePayload(reportType, sub),
    };
  }

  /**
   * Resolve active custom template for a report type, else return built-in default.
   */
  async resolve(
    reportType: ReportCustomizationType,
    physicalSubType?: string | null,
  ): Promise<
    APIResponseInterface<{
      id: string | null;
      name: string | null;
      reportType: ReportCustomizationType;
      physicalSubType: string | null;
      title: string;
      sections: ReportTemplateSection[];
      source: 'custom' | 'default';
      status: 'Active' | 'Inactive' | null;
    }>
  > {
    if (!['DIGITAL', 'OCR', 'TRIANGULATION', 'PHYSICAL'].includes(reportType)) {
      throw new BadRequestException('Invalid reportType');
    }

    const sub =
      reportType === 'PHYSICAL'
        ? this.assertTypeRules(reportType, physicalSubType)
        : null;

    const qb = this.repo
      .createQueryBuilder('rc')
      .where('rc.reportType = :reportType', { reportType })
      .andWhere('rc.status = :status', { status: 'Active' })
      .orderBy('rc.updatedAt', 'DESC');

    if (reportType === 'PHYSICAL') {
      qb.andWhere('rc.physicalSubType = :physicalSubType', { physicalSubType: sub });
    } else {
      qb.andWhere('rc.physicalSubType IS NULL');
    }

    const active = await qb.getOne();

    if (active) {
      return {
        code: HttpStatus.OK,
        message: 'Custom report template resolved',
        data: {
          id: active.id,
          name: active.name,
          reportType: active.reportType,
          physicalSubType: active.physicalSubType,
          title: active.title,
          sections: this.normalizeSections(active.sections || []),
          source: 'custom',
          status: active.status,
        },
      };
    }

    const defaults = buildDefaultTemplatePayload(reportType, sub);
    return {
      code: HttpStatus.OK,
      message: 'Default report template resolved',
      data: {
        id: null,
        name: null,
        reportType: defaults.reportType,
        physicalSubType: defaults.physicalSubType,
        title: defaults.title,
        sections: defaults.sections,
        source: 'default',
        status: null,
      },
    };
  }

  async create(
    dto: CreateReportCustomizationDto,
    userId?: string,
  ): Promise<APIResponseInterface<ReportCustomization>> {
    const physicalSubType = this.assertTypeRules(
      dto.reportType,
      dto.physicalSubType,
    );
    const status = dto.status ?? 'Inactive';

    if (!dto.sections?.length) {
      throw new BadRequestException('At least one section is required');
    }

    if (status === 'Active') {
      await this.deactivateOthers(dto.reportType, physicalSubType);
    }

    const entity = this.repo.create({
      name: dto.name.trim(),
      reportType: dto.reportType,
      physicalSubType,
      title: dto.title.trim(),
      sections: this.normalizeSections(dto.sections as ReportTemplateSection[]),
      status,
      createdBy: userId ?? null,
      updatedBy: userId ?? null,
    });

    const saved = await this.repo.save(entity);
    return {
      code: HttpStatus.CREATED,
      message: 'Report customization created successfully',
      data: saved,
    };
  }

  async update(
    id: string,
    dto: UpdateReportCustomizationDto,
    userId?: string,
  ): Promise<APIResponseInterface<ReportCustomization>> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Report customization not found');

    const nextType = (dto.reportType ?? row.reportType) as ReportCustomizationType;
    const nextSubRaw =
      dto.physicalSubType !== undefined ? dto.physicalSubType : row.physicalSubType;
    const physicalSubType = this.assertTypeRules(nextType, nextSubRaw);
    const nextStatus = dto.status ?? row.status;

    if (dto.sections && !dto.sections.length) {
      throw new BadRequestException('At least one section is required');
    }

    if (nextStatus === 'Active') {
      await this.deactivateOthers(nextType, physicalSubType, id);
    }

    row.name = dto.name?.trim() ?? row.name;
    row.reportType = nextType;
    row.physicalSubType = physicalSubType;
    row.title = dto.title?.trim() ?? row.title;
    if (dto.sections) {
      row.sections = this.normalizeSections(dto.sections as ReportTemplateSection[]);
    }
    row.status = nextStatus;
    row.updatedBy = userId ?? row.updatedBy;

    const saved = await this.repo.save(row);
    return {
      code: HttpStatus.OK,
      message: 'Report customization updated successfully',
      data: saved,
    };
  }

  async updateStatus(
    id: string,
    status: 'Active' | 'Inactive',
    userId?: string,
  ): Promise<APIResponseInterface<ReportCustomization>> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Report customization not found');

    if (status === 'Active') {
      await this.deactivateOthers(row.reportType, row.physicalSubType, id);
    }

    row.status = status;
    row.updatedBy = userId ?? row.updatedBy;
    const saved = await this.repo.save(row);
    return {
      code: HttpStatus.OK,
      message: `Report customization marked as ${status}`,
      data: saved,
    };
  }

  async remove(id: string): Promise<APIResponseInterface<{ id: string }>> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Report customization not found');
    if (row.status === 'Active') {
      throw new ConflictException(
        'Cannot delete an Active template. Set it Inactive first.',
      );
    }
    await this.repo.remove(row);
    return {
      code: HttpStatus.OK,
      message: 'Report customization deleted successfully',
      data: { id },
    };
  }
}
