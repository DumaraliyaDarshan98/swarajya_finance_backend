import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { VerificationRequest } from './entities/verification-request.entity';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';
import { OcrController } from './ocr.controller';
import { OcrService } from './ocr.service';
import { PhysicalVerificationModule } from '../physical-verification/physical-verification.module';
import { PhysicalVerificationRequest } from '../physical-verification/entities/physical-verification-request.entity';
import { PhysicalVerificationStatusHistory } from '../physical-verification/entities/physical-verification-status-history.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VerificationRequest,
      PhysicalVerificationRequest,
      PhysicalVerificationStatusHistory,
    ]),
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
    PhysicalVerificationModule,
  ],
  controllers: [VerificationController, OcrController],
  providers: [VerificationService, OcrService],
})
export class VerificationModule {}
