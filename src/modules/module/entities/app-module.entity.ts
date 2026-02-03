import { Entity, Column, PrimaryGeneratedColumn, OneToMany, CreateDateColumn } from 'typeorm';
import { RolePermission } from '../../role/entities/role-permission.entity';

@Entity('app_modules')
export class AppModule {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  name: string;

  @Column({ unique: true })
  code: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @Column({ name: 'sort_order', default: 0 })
  sortOrder: number;

  @OneToMany(() => RolePermission, (rp) => rp.module)
  rolePermissions: RolePermission[];

  @CreateDateColumn()
  createdAt: Date;
}
