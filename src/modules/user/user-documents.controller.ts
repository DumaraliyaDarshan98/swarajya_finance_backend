import {
  Controller,
  Post,
  Get,
  Param,
  Request,
  UseGuards,
  UseInterceptors,
  BadRequestException,
  NotFoundException,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { join } from 'path';
import { randomUUID } from 'crypto';
import * as express from 'express';
import { createReadStream, existsSync, statSync } from 'fs';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../decorators/roles.decorator';
import { Role } from '../../enum/role.enum';
import { UsersService } from './users.service';
import type { UploadDocumentResponse } from '../../interface/response.interface';
import { HttpStatus } from '@nestjs/common';
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'users', 'documents');
const MAX_SIZE = 10 * 1024 * 1024; // 10MB
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

@Controller('users')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN)
export class UserDocumentsController {
  constructor(private readonly usersService: UsersService) {}

  @Post('upload-document')
  @Roles(Role.SUPER_ADMIN)
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
          return cb(
            new BadRequestException(
              'Invalid file type. Allowed: PDF, images, Word docs.',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  uploadDocument(@Request() req: express.Request): UploadDocumentResponse {
    const file = (req as unknown as { file?: { filename: string } }).file;
    if (!file?.filename) {
      throw new BadRequestException('No file uploaded');
    }
    const prefix = process.env.API_PREFIX || 'api';
    const url = `/${prefix}/users/documents/view/${file.filename}`;
    return {
      code: HttpStatus.CREATED,
      message: 'File uploaded successfully',
      data: { url },
    };
  }

  @Get('documents/view/:filename')
  viewDocument(@Param('filename') filename: string): StreamableFile {
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
    const stream = createReadStream(filePath);
    return new StreamableFile(stream, { type: contentType });
  }
}
