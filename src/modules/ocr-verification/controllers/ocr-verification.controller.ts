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
  UploadedFiles,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { join } from 'path';
import { createReadStream, existsSync, statSync } from 'fs';
import { OcrVerificationService, OCR_UPLOAD_DIR } from '../services/ocr-verification.service';
import { ListOcrVerificationQueryDto } from '../dto/list-ocr-verification-query.dto';
import { UpdateOcrVerificationDto } from '../dto/update-ocr-verification.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { Role } from '../../../common/enums/role.enum';

type AuthedReq = { user: { role: Role; clientId?: string } };
type UploadedFileLike = { buffer: Buffer; mimetype?: string; originalname?: string };

const MAX_SIZE = 10 * 1024 * 1024;
const MAX_FILES = 20;
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

const docFileFilter = (
  _req: any,
  file: { mimetype: string },
  cb: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!file.mimetype || !ALLOWED_DOC_MIMES.includes(file.mimetype)) {
    return cb(
      new BadRequestException(
        'Invalid file type. Use PDF, JPG, JPEG, PNG, or WEBP for OCR documents.',
      ),
      false,
    );
  }
  cb(null, true);
};

@Controller('ocr-verifications')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.CLIENT_USER, Role.INTERNAL_USER)
export class OcrVerificationController {
  constructor(private readonly service: OcrVerificationService) {}

  @Get()
  @RequirePermissions('VERIFICATION', 'VIEW', 'LIST')
  list(@Query() query: ListOcrVerificationQueryDto, @Request() req: AuthedReq) {
    return this.service.list(query, req.user);
  }

  @Get('stats')
  @RequirePermissions('VERIFICATION', 'VIEW', 'LIST')
  stats(@Request() req: AuthedReq, @Query('clientId') clientId?: string) {
    return this.service.stats(req.user, clientId);
  }

  @Post()
  @RequirePermissions('VERIFICATION', 'ADD')
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
  @RequirePermissions('VERIFICATION', 'VIEW', 'LIST')
  getById(@Param('id') id: string, @Request() req: AuthedReq) {
    return this.service.getById(id, req.user);
  }

  @Patch(':id')
  @RequirePermissions('VERIFICATION', 'EDIT')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateOcrVerificationDto,
    @Request() req: AuthedReq,
  ) {
    return this.service.update(id, dto, req.user);
  }

  /** Append one or many documents (FormData field: files). */
  @Post(':id/documents/upload')
  @RequirePermissions('VERIFICATION', 'EDIT', 'ADD')
  @UseInterceptors(
    FilesInterceptor('files', MAX_FILES, {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE },
      fileFilter: docFileFilter,
    }),
  )
  uploadDocuments(
    @Param('id') id: string,
    @UploadedFiles() files: UploadedFileLike[] | undefined,
    @Request() req: AuthedReq,
  ) {
    return this.service.appendDocuments(id, files ?? [], req.user);
  }

  /** Legacy single-file upload (FormData field: file, optional key/isExtra). */
  @Post(':id/documents/upload-one')
  @RequirePermissions('VERIFICATION', 'EDIT', 'ADD')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: MAX_SIZE },
      fileFilter: docFileFilter,
    }),
  )
  uploadDocumentOne(
    @Param('id') id: string,
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body('key') key: string | undefined,
    @Body('isExtra') isExtra: string | undefined,
    @Request() req: AuthedReq,
  ) {
    return this.service.uploadDocument(
      id,
      key?.trim(),
      isExtra === 'true' || isExtra === '1',
      file,
      req.user,
    );
  }

  @Delete(':id/documents/:key')
  @RequirePermissions('VERIFICATION', 'EDIT', 'DELETE')
  deleteDocument(
    @Param('id') id: string,
    @Param('key') key: string,
    @Request() req: AuthedReq,
  ) {
    return this.service.deleteDocument(id, key, req.user);
  }

  @Post(':id/merged/upload')
  @RequirePermissions('VERIFICATION', 'EDIT', 'ADD')
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
  @RequirePermissions('VERIFICATION', 'EDIT', 'ADD')
  generateReport(@Param('id') id: string, @Request() req: AuthedReq) {
    return this.service.generateReport(id, req.user);
  }

  @Delete(':id')
  @RequirePermissions('VERIFICATION', 'DELETE')
  delete(@Param('id') id: string, @Request() req: AuthedReq) {
    return this.service.delete(id, req.user);
  }
}
