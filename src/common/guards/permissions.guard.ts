import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  PERMISSIONS_KEY,
  type RequiredPermission,
} from '../decorators/permissions.decorator';
import { PermissionsService } from '../services/permissions.service';
import { Role } from '../enums/role.enum';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly permissionsService: PermissionsService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required?.moduleCode) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user?.sub || !user?.role) {
      throw new ForbiddenException('Authentication required');
    }

    if (user.role === Role.SUPER_ADMIN) {
      return true;
    }

    const ok = await this.permissionsService.userHasPermission(
      user.sub,
      String(user.role),
      required.moduleCode,
      required.anyOf,
    );

    if (!ok) {
      throw new ForbiddenException(
        `Missing permission ${required.anyOf.join('|')} on ${required.moduleCode}`,
      );
    }
    return true;
  }
}
