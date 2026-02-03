import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Client } from '../../client/entities/client.entity';
import { RolePermission } from './role-permission.entity';
import { User } from '../../user/entities/user.entity';

@Entity('roles')
export class Role {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string;

  @ManyToOne(() => Client, { nullable: true, onDelete: 'CASCADE' })
  @JoinColumn({ name: 'client_id' })
  client: Client | null;

  @Column({ name: 'is_active', default: true })
  isActive: boolean;

  @OneToMany(() => RolePermission, (rp) => rp.role)
  rolePermissions: RolePermission[];

  @OneToMany(() => User, (user) => user.customRole)
  users: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
