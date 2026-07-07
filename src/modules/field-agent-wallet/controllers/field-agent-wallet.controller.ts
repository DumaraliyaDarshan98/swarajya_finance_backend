import { Controller, Get, Query, Request, UseGuards } from '@nestjs/common';
import { FieldAgentWalletService } from '../services/field-agent-wallet.service';
import { ListWalletTransactionsQueryDto } from '../dto/list-wallet-transactions-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';

type AuthedReq = { user: { role: Role; clientId?: string; sub?: string } };

@Controller('field-agent-wallet')
@UseGuards(JwtAuthGuard, RolesGuard)
export class FieldAgentWalletController {
  constructor(private readonly service: FieldAgentWalletService) {}

  @Get('me/summary')
  @Roles(Role.FIELD_AGENT)
  getMySummary(@Request() req: AuthedReq) {
    return this.service.getMySummary(req.user);
  }

  @Get('me/dashboard')
  @Roles(Role.FIELD_AGENT)
  getMyDashboard(@Request() req: AuthedReq) {
    return this.service.getMyDashboard(req.user);
  }

  @Get('me/transactions')
  @Roles(Role.FIELD_AGENT)
  listMyTransactions(@Query() query: ListWalletTransactionsQueryDto, @Request() req: AuthedReq) {
    return this.service.listTransactions(query, req.user);
  }

  @Get('admin/summary')
  @Roles(Role.SUPER_ADMIN)
  getAdminSummary(@Request() req: AuthedReq) {
    return this.service.getAdminSummary(req.user);
  }

  @Get('admin/agents')
  @Roles(Role.SUPER_ADMIN)
  listAgentOverviews(@Request() req: AuthedReq) {
    return this.service.listAgentOverviews(req.user);
  }

  @Get('admin/transactions')
  @Roles(Role.SUPER_ADMIN)
  listAdminTransactions(@Query() query: ListWalletTransactionsQueryDto, @Request() req: AuthedReq) {
    return this.service.listTransactions(query, req.user);
  }
}
