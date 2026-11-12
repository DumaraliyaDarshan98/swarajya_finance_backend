import {
  Controller,
  ForbiddenException,
  Get,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { BillingService } from '../services/billing.service';
import { BillingPeriodQueryDto } from '../dto/billing.dto';
import type { AuthedUser } from '../../../common/interfaces/authed-user.interface';

@Controller('billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.CLIENT_ADMIN, Role.CLIENT_USER)
export class BillingClientController {
  constructor(private readonly billing: BillingService) {}

  private clientIdOrThrow(user?: AuthedUser): string {
    if (!user?.clientId) {
      throw new ForbiddenException('Client context required');
    }
    return user.clientId;
  }

  @Get('me/current')
  current(@Req() req: { user?: AuthedUser }) {
    const clientId = this.clientIdOrThrow(req.user);
    return this.billing.getClientBill(clientId);
  }

  @Get('me/bill')
  bill(@Req() req: { user?: AuthedUser }, @Query() query: BillingPeriodQueryDto) {
    const clientId = this.clientIdOrThrow(req.user);
    return this.billing.getClientBill(clientId, query.from, query.to);
  }

  @Get('me/history')
  history(@Req() req: { user?: AuthedUser }) {
    const clientId = this.clientIdOrThrow(req.user);
    return this.billing.getClientBillHistory(clientId);
  }
}
