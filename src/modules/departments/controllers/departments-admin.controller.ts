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
import { DepartmentsService } from '../services/departments.service';
import {
  CreateDepartmentDto,
  UpdateDepartmentDto,
  UpdateDepartmentFlagsDto,
} from '../dto/department.dto';

@Controller('admin/departments')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class DepartmentsAdminController {
  constructor(private readonly service: DepartmentsService) {}

  @Get()
  list(@Query('activeOnly') activeOnly?: string) {
    return this.service.list({
      activeOnly: activeOnly === 'true' || activeOnly === '1',
    });
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.service.getOne(id);
  }

  @Post()
  create(@Body() dto: CreateDepartmentDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateDepartmentDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/flags')
  updateFlags(@Param('id') id: string, @Body() dto: UpdateDepartmentFlagsDto) {
    return this.service.updateFlags(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
