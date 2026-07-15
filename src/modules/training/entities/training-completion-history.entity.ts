import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('training_completion_history')
export class TrainingCompletionHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index()
  @Column({ name: 'training_id', type: 'uuid' })
  trainingId: string;

  @Column({ name: 'certificate_id', type: 'uuid', nullable: true })
  certificateId: string | null;

  @Column({ name: 'completed_at', type: 'datetime' })
  completedAt: Date;

  @Column({ name: 'expires_at', type: 'datetime', nullable: true })
  expiresAt: Date | null;

  @Column({ name: 'reset_reason', type: 'varchar', length: 100, nullable: true })
  resetReason: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
