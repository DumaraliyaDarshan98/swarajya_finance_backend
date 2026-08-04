import {
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';
import { ClientSettings } from '../../client/interfaces/client-settings.interface';
import { SubscriptionPlan } from '../entities/subscription-plan.entity';
import {
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
} from '../dto/subscription-plan.dto';

@Injectable()
export class SubscriptionPlanService {
  constructor(
    @InjectRepository(SubscriptionPlan)
    private readonly repo: Repository<SubscriptionPlan>,
  ) {}

  async list(activeOnly = false): Promise<APIResponseInterface<SubscriptionPlan[]>> {
    const where = activeOnly ? { isActive: true } : {};
    const data = await this.repo.find({
      where,
      order: { createdAt: 'DESC' },
    });
    return {
      code: HttpStatus.OK,
      message: 'Subscription plans fetched successfully',
      data,
    };
  }

  async getById(id: string): Promise<APIResponseInterface<SubscriptionPlan>> {
    const plan = await this.repo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Subscription plan not found');
    return {
      code: HttpStatus.OK,
      message: 'Subscription plan fetched successfully',
      data: plan,
    };
  }

  async findEntity(id: string): Promise<SubscriptionPlan | null> {
    return this.repo.findOne({ where: { id } });
  }

  /** Settings snapshot to apply onto a client. */
  settingsFromPlan(plan: SubscriptionPlan): ClientSettings {
    const s = plan.setting ?? {};
    return {
      digitalFlow: !!s.digitalFlow,
      physical: !!s.physical,
      ocr: !!s.ocr,
      triangulation: !!s.triangulation,
      maxUsers: s.maxUsers ?? null,
      maxRoles: s.maxRoles ?? null,
    };
  }

  async create(
    dto: CreateSubscriptionPlanDto,
  ): Promise<APIResponseInterface<SubscriptionPlan>> {
    const plan = this.repo.create({
      title: dto.title.trim(),
      description: dto.description?.trim() || null,
      amount: Number(dto.amount ?? 0),
      isActive: dto.isActive ?? true,
      setting: dto.setting ?? null,
    });
    const saved = await this.repo.save(plan);
    return {
      code: HttpStatus.CREATED,
      message: 'Subscription plan created successfully',
      data: saved,
    };
  }

  async update(
    id: string,
    dto: UpdateSubscriptionPlanDto,
  ): Promise<APIResponseInterface<SubscriptionPlan>> {
    const plan = await this.repo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Subscription plan not found');

    if (dto.title != null) plan.title = dto.title.trim();
    if (dto.description !== undefined) {
      plan.description = dto.description?.trim() || null;
    }
    if (dto.amount != null) plan.amount = Number(dto.amount);
    if (dto.isActive != null) plan.isActive = dto.isActive;
    if (dto.setting !== undefined) plan.setting = dto.setting ?? null;

    const saved = await this.repo.save(plan);
    return {
      code: HttpStatus.OK,
      message: 'Subscription plan updated successfully',
      data: saved,
    };
  }

  async remove(id: string): Promise<APIResponseInterface<{ id: string }>> {
    const plan = await this.repo.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('Subscription plan not found');
    await this.repo.delete(id);
    return {
      code: HttpStatus.OK,
      message: 'Subscription plan deleted successfully',
      data: { id },
    };
  }
}
