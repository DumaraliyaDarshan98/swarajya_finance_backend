import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BillingRateConfig } from './entities/billing-rate-config.entity';
import { BillingService } from './services/billing.service';
import { BillingAdminController } from './controllers/billing-admin.controller';
import { BillingClientController } from './controllers/billing-client.controller';
import { Client } from '../client/entities/client.entity';
import { OcrVerification } from '../ocr-verification/entities/ocr-verification.entity';
import { DigitalVerification } from '../digital-verification/entities/digital-verification.entity';
import { PhysicalVerification } from '../physical-verification/entities/physical-verification.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      BillingRateConfig,
      Client,
      OcrVerification,
      DigitalVerification,
      PhysicalVerification,
    ]),
  ],
  controllers: [BillingAdminController, BillingClientController],
  providers: [BillingService],
  exports: [BillingService, TypeOrmModule],
})
export class BillingModule {}