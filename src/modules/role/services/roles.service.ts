import {
  Injectable,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Role } from '../entities/role.entity';
import { RolePermission } from '../entities/role-permission.entity';
import { AppModule } from '../../module/entities/app-module.entity';
import { Client } from '../../client/entities/client.entity';
import { Permission } from '../../../common/enums/permission.enum';
import { CreateRoleDto } from '../dto/create-role.dto';
import { UpdateRoleDto } from '../dto/update-role.dto';
import { ListRolesQueryDto } from '../dto/list-roles-query.dto';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';
import { Role as RoleEnum } from '../../../common/enums/role.enum';

type RequestUser = { role: string; clientId?: string };

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(RolePermission)
    private rolePermissionRepo: Repository<RolePermission>,
    @InjectRepository(AppModule) private moduleRepo: Repository<AppModule>,
    @InjectRepository(Client) private clientRepo: Repository<Client>,
  ) {}

  private isPlatformAdmin(role: string): boolean {
    return role === RoleEnum.SUPER_ADMIN || role === RoleEnum.INTERNAL_USER;
  }

  private isClientTenantMember(user: RequestUser): boolean {
    return (
      user.role === RoleEnum.CLIENT_ADMIN ||
      user.role === RoleEnum.CLIENT_USER
    );
  }

  private requireClientId(user: RequestUser): string {
    if (!user.clientId) {
      throw new ForbiddenException('Client context is missing');
    }
    return user.clientId;
  }

  private assertRoleClientAccess(
    user: RequestUser,
    role: { client?: { id: string } | null },
  ): void {
    if (this.isPlatformAdmin(user.role)) {
      return;
    }
    if (this.isClientTenantMember(user)) {
      const clientId = this.requireClientId(user);
      if (role.client?.id !== clientId) {
        throw new ForbiddenException(
          'You can only access roles of your organization',
        );
      }
      return;
    }
    throw new ForbiddenException('Access denied');
  }

  async create(
    dto: CreateRoleDto,
    user: RequestUser,
  ): Promise<APIResponseInterface<Role>> {
    if (this.isClientTenantMember(user) && user.clientId && !dto.clientId) {
      dto.clientId = user.clientId;
    }

    if (dto.clientId) {
      if (
        !this.isPlatformAdmin(user.role) &&
        user.clientId !== dto.clientId
      ) {
        throw new ForbiddenException(
          'You can only create roles for your own client',
        );
      }
      await this.validateClientRoleCreationLimit(dto.clientId);
    } else {
      if (user.role !== RoleEnum.SUPER_ADMIN) {
        throw new ForbiddenException(
          'Only super admin can create internal roles',
        );
      }
    }

    const role = this.roleRepo.create({
      name: dto.name,
      description: dto.description,
      isActive: dto.isActive ?? true,
    });
    if (dto.clientId) {
      role.client = { id: dto.clientId } as any;
    }
    await this.roleRepo.save(role);

    await this.savePermissions(role.id, dto.permissions);
    const saved = await this.roleRepo.findOne({
      where: { id: role.id },
      relations: ['rolePermissions', 'rolePermissions.module'],
    });
    return {
      code: HttpStatus.CREATED,
      message: 'Role created successfully',
      data: saved!,
    };
  }

  async findAll(
    query: ListRolesQueryDto,
    user: RequestUser,
  ): Promise<APIResponseInterface<Role[]>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const skip = (page - 1) * limit;

    const qb = this.roleRepo
      .createQueryBuilder('role')
      .leftJoinAndSelect('role.rolePermissions', 'rp')
      .leftJoinAndSelect('rp.module', 'm')
      .leftJoinAndSelect('role.client', 'client')
      .orderBy('role.createdAt', 'DESC');

    const isPlatformAdmin = this.isPlatformAdmin(user.role);

    if (this.isClientTenantMember(user)) {
      const clientId = this.requireClientId(user);
      qb.andWhere('role.client_id = :clientId', { clientId });
    } else if (isPlatformAdmin) {
      if (query.clientId) {
        qb.andWhere('role.client_id = :clientId', {
          clientId: query.clientId,
        });
      } else {
        // Platform role management — internal roles only (not client tenant roles).
        qb.andWhere('role.client_id IS NULL');
      }
    } else {
      throw new ForbiddenException('Access denied');
    }

    const [list, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return {
      code: HttpStatus.OK,
      message: 'Roles fetched successfully',
      data: list,
      pagination: { total, page, pagePerRecord: limit },
    };
  }

  async findOne(
    id: string,
    user: RequestUser,
  ): Promise<APIResponseInterface<Role>> {
    const role = await this.roleRepo.findOne({
      where: { id },
      relations: ['rolePermissions', 'rolePermissions.module', 'client'],
    });
    if (!role) throw new NotFoundException('Role not found');
    this.assertRoleClientAccess(user, role);
    return {
      code: HttpStatus.OK,
      message: 'Role fetched successfully',
      data: role,
    };
  }

  async update(
    id: string,
    dto: UpdateRoleDto,
    user: RequestUser,
  ): Promise<APIResponseInterface<Role>> {
    const role = await this.roleRepo.findOne({
      where: { id },
      relations: ['client'],
    });
    if (!role) throw new NotFoundException('Role not found');
    this.assertRoleClientAccess(user, role);

    if (dto.name != null) role.name = dto.name;
    if (dto.description != null) role.description = dto.description;
    if (dto.isActive != null) role.isActive = dto.isActive;
    await this.roleRepo.save(role);

    if (dto.permissions != null) {
      await this.rolePermissionRepo.delete({ roleId: id });
      await this.savePermissions(id, dto.permissions);
    }

    const updated = await this.roleRepo.findOne({
      where: { id },
      relations: ['rolePermissions', 'rolePermissions.module'],
    });
    return {
      code: HttpStatus.OK,
      message: 'Role updated successfully',
      data: updated!,
    };
  }

  async remove(
    id: string,
    user: RequestUser,
  ): Promise<APIResponseInterface<null>> {
    const role = await this.roleRepo.findOne({
      where: { id },
      relations: ['client'],
    });
    if (!role) throw new NotFoundException('Role not found');
    this.assertRoleClientAccess(user, role);
    await this.roleRepo.remove(role);
    return {
      code: HttpStatus.OK,
      message: 'Role deleted successfully',
      data: null,
    };
  }

  private async savePermissions(
    roleId: string,
    permissions: { moduleId: string; permissions: string[] }[],
  ) {
    const toInsert: Partial<RolePermission>[] = [];
    for (const p of permissions) {
      for (const perm of p.permissions) {
        if (Object.values(Permission).includes(perm as Permission)) {
          toInsert.push({
            roleId,
            moduleId: p.moduleId,
            permission: perm as Permission,
          });
        }
      }
    }
    if (toInsert.length) {
      await this.rolePermissionRepo.insert(toInsert);
    }
  }

  async getModules(user?: {
    role: string;
  }): Promise<APIResponseInterface<AppModule[]>> {
    const list = await this.moduleRepo.find({ order: { sortOrder: 'ASC' } });
    const role = user?.role;
    let filtered = list;

    if (role === RoleEnum.CLIENT_ADMIN || role === RoleEnum.CLIENT_USER) {
      const excluded = new Set([
        'INTERNAL_USER_MANAGEMENT',
        'FIELD_AGENT',
        'CLIENT_MANAGEMENT',
      ]);
      filtered = list.filter((m) => !excluded.has(m.code));
    } else if (role === RoleEnum.INTERNAL_USER) {
      filtered = list.filter((m) => m.code !== 'FIELD_AGENT');
    }

    return {
      code: HttpStatus.OK,
      message: 'Modules fetched successfully',
      data: filtered,
    };
  }

  async validateClientRoleCreationLimit(clientId: string): Promise<void> {
    const client = await this.clientRepo.findOne({ where: { id: clientId } });
    const maxRoles = client?.setting?.maxRoles;
    if (maxRoles == null || maxRoles <= 0) {
      return;
    }
    const currentCount = await this.roleRepo.count({
      where: { client: { id: clientId } as any },
    });
    if (currentCount >= maxRoles) {
      throw new ForbiddenException(
        'Role creation limit reached for this organization. Contact your administrator.',
      );
    }
  }

  async seedModulesIfEmpty(): Promise<void> {
    const defaults = [
      {
        name: 'Client Management',
        code: 'CLIENT_MANAGEMENT',
        description: 'Manage clients',
        sortOrder: 1,
      },
      {
        name: 'User Management',
        code: 'USER_MANAGEMENT',
        description: 'Manage users',
        sortOrder: 2,
      },
      {
        name: 'Role Management',
        code: 'ROLE_MANAGEMENT',
        description: 'Manage roles and permissions',
        sortOrder: 3,
      },
      {
        name: 'Settings',
        code: 'SETTINGS',
        description: 'Application settings',
        sortOrder: 4,
      },
      {
        name: 'Internal User Management',
        code: 'INTERNAL_USER_MANAGEMENT',
        description: 'Manage internal/super-admin users',
        sortOrder: 5,
      },
      {
        name: 'Verification',
        code: 'VERIFICATION',
        description: 'Manage verification requests and reports',
        sortOrder: 6,
      },
      {
        name: 'Field Agent',
        code: 'FIELD_AGENT',
        description: 'Manage field agents and wallets',
        sortOrder: 7,
      },
      {
        name: 'Report Customization',
        code: 'REPORT_CUSTOMIZATION',
        description: 'Customize verification report layouts by type',
        sortOrder: 8,
      },
    ];
    const existing = await this.moduleRepo.find({
      select: { id: true, code: true } as any,
    });
    const existingCodes = new Set(existing.map((m) => m.code));
    const toInsert = defaults.filter((m) => !existingCodes.has(m.code));
    if (toInsert.length) {
      await this.moduleRepo.insert(toInsert);
    }
  }
}
