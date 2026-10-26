import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { User } from '../../modules/user/entities/user.entity';
import { Role as RoleEnum } from '../enums/role.enum';

const PLATFORM_FULL = [
  'DASHBOARD',
  'CLIENT_MANAGEMENT',
  'USER_MANAGEMENT',
  'ROLE_MANAGEMENT',
  'SETTINGS',
  'INTERNAL_USER_MANAGEMENT',
  'VERIFICATION',
  'FIELD_AGENT',
  'REPORT_CUSTOMIZATION',
  'PORTAL_LIST',
  'AI_TOOLS',
  'RCU_TRIGGERS',
  'FORENSIC_CHECKS',
  'TRAINING',
  'SUBSCRIPTION',
  'AUDIT_LOG',
] as const;

const CLIENT_FULL = [
  'DASHBOARD',
  'USER_MANAGEMENT',
  'ROLE_MANAGEMENT',
  'SETTINGS',
  'VERIFICATION',
  'TRAINING',
  'SUBSCRIPTION',
  'AUDIT_LOG',
] as const;

const CRUD = ['VIEW', 'ADD', 'EDIT', 'LIST', 'DELETE'] as const;

@Injectable()
export class PermissionsService {
  constructor(
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
  ) {}

  async userHasPermission(
    userId: string,
    role: string,
    moduleCode: string,
    anyOf: string[],
  ): Promise<boolean> {
    if (role === RoleEnum.SUPER_ADMIN) return true;

    const map = await this.resolvePermissionMap(userId, role);
    const granted = map.get(moduleCode) || [];
    if (!granted.length) return false;
    // VIEW and LIST are interchangeable for read access (nav + list APIs).
    const normalizedAnyOf = this.expandReadAliases(anyOf);
    const normalizedGranted = this.expandReadAliases(granted);
    return normalizedAnyOf.some((p) => normalizedGranted.includes(p));
  }

  /** Permission entries for login / UI (same rules as API guard). */
  async getPermissionEntries(
    userId: string,
    role: string,
  ): Promise<Array<{ moduleCode: string; permissions: string[] }>> {
    const map = await this.resolvePermissionMap(userId, role);
    return Array.from(map.entries()).map(([moduleCode, permissions]) => ({
      moduleCode,
      // Mirror guard aliases so sidebar + route guards match API access.
      permissions: this.expandReadAliases(permissions),
    }));
  }

  private expandReadAliases(perms: string[]): string[] {
    const out = new Set(perms);
    if (out.has('VIEW')) out.add('LIST');
    if (out.has('LIST')) out.add('VIEW');
    return Array.from(out);
  }

  private async resolvePermissionMap(
    userId: string,
    role: string,
  ): Promise<Map<string, string[]>> {
    if (role === RoleEnum.SUPER_ADMIN) {
      return this.fullMap(PLATFORM_FULL);
    }

    // CLIENT_ADMIN without a custom role keeps full client access.
    // With a custom role assigned, respect that role's matrix.
    if (role === RoleEnum.FIELD_AGENT) {
      return new Map([
        ['DASHBOARD', ['VIEW', 'LIST']],
        ['FIELD_AGENT', ['VIEW', 'LIST', 'EDIT']],
        // Field visits live under physical-verifications API
        ['VERIFICATION', ['VIEW', 'LIST', 'EDIT']],
        ['TRAINING', ['VIEW', 'LIST']],
        ['SETTINGS', ['VIEW', 'LIST', 'EDIT']],
      ]);
    }

    const user = await this.userRepo.findOne({
      where: { id: userId },
      relations: {
        customRole: { rolePermissions: { module: true } },
      },
    });

    const customMap = this.mapFromCustomRole(user);
    if (customMap) {
      return customMap;
    }

    if (role === RoleEnum.CLIENT_ADMIN) {
      return this.fullMap(CLIENT_FULL);
    }

    if (role === RoleEnum.INTERNAL_USER) {
      return new Map([
        ['DASHBOARD', ['VIEW', 'LIST']],
        ['CLIENT_MANAGEMENT', ['VIEW', 'LIST']],
      ]);
    }

    // CLIENT_USER with no custom role: no module access until a role is assigned
    return new Map();
  }

  /**
   * Returns null when no custom role is linked.
   * Returns a map (possibly with only DASHBOARD) when a custom role is linked.
   */
  private mapFromCustomRole(user: User | null): Map<string, string[]> | null {
    if (!user?.customRole) {
      return null;
    }
    if (user.customRole.isActive === false) {
      return new Map();
    }

    const map = new Map<string, string[]>();
    for (const rp of user.customRole.rolePermissions || []) {
      const code = rp.module?.code;
      if (!code || !rp.permission) continue;
      const list = map.get(code) || [];
      if (!list.includes(rp.permission)) list.push(rp.permission);
      map.set(code, list);
    }

    // Always allow landing on dashboard when the user has any custom-role access
    // (or even an empty active role, so the shell is not blank).
    const dash = map.get('DASHBOARD') || [];
    if (!dash.includes('VIEW')) dash.push('VIEW');
    if (!dash.includes('LIST')) dash.push('LIST');
    map.set('DASHBOARD', dash);

    return map;
  }

  private fullMap(codes: readonly string[]): Map<string, string[]> {
    const map = new Map<string, string[]>();
    for (const code of codes) {
      map.set(code, [...CRUD]);
    }
    return map;
  }
}
