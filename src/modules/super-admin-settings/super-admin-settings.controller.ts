import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  UseGuards,
} from '@nestjs/common';
import {
  EffectiveSuperAdminSettings,
  SuperAdminSettingsService,
} from './super-admin-settings.service';
import { UpdateSuperAdminSettingsDto } from './dto/update-super-admin-settings.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../enum/role.enum';
import { APIResponseInterface } from '../../interface/response.interface';
import { SuperAdminSettings } from './entities/super-admin-settings.entity';
import { CreateSettingDto } from './dto/create-setting.dto';
import { UpdateSettingDto } from './dto/update-setting.dto';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SuperAdminSettingsController {
  constructor(private readonly settingsService: SuperAdminSettingsService) {}

  // Effective settings used by business logic (client limits, notifications)
  @Get('effective')
  async getSettings(): Promise<
    APIResponseInterface<EffectiveSuperAdminSettings>
  > {
    return await this.settingsService.getEffectiveSettings();
  }

  @Put('effective')
  async updateSettings(
    @Body() dto: UpdateSuperAdminSettingsDto,
  ): Promise<APIResponseInterface<any>> {
    return await this.settingsService.upsertSettings(dto);
  }

  // ===== CRUD endpoints for individual settings rows (Super Admin UI) =====

  @Get()
  listAll(): Promise<APIResponseInterface<SuperAdminSettings[]>> {
    return this.settingsService.listAllSettings();
  }

  @Get(':id')
  getOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<APIResponseInterface<SuperAdminSettings>> {
    return this.settingsService.findOneSetting(id);
  }

  @Post()
  create(
    @Body() dto: CreateSettingDto,
  ): Promise<APIResponseInterface<SuperAdminSettings>> {
    return this.settingsService.createSetting(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateSettingDto,
  ): Promise<APIResponseInterface<SuperAdminSettings>> {
    return this.settingsService.updateSetting(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<APIResponseInterface<null>> {
    return this.settingsService.deleteSetting(id);
  }
}
