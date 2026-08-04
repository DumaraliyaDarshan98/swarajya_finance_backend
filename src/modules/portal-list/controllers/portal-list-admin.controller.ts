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
import { PortalListService } from '../services/portal-list.service';
import {
  CreatePortalCategoryDto,
  CreatePortalDto,
  UpdatePortalCategoryDto,
  UpdatePortalDto,
  UpdatePortalFlagsDto,
} from '../dto/portal-list.dto';

@Controller('admin/portal-list')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class PortalListAdminController {
  constructor(private readonly service: PortalListService) {}

  @Get('tree')
  getTree(@Query('activeOnly') activeOnly?: string) {
    return this.service.getTree({
      activeOnly: activeOnly === 'true' || activeOnly === '1',
    });
  }

  @Get('categories')
  listCategories() {
    return this.service.listCategories();
  }

  @Post('categories')
  createCategory(@Body() dto: CreatePortalCategoryDto) {
    return this.service.createCategory(dto);
  }

  @Put('categories/:id')
  updateCategory(
    @Param('id') id: string,
    @Body() dto: UpdatePortalCategoryDto,
  ) {
    return this.service.updateCategory(id, dto);
  }

  @Delete('categories/:id')
  removeCategory(@Param('id') id: string) {
    return this.service.removeCategory(id);
  }

  @Post('portals')
  createPortal(@Body() dto: CreatePortalDto) {
    return this.service.createPortal(dto);
  }

  @Put('portals/:id')
  updatePortal(@Param('id') id: string, @Body() dto: UpdatePortalDto) {
    return this.service.updatePortal(id, dto);
  }

  @Patch('portals/:id/flags')
  updatePortalFlags(
    @Param('id') id: string,
    @Body() dto: UpdatePortalFlagsDto,
  ) {
    return this.service.updatePortalFlags(id, dto);
  }

  @Delete('portals/:id')
  removePortal(@Param('id') id: string) {
    return this.service.removePortal(id);
  }
}
