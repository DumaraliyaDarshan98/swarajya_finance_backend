import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SuperAdminSettings } from './entities/super-admin-settings.entity';
import { UpdateSuperAdminSettingsDto } from './dto/update-super-admin-settings.dto';
import { APIResponseInterface } from 'src/interface/response.interface';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';

export interface EffectiveSuperAdminSettings {
  maxClientUsers: number | null;
  sendEmailNotifications: boolean;
  sendSmsNotifications: boolean;
}

const KEY_MAX_CLIENT_USERS = 'MAX_CLIENT_USERS';
const KEY_EMAIL = 'SEND_EMAIL_NOTIFICATIONS';
const KEY_SMS = 'SEND_SMS_NOTIFICATIONS';

@Injectable()
export class SuperAdminSettingsService {
  constructor(
    @InjectRepository(SuperAdminSettings)
    private readonly repo: Repository<SuperAdminSettings>,
  ) {}

  private toEffective(rows: SuperAdminSettings[]): EffectiveSuperAdminSettings {
    const byKey = new Map(rows.map((r) => [r.key, r]));

    const maxRow = byKey.get(KEY_MAX_CLIENT_USERS);
    const emailRow = byKey.get(KEY_EMAIL);
    const smsRow = byKey.get(KEY_SMS);

    return {
      maxClientUsers:
        maxRow && maxRow.status && maxRow.value
          ? Number(maxRow.value) || null
          : null,
      sendEmailNotifications: !!(
        emailRow && emailRow.status && emailRow.value === 'true'
      ),
      sendSmsNotifications: !!(
        smsRow && smsRow.status && smsRow.value === 'true'
      ),
    };
  }

  async getEffectiveSettings(): Promise<APIResponseInterface<EffectiveSuperAdminSettings>> {
    const rows = await this.repo.find();
    return {
      code: HttpStatus.OK,
      message: 'Super admin settings fetched successfully',
      data: this.toEffective(rows),
    };
  }

  async getRawSettings(): Promise<APIResponseInterface<SuperAdminSettings[]>> {
    const rows = await this.repo.find();
    if (!rows.length) {
      throw new NotFoundException('Super admin settings not configured');
    }
    return {
      code: HttpStatus.OK,
      message: 'Super admin settings fetched successfully',
      data: rows,
    };
  }

  // ===== Generic CRUD for individual settings (for Super Admin UI) =====

  async listAllSettings(): Promise<APIResponseInterface<SuperAdminSettings[]>> {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' } });
    return {
      code: HttpStatus.OK,
      message: 'Settings fetched successfully',
      data: rows,
    };
  }

  async findOneSetting(id: number): Promise<APIResponseInterface<SuperAdminSettings>> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('Setting not found');
    }
    return {
      code: HttpStatus.OK,
      message: 'Setting fetched successfully',
      data: row,
    };
  }

  async createSetting(dto: CreateSettingDto): Promise<APIResponseInterface<SuperAdminSettings>> {
    const entity = this.repo.create({
      key: dto.key,
      value: dto.value,
      description: dto.description ?? null,
      category: dto.category ?? null,
      status: dto.status ?? true,
    });
    const saved = await this.repo.save(entity);
    return {
      code: HttpStatus.CREATED,
      message: 'Setting created successfully',
      data: saved,
    };
  }

  async updateSetting(
    id: number,
    dto: UpdateSettingDto,
  ): Promise<APIResponseInterface<SuperAdminSettings>> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('Setting not found');
    }

    if (dto.key !== undefined) row.key = dto.key;
    if (dto.value !== undefined) row.value = dto.value;
    if (dto.description !== undefined) row.description = dto.description;
    if (dto.category !== undefined) row.category = dto.category;
    if (dto.status !== undefined) row.status = dto.status;

    const saved = await this.repo.save(row);
    return {
      code: HttpStatus.OK,
      message: 'Setting updated successfully',
      data: saved,
    };
  }

  async deleteSetting(id: number): Promise<APIResponseInterface<null>> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) {
      throw new NotFoundException('Setting not found');
    }
    await this.repo.remove(row);
    return {
      code: HttpStatus.OK,
      message: 'Setting deleted successfully',
      data: null,
    };
  }

  async upsertSettings(
    dto: UpdateSuperAdminSettingsDto,
  ): Promise<APIResponseInterface<EffectiveSuperAdminSettings>> {
    const toSave: SuperAdminSettings[] = [];

    if (dto.maxClientUsers !== undefined) {
      let row = await this.repo.findOne({ where: { key: KEY_MAX_CLIENT_USERS } });
      if (!row) {
        row = this.repo.create({
          key: KEY_MAX_CLIENT_USERS,
          category: 'System',
        });
      }
      row.value = dto.maxClientUsers == null ? '' : String(dto.maxClientUsers);
      row.status = dto.maxClientUsers != null;
      row.description =
        'Maximum client users allowed per client (blank = unlimited)';
      toSave.push(row);
    }

    if (dto.sendEmailNotifications !== undefined) {
      let row = await this.repo.findOne({ where: { key: KEY_EMAIL } });
      if (!row) {
        row = this.repo.create({
          key: KEY_EMAIL,
          category: 'Notification',
        });
      }
      row.value = String(dto.sendEmailNotifications);
      row.status = dto.sendEmailNotifications;
      row.description = 'Send system notifications via email';
      toSave.push(row);
    }

    if (dto.sendSmsNotifications !== undefined) {
      let row = await this.repo.findOne({ where: { key: KEY_SMS } });
      if (!row) {
        row = this.repo.create({
          key: KEY_SMS,
          category: 'Notification',
        });
      }
      row.value = String(dto.sendSmsNotifications);
      row.status = dto.sendSmsNotifications;
      row.description = 'Send system notifications via SMS';
      toSave.push(row);
    }

    if (toSave.length) {
      await this.repo.save(toSave);
    }

    const rows = await this.repo.find();
    return {
      code: HttpStatus.OK,
      message: 'Super admin settings updated successfully',
      data: this.toEffective(rows),
    };
  }
}

