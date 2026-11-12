import { Controller, Get, Req, UseGuards } from '@nestjs/common';
import { DashboardAnalyticsService } from '../services/dashboard-analytics.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { AuthedUser } from '../../../common/interfaces/authed-user.interface';

@Controller('dashboard')
@UseGuards(JwtAuthGuard, RolesGuard)
export class DashboardAnalyticsController {
  constructor(private readonly service: DashboardAnalyticsService) {}

  @Get('platform')
  @Roles(Role.SUPER_ADMIN, Role.INTERNAL_USER)
  platform(@Req() req: { user: AuthedUser }) {
    return this.service.platformAnalytics(req.user);
  }

  @Get('client')
  @Roles(Role.CLIENT_ADMIN, Role.CLIENT_USER, Role.SUPER_ADMIN)
  client(@Req() req: { user: AuthedUser }) {
    return this.service.clientAnalytics(req.user);
  }
}
