import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { PhysicalVerification } from './physical-verification.entity';
import type {
  PhysicalAddressBlock,
  PhysicalVerificationStatus,
} from '../interfaces/physical-verification.interface';
import type {
  PhysicalVisitAddressType,
  VisitFieldAgentSubmission,
} from '../interfaces/physical-verification-visit.interface';

@Entity('physical_verification_visits')
export class PhysicalVerificationVisit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PhysicalVerification, (parent) => parent.visits, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'physical_verification_id' })
  parent: PhysicalVerification;

  @Column({ name: 'physical_verification_id', type: 'uuid' })
  @Index()
  physicalVerificationId: string;

  @Column({ name: 'address_type', type: 'varchar', length: 20 })
  addressType: PhysicalVisitAddressType;

  @Column({ name: 'address_snapshot', type: 'json' })
  addressSnapshot: PhysicalAddressBlock;

  @Column({ type: 'varchar', length: 50, default: 'IN_PROGRESS' })
  status: PhysicalVerificationStatus;

  @Column({ name: 'assigned_field_agent_user_id', type: 'uuid', nullable: true })
  @Index()
  assignedFieldAgentUserId: string | null;

  @Column({ name: 'assigned_field_agent_name', type: 'varchar', length: 255, nullable: true })
  assignedFieldAgentName: string | null;

  @Column({ name: 'assigned_at', type: 'timestamp', nullable: true })
  assignedAt: Date | null;

  @Column({ name: 'field_agent_submission', type: 'json', nullable: true })
  fieldAgentSubmission: VisitFieldAgentSubmission | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'admin_review_note', type: 'text', nullable: true })
  adminReviewNote: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
