import { Module } from '@nestjs/common';
import { MailModule } from '../mail/mail.module';
import { SuperAdminSettingsModule } from '../super-admin-settings/super-admin-settings.module';
import { NotificationService } from './notification.service';

@Module({
  imports: [MailModule, SuperAdminSettingsModule],
  providers: [NotificationService],
  exports: [NotificationService],
})
export class NotificationModule {}
