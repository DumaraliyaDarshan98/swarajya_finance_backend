import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { VerificationRequest } from './entities/verification-request.entity';
import { VerificationController } from './controllers/verification.controller';
import { VerificationService } from './services/verification.service';
import { OcrController } from './controllers/ocr.controller';
import { OcrService } from './services/ocr.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([VerificationRequest]),
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
  ],
  controllers: [VerificationController, OcrController],
  providers: [VerificationService, OcrService],
  exports: [OcrService],
})
export class VerificationModule {}
