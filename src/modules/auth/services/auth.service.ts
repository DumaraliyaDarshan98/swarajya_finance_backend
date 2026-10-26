import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  HttpStatus,
  InternalServerErrorException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { UsersService } from '../../user/services/users.service';
import { Role } from '../../../common/enums/role.enum';
import { MailService } from '../../mail/services/mail.service';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';
import { FieldAssistanceService } from '../../field-assistance/services/field-assistance.service';
import { TrainingService } from '../../training/services/training.service';
import { AuditLogService } from '../../audit-log/services/audit-log.service';
import { extractRequestMeta } from '../../audit-log/helpers/request-meta.helper';
import { PermissionsService } from '../../../common/services/permissions.service';
import type { Request } from 'express';

export type PermissionEntry = { moduleCode: string; permissions: string[] };

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
    private fieldAssistanceService: FieldAssistanceService,
    private trainingService: TrainingService,
    private auditLogService: AuditLogService,
    private permissionsService: PermissionsService,
  ) {}

  async createSuperAdmin(dto: any): Promise<APIResponseInterface<any>> {
    console.log('dto.secret', dto.secret);
    console.log(
      'process.env.SUPER_ADMIN_SECRET',
      process.env.SUPER_ADMIN_SECRET,
    );
    if (dto.secret !== process.env.SUPER_ADMIN_SECRET) {
      throw new UnauthorizedException('Invalid secret key');
    }

    const hashed = await bcrypt.hash(dto.password, 10);
    const user = await this.usersService.save({
      fullName: dto.fullName,
      email: dto.email,
      password: hashed,
      role: Role.SUPER_ADMIN,
    });

    return {
      code: HttpStatus.CREATED,
      message: 'Super admin created successfully',
      data: user,
    };
  }

  async login(
    dto: any,
    req?: Request,
  ): Promise<APIResponseInterface<any>> {
    const meta = req ? extractRequestMeta(req) : null;
    const user = await this.usersService.findByEmail(dto.email);

    const failAudit = (reason: string, partial?: Partial<{
      userId: string;
      userEmail: string;
      userName: string;
      userRole: string;
      clientId: string;
    }>) => {
      this.auditLogService.logAsync({
        action: 'LOGIN_FAILED',
        module: 'AUTH',
        description: `Login failed for ${dto.email || 'unknown'}: ${reason}`,
        userId: partial?.userId ?? null,
        userEmail: partial?.userEmail ?? dto.email ?? null,
        userName: partial?.userName ?? null,
        userRole: partial?.userRole ?? null,
        clientId: partial?.clientId ?? null,
        ipAddress: meta?.ipAddress ?? null,
        userAgent: meta?.userAgent ?? null,
        method: meta?.method ?? 'POST',
        path: meta?.path ?? '/api/auth/login',
        statusCode: 401,
        metadata: { reason },
      });
    };

    if (!user || !(await bcrypt.compare(dto.password, user.password))) {
      failAudit('Invalid email or password', {
        userId: user?.id,
        userEmail: user?.email ?? dto.email,
        userName: user?.fullName,
        userRole: user?.role,
        clientId: user?.client?.id,
      });
      throw new UnauthorizedException('Invalid email or password');
    }

    let fieldAgentProfile: {
      fieldAgentId?: string | null;
      isAcceptTermAndCondition?: boolean;
    } | null = null;
    if (user.role === Role.FIELD_AGENT) {
      const fa = await this.fieldAssistanceService.findByUserId(user.id);
      if (!fa || fa.status !== 'Active') {
        const reason =
          fa?.status === 'Pending'
            ? 'Registration pending approval'
            : 'Field agent inactive or not found';
        failAudit(reason, {
          userId: user.id,
          userEmail: user.email,
          userName: user.fullName,
          userRole: user.role,
          clientId: user.client?.id,
        });
        if (fa?.status === 'Pending') {
          throw new UnauthorizedException(
            'Your registration is pending super admin approval',
          );
        }
        throw new UnauthorizedException(
          'Field agent account is inactive or not found',
        );
      }
      fieldAgentProfile = {
        fieldAgentId: fa.fieldAgentId,
        isAcceptTermAndCondition: !!fa.isAcceptTermAndCondition,
      };
    }

    // Same permission matrix as PermissionsGuard (custom roles included).
    const permissions = await this.permissionsService.getPermissionEntries(
      user.id,
      String(user.role),
    );

    const accessToken = this.jwtService.sign({
      sub: user.id,
      role: user.role,
      clientId: user.client?.id,
      email: user.email,
      fullName: user.fullName,
    });

    const { password, resetToken, resetTokenExpiry, ...userSafe } = user;

    const trainingStatus = await this.trainingService.getTrainingStatusForLogin(
      user.id,
      user.role,
    );

    this.auditLogService.logAsync({
      action: 'LOGIN',
      module: 'AUTH',
      description: `User logged in (${user.email})`,
      userId: user.id,
      userEmail: user.email,
      userName: user.fullName,
      userRole: user.role,
      clientId: user.client?.id ?? null,
      ipAddress: meta?.ipAddress ?? null,
      userAgent: meta?.userAgent ?? null,
      method: meta?.method ?? 'POST',
      path: meta?.path ?? '/api/auth/login',
      statusCode: 200,
      metadata: {
        role: user.role,
      },
    });

    return {
      code: HttpStatus.OK,
      message: 'Login successful',
      data: {
        accessToken,
        user: {
          ...userSafe,
          ...fieldAgentProfile,
          trainingRequired: trainingStatus.required && !trainingStatus.completed,
          trainingCompleted: trainingStatus.completed,
        },
        permissions,
        trainingStatus,
      },
    };
  }

  async forgotPassword(email: string): Promise<APIResponseInterface<any>> {
    try {
      const user = await this.usersService.findByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not for security
        return {
          code: HttpStatus.OK,
          message: 'If the email exists, a password reset link has been sent',
          data: null,
        };
      }

      user.resetToken = randomUUID();
      user.resetTokenExpiry = new Date(Date.now() + 15 * 60 * 1000);
      await this.usersService.save(user);

      await this.mailService.sendForgotPasswordEmail(
        user.email,
        user.resetToken,
      );

      return {
        code: HttpStatus.OK,
        message: 'If the email exists, a password reset link has been sent',
        data: null,
      };
    } catch (error) {
      console.log('error', error);
      throw new InternalServerErrorException(
        'Failed to send forgot password email',
      );
    }
  }

  async resetPassword(dto: any): Promise<APIResponseInterface<any>> {
    const user: any = await this.usersService.findByEmail(dto.email);
    if (!user || user.resetToken !== dto.token) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (user.resetTokenExpiry && new Date() > user.resetTokenExpiry) {
      throw new BadRequestException('Reset token has expired');
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    user.resetToken = null;
    user.resetTokenExpiry = null;
    await this.usersService.save(user);

    return {
      code: HttpStatus.OK,
      message: 'Password reset successfully',
      data: null,
    };
  }

  async changePassword(
    userId: string,
    dto: { currentPassword: string; newPassword: string },
  ): Promise<APIResponseInterface<null>> {
    const user = await this.usersService.findById(userId);
    if (!user?.password) {
      throw new UnauthorizedException('User not found');
    }

    const matches = await bcrypt.compare(dto.currentPassword, user.password);
    if (!matches) {
      throw new BadRequestException('Current password is incorrect');
    }

    if (dto.currentPassword === dto.newPassword) {
      throw new BadRequestException('New password must be different from current password');
    }

    user.password = await bcrypt.hash(dto.newPassword, 10);
    await this.usersService.save(user);

    return {
      code: HttpStatus.OK,
      message: 'Password changed successfully',
      data: null,
    };
  }
}
