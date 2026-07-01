import { SetMetadata } from '@nestjs/common';
import { Role } from 'src/enum/role.enum';

export const ROLES_KEY = 'roles';
// export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, roles);
export const Roles = (...roles: string[]) => SetMetadata(ROLES_KEY, [Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.INTERNAL_USER, Role.FIELD_AGENT, Role.CLIENT_USER]);