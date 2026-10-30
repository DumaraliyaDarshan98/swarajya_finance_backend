import {
  Body,
  Controller,
  Get,
  Param,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { BillingService } from '../services/billing.service';
import { BillingPeriodQueryDto, UpdateBillingRatesDto } from '../dto/billing.dto';
import type { AuthedUser } from '../../../common/interfaces/authed-user.interface';

@Controller('admin/billing')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class BillingAdminController {
  constructor(private readonly billing: BillingService) {}

  @Get('rates')
  getRates() {
    return this.billing.getRates();
  }

  @Put('rates')
  saveRates(@Body() dto: UpdateBillingRatesDto, @Req() req: { user?: AuthedUser }) {
    return this.billing.saveRates(dto, req.user?.sub);
  }

  @Get('clients/summary')
  clientSummaries(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
  ) {
    return this.billing.listClientSummaries({
      page: page ? Number(page) : 1,
      limit: limit ? Number(limit) : 20,
      search,
    });
  }

  @Get('clients/month-totals')
  monthTotals(@Query('clientIds') clientIds?: string) {
    const ids = String(clientIds || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    return this.billing.getCurrentMonthTotalsMap(ids);
  }

  @Get('clients/:clientId/bill')
  clientBill(@Param('clientId') clientId: string, @Query() query: BillingPeriodQueryDto) {
    return this.billing.getClientBill(clientId, query.from, query.to);
  }

  @Get('clients/:clientId/history')
  clientHistory(@Param('clientId') clientId: string) {
    return this.billing.getClientBillHistory(clientId);
  }
}
