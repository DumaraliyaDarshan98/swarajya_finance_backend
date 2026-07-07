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
import { UsersService } from '../services/users.service';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { CreateInternalUserDto } from '../dto/create-internal-user.dto';
import { CreateClientUserDto } from '../dto/create-client-user.dto';
import { UpdateInternalUserDto } from '../dto/update-internal-user.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.INTERNAL_USER, Role.CLIENT_ADMIN, Role.CLIENT_USER)
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

  @Post('client-users')
  @Roles(Role.CLIENT_ADMIN, Role.CLIENT_USER)
  createClientUser(@Body() dto: CreateClientUserDto, @Request() req: any) {
    return this.service.createClientUser(dto, req.user);
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
