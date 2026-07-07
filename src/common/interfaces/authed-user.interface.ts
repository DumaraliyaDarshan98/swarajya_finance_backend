import { Role } from '../enums/role.enum';

export interface AuthedUser {
  sub: string;
  role: Role | string;
  clientId?: string;
}
