import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Training } from './entities/training.entity';
import { UserTraining } from './entities/user-training.entity';
import { TrainingCertificate } from './entities/training-certificate.entity';
import { TrainingCompletionHistory } from './entities/training-completion-history.entity';
import { TrainingQuestion } from './entities/training-question.entity';
import { TrainingExamAttempt } from './entities/training-exam-attempt.entity';
import { SuperAdminSettings } from '../super-admin-settings/entities/super-admin-settings.entity';
import { User } from '../user/entities/user.entity';
import { Client } from '../client/entities/client.entity';
import { FieldAssistant } from '../field-assistance/entities/field-assistant.entity';
import { TrainingService } from './services/training.service';
import { TrainingAdminController } from './controllers/training-admin.controller';
import { TrainingUserController } from './controllers/training-user.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Training,
      UserTraining,
      TrainingCertificate,
      TrainingCompletionHistory,
      TrainingQuestion,
      TrainingExamAttempt,
      SuperAdminSettings,
      User,
      FieldAssistant,
      Client,
    ]),
  ],
  controllers: [TrainingAdminController, TrainingUserController],
  providers: [TrainingService],
  exports: [TrainingService],
})
export class TrainingModule {}
