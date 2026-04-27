import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  StreamableFile,
  UseGuards,
  UseInterceptors,
  UploadedFiles,
} from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../enum/role.enum';
import { PhysicalVerificationService } from './physical-verification.service';
import { ListPhysicalRequestsQueryDto } from './dto/list-physical-requests.dto';
import { AssignPhysicalRequestDto } from './dto/assign-physical-request.dto';
import { UpdatePhysicalStatusDto } from './dto/update-physical-status.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { FieldAgentSavePhysicalDetailsDto } from './dto/field-agent-save-physical-details.dto';
import { FilesInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { createReadStream, existsSync, statSync } from 'fs';
import { BadRequestException } from '@nestjs/common';
import type { PhysicalVerificationSelfie } from './entities/physical-verification-selfie.entity';

type AuthedReq = { user: any };

const SELFIE_DIR = join(process.cwd(), 'uploads', 'physical-verification', 'selfies');
const MAX_SIZE = 10 * 1024 * 1024; // 10MB each
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

@Controller()
@UseGuards(JwtAuthGuard, RolesGuard)
export class PhysicalVerificationController {
  constructor(private readonly service: PhysicalVerificationService) {}

  // ===== Super Admin =====

  @Get('physical-verification-requests')
  @Roles(Role.SUPER_ADMIN)
  list(@Query() query: ListPhysicalRequestsQueryDto) {
    return this.service.listSuperAdmin(query);
  }

  @Get('physical-verification-requests/:id')
  @Roles(Role.SUPER_ADMIN)
  details(@Param('id') id: string) {
    return this.service.getDetailsSuperAdmin(id);
  }

  @Post('physical-verification-requests/:id/assign')
  @Roles(Role.SUPER_ADMIN)
  assign(@Param('id') id: string, @Body() dto: AssignPhysicalRequestDto, @Request() req: AuthedReq) {
    return this.service.assign(id, dto.fieldAssistantId, dto.comment, req.user, 'ASSIGN');
  }

  @Post('physical-verification-requests/:id/reassign')
  @Roles(Role.SUPER_ADMIN)
  reassign(@Param('id') id: string, @Body() dto: AssignPhysicalRequestDto, @Request() req: AuthedReq) {
    return this.service.assign(id, dto.fieldAssistantId, dto.comment, req.user, 'REASSIGN');
  }

  @Post('physical-verification-requests/:id/approve')
  @Roles(Role.SUPER_ADMIN)
  approve(@Param('id') id: string, @Body('comment') comment: string | undefined, @Request() req: AuthedReq) {
    return this.service.approveOrDecline(id, 'APPROVE', comment, req.user);
  }

  @Post('physical-verification-requests/:id/decline')
  @Roles(Role.SUPER_ADMIN)
  decline(@Param('id') id: string, @Body('comment') comment: string | undefined, @Request() req: AuthedReq) {
    return this.service.approveOrDecline(id, 'DECLINE', comment, req.user);
  }

  // ===== Field Agent =====

  @Get('field-agent/physical-requests')
  @Roles(Role.FIELD_AGENT)
  listMine(@Request() req: AuthedReq) {
    return this.service.listForFieldAgent(req.user);
  }

  @Get('field-agent/physical-requests/:id')
  @Roles(Role.FIELD_AGENT)
  getMine(@Param('id') id: string, @Request() req: AuthedReq) {
    return this.service.getForFieldAgent(id, req.user);
  }

  @Post('field-agent/physical-requests/:id/status')
  @Roles(Role.FIELD_AGENT)
  updateStatus(@Param('id') id: string, @Body() dto: UpdatePhysicalStatusDto, @Request() req: AuthedReq) {
    return this.service.updateStatusForFieldAgent(id, dto.status, dto.comment, req.user);
  }

  @Post('field-agent/physical-requests/:id/location')
  @Roles(Role.FIELD_AGENT)
  updateLocation(@Param('id') id: string, @Body() dto: UpdateLocationDto, @Request() req: AuthedReq) {
    return this.service.updateLocationForFieldAgent(id, dto, req.user);
  }

  @Post('field-agent/physical-requests/:id/details')
  @Roles(Role.FIELD_AGENT)
  saveDetails(
    @Param('id') id: string,
    @Body() dto: FieldAgentSavePhysicalDetailsDto,
    @Request() req: AuthedReq,
  ) {
    return this.service.savePhysicalDetailsForFieldAgent(id, dto, req.user);
  }

  @Post('field-agent/physical-requests/:id/selfies')
  @Roles(Role.FIELD_AGENT)
  @UseInterceptors(
    FilesInterceptor('files', 10, {
      limits: { fileSize: MAX_SIZE },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const fs = require('fs');
          if (!fs.existsSync(SELFIE_DIR)) fs.mkdirSync(SELFIE_DIR, { recursive: true });
          cb(null, SELFIE_DIR);
        },
        filename: (_req, file, cb) => {
          const base = (file.originalname || 'selfie').replace(/\.[^/.]+$/, '');
          const ext = (file.originalname && file.originalname.split('.').pop()) || 'jpg';
          cb(null, `${randomUUID()}-${sanitizeFilename(base)}.${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype || !ALLOWED_MIMES.includes(file.mimetype)) {
          return cb(new BadRequestException('Invalid selfie file type'), false);
        }
        cb(null, true);
      },
    }),
  )
  async uploadSelfies(
    @Param('id') id: string,
    @UploadedFiles() files: Array<{ filename: string; originalname?: string; mimetype?: string }> | undefined,
    @Request() req: AuthedReq,
  ) {
    if (!files?.length) throw new BadRequestException('files are required');
    const prefix = process.env.API_PREFIX || 'api';

    const created: PhysicalVerificationSelfie[] = [];
    for (const f of files) {
      const url = `/${prefix}/field-agent/physical-selfies/view/${f.filename}`;
      const res = await this.service.addSelfie(
        id,
        url,
        f.originalname,
        f.mimetype,
        req.user,
      );
      if (!res.data) {
        throw new BadRequestException('Failed to persist selfie metadata');
      }
      created.push(res.data);
    }
    return {
      code: 201,
      message: 'Selfies uploaded',
      data: created,
    };
  }

  @Get('field-agent/physical-selfies/view/:filename')
  viewSelfie(@Param('filename') filename: string): StreamableFile {
    if (!filename || filename.includes('..')) throw new BadRequestException('Invalid filename');
    const filePath = join(SELFIE_DIR, filename);
    if (!existsSync(filePath) || !statSync(filePath).isFile()) throw new BadRequestException('File not found');
    const ext = filename.split('.').pop()?.toLowerCase();
    const mime: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    const contentType = mime[ext || ''] || 'application/octet-stream';
    return new StreamableFile(createReadStream(filePath), { type: contentType });
  }

  @Get('field-agent/wallet')
  @Roles(Role.FIELD_AGENT)
  wallet(@Request() req: AuthedReq) {
    const id = req.user?.fieldAssistantId || req.user?.sub;
    if (!id) throw new BadRequestException('Field agent context missing');
    return this.service.getWallet(id);
  }
}

