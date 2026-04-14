import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { VerificationRequest } from './entities/verification-request.entity';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([VerificationRequest]),
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
  ],
  controllers: [VerificationController, OcrController],
  providers: [VerificationService, OcrService],
})
export class VerificationModule {}
