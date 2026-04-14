import {
  Body,
  Controller,
  Post,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { OcrService } from './ocr.service';

type UploadedFileLike = { buffer: Buffer; mimetype?: string; originalname?: string };

@Controller('verification-requests/ocr')
export class OcrController {
  constructor(private readonly service: OcrService) {}

  @Post('extract-simple')
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

