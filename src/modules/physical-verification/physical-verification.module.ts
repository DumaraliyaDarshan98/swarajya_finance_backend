import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhysicalVerification } from './entities/physical-verification.entity';
import { PhysicalLog } from './entities/physical-log.entity';
import { PhysicalVerificationService } from './physical-verification.service';
import { PhysicalVerificationController } from './physical-verification.controller';
import { User } from '../user/entities/user.entity';
import { FieldAssistant } from '../field-assistance/entities/field-assistant.entity';
import { FieldAgentWalletModule } from '../field-agent-wallet/field-agent-wallet.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PhysicalVerification, PhysicalLog, User, FieldAssistant]),
    FieldAgentWalletModule,
  ],
  controllers: [PhysicalVerificationController],
  providers: [PhysicalVerificationService],
  exports: [PhysicalVerificationService],
})
export class PhysicalVerificationModule {}
