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
import { Department } from '../entities/department.entity';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  UpdateDepartmentFlagsDto,
} from '../dto/department.dto';

export type DepartmentOption = { id: string; name: string };

export type DepartmentsListPayload = {
  items: Department[];
  stats: { total: number; active: number; inactive: number };
};

@Injectable()
export class DepartmentsService {
  constructor(
    @InjectRepository(Department)
    private readonly repo: Repository<Department>,
  ) {}

  async list(options?: {
    activeOnly?: boolean;
  }): Promise<APIResponseInterface<DepartmentsListPayload>> {
    const where = options?.activeOnly ? { isActive: true } : undefined;
    const items = await this.repo.find({
      where,
      order: { name: 'ASC' },
    });
    const all = options?.activeOnly
      ? await this.repo.find({ select: { id: true, isActive: true } as any })
      : items;

    return {
      code: HttpStatus.OK,
      message: 'Departments loaded',
      data: {
        items,
        stats: {
          total: all.length,
          active: all.filter((d) => d.isActive).length,
          inactive: all.filter((d) => !d.isActive).length,
        },
      },
    };
  }

  async listActiveOptions(): Promise<APIResponseInterface<DepartmentOption[]>> {
    const rows = await this.repo.find({
      where: { isActive: true },
      order: { name: 'ASC' },
      select: { id: true, name: true },
    });
    return {
      code: HttpStatus.OK,
      message: 'Active departments loaded',
      data: rows,
    };
  }

  async getOne(id: string): Promise<APIResponseInterface<Department>> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Department not found');
    return {
      code: HttpStatus.OK,
      message: 'Department loaded',
      data: row,
    };
  }

  async assertActiveName(name: string): Promise<void> {
    const trimmed = name?.trim();
    const row = trimmed
      ? await this.repo
          .createQueryBuilder('d')
          .where('LOWER(d.name) = LOWER(:name)', { name: trimmed })
          .andWhere('d.is_active = :active', { active: true })
          .getOne()
      : null;
    if (!row) {
      throw new BadRequestException(
        'Please select a valid active department from the list',
      );
    }
  }

  async create(
    dto: CreateDepartmentDto,
  ): Promise<APIResponseInterface<Department>> {
    const name = dto.name.trim();
    const clash = await this.repo
      .createQueryBuilder('d')
      .where('LOWER(d.name) = LOWER(:name)', { name })
      .getOne();
    if (clash) {
      throw new ConflictException(`Department "${name}" already exists`);
    }

    const row = this.repo.create({
      name,
      description: dto.description?.trim() || null,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.repo.save(row);
    return {
      code: HttpStatus.CREATED,
      message: 'Department created',
      data: saved,
    };
  }

  async update(
    id: string,
    dto: UpdateDepartmentDto,
  ): Promise<APIResponseInterface<Department>> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Department not found');

    if (dto.name !== undefined) {
      const next = dto.name.trim();
      if (next.toLowerCase() !== row.name.toLowerCase()) {
        const clash = await this.repo
          .createQueryBuilder('d')
          .where('LOWER(d.name) = LOWER(:name)', { name: next })
          .getOne();
        if (clash) {
          throw new ConflictException(`Department "${next}" already exists`);
        }
      }
      row.name = next;
    }
    if (dto.description !== undefined) {
      row.description = dto.description?.trim() || null;
    }
    if (dto.isActive !== undefined) row.isActive = dto.isActive;

    const saved = await this.repo.save(row);
    return {
      code: HttpStatus.OK,
      message: 'Department updated',
      data: saved,
    };
  }

  async updateFlags(
    id: string,
    dto: UpdateDepartmentFlagsDto,
  ): Promise<APIResponseInterface<Department>> {
    if (dto.isActive === undefined) {
      throw new BadRequestException('Provide isActive');
    }
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Department not found');
    row.isActive = dto.isActive;
    const saved = await this.repo.save(row);
    return {
      code: HttpStatus.OK,
      message: 'Department flags updated',
      data: saved,
    };
  }

  async remove(id: string): Promise<APIResponseInterface<{ id: string }>> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Department not found');
    await this.repo.remove(row);
    return {
      code: HttpStatus.OK,
      message: 'Department deleted',
      data: { id },
    };
  }
}
