import { Controller, Get, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { SubscriptionPlanService } from '../services/subscription-plan.service';

/** Active plans visible to client organizations (for browsing / switching). */
@Controller('subscription-plans')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CLIENT_ADMIN, Role.CLIENT_USER)
export class SubscriptionPlanClientController {
  constructor(private readonly service: SubscriptionPlanService) {}

  @Get()
  listActive() {
    return this.service.list(true);
  }
}
