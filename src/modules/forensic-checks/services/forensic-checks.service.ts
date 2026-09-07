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
  ForensicCategory,
  ForensicCheck,
  ForensicSeverity,
} from '../entities/forensic-check.entity';
import {
  CreateForensicCheckDto,
  UpdateForensicCheckDto,
  UpdateForensicFlagsDto,
} from '../dto/forensic-checks.dto';

export type OcrForensicConfigPayload = {
  code: string;
  engineKey: string;
  threatCode: string;
  title: string;
  description: string;
  severity: ForensicSeverity;
  score: number;
  category: ForensicCategory;
  documentTypePattern?: string | null;
};

export type ForensicChecksListPayload = {
  meta: {
    title: string;
    subtitle: string;
    badge: string;
  };
  checks: ForensicCheck[];
  stats: {
    total: number;
    active: number;
    usedInOcr: number;
    byCategory: Record<string, number>;
  };
};

@Injectable()
export class ForensicChecksService {
  constructor(
    @InjectRepository(ForensicCheck)
    private readonly repo: Repository<ForensicCheck>,
  ) {}

  async list(options?: {
    activeOnly?: boolean;
  }): Promise<APIResponseInterface<ForensicChecksListPayload>> {
    const where = options?.activeOnly ? { isActive: true } : undefined;
    const checks = await this.repo.find({
      where,
      order: { category: 'ASC', sortOrder: 'ASC', threatCode: 'ASC', code: 'ASC' },
    });

    const byCategory: Record<string, number> = {
      PDF: 0,
      IMAGE: 0,
      DOC: 0,
      ZIP: 0,
    };
    for (const c of checks) {
      byCategory[c.category] = (byCategory[c.category] ?? 0) + 1;
    }

    return {
      code: HttpStatus.OK,
      message: 'Forensic checks loaded',
      data: {
        meta: {
          title: 'Document Forensics',
          subtitle:
            'Forensic checks are grouped by upload file type (PDF, Image, DOC, ZIP). On verification, only the matching group is executed.',
          badge: 'DOCUMENT INTELLIGENCE',
        },
        checks,
        stats: {
          total: checks.length,
          active: checks.filter((c) => c.isActive).length,
          usedInOcr: checks.filter((c) => c.usedInOcr && c.isActive).length,
          byCategory,
        },
      },
    };
  }

  async getOne(id: string): Promise<APIResponseInterface<ForensicCheck>> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Forensic check not found');
    return {
      code: HttpStatus.OK,
      message: 'Forensic check loaded',
      data: row,
    };
  }

  /**
   * OCR runtime configs for a detected file category.
   * Returns `null` when catalog is empty (OCR uses hardcoded defaults).
   * Returns `[]` when catalog exists but no active OCR checks for that category.
   */
  async getOcrForensicConfigs(
    fileCategory?: ForensicCategory | null,
  ): Promise<OcrForensicConfigPayload[] | null> {
    const total = await this.repo.count();
    if (total === 0) return null;

    const where: {
      isActive: boolean;
      usedInOcr: boolean;
      category?: ForensicCategory;
    } = { isActive: true, usedInOcr: true };
    if (fileCategory) where.category = fileCategory;

    const rows = await this.repo.find({
      where,
      order: { sortOrder: 'ASC', code: 'ASC' },
    });

    return rows.map((r) => ({
      code: r.code,
      engineKey: r.engineKey || r.code,
      threatCode: r.threatCode,
      title: r.title,
      description: r.description,
      severity: r.severity,
      score: r.score,
      category: r.category,
      documentTypePattern: r.documentTypePattern,
    }));
  }

  async create(
    dto: CreateForensicCheckDto,
  ): Promise<APIResponseInterface<ForensicCheck>> {
    const code = dto.code.trim().toUpperCase().replace(/\s+/g, '_');
    const existing = await this.repo.findOne({ where: { code } });
    if (existing) {
      throw new ConflictException(`Forensic check code "${code}" already exists`);
    }

    const engineKey = (dto.engineKey || code).trim().toUpperCase().replace(/\s+/g, '_');

    const row = this.repo.create({
      code,
      engineKey,
      threatCode: dto.threatCode.trim().toUpperCase(),
      category: dto.category as ForensicCategory,
      title: dto.title.trim(),
      description: dto.description.trim(),
      severity: dto.severity as ForensicSeverity,
      score: dto.score,
      documentTypePattern: dto.documentTypePattern?.trim() || null,
      isActive: dto.isActive ?? true,
      usedInOcr: dto.usedInOcr ?? true,
      isSystem: false,
      sortOrder: dto.sortOrder ?? 0,
    });

    const saved = await this.repo.save(row);
    return {
      code: HttpStatus.CREATED,
      message: 'Forensic check created',
      data: saved,
    };
  }

  async update(
    id: string,
    dto: UpdateForensicCheckDto,
  ): Promise<APIResponseInterface<ForensicCheck>> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Forensic check not found');

    if (dto.code !== undefined) {
      const nextCode = dto.code.trim().toUpperCase().replace(/\s+/g, '_');
      if (row.isSystem && nextCode !== row.code) {
        throw new BadRequestException('System forensic check code cannot be changed');
      }
      if (nextCode !== row.code) {
        const clash = await this.repo.findOne({ where: { code: nextCode } });
        if (clash) {
          throw new ConflictException(`Forensic check code "${nextCode}" already exists`);
        }
        row.code = nextCode;
      }
    }

    if (dto.engineKey !== undefined) {
      row.engineKey = dto.engineKey.trim().toUpperCase().replace(/\s+/g, '_') || row.code;
    }
    if (dto.threatCode !== undefined) {
      row.threatCode = dto.threatCode.trim().toUpperCase();
    }
    if (dto.category !== undefined) row.category = dto.category as ForensicCategory;
    if (dto.title !== undefined) row.title = dto.title.trim();
    if (dto.description !== undefined) row.description = dto.description.trim();
    if (dto.severity !== undefined) row.severity = dto.severity as ForensicSeverity;
    if (dto.score !== undefined) row.score = dto.score;
    if (dto.documentTypePattern !== undefined) {
      row.documentTypePattern = dto.documentTypePattern?.trim() || null;
    }
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.usedInOcr !== undefined) row.usedInOcr = dto.usedInOcr;
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;

    const saved = await this.repo.save(row);
    return {
      code: HttpStatus.OK,
      message: 'Forensic check updated',
      data: saved,
    };
  }

  async updateFlags(
    id: string,
    dto: UpdateForensicFlagsDto,
  ): Promise<APIResponseInterface<ForensicCheck>> {
    if (dto.isActive === undefined && dto.usedInOcr === undefined) {
      throw new BadRequestException('Provide isActive and/or usedInOcr');
    }
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Forensic check not found');
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.usedInOcr !== undefined) row.usedInOcr = dto.usedInOcr;
    const saved = await this.repo.save(row);
    return {
      code: HttpStatus.OK,
      message: 'Forensic check flags updated',
      data: saved,
    };
  }

  async remove(id: string): Promise<APIResponseInterface<{ id: string }>> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Forensic check not found');
    if (row.isSystem) {
      throw new BadRequestException(
        'System forensic checks cannot be deleted. Disable them instead.',
      );
    }
    await this.repo.remove(row);
    return {
      code: HttpStatus.OK,
      message: 'Forensic check deleted',
      data: { id },
    };
  }
}
