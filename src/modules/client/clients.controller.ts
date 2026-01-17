import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ClientsService } from './clients.service';
import { CreateClientDto } from './dto/create-client.dto';
import { RegisterClientDto } from './dto/register-client.dto';
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
}
