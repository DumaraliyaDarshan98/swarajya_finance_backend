import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { UpdateClientDto } from './dto/update-client.dto';
import { RegisterClientDto } from './dto/register-client.dto';
import { ListClientsQueryDto } from './dto/list-clients-query.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../enum/role.enum';

@Controller('clients')
export class ClientsController {
  constructor(private service: ClientsService) {}

  @Post('register')
  register(@Body() dto: RegisterClientDto) {
    return this.service.registerClient(dto);
  }

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  create(@Body() dto: CreateClientDto) {
    return this.service.createClient(dto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  list(@Query() query: ListClientsQueryDto, @Request() req: any) {
    return this.service.findAll(query, req.user);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN)
  getById(@Param('id') id: string, @Request() req: any) {
    return this.service.findOne(id, req.user);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateClientDto, @Request() req: any) {
    return this.service.update(id, dto, req.user);
  }
}
