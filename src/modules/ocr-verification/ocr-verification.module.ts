import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { OcrVerification } from './entities/ocr-verification.entity';
import { OcrVerificationController } from './controllers/ocr-verification.controller';
import { OcrVerificationService } from './services/ocr-verification.service';
import { OcrNotificationGateway } from './gateways/ocr-notification.gateway';
import { VerificationModule } from '../verification/verification.module';
import { RcuTriggersModule } from '../rcu-triggers/rcu-triggers.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([OcrVerification]),
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
    VerificationModule,
    RcuTriggersModule,
  ],
  controllers: [OcrVerificationController],
  providers: [OcrVerificationService, OcrNotificationGateway],
  exports: [OcrVerificationService],
})
export class OcrVerificationModule {}
