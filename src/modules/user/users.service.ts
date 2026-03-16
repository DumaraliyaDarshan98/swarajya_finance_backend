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
import { User } from './entities/user.entity';
import { Role } from '../../enum/role.enum';
import { ListUsersQueryDto } from './dto/list-users-query.dto';
import { CreateInternalUserDto } from './dto/create-internal-user.dto';
import { UpdateInternalUserDto } from './dto/update-internal-user.dto';
import { APIResponseInterface } from '../../interface/response.interface';
import { SuperAdminSettingsService } from '../super-admin-settings/super-admin-settings.service';

const DEFAULT_INTERNAL_USER_PASSWORD = 'Internal@123';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User) private repo: Repository<User>,
    private readonly superAdminSettingsService: SuperAdminSettingsService,
  ) {}

  findByEmail(email: string) {
    return this.repo.findOne({
      where: { email },
      relations: ['client', 'customRole', 'customRole.rolePermissions', 'customRole.rolePermissions.module'],
    });
  }

  save(user: Partial<User>) {
    return this.repo.save(user);
  }

  async findAll(
    query: ListUsersQueryDto,
    user: { role: string; clientId?: string },
  ): Promise<APIResponseInterface<Partial<User>[]>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
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
      .addSelect(['client.id', 'client.companyName'])
      .orderBy('user.createdAt', 'DESC');

    if (user.role === Role.SUPER_ADMIN) {
      qb.andWhere('user.role IN (:...roles)', {
        roles: [Role.SUPER_ADMIN, Role.INTERNAL_USER],
      });
    } else {
      qb.andWhere('client.id = :clientId', { clientId: user.clientId });
    }

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        '(user.fullName LIKE :term OR user.email LIKE :term)',
        { term },
      );
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

  async createInternalUser(
    dto: CreateInternalUserDto,
  ): Promise<APIResponseInterface<Partial<User>>> {
    const existing = await this.repo.findOne({ where: { email: dto.email } });
    if (existing) {
      throw new ConflictException('User with this email already exists');
    }
    const password =
      dto.password?.trim() || DEFAULT_INTERNAL_USER_PASSWORD;
    const hashed = await bcrypt.hash(password, 10);
    const user = this.repo.create({
      fullName: dto.fullName,
      email: dto.email,
      password: hashed,
      role: Role.INTERNAL_USER,
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
      resumeUrl: dto.resumeUrl ?? null,
      panUrl: dto.panUrl ?? null,
      addressProofUrl: dto.addressProofUrl ?? null,
      cancelledChequeUrl: dto.cancelledChequeUrl ?? null,
      cancelledChequeUrl2: dto.cancelledChequeUrl2 ?? null,
      offerLetterUrl: dto.offerLetterUrl ?? null,
      marksheet12Url: dto.marksheet12Url ?? null,
      graduationMarksheetUrl: dto.graduationMarksheetUrl ?? null,
      postGraduateCertUrl: dto.postGraduateCertUrl ?? null,
      additionalCertUrl: dto.additionalCertUrl ?? null,
    });
    const saved = await this.repo.save(user);
    const { password: _, resetToken, resetTokenExpiry, ...safe } = saved;
    return {
      code: HttpStatus.CREATED,
      message: 'Internal user created successfully',
      data: safe,
    };
  }

  /**
   * ===== CLIENT USER CREATION (LIMIT ENFORCEMENT PLACEHOLDER) =====
   *
   * This method shows how to enforce the global max_client_users limit
   * when implementing client user creation (Role.CLIENT_USER).
   */
  async validateClientUserCreationLimit(clientId: string): Promise<void> {
    const settings =
      await this.superAdminSettingsService.getEffectiveSettings();

    if (!settings.data?.maxClientUsers) {
      // Unlimited users if not configured
      return;
    }

    const currentCount = await this.repo.count({
      where: { role: Role.CLIENT_USER, client: { id: clientId } as any },
    });

    if (currentCount >= settings.data?.maxClientUsers) {
      throw new ForbiddenException(
        'User creation limit reached. Please contact the administrator.',
      );
    }
  }

  async findOne(
    id: string,
    reqUser: { role: string; clientId?: string },
  ): Promise<APIResponseInterface<Partial<User>>> {
    const user = await this.repo.findOne({
      where: { id },
      relations: ['client'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (reqUser.role === Role.SUPER_ADMIN) {
      if (user.role !== Role.SUPER_ADMIN && user.role !== Role.INTERNAL_USER) {
        throw new ForbiddenException('You can only view internal users');
      }
    } else if (reqUser.role === Role.CLIENT_ADMIN) {
      if (!user.client || user.client.id !== reqUser.clientId) {
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
    reqUser: { role: string; clientId?: string },
  ): Promise<APIResponseInterface<Partial<User>>> {
    const user = await this.repo.findOne({
      where: { id },
      relations: ['client'],
    });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (reqUser.role === Role.SUPER_ADMIN) {
      if (user.role !== Role.SUPER_ADMIN && user.role !== Role.INTERNAL_USER) {
        throw new ForbiddenException('You can only update internal users');
      }
    } else if (reqUser.role === Role.CLIENT_ADMIN) {
      if (!user.client || user.client.id !== reqUser.clientId) {
        throw new ForbiddenException('You can only update users of your client');
      }
    } else {
      throw new ForbiddenException('Access denied');
    }
    if (dto.fullName != null) user.fullName = dto.fullName;
    if (dto.employeeType != null) user.employeeType = dto.employeeType;
    if (dto.mobileNumber != null) user.mobileNumber = dto.mobileNumber;
    if (dto.alternateNumber != null) user.alternateNumber = dto.alternateNumber;
    if (dto.educationDetails != null) user.educationDetails = dto.educationDetails;
    if (dto.flatPlotNo != null) user.flatPlotNo = dto.flatPlotNo;
    if (dto.addressLine1 != null) user.addressLine1 = dto.addressLine1;
    if (dto.addressLine2 != null) user.addressLine2 = dto.addressLine2;
    if (dto.landmark != null) user.landmark = dto.landmark;
    if (dto.country != null) user.country = dto.country;
    if (dto.state != null) user.state = dto.state;
    if (dto.city != null) user.city = dto.city;
    if (dto.pincode != null) user.pincode = dto.pincode;
    if (dto.resumeUrl != null) user.resumeUrl = dto.resumeUrl;
    if (dto.panUrl != null) user.panUrl = dto.panUrl;
    if (dto.addressProofUrl != null) user.addressProofUrl = dto.addressProofUrl;
    if (dto.cancelledChequeUrl != null) user.cancelledChequeUrl = dto.cancelledChequeUrl;
    if (dto.cancelledChequeUrl2 != null) user.cancelledChequeUrl2 = dto.cancelledChequeUrl2;
    if (dto.offerLetterUrl != null) user.offerLetterUrl = dto.offerLetterUrl;
    if (dto.marksheet12Url != null) user.marksheet12Url = dto.marksheet12Url;
    if (dto.graduationMarksheetUrl != null) user.graduationMarksheetUrl = dto.graduationMarksheetUrl;
    if (dto.postGraduateCertUrl != null) user.postGraduateCertUrl = dto.postGraduateCertUrl;
    if (dto.additionalCertUrl != null) user.additionalCertUrl = dto.additionalCertUrl;
    const saved = await this.repo.save(user);
    const { password, resetToken, resetTokenExpiry, ...safe } = saved;
    return {
      code: HttpStatus.OK,
      message: 'User updated successfully',
      data: safe,
    };
  }
}
