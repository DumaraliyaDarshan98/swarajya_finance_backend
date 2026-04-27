import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FieldAssistanceController } from './field-assistance.controller';
import { FieldAssistanceService } from './field-assistance.service';
import { FieldAssistant } from './entities/field-assistant.entity';
import { FieldAssistantAddress } from './entities/field-assistant-address.entity';
import { FieldAssistantEmergencyContact } from './entities/field-assistant-emergency-contact.entity';
import { FieldAssistantEducation } from './entities/field-assistant-education.entity';
import { FieldAssistantBankAccount } from './entities/field-assistant-bank-account.entity';
import { FieldAssistantFamilyMember } from './entities/field-assistant-family-member.entity';
import { FieldAssistantIdentification } from './entities/field-assistant-identification.entity';
import { FieldAssistantPreviousEmployment } from './entities/field-assistant-previous-employment.entity';
import { FieldAssistantIdSequence } from './entities/field-assistant-id-sequence.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FieldAssistant,
      FieldAssistantAddress,
      FieldAssistantEmergencyContact,
      FieldAssistantEducation,
      FieldAssistantBankAccount,
      FieldAssistantFamilyMember,
      FieldAssistantIdentification,
      FieldAssistantPreviousEmployment,
      FieldAssistantIdSequence,
    ]),
  ],
  controllers: [FieldAssistanceController],
  providers: [FieldAssistanceService],
})
export class FieldAssistanceModule {}

