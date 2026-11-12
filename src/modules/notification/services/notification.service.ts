import { HttpStatus, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MailService } from '../../mail/services/mail.service';
import { SuperAdminSettingsService } from '../../super-admin-settings/services/super-admin-settings.service';
import {
  NotificationIcon,
  UserNotification,
} from '../entities/user-notification.entity';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';

export interface NotificationPayload {
  /** Persist in-app notification for this user id */
  userId?: string;
  toEmail?: string;
  toPhone?: string;
  subject: string;
  template?: string;
  data?: Record<string, any>;
  messageText?: string;
  title?: string;
  name?: string;
  ctaUrl?: string;
  ctaLabel?: string;
  details?: string;
  icon?: NotificationIcon;
}

@Injectable()
export class NotificationService {
  constructor(
    private readonly mailService: MailService,
    private readonly superAdminSettingsService: SuperAdminSettingsService,
    @InjectRepository(UserNotification)
    private readonly repo: Repository<UserNotification>,
  ) {}

  /**
   * Create in-app notification + optional email/SMS (respecting SA settings).
   */
  async sendSystemNotification(payload: NotificationPayload): Promise<void> {
    if (payload.userId) {
      await this.createInApp({
        userId: payload.userId,
        title: payload.title || payload.subject,
        body:
          payload.messageText ||
          (typeof payload.data?.message === 'string'
            ? payload.data.message
            : payload.subject),
        icon: payload.icon || 'info',
        ctaUrl: payload.ctaUrl || payload.data?.ctaUrl || null,
      });
    }

    const settings =
      await this.superAdminSettingsService.getEffectiveSettings();

    if (settings.data?.sendEmailNotifications && payload.toEmail) {
      const template = payload.template ?? 'generic-notification';
      const message =
        payload.messageText ||
        (typeof payload.data?.message === 'string'
          ? payload.data.message
          : payload.subject);

      if (template === 'generic-notification') {
        await this.mailService.sendGenericNotification({
          to: payload.toEmail,
          subject: payload.subject,
          title: payload.title || payload.data?.title || payload.subject,
          name: payload.name || payload.data?.name,
          message,
          details: payload.details || payload.data?.details,
          ctaUrl: payload.ctaUrl || payload.data?.ctaUrl,
          ctaLabel: payload.ctaLabel || payload.data?.ctaLabel,
        });
      } else {
        await this.mailService.sendMail(payload.toEmail, payload.subject, template, {
          title: payload.title || payload.subject,
          name: payload.name,
          message,
          details: payload.details,
          ctaUrl: payload.ctaUrl,
          ctaLabel: payload.ctaLabel || 'Open portal',
          ...(payload.data ?? {}),
        });
      }
    }

    if (settings.data?.sendSmsNotifications && payload.toPhone) {
      // SMS provider integration pending — log only.
      console.log(
        'SMS notification (stub):',
        payload.toPhone,
        payload.messageText ?? payload.subject,
      );
    }
  }

  async createInApp(input: {
    userId: string;
    title: string;
    body: string;
    icon?: NotificationIcon;
    ctaUrl?: string | null;
  }): Promise<UserNotification> {
    const row = this.repo.create({
      userId: input.userId,
      title: input.title,
      body: input.body,
      icon: input.icon || 'info',
      read: false,
      ctaUrl: input.ctaUrl ?? null,
    });
    return this.repo.save(row);
  }

  async listForUser(
    userId: string,
    limit = 50,
  ): Promise<APIResponseInterface<UserNotification[]>> {
    const rows = await this.repo.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: Math.min(100, Math.max(1, limit)),
    });
    return {
      code: HttpStatus.OK,
      message: 'Notifications fetched',
      data: rows,
    };
  }

  async unreadCount(
    userId: string,
  ): Promise<APIResponseInterface<{ count: number }>> {
    const count = await this.repo.count({ where: { userId, read: false } });
    return {
      code: HttpStatus.OK,
      message: 'Unread count fetched',
      data: { count },
    };
  }

  async markRead(
    id: string,
    userId: string,
  ): Promise<APIResponseInterface<UserNotification>> {
    const row = await this.repo.findOne({ where: { id, userId } });
    if (!row) throw new NotFoundException('Notification not found');
    row.read = true;
    const saved = await this.repo.save(row);
    return {
      code: HttpStatus.OK,
      message: 'Marked as read',
      data: saved,
    };
  }

  async markAllRead(
    userId: string,
  ): Promise<APIResponseInterface<{ updated: number }>> {
    const result = await this.repo.update(
      { userId, read: false },
      { read: true },
    );
    return {
      code: HttpStatus.OK,
      message: 'All notifications marked as read',
      data: { updated: result.affected ?? 0 },
    };
  }

  async remove(
    id: string,
    userId: string,
  ): Promise<APIResponseInterface<null>> {
    const row = await this.repo.findOne({ where: { id, userId } });
    if (!row) throw new NotFoundException('Notification not found');
    await this.repo.remove(row);
    return {
      code: HttpStatus.OK,
      message: 'Notification deleted',
      data: null,
    };
  }
}
