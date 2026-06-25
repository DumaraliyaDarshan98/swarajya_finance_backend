import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { OcrVerification } from './entities/ocr-verification.entity';
import { OcrVerificationController } from './ocr-verification.controller';
import { OcrVerificationService } from './ocr-verification.service';
import { VerificationModule } from '../verification/verification.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OcrVerification]),
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
    VerificationModule,
  ],
  controllers: [OcrVerificationController],
  providers: [OcrVerificationService],
  exports: [OcrVerificationService],
})
export class OcrVerificationModule {}
