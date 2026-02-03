import {
  Injectable,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { AppModule } from '../module/entities/app-module.entity';
import { Permission } from '../../enum/permission.enum';
import { CreateRoleDto } from './dto/create-role.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { ListRolesQueryDto } from './dto/list-roles-query.dto';
import { APIResponseInterface } from '../../interface/response.interface';
import { Role as RoleEnum } from '../../enum/role.enum';

@Injectable()
export class RolesService {
  constructor(
    @InjectRepository(Role) private roleRepo: Repository<Role>,
    @InjectRepository(RolePermission) private rolePermissionRepo: Repository<RolePermission>,
    @InjectRepository(AppModule) private moduleRepo: Repository<AppModule>,
  ) {}

  async create(
    dto: CreateRoleDto,
    user: { role: string; clientId?: string },
  ): Promise<APIResponseInterface<Role>> {
    if (dto.clientId) {
      if (user.role !== RoleEnum.SUPER_ADMIN && user.clientId !== dto.clientId) {
        throw new ForbiddenException('You can only create roles for your own client');
      }
    } else {
      if (user.role !== RoleEnum.SUPER_ADMIN) {
        throw new ForbiddenException('Only super admin can create internal roles');
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
    return { code: HttpStatus.CREATED, message: 'Role created successfully', data: saved! };
  }

  async findAll(
    query: ListRolesQueryDto,
    user: { role: string; clientId?: string },
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

    if (user.role === RoleEnum.SUPER_ADMIN) {
      if (query.clientId) qb.andWhere('role.client_id = :clientId', { clientId: query.clientId });
    } else {
      qb.andWhere('role.client_id = :clientId', { clientId: user.clientId });
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
    user: { role: string; clientId?: string },
  ): Promise<APIResponseInterface<Role>> {
    const role = await this.roleRepo.findOne({
      where: { id },
      relations: ['rolePermissions', 'rolePermissions.module', 'client'],
    });
    if (!role) throw new NotFoundException('Role not found');
    if (user.role !== RoleEnum.SUPER_ADMIN && role.client?.id !== user.clientId) {
      throw new ForbiddenException('You can only view roles of your client');
    }
    return { code: HttpStatus.OK, message: 'Role fetched successfully', data: role };
  }

  async update(
    id: string,
    dto: UpdateRoleDto,
    user: { role: string; clientId?: string },
  ): Promise<APIResponseInterface<Role>> {
    const role = await this.roleRepo.findOne({ where: { id }, relations: ['client'] });
    if (!role) throw new NotFoundException('Role not found');
    if (user.role !== RoleEnum.SUPER_ADMIN && role.client?.id !== user.clientId) {
      throw new ForbiddenException('You can only update roles of your client');
    }

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
    return { code: HttpStatus.OK, message: 'Role updated successfully', data: updated! };
  }

  async remove(id: string, user: { role: string; clientId?: string }): Promise<APIResponseInterface<null>> {
    const role = await this.roleRepo.findOne({ where: { id }, relations: ['client'] });
    if (!role) throw new NotFoundException('Role not found');
    if (user.role !== RoleEnum.SUPER_ADMIN && role.client?.id !== user.clientId) {
      throw new ForbiddenException('You can only delete roles of your client');
    }
    await this.roleRepo.remove(role);
    return { code: HttpStatus.OK, message: 'Role deleted successfully', data: null };
  }

  private async savePermissions(roleId: string, permissions: { moduleId: string; permissions: string[] }[]) {
    const toInsert: Partial<RolePermission>[] = [];
    for (const p of permissions) {
      for (const perm of p.permissions) {
        if (Object.values(Permission).includes(perm as Permission)) {
          toInsert.push({ roleId, moduleId: p.moduleId, permission: perm as Permission });
        }
      }
    }
    if (toInsert.length) {
      await this.rolePermissionRepo.insert(toInsert);
    }
  }

  async getModules(): Promise<APIResponseInterface<AppModule[]>> {
    const list = await this.moduleRepo.find({ order: { sortOrder: 'ASC' } });
    return { code: HttpStatus.OK, message: 'Modules fetched successfully', data: list };
  }

  async seedModulesIfEmpty(): Promise<void> {
    const count = await this.moduleRepo.count();
    if (count > 0) return;
    const defaults = [
      { name: 'Client Management', code: 'CLIENT_MANAGEMENT', description: 'Manage clients', sortOrder: 1 },
      { name: 'User Management', code: 'USER_MANAGEMENT', description: 'Manage users', sortOrder: 2 },
      { name: 'Role Management', code: 'ROLE_MANAGEMENT', description: 'Manage roles and permissions', sortOrder: 3 },
      { name: 'Settings', code: 'SETTINGS', description: 'Application settings', sortOrder: 4 },
      { name: 'Internal User Management', code: 'INTERNAL_USER_MANAGEMENT', description: 'Manage internal/super-admin users', sortOrder: 5 },
    ];
    await this.moduleRepo.insert(defaults);
  }
}
