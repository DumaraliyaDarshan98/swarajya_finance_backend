import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { EffectiveSuperAdminSettings, SuperAdminSettingsService } from './super-admin-settings.service';
import { UpdateSuperAdminSettingsDto } from './dto/update-super-admin-settings.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../enum/role.enum';
import { APIResponseInterface } from '../../interface/response.interface';

@Controller('admin/settings')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SuperAdminSettingsController {
  constructor(
    private readonly settingsService: SuperAdminSettingsService,
  ) {}

  @Get()
  async getSettings() : Promise<APIResponseInterface<EffectiveSuperAdminSettings>> {
    return await this.settingsService.getEffectiveSettings();
  }

  @Put()
  async updateSettings(@Body() dto: UpdateSuperAdminSettingsDto) : Promise<APIResponseInterface<any>> {
    return await this.settingsService.upsertSettings(dto);
  }
}

