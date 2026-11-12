import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import { ReportCustomizationService } from '../services/report-customization.service';
import {
  CreateReportCustomizationDto,
  ListReportCustomizationsQueryDto,
  UpdateReportCustomizationDto,
  UpdateReportCustomizationStatusDto,
} from '../dto/report-customization.dto';

type AuthedReq = { user: { role: Role; sub?: string } };

@Controller('report-customizations')
@UseGuards(JwtAuthGuard, RolesGuard)
export class ReportCustomizationController {
  constructor(private readonly service: ReportCustomizationService) {}

  /** Resolve active custom template or built-in default (used by report viewers). */
  @Get('resolve')
  @Roles(Role.SUPER_ADMIN, Role.INTERNAL_USER, Role.CLIENT_ADMIN, Role.CLIENT_USER, Role.FIELD_AGENT)
  resolve(
    @Query('reportType') reportType: string,
    @Query('physicalSubType') physicalSubType?: string,
  ) {
    return this.service.resolve(reportType as any, physicalSubType);
  }

  @Get('defaults')
  @Roles(Role.SUPER_ADMIN, Role.INTERNAL_USER)
  getDefaults(
    @Query('reportType') reportType: string,
    @Query('physicalSubType') physicalSubType?: string,
  ) {
    return this.service.getDefaults(reportType as any, physicalSubType);
  }

  @Get()
  @Roles(Role.SUPER_ADMIN, Role.INTERNAL_USER)
  list(@Query() query: ListReportCustomizationsQueryDto) {
    return this.service.list(query);
  }

  @Get(':id')
  @Roles(Role.SUPER_ADMIN, Role.INTERNAL_USER)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.findOne(id);
  }

  @Post()
  @Roles(Role.SUPER_ADMIN)
  create(@Body() dto: CreateReportCustomizationDto, @Request() req: AuthedReq) {
    return this.service.create(dto, req.user.sub);
  }

  @Put(':id')
  @Roles(Role.SUPER_ADMIN)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportCustomizationDto,
    @Request() req: AuthedReq,
  ) {
    return this.service.update(id, dto, req.user.sub);
  }

  @Patch(':id/status')
  @Roles(Role.SUPER_ADMIN)
  updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReportCustomizationStatusDto,
    @Request() req: AuthedReq,
  ) {
    return this.service.updateStatus(id, dto.status, req.user.sub);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.service.remove(id);
  }
}
