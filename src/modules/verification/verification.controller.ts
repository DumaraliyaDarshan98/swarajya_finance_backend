import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../enum/role.enum';
import { VerificationService } from './verification.service';
import { ListVerificationRequestsQueryDto } from './dto/list-verification-requests.dto';
import { UpsertDigitalVerificationDto } from './dto/upsert-digital.dto';
import { UpsertDocumentVerificationDto } from './dto/upsert-document.dto';
import { UpsertPhysicalVerificationDto } from './dto/upsert-physical.dto';

type AuthedReq = { user: { role: Role; clientId?: string } };

@Controller('verification-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.CLIENT_USER)
export class VerificationController {
  constructor(private service: VerificationService) {}

  @Get()
  list(@Query() query: ListVerificationRequestsQueryDto, @Request() req: AuthedReq) {
    return this.service.list(query, req.user);
  }

  @Post()
  createDigital(@Body() dto: UpsertDigitalVerificationDto, @Request() req: AuthedReq) {
    return this.service.createDigital(dto, req.user);
  }

  @Get(':id')
  getById(@Param('id') id: string, @Request() req: AuthedReq) {
    return this.service.getById(id, req.user);
  }

  @Patch(':id/digital')
  updateDigital(@Param('id') id: string, @Body() dto: UpsertDigitalVerificationDto, @Request() req: AuthedReq) {
    return this.service.updateDigital(id, dto, req.user);
  }

  @Patch(':id/document')
  updateDocument(@Param('id') id: string, @Body() dto: UpsertDocumentVerificationDto, @Request() req: AuthedReq) {
    return this.service.updateDocument(id, dto, req.user);
  }

  @Patch(':id/physical')
  updatePhysical(@Param('id') id: string, @Body() dto: UpsertPhysicalVerificationDto, @Request() req: AuthedReq) {
    return this.service.updatePhysical(id, dto, req.user);
  }

  @Post(':id/generate-report')
  generateReport(@Param('id') id: string, @Request() req: AuthedReq) {
    return this.service.generateReport(id, req.user);
  }
}
