import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import { AuditLogService } from '../services/audit-log.service';
import { ListAuditLogsQueryDto } from '../dto/list-audit-logs-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { Role } from '../../../common/enums/role.enum';
import { AuthedUser } from '../../../common/interfaces/authed-user.interface';

@Controller('audit-logs')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
export class AuditLogController {
  constructor(private readonly service: AuditLogService) {}

  @Get()
  @Roles(
    Role.SUPER_ADMIN,
    Role.INTERNAL_USER,
    Role.CLIENT_ADMIN,
    Role.CLIENT_USER,
  )
  @RequirePermissions('AUDIT_LOG', 'VIEW', 'LIST')
  list(@Query() query: ListAuditLogsQueryDto, @Req() req: { user: AuthedUser }) {
    return this.service.findAll(query, req.user);
  }

  @Get('filters')
  @Roles(
    Role.SUPER_ADMIN,
    Role.INTERNAL_USER,
    Role.CLIENT_ADMIN,
    Role.CLIENT_USER,
  )
  @RequirePermissions('AUDIT_LOG', 'VIEW', 'LIST')
  filters(@Req() req: { user: AuthedUser }) {
    return this.service.getFilterOptions(req.user);
  }
}
