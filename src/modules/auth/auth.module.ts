import { Module } from '@nestjs/common';
import { AuthService } from './services/auth.service';
import { AuthController } from './controllers/auth.controller';
import { UserModule } from '../user/user.module';
import { JwtStrategy } from '../../common/jwt.strategy';
import { MailModule } from '../mail/mail.module';
import { FieldAssistanceModule } from '../field-assistance/field-assistance.module';

@Module({
  imports: [UserModule, MailModule, FieldAssistanceModule],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
