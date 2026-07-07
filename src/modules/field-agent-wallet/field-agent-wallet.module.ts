import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FieldAgentWallet } from './entities/field-agent-wallet.entity';
import { FieldAgentWalletTransaction } from './entities/field-agent-wallet-transaction.entity';
import { FieldAgentWalletService } from './services/field-agent-wallet.service';
import { FieldAgentWalletController } from './controllers/field-agent-wallet.controller';
import { PhysicalVerification } from '../physical-verification/entities/physical-verification.entity';
import { FieldAssistant } from '../field-assistance/entities/field-assistant.entity';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FieldAgentWallet,
      FieldAgentWalletTransaction,
      PhysicalVerification,
      FieldAssistant,
      User,
    ]),
  ],
  controllers: [FieldAgentWalletController],
  providers: [FieldAgentWalletService],
  exports: [FieldAgentWalletService],
})
export class FieldAgentWalletModule {}
