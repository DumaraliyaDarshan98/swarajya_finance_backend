import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Request,
  StreamableFile,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { createReadStream, existsSync, statSync } from 'fs';
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
type UploadedFileLike = { filename?: string; originalname?: string; mimetype?: string };

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'verification', 'documents');
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
];

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

@Controller('verification-requests')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.CLIENT_USER)
export class VerificationController {
  constructor(private service: VerificationService) {}

  @Get()
  list(@Query() query: ListVerificationRequestsQueryDto, @Request() req: AuthedReq) {
    return this.service.list(query, req.user);
  }

  @Get('stats')
  stats(@Request() req: AuthedReq) {
    return this.service.stats(req.user);
  }

  @Post(':id/documents/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_SIZE },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          const fs = require('fs');
          if (!fs.existsSync(UPLOAD_DIR)) {
            fs.mkdirSync(UPLOAD_DIR, { recursive: true });
          }
          cb(null, UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
          const base = (file.originalname || 'file').replace(/\.[^/.]+$/, '');
          const ext =
            (file.originalname && file.originalname.split('.').pop()) || 'bin';
          cb(null, `${randomUUID()}-${sanitizeFilename(base)}.${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype || !ALLOWED_MIMES.includes(file.mimetype)) {
          return cb(new BadRequestException('Invalid file type'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadVerificationDocument(
    @Param('id') id: string,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body('key') key: string | undefined,
    @Request() req: AuthedReq,
  ) {
    if (!file?.filename) throw new BadRequestException('No file uploaded');
    if (!key?.trim()) throw new BadRequestException('key is required');
    return this.service.attachDocument(
      id,
      key.trim(),
      file.filename,
      file.originalname,
      req.user,
    );
  }

  @Get('documents/view/:filename')
  viewVerificationDocument(@Param('filename') filename: string): StreamableFile {
    if (!filename || filename.includes('..')) {
      throw new BadRequestException('Invalid filename');
    }
    const filePath = join(UPLOAD_DIR, filename);
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      throw new BadRequestException('Document not found');
    }
    const ext = filename.split('.').pop()?.toLowerCase();
    const mime: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
    };
    const contentType = mime[ext || ''] || 'application/octet-stream';
    const stream = createReadStream(filePath);
    return new StreamableFile(stream, { type: contentType });
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
