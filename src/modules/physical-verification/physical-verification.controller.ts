import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { createReadStream, existsSync, statSync } from 'fs';
import {
  PhysicalVerificationService,
  PHYSICAL_UPLOAD_DIR,
} from './physical-verification.service';
import { UpsertPhysicalVerificationDto } from './dto/upsert-physical-verification.dto';
import { ListPhysicalVerificationQueryDto } from './dto/list-physical-verification-query.dto';
import { AssignFieldAgentDto } from './dto/assign-field-agent.dto';
import { SaveFieldAgentSubmissionDto } from './dto/save-field-agent-submission.dto';
import { UpdateAgentTrackingDto } from './dto/update-agent-tracking.dto';
import { AdminReviewNoteDto, RejectPhysicalVerificationDto } from './dto/admin-review.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../enum/role.enum';

type AuthedReq = { user: { role: Role; clientId?: string; sub?: string } };
type UploadedFileLike = { buffer: Buffer; mimetype?: string; originalname?: string; size?: number };

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIMES = ['application/pdf', 'image/jpeg', 'image/png', 'image/jpg', 'image/webp'];

@Controller('physical-verifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.CLIENT_USER, Role.FIELD_AGENT)
export class PhysicalVerificationController {
  constructor(private service: PhysicalVerificationService) {}

  @Get()
  list(@Query() query: ListPhysicalVerificationQueryDto, @Request() req: AuthedReq) {
    return this.service.list(query, req.user);
  }

  @Get('stats')
  stats(@Request() req: AuthedReq) {
    return this.service.stats(req.user);
  }

  @Get('files/view/:filename')
  viewFile(@Param('filename') filename: string): StreamableFile {
    if (!filename || filename.includes('..')) {
      throw new BadRequestException('Invalid filename');
    }
    const filePath = join(PHYSICAL_UPLOAD_DIR, filename);
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      throw new BadRequestException('File not found');
    }
    const ext = filename.split('.').pop()?.toLowerCase();
    const mime: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    return new StreamableFile(createReadStream(filePath), {
      type: mime[ext ?? ''] ?? 'application/octet-stream',
    });
  }

  @Post()
  @Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.CLIENT_USER)
  create(@Body() dto: UpsertPhysicalVerificationDto, @Request() req: AuthedReq) {
    return this.service.create(dto, req.user);
  }

  @Get(':id/logs')
  @Roles(Role.SUPER_ADMIN)
  getLogs(@Param('id') id: string, @Request() req: AuthedReq) {
    return this.service.getLogs(id, req.user);
  }

  @Get(':id')
  getById(@Param('id') id: string, @Request() req: AuthedReq) {
    return this.service.getById(id, req.user);
  }

  @Patch(':id')
  @Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.CLIENT_USER)
  update(
    @Param('id') id: string,
    @Body() dto: UpsertPhysicalVerificationDto,
    @Request() req: AuthedReq,
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Post(':id/submit')
  @Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.CLIENT_USER)
  submit(@Param('id') id: string, @Request() req: AuthedReq) {
    return this.service.submit(id, req.user);
  }

  @Post(':id/assign-agent')
  @Roles(Role.SUPER_ADMIN)
  assignAgent(
    @Param('id') id: string,
    @Body() dto: AssignFieldAgentDto,
    @Request() req: AuthedReq,
  ) {
    return this.service.assignFieldAgent(id, dto, req.user);
  }

  @Patch(':id/field-agent-submission')
  @Roles(Role.FIELD_AGENT)
  saveFieldAgentSubmission(
    @Param('id') id: string,
    @Body() dto: SaveFieldAgentSubmissionDto,
    @Request() req: AuthedReq,
  ) {
    return this.service.saveFieldAgentSubmission(id, dto, req.user);
  }

  @Patch(':id/agent-tracking')
  @Roles(Role.FIELD_AGENT, Role.SUPER_ADMIN)
  updateAgentTracking(
    @Param('id') id: string,
    @Body() dto: UpdateAgentTrackingDto,
    @Request() req: AuthedReq,
  ) {
    return this.service.updateAgentTracking(id, dto, req.user);
  }

  @Post(':id/field-agent-submit')
  @Roles(Role.FIELD_AGENT)
  submitFieldAgentSubmission(@Param('id') id: string, @Request() req: AuthedReq) {
    return this.service.submitFieldAgentSubmission(id, req.user);
  }

  @Post(':id/field-upload')
  @Roles(Role.FIELD_AGENT)
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype || !ALLOWED_MIMES.includes(file.mimetype)) {
          return cb(new BadRequestException('Invalid file type'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadFieldFile(
    @Param('id') id: string,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body('key') key: string | undefined,
    @Request() req: AuthedReq,
  ) {
    if (!key?.trim()) throw new BadRequestException('key is required');
    return this.service.uploadFieldFile(id, key.trim(), file as any, req.user);
  }

  @Post(':id/approve')
  @Roles(Role.SUPER_ADMIN)
  approve(
    @Param('id') id: string,
    @Body() dto: AdminReviewNoteDto,
    @Request() req: AuthedReq,
  ) {
    return this.service.approve(id, dto, req.user);
  }

  @Post(':id/reject')
  @Roles(Role.SUPER_ADMIN)
  reject(
    @Param('id') id: string,
    @Body() dto: RejectPhysicalVerificationDto,
    @Request() req: AuthedReq,
  ) {
    return this.service.reject(id, dto, req.user);
  }

  @Post(':id/complete')
  @Roles(Role.SUPER_ADMIN)
  complete(@Param('id') id: string, @Request() req: AuthedReq) {
    return this.service.complete(id, req.user);
  }

  @Delete(':id')
  @Roles(Role.SUPER_ADMIN)
  delete(@Param('id') id: string, @Request() req: AuthedReq) {
    return this.service.delete(id, req.user);
  }
}
