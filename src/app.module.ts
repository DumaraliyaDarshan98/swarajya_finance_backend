import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JwtModule } from '@nestjs/jwt';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/config.module';
import { TimeoutInterceptor } from './common/interceptors/timeout.interceptor';
import { APIResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './modules/mail/mail.module';
import { UserModule } from './modules/user/user.module';
import { ClientsModule } from './modules/client/client.module';
import { RoleModule } from './modules/role/role.module';
import { SuperAdminSettingsModule } from './modules/super-admin-settings/super-admin-settings.module';
import { NotificationModule } from './modules/notification/notification.module';
import { VerificationModule } from './modules/verification/verification.module';
import { FieldAssistanceModule } from './modules/field-assistance/field-assistance.module';
import { ScrappingModule } from './modules/scrapping/scrapping.module';
import { DigitalVerificationModule } from './modules/digital-verification/digital-verification.module';
import { OcrVerificationModule } from './modules/ocr-verification/ocr-verification.module';
import { PhysicalVerificationModule } from './modules/physical-verification/physical-verification.module';
import { FieldAgentWalletModule } from './modules/field-agent-wallet/field-agent-wallet.module';
import { TelephonyModule } from './modules/telephony/telephony.module';
import { ReportCustomizationModule } from './modules/report-customization/report-customization.module';
import { FieldAgentAttendanceModule } from './modules/field-agent-attendance/field-agent-attendance.module';
import { GeoModule } from './modules/geo/geo.module';
import { TrainingModule } from './modules/training/training.module';
import { SubscriptionPlanModule } from './modules/subscription-plan/subscription-plan.module';
import { RcuTriggersModule } from './modules/rcu-triggers/rcu-triggers.module';
import { PortalListModule } from './modules/portal-list/portal-list.module';
import { QueuesModule } from './queues/queues.module';

@Module({
  imports: [
    AppConfigModule,
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const db = config.get('database');
        return {
          ...db,
          autoLoadEntities: true,
        };
      },
    }),
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>('jwt.secret'),
        signOptions: {
          expiresIn: (config.get<string>('jwt.expiresIn') ?? '1d') as `${number}d`,
        },
      }),
    }),
    QueuesModule,
    AuthModule,
    MailModule,
    UserModule,
    ClientsModule,
    RoleModule,
    SuperAdminSettingsModule,
    NotificationModule,
    VerificationModule,
    FieldAssistanceModule,
    ScrappingModule,
    DigitalVerificationModule,
    OcrVerificationModule,
    PhysicalVerificationModule,
    FieldAgentWalletModule,
    TelephonyModule,
    ReportCustomizationModule,
    FieldAgentAttendanceModule,
    GeoModule,
    TrainingModule,
    SubscriptionPlanModule,
    RcuTriggersModule,
    PortalListModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
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
