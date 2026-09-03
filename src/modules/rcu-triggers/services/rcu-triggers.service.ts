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
import { RcuCategory } from '../entities/rcu-category.entity';
import {
  RcuContentType,
  RcuDocumentType,
} from '../entities/rcu-document-type.entity';
import { RcuRiskLevel, RcuTrigger } from '../entities/rcu-trigger.entity';
import {
  CreateRcuCategoryDto,
  CreateRcuDocumentTypeDto,
  CreateRcuTriggerDto,
  UpdateRcuCategoryDto,
  UpdateRcuDocumentTypeDto,
  UpdateRcuFlagsDto,
  UpdateRcuTriggerDto,
} from '../dto/rcu-triggers.dto';

export interface RcuTreeMeta {
  title: string;
  subtitle: string;
  badge: string;
}

export interface RcuTreePayload {
  meta: RcuTreeMeta;
  categories: Array<{
    id: string;
    key: string;
    label: string;
    sortOrder: number;
    isActive: boolean;
    usedInOcr: boolean;
    documentTypes: Array<{
      id: string;
      categoryId: string;
      key: string;
      label: string;
      sidebarLabel: string | null;
      badge: string | null;
      description: string | null;
      icon: string | null;
      note: string | null;
      infoNote: string | null;
      contentType: RcuContentType;
      logic: Record<string, unknown> | null;
      taxSlabs: Record<string, unknown> | null;
      isActive: boolean;
      usedInOcr: boolean;
      sortOrder: number;
      triggers: Array<{
        id: string;
        documentTypeId: string;
        code: string;
        text: string;
        risk: RcuRiskLevel;
        section: string | null;
        isActive: boolean;
        usedInOcr: boolean;
        sortOrder: number;
      }>;
    }>;
  }>;
  stats: {
    totalCategories: number;
    totalDocumentTypes: number;
    totalTriggers: number;
  };
}

const DEFAULT_META: RcuTreeMeta = {
  title: 'Swarajya Finance Triggers',
  subtitle:
    'Comprehensive fraud detection triggers & document verification protocols for loan processing and RCU analysis.',
  badge: 'RISK CONTAINMENT UNIT',
};

@Injectable()
export class RcuTriggersService {
  constructor(
    @InjectRepository(RcuCategory)
    private readonly categoryRepo: Repository<RcuCategory>,
    @InjectRepository(RcuDocumentType)
    private readonly documentTypeRepo: Repository<RcuDocumentType>,
    @InjectRepository(RcuTrigger)
    private readonly triggerRepo: Repository<RcuTrigger>,
  ) {}

  // ---------- Tree (browse UI) ----------

  async getTree(options?: {
    activeOnly?: boolean;
  }): Promise<APIResponseInterface<RcuTreePayload>> {
    const activeOnly = options?.activeOnly === true;

    const categories = await this.categoryRepo.find({
      where: activeOnly ? { isActive: true } : undefined,
      order: { sortOrder: 'ASC', label: 'ASC' },
      relations: ['documentTypes', 'documentTypes.triggers'],
    });

    const mapped = categories
      .map((cat) => {
        let docs = [...(cat.documentTypes ?? [])].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.label.localeCompare(b.label),
        );
        if (activeOnly) docs = docs.filter((d) => d.isActive);

        const documentTypes = docs.map((doc) => {
          let triggers = [...(doc.triggers ?? [])].sort(
            (a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code),
          );
          if (activeOnly) triggers = triggers.filter((t) => t.isActive);

          return {
            id: doc.id,
            categoryId: doc.categoryId,
            key: doc.key,
            label: doc.label,
            sidebarLabel: doc.sidebarLabel,
            badge: doc.badge,
            description: doc.description,
            icon: doc.icon,
            note: doc.note,
            infoNote: doc.infoNote,
            contentType: doc.contentType,
            logic: doc.logic,
            taxSlabs: doc.taxSlabs,
            isActive: doc.isActive,
            usedInOcr: doc.usedInOcr,
            sortOrder: doc.sortOrder,
            triggers: triggers.map((t) => ({
              id: t.id,
              documentTypeId: t.documentTypeId,
              code: t.code,
              text: t.text,
              risk: t.risk,
              section: t.section,
              isActive: t.isActive,
              usedInOcr: t.usedInOcr,
              sortOrder: t.sortOrder,
            })),
          };
        });

        return {
          id: cat.id,
          key: cat.key,
          label: cat.label,
          sortOrder: cat.sortOrder,
          isActive: cat.isActive,
          usedInOcr: cat.usedInOcr,
          documentTypes,
        };
      })
      .filter((c) => !activeOnly || c.documentTypes.length > 0);

    const totalDocumentTypes = mapped.reduce(
      (s, c) => s + c.documentTypes.length,
      0,
    );
    const totalTriggers = mapped.reduce(
      (s, c) =>
        s + c.documentTypes.reduce((ds, d) => ds + d.triggers.length, 0),
      0,
    );

    return {
      code: HttpStatus.OK,
      message: 'RCU triggers tree fetched successfully',
      data: {
        meta: DEFAULT_META,
        categories: mapped,
        stats: {
          totalCategories: mapped.length,
          totalDocumentTypes,
          totalTriggers,
        },
      },
    };
  }

  // ---------- Categories ----------

  async listCategories(): Promise<APIResponseInterface<RcuCategory[]>> {
    const rows = await this.categoryRepo.find({
      order: { sortOrder: 'ASC', label: 'ASC' },
    });
    return {
      code: HttpStatus.OK,
      message: 'RCU categories fetched successfully',
      data: rows,
    };
  }

  async createCategory(
    dto: CreateRcuCategoryDto,
  ): Promise<APIResponseInterface<RcuCategory>> {
    const key = dto.key.trim().toLowerCase();
    await this.ensureUniqueCategoryKey(key);

    const sortOrder =
      dto.sortOrder !== undefined
        ? dto.sortOrder
        : await this.nextCategorySortOrder();

    const saved = await this.categoryRepo.save(
      this.categoryRepo.create({
        key,
        label: dto.label.trim(),
        sortOrder,
        isActive: dto.isActive ?? true,
        usedInOcr: dto.usedInOcr ?? false,
      }),
    );

    return {
      code: HttpStatus.CREATED,
      message: 'Category created successfully',
      data: saved,
    };
  }

  async updateCategory(
    id: string,
    dto: UpdateRcuCategoryDto,
  ): Promise<APIResponseInterface<RcuCategory>> {
    const row = await this.categoryRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Category not found');

    if (dto.key !== undefined) {
      const key = dto.key.trim().toLowerCase();
      await this.ensureUniqueCategoryKey(key, id);
      row.key = key;
    }
    if (dto.label !== undefined) row.label = dto.label.trim();
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.usedInOcr !== undefined) row.usedInOcr = dto.usedInOcr;

    const saved = await this.categoryRepo.save(row);
    return {
      code: HttpStatus.OK,
      message: 'Category updated successfully',
      data: saved,
    };
  }

  async removeCategory(id: string): Promise<APIResponseInterface<null>> {
    const row = await this.categoryRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Category not found');
    await this.categoryRepo.remove(row);
    return {
      code: HttpStatus.OK,
      message: 'Category deleted successfully',
      data: null,
    };
  }

  // ---------- Document types ----------

  async createDocumentType(
    dto: CreateRcuDocumentTypeDto,
  ): Promise<APIResponseInterface<RcuDocumentType>> {
    await this.requireCategory(dto.categoryId);
    const key = dto.key.trim().toLowerCase();
    await this.ensureUniqueDocumentKey(key);

    const sortOrder =
      dto.sortOrder !== undefined
        ? dto.sortOrder
        : await this.nextDocumentSortOrder(dto.categoryId);

    const saved = await this.documentTypeRepo.save(
      this.documentTypeRepo.create({
        categoryId: dto.categoryId,
        key,
        label: dto.label.trim(),
        sidebarLabel: dto.sidebarLabel?.trim() || null,
        badge: dto.badge?.trim() || null,
        description: dto.description?.trim() || null,
        icon: dto.icon?.trim() || null,
        note: dto.note?.trim() || null,
        infoNote: dto.infoNote?.trim() || null,
        contentType: dto.contentType ?? 'triggers',
        logic: dto.logic ?? null,
        taxSlabs: dto.taxSlabs ?? null,
        isActive: dto.isActive ?? true,
        usedInOcr: dto.usedInOcr ?? false,
        sortOrder,
      }),
    );

    return {
      code: HttpStatus.CREATED,
      message: 'Document type created successfully',
      data: saved,
    };
  }

  async updateDocumentType(
    id: string,
    dto: UpdateRcuDocumentTypeDto,
  ): Promise<APIResponseInterface<RcuDocumentType>> {
    const row = await this.documentTypeRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Document type not found');

    if (dto.categoryId !== undefined) {
      await this.requireCategory(dto.categoryId);
      row.categoryId = dto.categoryId;
    }
    if (dto.key !== undefined) {
      const key = dto.key.trim().toLowerCase();
      await this.ensureUniqueDocumentKey(key, id);
      row.key = key;
    }
    if (dto.label !== undefined) row.label = dto.label.trim();
    if (dto.sidebarLabel !== undefined) {
      row.sidebarLabel = dto.sidebarLabel?.trim() || null;
    }
    if (dto.badge !== undefined) row.badge = dto.badge?.trim() || null;
    if (dto.description !== undefined) {
      row.description = dto.description?.trim() || null;
    }
    if (dto.icon !== undefined) row.icon = dto.icon?.trim() || null;
    if (dto.note !== undefined) row.note = dto.note?.trim() || null;
    if (dto.infoNote !== undefined) row.infoNote = dto.infoNote?.trim() || null;
    if (dto.contentType !== undefined) row.contentType = dto.contentType;
    if (dto.logic !== undefined) row.logic = dto.logic;
    if (dto.taxSlabs !== undefined) row.taxSlabs = dto.taxSlabs;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.usedInOcr !== undefined) row.usedInOcr = dto.usedInOcr;
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;

    const saved = await this.documentTypeRepo.save(row);
    return {
      code: HttpStatus.OK,
      message: 'Document type updated successfully',
      data: saved,
    };
  }

  async updateDocumentTypeFlags(
    id: string,
    dto: UpdateRcuFlagsDto,
  ): Promise<APIResponseInterface<RcuDocumentType>> {
    if (dto.isActive === undefined && dto.usedInOcr === undefined) {
      throw new BadRequestException('Provide isActive and/or usedInOcr');
    }
    const row = await this.documentTypeRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Document type not found');

    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.usedInOcr !== undefined) row.usedInOcr = dto.usedInOcr;

    const saved = await this.documentTypeRepo.save(row);
    return {
      code: HttpStatus.OK,
      message: 'Document type flags updated successfully',
      data: saved,
    };
  }

  async removeDocumentType(id: string): Promise<APIResponseInterface<null>> {
    const row = await this.documentTypeRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Document type not found');
    await this.documentTypeRepo.remove(row);
    return {
      code: HttpStatus.OK,
      message: 'Document type deleted successfully',
      data: null,
    };
  }

  // ---------- Triggers ----------

  async createTrigger(
    dto: CreateRcuTriggerDto,
  ): Promise<APIResponseInterface<RcuTrigger>> {
    await this.requireDocumentType(dto.documentTypeId);
    const code = dto.code.trim();
    await this.ensureUniqueTriggerCode(dto.documentTypeId, code);

    const sortOrder =
      dto.sortOrder !== undefined
        ? dto.sortOrder
        : await this.nextTriggerSortOrder(dto.documentTypeId);

    const saved = await this.triggerRepo.save(
      this.triggerRepo.create({
        documentTypeId: dto.documentTypeId,
        code,
        text: dto.text.trim(),
        risk: dto.risk,
        section: dto.section?.trim() || null,
        isActive: dto.isActive ?? true,
        usedInOcr: dto.usedInOcr ?? false,
        sortOrder,
      }),
    );

    return {
      code: HttpStatus.CREATED,
      message: 'Trigger created successfully',
      data: saved,
    };
  }

  async updateTrigger(
    id: string,
    dto: UpdateRcuTriggerDto,
  ): Promise<APIResponseInterface<RcuTrigger>> {
    const row = await this.triggerRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Trigger not found');

    if (dto.documentTypeId !== undefined) {
      await this.requireDocumentType(dto.documentTypeId);
      row.documentTypeId = dto.documentTypeId;
    }

    const documentTypeId = row.documentTypeId;
    if (dto.code !== undefined) {
      const code = dto.code.trim();
      await this.ensureUniqueTriggerCode(documentTypeId, code, id);
      row.code = code;
    } else if (dto.documentTypeId !== undefined) {
      // Moving to another document type — ensure current code is unique there
      await this.ensureUniqueTriggerCode(documentTypeId, row.code, id);
    }

    if (dto.text !== undefined) row.text = dto.text.trim();
    if (dto.risk !== undefined) row.risk = dto.risk;
    if (dto.section !== undefined) row.section = dto.section?.trim() || null;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.usedInOcr !== undefined) row.usedInOcr = dto.usedInOcr;
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;

    const saved = await this.triggerRepo.save(row);
    return {
      code: HttpStatus.OK,
      message: 'Trigger updated successfully',
      data: saved,
    };
  }

  async updateTriggerFlags(
    id: string,
    dto: UpdateRcuFlagsDto,
  ): Promise<APIResponseInterface<RcuTrigger>> {
    if (dto.isActive === undefined && dto.usedInOcr === undefined) {
      throw new BadRequestException('Provide isActive and/or usedInOcr');
    }
    const row = await this.triggerRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Trigger not found');

    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.usedInOcr !== undefined) row.usedInOcr = dto.usedInOcr;

    const saved = await this.triggerRepo.save(row);
    return {
      code: HttpStatus.OK,
      message: 'Trigger flags updated successfully',
      data: saved,
    };
  }

  async removeTrigger(id: string): Promise<APIResponseInterface<null>> {
    const row = await this.triggerRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Trigger not found');
    await this.triggerRepo.remove(row);
    return {
      code: HttpStatus.OK,
      message: 'Trigger deleted successfully',
      data: null,
    };
  }

  /**
   * OCR lookup: match document type by string (key/label), require usedInOcr + isActive,
   * then return triggers that are also usedInOcr + isActive.
   * If no document type matches, fall back to the "other" OCR document type.
   * Extra hints (e.g. display label) improve matching against custom admin names.
   */
  async findOcrTriggersForDocumentType(
    documentTypeHint: string,
    extraHints: string[] = [],
  ): Promise<{
    matchedKey: string | null;
    matchedLabel: string | null;
    usedFallbackOther: boolean;
    matchScore: number;
    triggers: Array<{
      code: string;
      text: string;
      risk: RcuRiskLevel;
      section: string | null;
    }>;
  }> {
    const docs = await this.documentTypeRepo.find({
      where: { isActive: true },
      relations: ['triggers'],
      order: { sortOrder: 'ASC', label: 'ASC' },
    });

    // Prefer OCR-enabled document types; if none match, allow active non-OCR types as a last resort.
    const ocrDocs = docs.filter((d) => d.usedInOcr);
    const searchPools = ocrDocs.length ? [ocrDocs, docs] : [docs];

    const hints = [documentTypeHint, ...extraHints]
      .map((h) => (h ?? '').trim())
      .filter(Boolean);

    let matched: RcuDocumentType | null = null;
    let matchScore = 0;
    for (const pool of searchPools) {
      for (const hint of hints) {
        const result = this.pickBestDocumentTypeMatch(pool, hint);
        if (result && result.score > matchScore) {
          matched = result.doc;
          matchScore = result.score;
        }
      }
      if (matched && matchScore >= 70) break;
    }

    let usedFallbackOther = false;
    if (!matched) {
      const fallback = this.pickBestDocumentTypeMatch(docs, 'other');
      matched = fallback?.doc ?? null;
      matchScore = fallback?.score ?? 0;
      usedFallbackOther = !!matched;
    }

    const triggers = (matched?.triggers ?? [])
      .filter((t) => t.isActive && t.usedInOcr)
      .sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code))
      .map((t) => ({
        code: t.code,
        text: t.text,
        risk: t.risk,
        section: t.section,
      }));

    return {
      matchedKey: matched?.key ?? null,
      matchedLabel: matched?.label ?? null,
      usedFallbackOther,
      matchScore,
      triggers,
    };
  }

  // ---------- Helpers ----------

  private async requireCategory(id: string): Promise<RcuCategory> {
    const row = await this.categoryRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Category not found');
    return row;
  }

  private async requireDocumentType(id: string): Promise<RcuDocumentType> {
    const row = await this.documentTypeRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Document type not found');
    return row;
  }

  private async ensureUniqueCategoryKey(
    key: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.categoryRepo.findOne({ where: { key } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Category key "${key}" already exists`);
    }
  }

  private async ensureUniqueDocumentKey(
    key: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.documentTypeRepo.findOne({ where: { key } });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(`Document type key "${key}" already exists`);
    }
  }

  private async ensureUniqueTriggerCode(
    documentTypeId: string,
    code: string,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.triggerRepo.findOne({
      where: { documentTypeId, code },
    });
    if (existing && existing.id !== excludeId) {
      throw new ConflictException(
        `Trigger code "${code}" already exists for this document type`,
      );
    }
  }

  private async nextCategorySortOrder(): Promise<number> {
    const last = await this.categoryRepo.find({
      order: { sortOrder: 'DESC' },
      take: 1,
    });
    return (last[0]?.sortOrder ?? -1) + 1;
  }

  private async nextDocumentSortOrder(categoryId: string): Promise<number> {
    const last = await this.documentTypeRepo.find({
      where: { categoryId },
      order: { sortOrder: 'DESC' },
      take: 1,
    });
    return (last[0]?.sortOrder ?? -1) + 1;
  }

  private async nextTriggerSortOrder(documentTypeId: string): Promise<number> {
    const last = await this.triggerRepo.find({
      where: { documentTypeId },
      order: { sortOrder: 'DESC' },
      take: 1,
    });
    return (last[0]?.sortOrder ?? -1) + 1;
  }

  private normalizeDocTypeText(value: string): string {
    let text = value
      .toLowerCase()
      .replace(/[_/]+/g, ' ')
      .replace(/-/g, ' ')
      // Drop noisy suffixes admins often append in UI labels
      .replace(/\b(ocr|verification|document|documents|type|card)\b/g, ' ')
      // Common typo: "salary sleep" → "salary slip"
      .replace(/\bsleep\b/g, 'slip')
      .replace(/\s+/g, ' ')
      .trim();
    return text;
  }

  private compactDocTypeText(value: string): string {
    return this.normalizeDocTypeText(value).replace(/\s+/g, '');
  }

  private hintVariants(hint: string): string[] {
    const normalized = this.normalizeDocTypeText(hint);
    const compact = this.compactDocTypeText(hint);
    const aliases: Record<string, string[]> = {
      pan: ['pan', 'pancard'],
      pancard: ['pan', 'pancard'],
      aadhaar: ['aadhaar', 'aadhar', 'aadhaarcard', 'aadharcard'],
      aadhar: ['aadhaar', 'aadhar', 'aadhaarcard', 'aadharcard'],
      aadhaarcard: ['aadhaar', 'aadhaarcard'],
      salaryslip: [
        'salaryslip',
        'salarycertificate',
        'salarysleep',
        'payslip',
        'pay slip',
        'joiningletter',
      ],
      salarysleep: ['salaryslip', 'salarysleep', 'payslip'],
      payslip: ['salaryslip', 'payslip'],
      form16: ['form16'],
      bankstatement: [
        'bankstatement',
        'bankstmt',
        'bankstmtmanual',
        'bankstmtdigital',
        'bankstmtcoded',
        'accountstatement',
      ],
      accountstatement: [
        'bankstatement',
        'bankstmt',
        'bankstmtmanual',
        'bankstmtdigital',
        'bankstmtcoded',
        'accountstatement',
      ],
      other: ['other', 'others', 'otherdocs'],
      others: ['other', 'others', 'otherdocs'],
      addressproof: ['addressproof', 'other', 'others', 'otherdocs'],
      ownershipdeed: ['ownershipdeed', 'other', 'others', 'otherdocs'],
      agreement: ['rentagreement', 'agreement', 'other', 'others', 'otherdocs'],
      agreementcopy: ['rentagreement', 'agreement', 'other', 'others', 'otherdocs'],
    };

    const variants = new Set<string>([
      normalized,
      compact,
      normalized.replace('statement', 'stmt'),
      compact.replace('statement', 'stmt'),
      ...(aliases[compact] ?? []),
    ]);

    // Also add token-stripped compact forms without spaces from aliases
    for (const alias of aliases[compact] ?? []) {
      variants.add(alias.replace(/\s+/g, ''));
    }

    return [...variants].filter(Boolean);
  }

  private tokenSet(value: string): Set<string> {
    return new Set(
      this.normalizeDocTypeText(value)
        .split(' ')
        .map((t) => t.trim())
        .filter((t) => t.length >= 2),
    );
  }

  private scoreDocumentTypeMatch(
    hintVariants: string[],
    key: string,
    label: string,
  ): number {
    const kn = this.normalizeDocTypeText(key);
    const ln = this.normalizeDocTypeText(label);
    const kc = this.compactDocTypeText(key);
    const lc = this.compactDocTypeText(label);
    let best = 0;

    for (const hint of hintVariants) {
      const hc = hint.replace(/\s+/g, '');
      if (!hc) continue;
      if (kn === hint || ln === hint || kc === hc || lc === hc) {
        best = Math.max(best, 100);
      } else if (kc.startsWith(hc) || lc.startsWith(hc) || hc.startsWith(kc) || hc.startsWith(lc)) {
        best = Math.max(best, 85);
      } else if (kc.includes(hc) || lc.includes(hc) || hc.includes(kc) || hc.includes(lc)) {
        // Prefer longer overlap
        const overlap = Math.min(hc.length, Math.max(kc.length, lc.length));
        best = Math.max(best, overlap >= 6 ? 80 : 70);
      } else if (hc.includes(kc) && kc.length >= 4) {
        best = Math.max(best, 60);
      }
    }

    // Token overlap: "salary slip" vs "salary sleep ocr" → salary + slip (after sleep→slip)
    for (const hint of hintVariants) {
      const hintTokens = this.tokenSet(hint);
      if (!hintTokens.size) continue;
      for (const target of [key, label]) {
        const targetTokens = this.tokenSet(target);
        if (!targetTokens.size) continue;
        let shared = 0;
        for (const t of hintTokens) {
          if (targetTokens.has(t)) shared++;
        }
        if (shared === 0) continue;
        const ratio = shared / Math.max(hintTokens.size, targetTokens.size);
        if (shared >= 2 || (shared === 1 && hintTokens.size === 1 && targetTokens.has([...hintTokens][0]))) {
          best = Math.max(best, Math.round(55 + ratio * 40));
        }
      }
    }

    return best;
  }

  private pickBestDocumentTypeMatch(
    docs: RcuDocumentType[],
    hint: string,
  ): { doc: RcuDocumentType; score: number } | null {
    const variants = this.hintVariants(hint);
    let best: { doc: RcuDocumentType; score: number } | null = null;

    for (const doc of docs) {
      const score = this.scoreDocumentTypeMatch(variants, doc.key, doc.label);
      if (score < 55) continue;
      if (!best || score > best.score) {
        best = { doc, score };
      }
    }

    return best;
  }
}
