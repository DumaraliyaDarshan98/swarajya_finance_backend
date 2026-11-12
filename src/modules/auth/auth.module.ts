import { Module } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { UserModule } from '../user/user.module';
import { JwtStrategy } from '../../common/jwt.strategy';
import { MailModule } from '../mail/mail.module';
import { FieldAssistanceModule } from '../field-assistance/field-assistance.module';
import { TrainingModule } from '../training/training.module';
import { AuditLogModule } from '../audit-log/audit-log.module';
import { CommonModule } from '../../common/common.module';

@Module({
  imports: [
    UserModule,
    MailModule,
    FieldAssistanceModule,
    TrainingModule,
    AuditLogModule,
    CommonModule,
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
