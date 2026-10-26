import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { DigitalVerificationService } from '../services/digital-verification.service';
import { UpsertDigitalVerificationDto } from '../dto/upsert-digital-verification.dto';
import { ListDigitalVerificationQueryDto } from '../dto/list-digital-verification-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { Role } from '../../../common/enums/role.enum';

type AuthedReq = { user: { role: Role; clientId?: string } };

@Controller('digital-verifications')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.CLIENT_USER, Role.INTERNAL_USER)
export class DigitalVerificationController {
  constructor(private service: DigitalVerificationService) {}

  @Get()
  @RequirePermissions('VERIFICATION', 'VIEW', 'LIST')
  list(@Query() query: ListDigitalVerificationQueryDto, @Request() req: AuthedReq) {
    return this.service.list(query, req.user);
  }

  @Get('stats')
  @RequirePermissions('VERIFICATION', 'VIEW', 'LIST')
  stats(@Request() req: AuthedReq, @Query('clientId') clientId?: string) {
    return this.service.stats(req.user, clientId);
  }

  @Post()
  @RequirePermissions('VERIFICATION', 'ADD')
  create(@Body() dto: UpsertDigitalVerificationDto, @Request() req: AuthedReq) {
    return this.service.create(dto, req.user);
  }

  @Get(':id')
  @RequirePermissions('VERIFICATION', 'VIEW', 'LIST')
  getById(@Param('id') id: string, @Request() req: AuthedReq) {
    return this.service.getById(id, req.user);
  }

  @Patch(':id')
  @RequirePermissions('VERIFICATION', 'EDIT')
  update(
    @Param('id') id: string,
    @Body() dto: UpsertDigitalVerificationDto,
    @Request() req: AuthedReq,
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Post(':id/generate-report')
  @RequirePermissions('VERIFICATION', 'EDIT', 'ADD')
  generateReport(@Param('id') id: string, @Request() req: AuthedReq) {
    return this.service.generateReport(id, req.user);
  }

  @Delete(':id')
  @RequirePermissions('VERIFICATION', 'DELETE')
  delete(@Param('id') id: string, @Request() req: AuthedReq) {
    return this.service.delete(id, req.user);
  }
}
