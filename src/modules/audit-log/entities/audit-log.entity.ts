import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type AuditAction =
  | 'LOGIN'
  | 'LOGIN_FAILED'
  | 'LOGOUT'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'VIEW'
  | 'EXPORT'
  | 'STATUS_CHANGE'
  | 'OTHER';

@Entity('audit_logs')
@Index(['createdAt'])
@Index(['clientId', 'createdAt'])
@Index(['userId', 'createdAt'])
@Index(['action', 'createdAt'])
@Index(['module', 'createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 40 })
  action: AuditAction;

  @Column({ type: 'varchar', length: 80, default: 'GENERAL' })
  module: string;

  @Column({ name: 'entity_type', type: 'varchar', length: 80, nullable: true })
  entityType: string | null;

  @Column({ name: 'entity_id', type: 'varchar', length: 64, nullable: true })
  entityId: string | null;

  @Column({ type: 'text' })
  description: string;

  @Column({ name: 'user_id', type: 'uuid', nullable: true })
  userId: string | null;

  @Column({ name: 'user_email', type: 'varchar', length: 180, nullable: true })
  userEmail: string | null;

  @Column({ name: 'user_name', type: 'varchar', length: 180, nullable: true })
  userName: string | null;

  @Column({ name: 'user_role', type: 'varchar', length: 40, nullable: true })
  userRole: string | null;

  @Column({ name: 'client_id', type: 'uuid', nullable: true })
  clientId: string | null;

  @Column({ name: 'ip_address', type: 'varchar', length: 64, nullable: true })
  ipAddress: string | null;

  @Column({ name: 'user_agent', type: 'text', nullable: true })
  userAgent: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  region: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  country: string | null;

  @Column({
    name: 'location_label',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  locationLabel: string | null;

  @Column({ type: 'varchar', length: 10, nullable: true })
  method: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  path: string | null;

  @Column({ name: 'status_code', type: 'int', nullable: true })
  statusCode: number | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
