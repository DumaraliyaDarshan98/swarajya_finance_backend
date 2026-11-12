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
import { RcuTriggersService } from '../services/rcu-triggers.service';
import {
  CreateRcuCategoryDto,
  CreateRcuDocumentTypeDto,
  CreateRcuTriggerDto,
  UpdateRcuCategoryDto,
  UpdateRcuDocumentTypeDto,
  UpdateRcuFlagsDto,
  UpdateRcuTriggerDto,
} from '../dto/rcu-triggers.dto';

@Controller('admin/rcu-triggers')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class RcuTriggersAdminController {
  constructor(private readonly service: RcuTriggersService) {}

  @Get('tree')
  getTree(@Query('activeOnly') activeOnly?: string) {
    return this.service.getTree({
      activeOnly: activeOnly === 'true' || activeOnly === '1',
    });
  }

  // ---- Categories ----

  @Get('categories')
  listCategories() {
    return this.service.listCategories();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateRcuCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Put('categories/:id')
  updateCategory(@Param('id') id: string, @Body() dto: UpdateRcuCategoryDto) {
    return this.service.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id') id: string) {
    return this.service.removeCategory(id);
  }

  // ---- Document types ----

  @Post('document-types')
  createDocumentType(@Body() dto: CreateRcuDocumentTypeDto) {
    return this.service.createDocumentType(dto);
  }

  @Put('document-types/:id')
  updateDocumentType(
    @Param('id') id: string,
    @Body() dto: UpdateRcuDocumentTypeDto,
  ) {
    return this.service.updateDocumentType(id, dto);
  }

  @Patch('document-types/:id/flags')
  updateDocumentTypeFlags(
    @Param('id') id: string,
    @Body() dto: UpdateRcuFlagsDto,
  ) {
    return this.service.updateDocumentTypeFlags(id, dto);
  }

  @Delete('document-types/:id')
  removeDocumentType(@Param('id') id: string) {
    return this.service.removeDocumentType(id);
  }

  // ---- Triggers ----

  @Post('triggers')
  createTrigger(@Body() dto: CreateRcuTriggerDto) {
    return this.service.createTrigger(dto);
  }

  @Put('triggers/:id')
  updateTrigger(@Param('id') id: string, @Body() dto: UpdateRcuTriggerDto) {
    return this.service.updateTrigger(id, dto);
  }

  @Patch('triggers/:id/flags')
  updateTriggerFlags(
    @Param('id') id: string,
    @Body() dto: UpdateRcuFlagsDto,
  ) {
    return this.service.updateTriggerFlags(id, dto);
  }

  @Delete('triggers/:id')
  removeTrigger(@Param('id') id: string) {
    return this.service.removeTrigger(id);
  }
}
