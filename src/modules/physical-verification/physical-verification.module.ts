import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhysicalVerificationRequest } from './entities/physical-verification-request.entity';
import { PhysicalVerificationStatusHistory } from './entities/physical-verification-status-history.entity';
import { PhysicalVerificationSelfie } from './entities/physical-verification-selfie.entity';
import { FieldAgentWallet } from './entities/field-agent-wallet.entity';
import { FieldAgentWalletTransaction } from './entities/field-agent-wallet-transaction.entity';
import { PhysicalVerificationService } from './physical-verification.service';
import { PhysicalVerificationController } from './physical-verification.controller';
import { SuperAdminSettings } from '../super-admin-settings/entities/super-admin-settings.entity';
import { VerificationRequest } from '../verification/entities/verification-request.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PhysicalVerificationRequest,
      PhysicalVerificationStatusHistory,
      PhysicalVerificationSelfie,
      FieldAgentWallet,
      FieldAgentWalletTransaction,
      SuperAdminSettings,
      VerificationRequest,
    ]),
  ],
  providers: [PhysicalVerificationService],
  controllers: [PhysicalVerificationController],
  exports: [PhysicalVerificationService],
})
export class PhysicalVerificationModule {}

