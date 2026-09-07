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
import { ForensicChecksService } from '../services/forensic-checks.service';
import {
  CreateForensicCheckDto,
  UpdateForensicCheckDto,
  UpdateForensicFlagsDto,
} from '../dto/forensic-checks.dto';

@Controller('admin/forensic-checks')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class ForensicChecksAdminController {
  constructor(private readonly service: ForensicChecksService) {}

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
  create(@Body() dto: CreateForensicCheckDto) {
    return this.service.create(dto);
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() dto: UpdateForensicCheckDto) {
    return this.service.update(id, dto);
  }

  @Patch(':id/flags')
  updateFlags(@Param('id') id: string, @Body() dto: UpdateForensicFlagsDto) {
    return this.service.updateFlags(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
