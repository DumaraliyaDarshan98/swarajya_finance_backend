import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UserModule } from '../user/user.module';
import { JwtStrategy } from '../../common/jwt.strategy';
import { MailModule } from '../mail/mail.module';
import { FieldAssistanceModule } from '../field-assistance/field-assistance.module';

@Module({
  imports: [
    UserModule,
    MailModule,
    FieldAssistanceModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '1d' },
    }),
  ],
  providers: [AuthService, JwtStrategy],
  controllers: [AuthController],
})
export class AuthModule {}
