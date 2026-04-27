import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
  Request,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../enum/role.enum';
import { FieldAssistanceService } from './field-assistance.service';
import { ListFieldAssistantsQueryDto } from './dto/list-field-assistants-query.dto';
import { UpsertFieldAssistantDto } from './dto/field-assistant.dto';

@Controller('field-assistants')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class FieldAssistanceController {
  constructor(private readonly service: FieldAssistanceService) {}

  /**
   * Create Field Assistant
   * - Validates age >= 18 (based on dateOfBirth)
   * - Validates only one Active bank account in bankDetails
   * - Creates nested records in separate tables (addresses, banks, education, etc.)
   */
  @Post()
  create(@Body() dto: UpsertFieldAssistantDto, @Request() req: any) {
    return this.service.create(dto, req.user?.sub);
  }

  /**
   * Listing API
   * Supports pagination, searching, and sorting.
   *
   * Query params:
   * - page, limit
   * - search: searches name, fieldAgentId, office/personal mobile/email
   * - sortBy: createdAt | fullName | fieldAgentId | status
   * - sortOrder: ASC | DESC
   */
  @Get()
  list(@Query() query: ListFieldAssistantsQueryDto) {
    return this.service.list(query);
  }

  /** Get Field Assistant with all nested details */
  @Get(':id')
  getById(@Param('id') id: string) {
    return this.service.getById(id);
  }

  /**
   * Edit/Update Field Assistant
   * Replaces nested details using cascade + orphan delete.
   */
  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpsertFieldAssistantDto,
    @Request() req: any,
  ) {
    return this.service.update(id, dto, req.user?.sub);
  }

  /** Delete Field Assistant */
  @Delete(':id')
  delete(@Param('id') id: string) {
    return this.service.delete(id);
  }

  /** Update status quickly from listing page */
  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: 'Active' | 'Inactive' },
    @Request() req: any,
  ) {
    return this.service.updateStatus(id, body.status, req.user?.sub);
  }
}

