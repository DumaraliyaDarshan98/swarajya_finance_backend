import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { HiringPositionsService } from '../services/hiring-positions.service';
import {
  CreateHiringPositionDto,
  UpdateHiringPositionDto,
  UpdateHiringPositionFlagsDto,
} from '../dto/hiring-position.dto';

@Controller('admin/hiring-positions')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class HiringPositionsAdminController {
  constructor(private readonly service: HiringPositionsService) {}

  @Get()
  list(@Query('activeOnly') activeOnly?: string) {
    return this.service.list({
      activeOnly: activeOnly === 'true' || activeOnly === '1',
    });
  }

  @Get('applicants')
  listApplicants(
    @Query('hiringPositionId') hiringPositionId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.service.listApplicants({
      hiringPositionId: hiringPositionId || undefined,
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 10,
      search: search || undefined,
    });
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post()
  create(@Body() dto: CreateHiringPositionDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateHiringPositionDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/flags')
  updateFlags(
    @Param('id') id: string,
    @Body() dto: UpdateHiringPositionFlagsDto,
  ) {
    return this.service.updateFlags(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
