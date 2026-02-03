import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { CreateInternalUserDto } from './dto/create-internal-user.dto';
import { UpdateInternalUserDto } from './dto/update-internal-user.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../enum/role.enum';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN)
export class UsersController {
  constructor(private service: UsersService) {}

  @Get()
  list(@Query() query: ListUsersQueryDto, @Request() req: any) {
    return this.service.findAll(query, req.user);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  createInternalUser(@Body() dto: CreateInternalUserDto) {
    return this.service.createInternalUser(dto);
  }

  @Get(':id')
  getOne(@Param('id') id: string, @Request() req: any) {
    return this.service.findOne(id, req.user);
  }

  @Patch(':id')
  updateInternalUser(
    @Param('id') id: string,
    @Body() dto: UpdateInternalUserDto,
    @Request() req: any,
  ) {
    return this.service.updateInternalUser(id, dto, req.user);
  }
}
