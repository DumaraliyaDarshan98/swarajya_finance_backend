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
import { PortalCategory } from '../entities/portal-category.entity';
import { Portal } from '../entities/portal.entity';
import {
  CreatePortalCategoryDto,
  CreatePortalDto,
  UpdatePortalCategoryDto,
  UpdatePortalDto,
  UpdatePortalFlagsDto,
} from '../dto/portal-list.dto';

export interface PortalTreePayload {
  categories: Array<{
    id: string;
    key: string;
    name: string;
    sortOrder: number;
    isActive: boolean;
    usedInDigitalReport: boolean;
    portalCount: number;
    portals: Array<{
      id: string;
      categoryId: string;
      title: string;
      state: string;
      url: string;
      isActive: boolean;
      usedInDigitalReport: boolean;
      sortOrder: number;
      categoryName: string;
    }>;
  }>;
  stats: {
    totalCategories: number;
    totalPortals: number;
  };
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
}

@Injectable()
export class PortalListService {
  constructor(
    @InjectRepository(PortalCategory)
    private readonly categoryRepo: Repository<PortalCategory>,
    @InjectRepository(Portal)
    private readonly portalRepo: Repository<Portal>,
  ) {}

  async getTree(options?: {
    activeOnly?: boolean;
  }): Promise<APIResponseInterface<PortalTreePayload>> {
    const activeOnly = options?.activeOnly === true;
    const categories = await this.categoryRepo.find({
      where: activeOnly ? { isActive: true } : undefined,
      order: { sortOrder: 'ASC', name: 'ASC' },
      relations: ['portals'],
    });

    const mapped = categories
      .map((cat) => {
        let portals = [...(cat.portals ?? [])].sort(
          (a, b) => a.sortOrder - b.sortOrder || a.title.localeCompare(b.title),
        );
        if (activeOnly) portals = portals.filter((p) => p.isActive);

        return {
          id: cat.id,
          key: cat.key,
          name: cat.name,
          sortOrder: cat.sortOrder,
          isActive: cat.isActive,
          usedInDigitalReport: cat.usedInDigitalReport,
          portalCount: portals.length,
          portals: portals.map((p) => ({
            id: p.id,
            categoryId: p.categoryId,
            title: p.title,
            state: p.state,
            url: p.url,
            isActive: p.isActive,
            usedInDigitalReport: p.usedInDigitalReport,
            sortOrder: p.sortOrder,
            categoryName: cat.name,
          })),
        };
      })
      .filter((c) => !activeOnly || c.portals.length > 0);

    const totalPortals = mapped.reduce((s, c) => s + c.portals.length, 0);

    return {
      code: HttpStatus.OK,
      message: 'Portal list fetched successfully',
      data: {
        categories: mapped,
        stats: {
          totalCategories: mapped.length,
          totalPortals,
        },
      },
    };
  }

  async listCategories(): Promise<APIResponseInterface<PortalCategory[]>> {
    const rows = await this.categoryRepo.find({
      order: { sortOrder: 'ASC', name: 'ASC' },
    });
    return {
      code: HttpStatus.OK,
      message: 'Portal categories fetched successfully',
      data: rows,
    };
  }

  async createCategory(
    dto: CreatePortalCategoryDto,
  ): Promise<APIResponseInterface<PortalCategory>> {
    const key = slugify(dto.key || dto.name);
    await this.ensureUniqueCategoryKey(key);

    const sortOrder =
      dto.sortOrder !== undefined
        ? dto.sortOrder
        : await this.nextCategorySortOrder();

    const saved = await this.categoryRepo.save(
      this.categoryRepo.create({
        key,
        name: dto.name.trim(),
        sortOrder,
        isActive: dto.isActive ?? true,
        usedInDigitalReport: dto.usedInDigitalReport ?? false,
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
    dto: UpdatePortalCategoryDto,
  ): Promise<APIResponseInterface<PortalCategory>> {
    const row = await this.categoryRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Category not found');

    if (dto.key !== undefined) {
      const key = slugify(dto.key);
      await this.ensureUniqueCategoryKey(key, id);
      row.key = key;
    }
    if (dto.name !== undefined) row.name = dto.name.trim();
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.usedInDigitalReport !== undefined) {
      row.usedInDigitalReport = dto.usedInDigitalReport;
    }

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

  async createPortal(
    dto: CreatePortalDto,
  ): Promise<APIResponseInterface<Portal>> {
    await this.requireCategory(dto.categoryId);

    const sortOrder =
      dto.sortOrder !== undefined
        ? dto.sortOrder
        : await this.nextPortalSortOrder(dto.categoryId);

    const saved = await this.portalRepo.save(
      this.portalRepo.create({
        categoryId: dto.categoryId,
        title: dto.title.trim(),
        state: dto.state.trim(),
        url: dto.url.trim(),
        isActive: dto.isActive ?? true,
        usedInDigitalReport: dto.usedInDigitalReport ?? false,
        sortOrder,
      }),
    );

    return {
      code: HttpStatus.CREATED,
      message: 'Portal created successfully',
      data: saved,
    };
  }

  async updatePortal(
    id: string,
    dto: UpdatePortalDto,
  ): Promise<APIResponseInterface<Portal>> {
    const row = await this.portalRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Portal not found');

    if (dto.categoryId !== undefined) {
      await this.requireCategory(dto.categoryId);
      row.categoryId = dto.categoryId;
    }
    if (dto.title !== undefined) row.title = dto.title.trim();
    if (dto.state !== undefined) row.state = dto.state.trim();
    if (dto.url !== undefined) row.url = dto.url.trim();
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.usedInDigitalReport !== undefined) {
      row.usedInDigitalReport = dto.usedInDigitalReport;
    }
    if (dto.sortOrder !== undefined) row.sortOrder = dto.sortOrder;

    const saved = await this.portalRepo.save(row);
    return {
      code: HttpStatus.OK,
      message: 'Portal updated successfully',
      data: saved,
    };
  }

  async updatePortalFlags(
    id: string,
    dto: UpdatePortalFlagsDto,
  ): Promise<APIResponseInterface<Portal>> {
    if (dto.isActive === undefined && dto.usedInDigitalReport === undefined) {
      throw new BadRequestException('Provide isActive and/or usedInDigitalReport');
    }
    const row = await this.portalRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Portal not found');
    if (dto.isActive !== undefined) row.isActive = dto.isActive;
    if (dto.usedInDigitalReport !== undefined) {
      row.usedInDigitalReport = dto.usedInDigitalReport;
    }
    const saved = await this.portalRepo.save(row);
    return {
      code: HttpStatus.OK,
      message: 'Portal flags updated successfully',
      data: saved,
    };
  }

  async removePortal(id: string): Promise<APIResponseInterface<null>> {
    const row = await this.portalRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Portal not found');
    await this.portalRepo.remove(row);
    return {
      code: HttpStatus.OK,
      message: 'Portal deleted successfully',
      data: null,
    };
  }

  private async requireCategory(id: string): Promise<PortalCategory> {
    const row = await this.categoryRepo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Category not found');
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

  private async nextCategorySortOrder(): Promise<number> {
    const last = await this.categoryRepo.find({
      order: { sortOrder: 'DESC' },
      take: 1,
    });
    return (last[0]?.sortOrder ?? -1) + 1;
  }

  private async nextPortalSortOrder(categoryId: string): Promise<number> {
    const last = await this.portalRepo.find({
      where: { categoryId },
      order: { sortOrder: 'DESC' },
      take: 1,
    });
    return (last[0]?.sortOrder ?? -1) + 1;
  }
}
