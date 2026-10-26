import {
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  Body,
  UseGuards,
  StreamableFile,
  Header,
} from '@nestjs/common';
import { createReadStream } from 'fs';
import { basename } from 'path';
import { JobApplicationService } from '../services/job-application.service';
import { ListJobApplicationQueryDto } from '../dto/list-job-application-query.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import type { JobApplicationStatus } from '../entities/job-application.entity';

@Controller('admin/job-applications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN)
export class JobApplicationAdminController {
  constructor(private readonly service: JobApplicationService) {}

  @Get()
  list(@Query() query: ListJobApplicationQueryDto) {
    return this.service.findAll(query);
  }

  @Get(':id')
  getOne(@Param('id') id: string) {
    return this.service.findOne(id);
  }

  @Get(':id/resume')
  @Header('Cache-Control', 'private, max-age=60')
  async resume(@Param('id') id: string): Promise<StreamableFile> {
    const res = await this.service.findOne(id);
    const row = res.data!;
    const filePath = this.service.resolveResumePath(row.resumeStoredFileName);
    const stream = createReadStream(filePath);
    const downloadName = row.resumeOriginalName || basename(filePath);
    return new StreamableFile(stream, {
      type: row.resumeMimeType || 'application/pdf',
      disposition: `inline; filename="${downloadName.replace(/"/g, '')}"`,
    });
  }

  @Patch(':id/status')
  updateStatus(
    @Param('id') id: string,
    @Body() body: { status: JobApplicationStatus },
  ) {
    return this.service.updateStatus(id, body.status);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
