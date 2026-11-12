import {
  Body,
  Controller,
  Post,
  UseGuards,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { OcrService } from '../services/ocr.service';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { PermissionsGuard } from '../../../common/guards/permissions.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { RequirePermissions } from '../../../common/decorators/permissions.decorator';
import { Role } from '../../../common/enums/role.enum';

type UploadedFileLike = { buffer: Buffer; mimetype?: string; originalname?: string };

@Controller('verification-requests/ocr')
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@Roles(
  Role.SUPER_ADMIN,
  Role.INTERNAL_USER,
  Role.CLIENT_ADMIN,
  Role.CLIENT_USER,
)
export class OcrController {
  constructor(private readonly service: OcrService) {}

  @Post('extract-simple')
  @RequirePermissions('VERIFICATION', 'ADD')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
    }),
  )
  extractSimple(
    @UploadedFile() file: UploadedFileLike | undefined,
    @Body('documentType') documentType: string | undefined,
  ) {
    return this.service.extractSimple(file, documentType);
  }
}
