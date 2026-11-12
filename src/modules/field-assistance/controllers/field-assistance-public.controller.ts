import {
  BadRequestException,
  Body,
  Controller,
  Get,
  HttpStatus,
  NotFoundException,
  Param,
  Post,
  Request,
  StreamableFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { createReadStream, existsSync, mkdirSync, statSync } from 'fs';
import type { Request as ExpressRequest } from 'express';
import { FieldAssistanceService } from '../services/field-assistance.service';
import { UpsertFieldAssistantDto } from '../dto/field-assistant.dto';

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'users', 'documents');
const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

@Controller('field-assistants')
export class FieldAssistancePublicController {
  constructor(private readonly service: FieldAssistanceService) {}

  /** Single registration API — full payload in one request (document URLs from upload endpoint). */
  @Post('register')
  register(@Body() dto: UpsertFieldAssistantDto) {
    return this.service.selfRegister(dto);
  }

  @Post('register/upload-document')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: MAX_SIZE },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          if (!existsSync(UPLOAD_DIR)) {
            mkdirSync(UPLOAD_DIR, { recursive: true });
          }
          cb(null, UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
          const base = (file.originalname || 'file').replace(/\.[^/.]+$/, '');
          const ext = (file.originalname && file.originalname.split('.').pop()) || 'bin';
          cb(null, `${randomUUID()}-${sanitizeFilename(base)}.${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype || !ALLOWED_MIMES.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Invalid file type. Allowed: PDF, images, Word docs.'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  uploadRegistrationDocument(@Request() req: ExpressRequest) {
    const file = (req as ExpressRequest & { file?: { filename: string } }).file;
    if (!file?.filename) {
      throw new BadRequestException('No file uploaded');
    }
    const prefix = process.env.API_PREFIX || 'api';
    return {
      code: HttpStatus.CREATED,
      message: 'File uploaded successfully',
      data: {
        url: `/${prefix}/field-assistants/register/documents/view/${file.filename}`,
      },
    };
  }

  /** Public document view for self-registration uploads (no auth). */
  @Get('register/documents/view/:filename')
  viewRegistrationDocument(@Param('filename') filename: string): StreamableFile {
    if (!filename || filename.includes('..')) {
      throw new BadRequestException('Invalid filename');
    }
    const filePath = join(UPLOAD_DIR, filename);
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      throw new NotFoundException('Document not found');
    }
    const ext = filename.split('.').pop()?.toLowerCase();
    const mime: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      webp: 'image/webp',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    };
    const contentType = mime[ext || ''] || 'application/octet-stream';
    return new StreamableFile(createReadStream(filePath), { type: contentType });
  }
}
