import {
  BadRequestException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';
import { HiringPosition } from '../entities/hiring-position.entity';
import { Department } from '../../departments/entities/department.entity';
import { Designation } from '../../designations/entities/designation.entity';
import { JobApplication } from '../../job-application/entities/job-application.entity';
import {
  CreateHiringPositionDto,
  UpdateHiringPositionDto,
  UpdateHiringPositionFlagsDto,
} from '../dto/hiring-position.dto';

export type HiringPositionPublicOption = {
  id: string;
  title: string;
  departmentName: string;
  designationName: string;
  description: string | null;
};

export type HiringPositionsListPayload = {
  items: Array<
    HiringPosition & {
      applicantCount?: number;
    }
  >;
  stats: { total: number; active: number; inactive: number };
};

@Injectable()
export class HiringPositionsService {
  constructor(
    @InjectRepository(HiringPosition)
    private readonly repo: Repository<HiringPosition>,
    @InjectRepository(Department)
    private readonly departmentRepo: Repository<Department>,
    @InjectRepository(Designation)
    private readonly designationRepo: Repository<Designation>,
    @InjectRepository(JobApplication)
    private readonly applicationRepo: Repository<JobApplication>,
  ) {}

  async list(options?: {
    activeOnly?: boolean;
  }): Promise<APIResponseInterface<HiringPositionsListPayload>> {
    const where = options?.activeOnly ? { isActive: true } : undefined;
    const items = await this.repo.find({
      where,
      relations: ['department', 'designation'],
      order: { createdAt: 'DESC' },
    });

    const counts = await this.applicationRepo
      .createQueryBuilder('a')
      .select('a.hiring_position_id', 'positionId')
      .addSelect('COUNT(*)', 'cnt')
      .where('a.hiring_position_id IS NOT NULL')
      .groupBy('a.hiring_position_id')
      .getRawMany<{ positionId: string; cnt: string }>();

    const countMap = new Map(
      counts.map((c) => [c.positionId, Number(c.cnt) || 0]),
    );

    const withCounts = items.map((item) =>
      Object.assign(item, { applicantCount: countMap.get(item.id) ?? 0 }),
    );

    const all = options?.activeOnly
      ? await this.repo.find({ select: { id: true, isActive: true } as any })
      : items;

    return {
      code: HttpStatus.OK,
      message: 'Hiring positions loaded',
      data: {
        items: withCounts,
        stats: {
          total: all.length,
          active: all.filter((d) => d.isActive).length,
          inactive: all.filter((d) => !d.isActive).length,
        },
      },
    };
  }

  async listActivePublic(): Promise<
    APIResponseInterface<HiringPositionPublicOption[]>
  > {
    const rows = await this.repo.find({
      where: { isActive: true },
      order: { createdAt: 'DESC' },
    });
    return {
      code: HttpStatus.OK,
      message: 'Open hiring positions loaded',
      data: rows.map((r) => ({
        id: r.id,
        title: r.title,
        departmentName: r.departmentName,
        designationName: r.designationName,
        description: r.description,
      })),
    };
  }

  async getOne(id: string): Promise<APIResponseInterface<HiringPosition>> {
    const row = await this.repo.findOne({
      where: { id },
      relations: ['department', 'designation'],
    });
    if (!row) throw new NotFoundException('Hiring position not found');
    return {
      code: HttpStatus.OK,
      message: 'Hiring position loaded',
      data: row,
    };
  }

  async getActiveOrFail(id: string): Promise<HiringPosition> {
    const row = await this.repo.findOne({ where: { id, isActive: true } });
    if (!row) {
      throw new BadRequestException(
        'Please select a valid active hiring position',
      );
    }
    return row;
  }

  async listApplicants(options?: {
    hiringPositionId?: string;
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<
    APIResponseInterface<JobApplication[]> & {
      pagination: { total: number; page: number; pagePerRecord: number };
    }
  > {
    const page = Math.max(1, options?.page ?? 1);
    const limit = Math.min(100, Math.max(1, options?.limit ?? 10));
    const qb = this.applicationRepo
      .createQueryBuilder('a')
      .leftJoinAndSelect('a.hiringPosition', 'hp')
      .orderBy('a.createdAt', 'DESC');

    if (options?.hiringPositionId) {
      qb.andWhere('a.hiringPositionId = :pid', {
        pid: options.hiringPositionId,
      });
    } else {
      qb.andWhere('a.hiringPositionId IS NOT NULL');
    }

    const search = options?.search?.trim();
    if (search) {
      qb.andWhere(
        '(a.fullName LIKE :q OR a.email LIKE :q OR a.mobileNumber LIKE :q OR hp.title LIKE :q)',
        { q: `%${search}%` },
      );
    }

    // Avoid getManyAndCount + join DISTINCT quirks on MySQL.
    const total = await qb.clone().getCount();
    const list = await qb.skip((page - 1) * limit).take(limit).getMany();
    return {
      code: HttpStatus.OK,
      message: 'Applicants loaded',
      data: list,
      pagination: { total, page, pagePerRecord: limit },
    };
  }

  private async resolveMasters(departmentId: string, designationId: string) {
    const department = await this.departmentRepo.findOne({
      where: { id: departmentId, isActive: true },
    });
    if (!department) {
      throw new BadRequestException('Please select a valid active department');
    }
    const designation = await this.designationRepo.findOne({
      where: { id: designationId, isActive: true },
    });
    if (!designation) {
      throw new BadRequestException('Please select a valid active designation');
    }
    return { department, designation };
  }

  async create(
    dto: CreateHiringPositionDto,
  ): Promise<APIResponseInterface<HiringPosition>> {
    const { department, designation } = await this.resolveMasters(
      dto.departmentId,
      dto.designationId,
    );
    const row = this.repo.create({
      title: dto.title.trim(),
      departmentId: department.id,
      designationId: designation.id,
      departmentName: department.name,
      designationName: designation.name,
      description: dto.description?.trim() || null,
      isActive: dto.isActive ?? true,
    });
    const saved = await this.repo.save(row);
    return {
      code: HttpStatus.CREATED,
      message: 'Hiring position created',
      data: saved,
    };
  }

  async update(
    id: string,
    dto: UpdateHiringPositionDto,
  ): Promise<APIResponseInterface<HiringPosition>> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Hiring position not found');

    if (dto.title !== undefined) row.title = dto.title.trim();
    if (dto.description !== undefined) {
      row.description = dto.description?.trim() || null;
    }
    if (dto.isActive !== undefined) row.isActive = dto.isActive;

    if (dto.departmentId !== undefined || dto.designationId !== undefined) {
      const { department, designation } = await this.resolveMasters(
        dto.departmentId ?? row.departmentId!,
        dto.designationId ?? row.designationId!,
      );
      row.departmentId = department.id;
      row.designationId = designation.id;
      row.departmentName = department.name;
      row.designationName = designation.name;
    }

    const saved = await this.repo.save(row);
    return {
      code: HttpStatus.OK,
      message: 'Hiring position updated',
      data: saved,
    };
  }

  async updateFlags(
    id: string,
    dto: UpdateHiringPositionFlagsDto,
  ): Promise<APIResponseInterface<HiringPosition>> {
    if (dto.isActive === undefined) {
      throw new BadRequestException('Provide isActive');
    }
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Hiring position not found');
    row.isActive = dto.isActive;
    const saved = await this.repo.save(row);
    return {
      code: HttpStatus.OK,
      message: 'Hiring position flags updated',
      data: saved,
    };
  }

  async remove(id: string): Promise<APIResponseInterface<{ id: string }>> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Hiring position not found');
    await this.repo.remove(row);
    return {
      code: HttpStatus.OK,
      message: 'Hiring position deleted',
      data: { id },
    };
  }
}
