import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';

export type NotificationIcon =
  | 'danger'
  | 'warning'
  | 'primary'
  | 'success'
  | 'info';

@Entity('user_notifications')
@Index(['userId', 'createdAt'])
@Index(['userId', 'read'])
export class UserNotification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 180 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  @Column({ type: 'varchar', length: 20, default: 'info' })
  icon: NotificationIcon;

  @Column({ type: 'boolean', default: false })
  read: boolean;

  @Column({ name: 'cta_url', type: 'varchar', length: 500, nullable: true })
  ctaUrl: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
