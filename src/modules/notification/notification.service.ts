import { Injectable } from '@nestjs/common';
import { MailService } from '../mail/mail.service';
import { SuperAdminSettingsService } from '../super-admin-settings/super-admin-settings.service';

export interface NotificationPayload {
  toEmail?: string;
  toPhone?: string;
  subject: string;
  template?: string;
  data?: Record<string, any>;
  messageText?: string;
}

@Injectable()
export class NotificationService {
  constructor(
    private readonly mailService: MailService,
    private readonly superAdminSettingsService: SuperAdminSettingsService,
  ) {}

  /**
   * Central helper to send system notifications (e.g. task assigned/updated)
   * respecting the global Super Admin settings for email/SMS.
   */
  async sendSystemNotification(payload: NotificationPayload): Promise<void> {
    const settings =
      await this.superAdminSettingsService.getEffectiveSettings();

    if (settings.data?.sendEmailNotifications && payload.toEmail) {
      // Reuse generic mail sender; template is optional so callers
      // can plug in their own mail templates later.
      await this.mailService.sendMail(
        payload.toEmail,
        payload.subject,
        payload.template ?? 'generic-notification',
        payload.data ?? {},
      );
    }

    if (settings.data?.sendSmsNotifications && payload.toPhone) {
      // Placeholder: integrate with actual SMS provider here.
      // This keeps a single place to respect the SMS flag.

      console.log(
        'SMS notification (stub):',
        payload.toPhone,
        payload.messageText ?? payload.subject,
      );
    }
  }
}
