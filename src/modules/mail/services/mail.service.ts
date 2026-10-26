import {
  Injectable,
  InternalServerErrorException,
  Logger,
  OnModuleInit,
} from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';

export type MailTemplateData = Record<string, unknown>;

@Injectable()
export class MailService implements OnModuleInit {
  private readonly logger = new Logger(MailService.name);
  private transporter: nodemailer.Transporter;
  private readonly templatesDir = path.join(
    process.cwd(),
    'src/modules/mail/templates',
  );
  private partialsRegistered = false;

  constructor() {
    this.transporter = nodemailer.createTransport({
      host: process.env.MAIL_HOST,
      port: Number(process.env.MAIL_PORT),
      secure: false,
      auth: {
        user: process.env.MAIL_USER,
        pass: process.env.MAIL_PASS,
      },
    });
  }

  onModuleInit() {
    this.registerPartials();
  }

  private registerPartials() {
    if (this.partialsRegistered) return;

    const partialsDir = path.join(this.templatesDir, 'partials');
    if (!fs.existsSync(partialsDir)) {
      this.partialsRegistered = true;
      return;
    }

    for (const file of fs.readdirSync(partialsDir)) {
      if (!file.endsWith('.hbs')) continue;
      const name = path.basename(file, '.hbs');
      const source = fs.readFileSync(path.join(partialsDir, file), 'utf8');
      handlebars.registerPartial(name, source);
    }

    this.partialsRegistered = true;
  }

  private getBrandContext(extra: MailTemplateData = {}): MailTemplateData {
    const frontendUrl = (
      process.env.FRONTEND_URL || 'http://localhost:4200'
    ).replace(/\/$/, '');

    return {
      brandName: process.env.MAIL_BRAND_NAME || 'Swarajya RAC',
      brandPrimary: process.env.MAIL_BRAND_PRIMARY || '#F16300',
      frontendUrl,
      loginUrl: `${frontendUrl}/auth/login`,
      supportEmail:
        process.env.MAIL_SUPPORT_EMAIL ||
        process.env.MAIL_FROM ||
        'info@swarajyarac.com',
      supportPhone: process.env.MAIL_SUPPORT_PHONE || '+91 76663 22270',
      year: new Date().getFullYear(),
      ...extra,
    };
  }

  private readTemplate(relativePath: string): string {
    const filePath = path.join(this.templatesDir, relativePath);
    if (!fs.existsSync(filePath)) {
      throw new InternalServerErrorException(
        `Email template not found: ${relativePath}`,
      );
    }
    return fs.readFileSync(filePath, 'utf8');
  }

  /**
   * Compiles content template + branded layout (frontend-aligned).
   */
  private compileTemplate(templateName: string, data: MailTemplateData): string {
    this.registerPartials();
    const context = this.getBrandContext(data);
    const bodyHtml = handlebars.compile(
      this.readTemplate(`${templateName}.hbs`),
    )(context);
    return handlebars.compile(this.readTemplate('layouts/base.hbs'))({
      ...context,
      body: bodyHtml,
    });
  }

  async sendMail(
    to: string,
    subject: string,
    template: string,
    data: MailTemplateData = {},
  ) {
    try {
      const html = this.compileTemplate(template, {
        ...data,
        preheader:
          (typeof data.preheader === 'string' && data.preheader) || subject,
      });

      await this.transporter.sendMail({
        from: process.env.MAIL_FROM,
        to,
        subject,
        html,
      });

      this.logger.log(`Email sent template=${template} to=${to}`);
    } catch (error) {
      this.logger.error(
        `Mail sending failed template=${template} to=${to}`,
        error instanceof Error ? error.stack : String(error),
      );
      throw new InternalServerErrorException('Mail sending failed');
    }
  }

  /* ===================== USE CASES ===================== */

  async sendForgotPasswordEmail(email: string, token: string) {
    const frontendUrl = (
      process.env.FRONTEND_URL || 'http://localhost:4200'
    ).replace(/\/$/, '');
    const resetLink = `${frontendUrl}/reset-password?token=${token}`;

    return this.sendMail(email, 'Reset your Swarajya RAC password', 'forgot-password', {
      resetLink,
      preheader: 'Reset your password — link valid for 15 minutes',
    });
  }

  async sendClientCredentials(email: string, name: string, password: string) {
    return this.sendMail(
      email,
      'Your Swarajya RAC login credentials',
      'client-credentials',
      {
        name,
        email,
        password,
        preheader: 'Your client admin account is ready',
      },
    );
  }

  async sendInternalUserCredentials(
    email: string,
    name: string,
    password: string,
    roleLabel = 'Internal User',
  ) {
    return this.sendMail(
      email,
      'Your Swarajya RAC internal user login credentials',
      'internal-user-credentials',
      {
        name,
        email,
        password,
        roleLabel,
        preheader: 'Your internal user account is ready',
      },
    );
  }

  async sendFieldAgentCredentials(
    email: string,
    name: string,
    fieldAgentId: string,
    password: string,
    approved = false,
  ) {
    return this.sendMail(
      email,
      approved
        ? 'Your Swarajya RAC field agent account is approved'
        : 'Your Swarajya RAC field agent login credentials',
      'field-agent-credentials',
      {
        name,
        email,
        fieldAgentId,
        password,
        approved,
        preheader: approved
          ? 'Your field agent account was approved'
          : 'Your field agent login credentials',
      },
    );
  }

  async sendFieldAgentWithdrawalApproved(params: {
    email: string;
    name: string;
    amount: number;
    requestId: string;
    bankName: string;
    accountNumber: string;
    ifsc: string;
    adminRemarks?: string | null;
  }) {
    return this.sendMail(
      params.email,
      'Wallet withdrawal approved — Swarajya RAC',
      'field-agent-withdrawal-approved',
      {
        name: params.name,
        amount: params.amount,
        requestId: params.requestId,
        bankName: params.bankName,
        accountNumber: params.accountNumber,
        ifsc: params.ifsc,
        adminRemarks: params.adminRemarks || '',
        preheader: `Withdrawal of ₹${params.amount} approved`,
      },
    );
  }

  async sendFieldAgentWithdrawalRejected(params: {
    email: string;
    name: string;
    amount: number;
    requestId: string;
    adminRemarks?: string | null;
  }) {
    return this.sendMail(
      params.email,
      'Wallet withdrawal rejected — Swarajya RAC',
      'field-agent-withdrawal-rejected',
      {
        name: params.name,
        amount: params.amount,
        requestId: params.requestId,
        adminRemarks: params.adminRemarks || '',
        preheader: `Withdrawal of ₹${params.amount} was rejected`,
      },
    );
  }

  /**
   * Generic branded notification (used by NotificationService).
   */
  async sendGenericNotification(params: {
    to: string;
    subject: string;
    title?: string;
    name?: string;
    message: string;
    details?: string;
    ctaUrl?: string;
    ctaLabel?: string;
  }) {
    return this.sendMail(
      params.to,
      params.subject,
      'generic-notification',
      {
        title: params.title || params.subject,
        name: params.name || '',
        message: params.message,
        details: params.details || '',
        ctaUrl: params.ctaUrl || '',
        ctaLabel: params.ctaLabel || 'Open portal',
        preheader: params.message.slice(0, 120),
      },
    );
  }

  /** Confirmation email after a public career application is submitted. */
  async sendJobApplicationReceived(params: {
    email: string;
    name: string;
    applicationId: string;
    mobileNumber: string;
    skill: string;
    resumeName: string;
  }) {
    return this.sendMail(
      params.email,
      'We received your job application — Swarajya RAC',
      'job-application-received',
      {
        name: params.name,
        email: params.email,
        applicationId: params.applicationId,
        mobileNumber: params.mobileNumber,
        skill: params.skill,
        resumeName: params.resumeName,
        preheader: 'Thank you for applying — we have received your application',
      },
    );
  }
}
