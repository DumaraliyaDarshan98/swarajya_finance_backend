import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import dbDataSource from './database/databaseConfig';
import { JwtService } from '@nestjs/jwt';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TimeoutInterceptor } from './interceptor/timeout.interceptor';
import { APIResponseInterceptor } from './interceptor/api-response.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './modules/mail/mail.module';
import { UserModule } from './modules/user/user.module';
import { ClientsModule } from './modules/client/client.module';
import { RoleModule } from './modules/role/role.module';
import { SuperAdminSettingsModule } from './modules/super-admin-settings/super-admin-settings.module';
import { NotificationModule } from './modules/notification/notification.module';
import { VerificationModule } from './modules/verification/verification.module';
import { FieldAssistanceModule } from './modules/field-assistance/field-assistance.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(dbDataSource.options),
    AuthModule,
    MailModule,
    UserModule,
    ClientsModule,
    RoleModule,
    SuperAdminSettingsModule,
    NotificationModule,
    VerificationModule,
    FieldAssistanceModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: APIResponseInterceptor,
    },
  ],
})
export class AppModule {}
