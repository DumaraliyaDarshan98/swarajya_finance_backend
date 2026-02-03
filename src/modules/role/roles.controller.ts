import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { RolesService } from './roles.service';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ListRolesQueryDto } from './dto/list-roles-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../enum/role.enum';

@Controller('roles')
@UseGuards(JwtAuthGuard)
export class RolesController {
  constructor(private service: RolesService) {}

  @Post()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN)
  create(@Body() dto: CreateRoleDto, @Request() req: any) {
    return this.service.create(dto, req.user);
  }

  @Get('modules')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN)
  getModules() {
    return this.service.getModules();
  }

  @Get()
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN)
  list(@Query() query: ListRolesQueryDto, @Request() req: any) {
    return this.service.findAll(query, req.user);
  }

  @Get(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN)
  getById(@Param('id') id: string, @Request() req: any) {
    return this.service.findOne(id, req.user);
  }

  @Patch(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateRoleDto, @Request() req: any) {
    return this.service.update(id, dto, req.user);
  }

  @Delete(':id')
  @UseGuards(RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN)
  remove(@Param('id') id: string, @Request() req: any) {
    return this.service.remove(id, req.user);
  }
}
