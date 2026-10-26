import { SetMetadata } from '@nestjs/common';

export const PERMISSIONS_KEY = 'required_permissions';

export type RequiredPermission = {
  moduleCode: string;
  /** Any of these permissions grants access (e.g. VIEW or LIST). */
  anyOf: string[];
};

/**
 * Require module-level RBAC on the server.
 * Example: `@RequirePermissions('VERIFICATION', 'VIEW', 'LIST')`
 */
export const RequirePermissions = (
  moduleCode: string,
  ...anyOf: string[]
) =>
  SetMetadata(PERMISSIONS_KEY, {
    moduleCode,
    anyOf: anyOf.length ? anyOf : ['VIEW', 'LIST'],
  } satisfies RequiredPermission);
