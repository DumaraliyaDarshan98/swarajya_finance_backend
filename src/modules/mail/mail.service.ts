import { Injectable, InternalServerErrorException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import * as fs from 'fs';
import * as path from 'path';
import * as handlebars from 'handlebars';

@Injectable()
export class MailService {
  private transporter: nodemailer.Transporter;

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

  private compileTemplate(templateName: string, data: any) {
    const filePath = path.join(
      process.cwd(),
      'src/modules/mail/templates',
      `${templateName}.hbs`,
    );

    const source = fs.readFileSync(filePath, 'utf8');
    const template = handlebars.compile(source);
    return template(data);
  }

  async sendMail(
    to: string,
    subject: string,
    template: string,
    data: any,
  ) {
    try {
      const html = this.compileTemplate(template, data);

      await this.transporter.sendMail({
        from: process.env.MAIL_FROM,
        to,
        subject,
        html,
      });
    } catch (error) {
      throw new InternalServerErrorException('Mail sending failed');
    }
  }

  /* ===================== USE CASES ===================== */

  async sendForgotPasswordEmail(email: string, token: string) {
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${token}`;

    return this.sendMail(
      email,
      'Reset Your Password',
      'forgot-password',
      { resetLink },
    );
  }

  async sendClientCredentials(
    email: string,
    name: string,
    password: string,
  ) {
    return this.sendMail(
      email,
      'Your Swarajya Login Credentials',
      'client-credentials',
      { name, email, password },
    );
  }
}
