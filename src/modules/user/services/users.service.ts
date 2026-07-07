import {
  Injectable,
  HttpStatus,
  ForbiddenException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../entities/user.entity';
import { Role as RoleEntity } from '../../role/entities/role.entity';
import { Client } from '../../client/entities/client.entity';
import { Role } from '../../../common/enums/role.enum';
import { ListUsersQueryDto } from '../dto/list-users-query.dto';
import { CreateInternalUserDto } from '../dto/create-internal-user.dto';
import { CreateClientUserDto } from '../dto/create-client-user.dto';
import { UpdateInternalUserDto } from '../dto/update-internal-user.dto';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';
import { SuperAdminSettingsService } from '../../super-admin-settings/services/super-admin-settings.service';
import { UserRepository } from '../repositories/user.repository';

const DEFAULT_INTERNAL_USER_PASSWORD = 'Internal@123';

type RequestUser = { role: string; clientId?: string; sub?: string };

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    @InjectRepository(RoleEntity) private roleRepo: Repository<RoleEntity>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    private readonly superAdminSettingsService: SuperAdminSettingsService,
    private readonly userRepository: UserRepository,
  ) {}

  findByEmail(email: string) {
    return this.userRepository.findByEmail(email);
  }

  save(user: Partial<User>) {
    return this.userRepository.save(user);
  }

  private normalizeNullableString(value?: string | null): string | null {
    if (value == null) return null;
    const normalized = value.trim();
    return normalized.length ? normalized : null;
  }

  private isPlatformAdmin(role: string): boolean {
    return role === Role.SUPER_ADMIN || role === Role.INTERNAL_USER;
  }

  private isClientTenantMember(user: RequestUser): boolean {
    return user.role === Role.CLIENT_ADMIN || user.role === Role.CLIENT_USER;
  }

  private requireClientId(user: RequestUser): string {
    if (!user.clientId) {
      throw new ForbiddenException('Client context is missing');
    }
    return user.clientId;
  }

  async findAll(
    query: ListUsersQueryDto,
    user: RequestUser,
  ): Promise<APIResponseInterface<Partial<User>[]>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 20));
    const skip = (page - 1) * limit;

    const qb = this.repo
      .createQueryBuilder('user')
      .select([
        'user.id',
        'user.fullName',
        'user.email',
        'user.role',
        'user.createdAt',
        'user.customRoleId',
      ])
      .leftJoin('user.client', 'client')
      .leftJoin('user.customRole', 'customRole')
      .addSelect(['client.id', 'client.companyName'])
      .addSelect(['customRole.id', 'customRole.name'])
      .orderBy('user.createdAt', 'DESC');

    const isPlatformAdmin = this.isPlatformAdmin(user.role);
    const isClientTenant = this.isClientTenantMember(user);

    if (query.clientId) {
      if (isPlatformAdmin) {
        qb.andWhere('client.id = :clientId', { clientId: query.clientId });
      } else if (isClientTenant) {
        const clientId = this.requireClientId(user);
        if (clientId !== query.clientId) {
          throw new ForbiddenException(
            'You can only view users of your organization',
          );
        }
        qb.andWhere('client.id = :clientId', { clientId });
      } else {
        throw new ForbiddenException('Access denied');
      }
      if (!query.role) {
        qb.andWhere('user.role = :clientStaffRole', {
          clientStaffRole: Role.CLIENT_USER,
        }); 
      }
    } else if (isClientTenant) {
      const clientId = this.requireClientId(user);
      qb.andWhere('client.id = :clientId', { clientId });
      if (!query.role) {
        qb.andWhere('user.role = :clientStaffRole', {
          clientStaffRole: Role.CLIENT_USER,
        });
      }
    } else if (isPlatformAdmin) {
      if (!query.role) {
        qb.andWhere('user.role IN (:...platformRoles)', {
          platformRoles: [Role.SUPER_ADMIN, Role.INTERNAL_USER],
        });
      }
    } else {
      throw new ForbiddenException('Access denied');
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere('(user.fullName LIKE :term OR user.email LIKE :term)', {
        term,
      });
    }

    if (query.role) {
      qb.andWhere('user.role = :role', { role: query.role });
    }

    if (query.customRoleId) {
      qb.andWhere('user.customRoleId = :customRoleId', {
        customRoleId: query.customRoleId,
      });
    }

    const [list, total] = await qb.skip(skip).take(limit).getManyAndCount();

    const safeList = list.map((u) => {
      const o = u as any;
      const { password, resetToken, resetTokenExpiry, ...rest } = o;
      return rest;
    });

    return {
      code: HttpStatus.OK,
      message: 'Users fetched successfully',
      data: safeList,
      pagination: { total, page, pagePerRecord: limit },
    };
  }

  async createFieldAgentUser(params: {
    fullName: string;
    email: string;
  }): Promise<{ user: User; plainPassword: string }> {
    const email = params.email.trim().toLowerCase();
    const existing = await this.repo.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const plainPassword = Math.random().toString(36).slice(-8);
    const hashed = await bcrypt.hash(plainPassword, 10);
    const user = this.repo.create({
      fullName: params.fullName.trim(),
      email,
      password: hashed,
      role: Role.FIELD_AGENT,
      customRoleId: null,
    });
    const saved = await this.repo.save(user);
    return { user: saved, plainPassword };
  }

  async deleteById(id: string): Promise<void> {
    const user = await this.repo.findOne({ where: { id } });
    if (!user) return;
    await this.repo.delete(id);
  }

  async updateFieldAgentLogin(
    userId: string,
    params: { fullName?: string; email?: string },
  ): Promise<void> {
    const user = await this.repo.findOne({ where: { id: userId } });
    if (!user || user.role !== Role.FIELD_AGENT) return;

    if (params.fullName?.trim()) {
      user.fullName = params.fullName.trim();
    }
    if (params.email?.trim()) {
      const email = params.email.trim().toLowerCase();
      if (email !== user.email) {
        const existing = await this.repo.findOne({ where: { email } });
        if (existing && existing.id !== userId) {
          throw new ConflictException('User with this email already exists');
        }
        user.email = email;
      }
    }
    await this.repo.save(user);
  }

  async createInternalUser(
    dto: CreateInternalUserDto,
  ): Promise<APIResponseInterface<Partial<User>>> {
    const existing = await this.repo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }
    if (dto.customRoleId) {
      await this.validateInternalCustomRole(dto.customRoleId);
    }
    const password = dto.password?.trim() || DEFAULT_INTERNAL_USER_PASSWORD;
    const hashed = await bcrypt.hash(password, 10);
    const user = this.repo.create({
      fullName: dto.fullName,
      email: dto.email,
      password: hashed,
      role: dto.role ?? Role.INTERNAL_USER,
      customRoleId: dto.customRoleId ?? null,
      employeeType: dto.employeeType ?? null,
      mobileNumber: dto.mobileNumber ?? null,
      alternateNumber: dto.alternateNumber ?? null,
      educationDetails: dto.educationDetails ?? null,
      flatPlotNo: dto.flatPlotNo ?? null,
      addressLine1: dto.addressLine1 ?? null,
      addressLine2: dto.addressLine2 ?? null,
      landmark: dto.landmark ?? null,
      country: dto.country ?? null,
      state: dto.state ?? null,
      city: dto.city ?? null,
      pincode: dto.pincode ?? null,
      resumeUrl: this.normalizeNullableString(dto.resumeUrl),
      panUrl: this.normalizeNullableString(dto.panUrl),
      addressProofUrl: this.normalizeNullableString(dto.addressProofUrl),
      cancelledChequeUrl: this.normalizeNullableString(dto.cancelledChequeUrl),
      cancelledChequeUrl2: this.normalizeNullableString(dto.cancelledChequeUrl2),
      offerLetterUrl: this.normalizeNullableString(dto.offerLetterUrl),
      marksheet12Url: this.normalizeNullableString(dto.marksheet12Url),
      graduationMarksheetUrl: this.normalizeNullableString(
        dto.graduationMarksheetUrl,
      ),
      postGraduateCertUrl: this.normalizeNullableString(dto.postGraduateCertUrl),
      additionalCertUrl: this.normalizeNullableString(dto.additionalCertUrl),
    });
    const saved = await this.repo.save(user);
    const { password: _, resetToken, resetTokenExpiry, ...safe } = saved;
    return {
      code: HttpStatus.CREATED,
      message: 'Internal user created successfully',
      data: safe,
    };
  }

  async createClientUser(
    dto: CreateClientUserDto,
    reqUser: RequestUser,
  ): Promise<APIResponseInterface<Partial<User>>> {
    if (!this.isClientTenantMember(reqUser)) {
      throw new ForbiddenException(
        'Only organization users can create client staff accounts',
      );
    }
    const clientId = this.requireClientId(reqUser);

    await this.validateClientUserCreationLimit(clientId);
    await this.validateClientCustomRole(dto.customRoleId, clientId);

    const existing = await this.repo.findOne({
      where: { email: dto.email.trim().toLowerCase() },
    });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }

    const plainPassword =
      dto.password?.trim() || Math.random().toString(36).slice(-10);
    const hashed = await bcrypt.hash(plainPassword, 10);
    const user = this.repo.create({
      fullName: dto.fullName.trim(),
      email: dto.email.trim().toLowerCase(),
      password: hashed,
      role: Role.CLIENT_USER,
      customRoleId: dto.customRoleId,
      mobileNumber: dto.mobileNumber?.trim() ?? null,
      client: { id: clientId } as Client,
    });
    const saved = await this.repo.save(user);
    const { password: _, resetToken, resetTokenExpiry, ...safe } = saved;
    return {
      code: HttpStatus.CREATED,
      message: 'Client user created successfully',
      data: safe,
    };
  }

  /**
   * Enforces per-client maxUsers (client.setting) and global maxClientUsers.
   */
  async validateClientUserCreationLimit(clientId: string): Promise<void> {
    const currentCount = await this.repo.count({
      where: { role: Role.CLIENT_USER, client: { id: clientId } as any },
    });

    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    const clientMax = client?.setting?.maxUsers;
    if (clientMax != null && clientMax > 0 && currentCount >= clientMax) {
      throw new ForbiddenException(
        'Client user limit reached for this organization. Contact your administrator.',
      );
    }

    const settings =
      await this.superAdminSettingsService.getEffectiveSettings();
    const globalMax = settings.data?.maxClientUsers;
    if (globalMax != null && globalMax > 0 && currentCount >= globalMax) {
      throw new ForbiddenException(
        'User creation limit reached. Please contact the administrator.',
      );
    }
  }

  private async validateClientCustomRole(
    customRoleId: string,
    clientId: string,
  ): Promise<void> {
    const role = await this.roleRepo.findOne({
      where: { id: customRoleId },
      relations: ['client'],
    });
    if (!role || !role.isActive) {
      throw new ForbiddenException('Selected role is invalid or inactive');
    }
    if (role.client?.id !== clientId) {
      throw new ForbiddenException(
        'Selected role does not belong to your organization',
      );
    }
  }

  private async validateInternalCustomRole(customRoleId: string): Promise<void> {
    const role = await this.roleRepo.findOne({
      where: { id: customRoleId },
      relations: ['client'],
    });
    if (!role || !role.isActive) {
      throw new ForbiddenException('Selected role is invalid or inactive');
    }
    if (role.client != null) {
      throw new ForbiddenException(
        'Internal users must be assigned an internal role',
      );
    }
  }

  async findOne(
    id: string,
    reqUser: RequestUser,
  ): Promise<APIResponseInterface<Partial<User>>> {
    const user = await this.repo.findOne({
      where: { id },
      relations: ['client', 'customRole'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (this.isPlatformAdmin(reqUser.role)) {
      // Platform admins can view all users.
    } else if (this.isClientTenantMember(reqUser)) {
      const clientId = this.requireClientId(reqUser);
      if (!user.client || user.client.id !== clientId) {
        throw new ForbiddenException('You can only view users of your client');
      }
    } else {
      throw new ForbiddenException('Access denied');
    }
    const { password, resetToken, resetTokenExpiry, ...safe } = user;
    return {
      code: HttpStatus.OK,
      message: 'User fetched successfully',
      data: safe,
    };
  }

  async updateInternalUser(
    id: string,
    dto: UpdateInternalUserDto,
    reqUser: RequestUser,
  ): Promise<APIResponseInterface<Partial<User>>> {
    const user = await this.repo.findOne({
      where: { id },
      relations: ['client'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (this.isPlatformAdmin(reqUser.role)) {
      // Platform admins can update all users.
    } else if (this.isClientTenantMember(reqUser)) {
      const clientId = this.requireClientId(reqUser);
      if (!user.client || user.client.id !== clientId) {
        throw new ForbiddenException(
          'You can only update users of your client',
        );
      }
    } else {
      throw new ForbiddenException('Access denied');
    }

    const allowedRoles = this.isPlatformAdmin(reqUser.role)
      ? [
          Role.SUPER_ADMIN,
          Role.INTERNAL_USER,
          Role.CLIENT_ADMIN,
          Role.CLIENT_USER,
          Role.FIELD_AGENT,
        ]
      : [Role.CLIENT_USER];

    if (dto.role != null) {
      if (!allowedRoles.includes(dto.role)) {
        throw new ForbiddenException('You cannot assign this role');
      }
      user.role = dto.role;
    }

    if (dto.customRoleId != null) {
      if (this.isClientTenantMember(reqUser) && reqUser.clientId) {
        await this.validateClientCustomRole(dto.customRoleId, reqUser.clientId);
      } else if (this.isPlatformAdmin(reqUser.role)) {
        if (dto.customRoleId && user.client?.id) {
          await this.validateClientCustomRole(
            dto.customRoleId,
            user.client.id,
          );
        } else if (dto.customRoleId) {
          await this.validateInternalCustomRole(dto.customRoleId);
        }
      }
      user.customRoleId = dto.customRoleId || null;
    }

    if (dto.fullName != null) user.fullName = dto.fullName;
    if (dto.employeeType != null) user.employeeType = dto.employeeType;
    if (dto.mobileNumber != null) user.mobileNumber = dto.mobileNumber;
    if (dto.alternateNumber != null) user.alternateNumber = dto.alternateNumber;
    if (dto.educationDetails != null)
      user.educationDetails = dto.educationDetails;
    if (dto.flatPlotNo != null) user.flatPlotNo = dto.flatPlotNo;
    if (dto.addressLine1 != null) user.addressLine1 = dto.addressLine1;
    if (dto.addressLine2 != null) user.addressLine2 = dto.addressLine2;
    if (dto.landmark != null) user.landmark = dto.landmark;
    if (dto.country != null) user.country = dto.country;
    if (dto.state != null) user.state = dto.state;
    if (dto.city != null) user.city = dto.city;
    if (dto.pincode != null) user.pincode = dto.pincode;
    if (dto.resumeUrl != null)
      user.resumeUrl = this.normalizeNullableString(dto.resumeUrl);
    if (dto.panUrl != null) user.panUrl = this.normalizeNullableString(dto.panUrl);
    if (dto.addressProofUrl != null)
      user.addressProofUrl = this.normalizeNullableString(dto.addressProofUrl);
    if (dto.cancelledChequeUrl != null)
      user.cancelledChequeUrl = this.normalizeNullableString(
        dto.cancelledChequeUrl,
      );
    if (dto.cancelledChequeUrl2 != null)
      user.cancelledChequeUrl2 = this.normalizeNullableString(
        dto.cancelledChequeUrl2,
      );
    if (dto.offerLetterUrl != null)
      user.offerLetterUrl = this.normalizeNullableString(dto.offerLetterUrl);
    if (dto.marksheet12Url != null)
      user.marksheet12Url = this.normalizeNullableString(dto.marksheet12Url);
    if (dto.graduationMarksheetUrl != null)
      user.graduationMarksheetUrl = this.normalizeNullableString(
        dto.graduationMarksheetUrl,
      );
    if (dto.postGraduateCertUrl != null)
      user.postGraduateCertUrl = this.normalizeNullableString(
        dto.postGraduateCertUrl,
      );
    if (dto.additionalCertUrl != null)
      user.additionalCertUrl = this.normalizeNullableString(
        dto.additionalCertUrl,
      );
    const saved = await this.repo.save(user);
    const { password, resetToken, resetTokenExpiry, ...safe } = saved;
    return {
      code: HttpStatus.OK,
      message: 'User updated successfully',
      data: safe,
    };
  }
}
