import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhysicalVerification } from './entities/physical-verification.entity';
import { PhysicalVerificationVisit } from './entities/physical-verification-visit.entity';
import { PhysicalLog } from './entities/physical-log.entity';
import { PhysicalVerificationService } from './services/physical-verification.service';
import { PhysicalVerificationVisitService } from './services/physical-verification-visit.service';
import { PhysicalVerificationController } from './controllers/physical-verification.controller';
import { User } from '../user/entities/user.entity';
import { FieldAssistant } from '../field-assistance/entities/field-assistant.entity';
import { FieldAgentWalletModule } from '../field-agent-wallet/field-agent-wallet.module';
import { TelephonyModule } from '../telephony/telephony.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PhysicalVerification,
      PhysicalVerificationVisit,
      PhysicalLog,
      User,
      FieldAssistant,
    ]),
    FieldAgentWalletModule,
    TelephonyModule,
  ],
  controllers: [PhysicalVerificationController],
  providers: [PhysicalVerificationService, PhysicalVerificationVisitService],
  exports: [PhysicalVerificationService, PhysicalVerificationVisitService],
})
export class PhysicalVerificationModule {}
