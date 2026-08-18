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
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { createReadStream, existsSync, statSync } from 'fs';
import { OcrVerificationService, OCR_UPLOAD_DIR } from '../services/ocr-verification.service';
import { ListOcrVerificationQueryDto } from '../dto/list-ocr-verification-query.dto';
import { UpdateOcrVerificationDto } from '../dto/update-ocr-verification.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';

type AuthedReq = { user: { role: Role; clientId?: string } };
type UploadedFileLike = { buffer: Buffer; mimetype?: string; originalname?: string };

const MAX_SIZE = 10 * 1024 * 1024;
const ALLOWED_DOC_MIMES = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/jpg',
  'image/webp',
];
const ALLOWED_MERGED_MIMES = [
  ...ALLOWED_DOC_MIMES,
  'application/zip',
  'application/x-zip-compressed',
];

@Controller('ocr-verifications')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.CLIENT_USER)
export class OcrVerificationController {
  constructor(private readonly service: OcrVerificationService) {}

  @Get()
  list(@Query() query: ListOcrVerificationQueryDto, @Request() req: AuthedReq) {
    return this.service.list(query, req.user);
  }

  @Get('stats')
  stats(@Request() req: AuthedReq, @Query('clientId') clientId?: string) {
    return this.service.stats(req.user, clientId);
  }

  @Post()
  create(@Request() req: AuthedReq) {
    return this.service.create(req.user);
  }

  @Get('documents/view/:filename')
  viewDocument(@Param('filename') filename: string): StreamableFile {
    if (!filename || filename.includes('..')) {
      throw new BadRequestException('Invalid filename');
    }
    const filePath = join(OCR_UPLOAD_DIR, filename);
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      throw new BadRequestException('Document not found');
    }
    const ext = filename.split('.').pop()?.toLowerCase();
    const mime: Record<string, string> = {
      pdf: 'application/pdf',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
      zip: 'application/zip',
    };
    const type = mime[ext ?? ''] ?? 'application/octet-stream';
    return new StreamableFile(createReadStream(filePath), { type });
  }

  @Get(':id')
  getById(@Param('id') id: string, @Request() req: AuthedReq) {
    return this.service.getById(id, req.user);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOcrVerificationDto,
    @Request() req: AuthedReq,
  ) {
    return this.service.update(id, dto, req.user);
  }

  @Post(':id/documents/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype || !ALLOWED_DOC_MIMES.includes(file.mimetype)) {
          return cb(
            new BadRequestException(
              'Invalid file type. Use PDF, JPG, JPEG, PNG, or WEBP for OCR documents.',
            ),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  uploadDocument(
    @Param('id') id: string,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body('key') key: string | undefined,
    @Body('isExtra') isExtra: string | undefined,
    @Request() req: AuthedReq,
  ) {
    if (!key?.trim()) throw new BadRequestException('key is required');
    return this.service.uploadDocument(
      id,
      key.trim(),
      isExtra === 'true' || isExtra === '1',
      file,
      req.user,
    );
  }

  @Post(':id/merged/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE },
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype || !ALLOWED_MERGED_MIMES.includes(file.mimetype)) {
          return cb(new BadRequestException('Invalid file type'), false);
        }
        cb(null, true);
      },
    }),
  )
  uploadMerged(
    @Param('id') id: string,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Request() req: AuthedReq,
  ) {
    return this.service.uploadMerged(id, file, req.user);
  }

  @Post(':id/generate-report')
  generateReport(@Param('id') id: string, @Request() req: AuthedReq) {
    return this.service.generateReport(id, req.user);
  }

  @Delete(':id')
  delete(@Param('id') id: string, @Request() req: AuthedReq) {
    return this.service.delete(id, req.user);
  }
}
