import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  Unique,
} from 'typeorm';
import { Permission } from '../../../enum/permission.enum';
import { Role } from './role.entity';
import { AppModule } from '../../module/entities/app-module.entity';

@Entity('role_permissions')
@Unique(['roleId', 'moduleId', 'permission'])
export class RolePermission {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'role_id', type: 'uuid' })
  roleId: string;

  @ManyToOne(() => Role, (role) => role.rolePermissions, {
    onDelete: 'CASCADE',
  })
  role: Role;

  @Column({ name: 'module_id', type: 'uuid' })
  moduleId: string;

  @ManyToOne(() => AppModule, (module) => module.rolePermissions, {
    onDelete: 'CASCADE',
  })
  module: AppModule;

  @Column({ type: 'enum', enum: Permission })
  permission: Permission;
}
