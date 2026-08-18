import { Controller, Get, Param, Patch, Post, Body, Query, Request, UseGuards } from '@nestjs/common';
import { FieldAgentWalletService } from '../services/field-agent-wallet.service';
import { ListWalletTransactionsQueryDto } from '../dto/list-wallet-transactions-query.dto';
import { CreateWithdrawalDto } from '../dto/create-withdrawal.dto';
import { ListWithdrawalsQueryDto } from '../dto/list-withdrawals-query.dto';
import { ReviewWithdrawalDto } from '../dto/review-withdrawal.dto';
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

  @Get('me/withdraw-context')
  @Roles(Role.FIELD_AGENT)
  getMyWithdrawContext(@Request() req: AuthedReq) {
    return this.service.getMyWithdrawContext(req.user);
  }

  @Get('me/withdrawals')
  @Roles(Role.FIELD_AGENT)
  listMyWithdrawals(@Query() query: ListWithdrawalsQueryDto, @Request() req: AuthedReq) {
    return this.service.listWithdrawals(query, req.user);
  }

  @Post('me/withdrawals')
  @Roles(Role.FIELD_AGENT)
  createWithdrawal(@Body() dto: CreateWithdrawalDto, @Request() req: AuthedReq) {
    return this.service.createWithdrawal(dto, req.user);
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

  @Get('admin/agents/:fieldAgentUserId')
  @Roles(Role.SUPER_ADMIN)
  getAdminAgentOverview(
    @Param('fieldAgentUserId') fieldAgentUserId: string,
    @Request() req: AuthedReq,
  ) {
    return this.service.getAdminAgentOverview(fieldAgentUserId, req.user);
  }

  @Get('admin/transactions')
  @Roles(Role.SUPER_ADMIN)
  listAdminTransactions(@Query() query: ListWalletTransactionsQueryDto, @Request() req: AuthedReq) {
    return this.service.listTransactions(query, req.user);
  }

  @Get('admin/withdrawals')
  @Roles(Role.SUPER_ADMIN)
  listAdminWithdrawals(@Query() query: ListWithdrawalsQueryDto, @Request() req: AuthedReq) {
    return this.service.listWithdrawals(query, req.user);
  }

  @Patch('admin/withdrawals/:id/approve')
  @Roles(Role.SUPER_ADMIN)
  approveWithdrawal(
    @Param('id') id: string,
    @Body() dto: ReviewWithdrawalDto,
    @Request() req: AuthedReq,
  ) {
    return this.service.reviewWithdrawal(id, 'APPROVED', dto, req.user);
  }

  @Patch('admin/withdrawals/:id/reject')
  @Roles(Role.SUPER_ADMIN)
  rejectWithdrawal(
    @Param('id') id: string,
    @Body() dto: ReviewWithdrawalDto,
    @Request() req: AuthedReq,
  ) {
    return this.service.reviewWithdrawal(id, 'REJECTED', dto, req.user);
  }
}
