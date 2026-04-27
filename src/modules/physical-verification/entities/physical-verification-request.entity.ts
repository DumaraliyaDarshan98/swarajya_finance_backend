import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { VerificationRequest } from '../../verification/entities/verification-request.entity';
import { FieldAssistant } from '../../field-assistance/entities/field-assistant.entity';
import { PhysicalVerificationStatusHistory } from './physical-verification-status-history.entity';
import { PhysicalVerificationSelfie } from './physical-verification-selfie.entity';

export type PhysicalVerificationRequestStatus =
  | 'PENDING'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'VERIFIED'
  | 'APPROVED'
  | 'DECLINED'
  | 'REASSIGNED';

@Entity('physical_verification_requests')
export class PhysicalVerificationRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => VerificationRequest, { nullable: false })
  verificationRequest: VerificationRequest;

  @Column({ name: 'verification_request_id', type: 'uuid' })
  @Index({ unique: true })
  verificationRequestId: string;

  @Column({ name: 'client_id', type: 'uuid' })
  @Index()
  clientId: string;

  @ManyToOne(() => FieldAssistant, { nullable: true })
  assignedFieldAssistant: FieldAssistant | null;

  @Column({ name: 'assigned_field_assistant_id', type: 'uuid', nullable: true })
  @Index()
  assignedFieldAssistantId: string | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'PENDING' })
  status: PhysicalVerificationRequestStatus;

  /**
   * Snapshot of the configured price when the request is assigned/approved.
   * Stored in paise to avoid floating point.
   */
  @Column({ name: 'price_paise', type: 'int', default: 0 })
  pricePaise: number;

  /**
   * Latest location captured by field agent.
   * Example: { lat, lng, accuracy, capturedAt }
   */
  @Column({ name: 'current_location', type: 'json', nullable: true })
  currentLocation: Record<string, unknown> | null;

  @Column({ name: 'agent_comment', type: 'text', nullable: true })
  agentComment: string | null;

  @Column({ name: 'admin_comment', type: 'text', nullable: true })
  adminComment: string | null;

  @OneToMany(() => PhysicalVerificationStatusHistory, (x) => x.request, {
    cascade: true,
  })
  history: PhysicalVerificationStatusHistory[];

  @OneToMany(() => PhysicalVerificationSelfie, (x) => x.request, {
    cascade: true,
  })
  selfies: PhysicalVerificationSelfie[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

