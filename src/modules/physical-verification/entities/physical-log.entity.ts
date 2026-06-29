import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { PhysicalVerification } from './physical-verification.entity';

export type PhysicalLogAction =
  | 'CREATED'
  | 'SUBMITTED'
  | 'AGENT_ASSIGNED'
  | 'AGENT_REASSIGNED'
  | 'AGENT_DRAFT_SAVED'
  | 'AGENT_SUBMITTED'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  | 'FAILED';

@Entity('physical_logs')
export class PhysicalLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PhysicalVerification, { onDelete: 'CASCADE' })
  physicalVerification: PhysicalVerification;

  @Column({ name: 'physical_verification_id', type: 'uuid' })
  @Index()
  physicalVerificationId: string;

  @Column({ type: 'varchar', length: 50 })
  action: PhysicalLogAction;

  @Column({ type: 'text' })
  message: string;

  @Column({ name: 'performed_by_user_id', type: 'uuid', nullable: true })
  performedByUserId: string | null;

  @Column({ name: 'performed_by_name', type: 'varchar', length: 255, nullable: true })
  performedByName: string | null;

  @Column({ type: 'json', nullable: true })
  metadata: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;
}
