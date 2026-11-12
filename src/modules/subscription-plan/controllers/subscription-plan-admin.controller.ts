import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { SubscriptionPlanService } from '../services/subscription-plan.service';
import {
  CreateSubscriptionPlanDto,
  UpdateSubscriptionPlanDto,
} from '../dto/subscription-plan.dto';

@Controller('admin/subscription-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class SubscriptionPlanAdminController {
  constructor(private readonly service: SubscriptionPlanService) {}

  @Get()
  list(@Query('activeOnly') activeOnly?: string) {
    return this.service.list(activeOnly === 'true' || activeOnly === '1');
  }

  @Get(':id')
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  @Post()
  create(@Body() dto: CreateSubscriptionPlanDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateSubscriptionPlanDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
