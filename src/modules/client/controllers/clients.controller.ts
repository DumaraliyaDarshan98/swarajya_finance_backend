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
import { ClientsService } from '../services/clients.service';
import { CreateClientDto } from '../dto/create-client.dto';
import { UpdateClientDto } from '../dto/update-client.dto';
import { RegisterClientDto } from '../dto/register-client.dto';
import { ListClientsQueryDto } from '../dto/list-clients-query.dto';
import { ChangeSubscriptionPlanDto } from '../dto/change-subscription-plan.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';

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
  // @Roles(Role.SUPER_ADMIN)
  list(@Query() query: ListClientsQueryDto, @Request() req: any) {
    return this.service.findAll(query, req.user);
  }

  /** Own organization (must be before :id). */
  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLIENT_ADMIN, Role.CLIENT_USER)
  getMe(@Request() req: any) {
    return this.service.findMyClient(req.user);
  }

  /** Switch subscription plan for own organization (payment can be wired later). */
  @Post('me/change-plan')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.CLIENT_ADMIN)
  changePlan(@Body() dto: ChangeSubscriptionPlanDto, @Request() req: any) {
    return this.service.changeMyPlan(req.user, dto.subscriptionPlanId);
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
  update(
    @Param('id') id: string,
    @Body() dto: UpdateClientDto,
    @Request() req: any,
  ) {
    return this.service.update(id, dto, req.user);
  }
}
