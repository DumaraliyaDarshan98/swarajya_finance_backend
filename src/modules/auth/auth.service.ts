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
import { UsersService } from '../user/users.service';
import { Role } from '../../enum/role.enum';
import { MailService } from '../mail/mail.service';
import { APIResponseInterface } from '../../interface/response.interface';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { FieldAssistant } from '../field-assistance/entities/field-assistant.entity';

export type PermissionEntry = { moduleCode: string; permissions: string[] };

@Injectable()
export class AuthService {
  constructor(
    private usersService: UsersService,
    private jwtService: JwtService,
    private mailService: MailService,
    @InjectRepository(FieldAssistant)
    private fieldAssistantRepo: Repository<FieldAssistant>,
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

  async login(dto: any): Promise<APIResponseInterface<any>> {
    // NOTE: Avoid heavy console logging in auth flow (can slow down responses in dev tools).
    // 1) Try normal users table
    const user = await this.usersService.findByEmail(dto.email);
    if (user) {
      if (!(await bcrypt.compare(dto.password, user.password))) {
        throw new UnauthorizedException('Invalid email or password');
      }

      const permissions = this.getUserPermissions(user);
      const accessToken = this.jwtService.sign({
        sub: user.id,
        role: user.role,
        clientId: user.client?.id,
      });

      const { password, resetToken, resetTokenExpiry, ...userSafe } = user as any;
      return {
        code: HttpStatus.OK,
        message: 'Login successful',
        data: { accessToken, user: userSafe, permissions },
      };
    }

    // 2) Try Field Assistant login (Field Agent)
    const fa = await this.fieldAssistantRepo
      .createQueryBuilder('fa')
      .where('fa.login_email = :email', { email: dto.email })
      .orWhere('fa.personal_email_id = :email', { email: dto.email })
      .orWhere('fa.office_email_id = :email', { email: dto.email })
      .getOne();

    if (!fa || !fa.password) {
      throw new UnauthorizedException('Invalid email or password');
    }
    if (!(await bcrypt.compare(dto.password, fa.password))) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const permissions = this.getUserPermissions({ role: Role.FIELD_AGENT });
    const accessToken = this.jwtService.sign({
      sub: fa.id,
      role: Role.FIELD_AGENT,
      fieldAssistantId: fa.id,
    });

    const safeFa = {
      id: fa.id,
      fullName: fa.fullName ?? [fa.firstName, fa.middleName, fa.lastName].filter(Boolean).join(' '),
      email: fa.loginEmail ?? fa.personalEmailId ?? fa.officeEmailId ?? dto.email,
      role: Role.FIELD_AGENT,
      fieldAgentId: fa.fieldAgentId,
    };

    return {
      code: HttpStatus.OK,
      message: 'Login successful',
      data: { accessToken, user: safeFa, permissions },
    };
  }

  getUserPermissions(user: any): PermissionEntry[] {
    if (user.role === Role.SUPER_ADMIN) {
      return [
        {
          moduleCode: 'CLIENT_MANAGEMENT',
          permissions: ['VIEW', 'ADD', 'EDIT', 'LIST', 'DELETE'],
        },
        {
          moduleCode: 'USER_MANAGEMENT',
          permissions: ['VIEW', 'ADD', 'EDIT', 'LIST', 'DELETE'],
        },
        {
          moduleCode: 'ROLE_MANAGEMENT',
          permissions: ['VIEW', 'ADD', 'EDIT', 'LIST', 'DELETE'],
        },
        {
          moduleCode: 'SETTINGS',
          permissions: ['VIEW', 'ADD', 'EDIT', 'LIST', 'DELETE'],
        },
        {
          moduleCode: 'INTERNAL_USER_MANAGEMENT',
          permissions: ['VIEW', 'ADD', 'EDIT', 'LIST', 'DELETE'],
        },
        {
          moduleCode: 'VERIFICATION',
          permissions: ['VIEW', 'ADD', 'EDIT', 'LIST', 'DELETE'],
        },
      ];
    }
    // Internal user: default role with client show + dashboard access
    if (user.role === Role.INTERNAL_USER) {
      return [{ moduleCode: 'CLIENT_MANAGEMENT', permissions: ['VIEW'] }];
    }
    if (user.customRole?.rolePermissions?.length) {
      const byModule: Record<string, string[]> = {};
      for (const rp of user.customRole.rolePermissions) {
        if (rp.module?.code) {
          if (!byModule[rp.module.code]) byModule[rp.module.code] = [];
          if (
            rp.permission &&
            !byModule[rp.module.code].includes(rp.permission)
          ) {
            byModule[rp.module.code].push(rp.permission);
          }
        }
      }
      return Object.entries(byModule).map(([moduleCode, permissions]) => ({
        moduleCode,
        permissions,
      }));
    }
    if (user.role === Role.CLIENT_ADMIN) {
      return [
        { moduleCode: 'CLIENT_MANAGEMENT', permissions: ['VIEW', 'LIST'] },
        {
          moduleCode: 'USER_MANAGEMENT',
          permissions: ['VIEW', 'ADD', 'EDIT', 'LIST', 'DELETE'],
        },
        {
          moduleCode: 'ROLE_MANAGEMENT',
          permissions: ['VIEW', 'ADD', 'EDIT', 'LIST', 'DELETE'],
        },
        {
          moduleCode: 'SETTINGS',
          permissions: ['VIEW', 'ADD', 'EDIT', 'LIST', 'DELETE'],
        },
        {
          moduleCode: 'VERIFICATION',
          permissions: ['VIEW', 'ADD', 'EDIT', 'LIST', 'DELETE'],
        },
      ];
    }
    if (user.role === Role.FIELD_AGENT) {
      return [
        { moduleCode: 'PHYSICAL_VERIFICATION', permissions: ['VIEW', 'LIST', 'EDIT'] },
        { moduleCode: 'WALLET', permissions: ['VIEW', 'LIST'] },
      ];
    }
    return [];
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
}
