import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import type { PhysicalVerificationRequestStatus } from './physical-verification-request.entity';
import { PhysicalVerificationRequest } from './physical-verification-request.entity';

@Entity('physical_verification_status_history')
export class PhysicalVerificationStatusHistory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PhysicalVerificationRequest, { nullable: false })
  request: PhysicalVerificationRequest;

  @Column({ name: 'request_id', type: 'uuid' })
  @Index()
  requestId: string;

  @Column({ name: 'from_status', type: 'varchar', length: 20, nullable: true })
  fromStatus: PhysicalVerificationRequestStatus | null;

  @Column({ name: 'to_status', type: 'varchar', length: 20 })
  toStatus: PhysicalVerificationRequestStatus;

  @Column({ name: 'comment', type: 'text', nullable: true })
  comment: string | null;

  @Column({ name: 'changed_by_role', type: 'varchar', length: 30 })
  changedByRole: string;

  @Column({ name: 'changed_by_id', type: 'uuid', nullable: true })
  changedById: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

