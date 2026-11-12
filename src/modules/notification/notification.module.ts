import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../mail/mail.module';
import { SuperAdminSettingsModule } from '../super-admin-settings/super-admin-settings.module';
import { NotificationService } from './services/notification.service';
import { UserNotification } from './entities/user-notification.entity';
import { NotificationsController } from './controllers/notifications.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([UserNotification]),
    MailModule,
    SuperAdminSettingsModule,
  ],
  controllers: [NotificationsController],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
