import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Client } from '../../client/entities/client.entity';
import type {
  DocumentTypeVerification,
  FieldAgentSubmission,
  PhysicalPartyDetails,
  PhysicalReportPayload,
  PhysicalVerificationStatus,
} from '../interfaces/physical-verification.interface';

@Entity('physical_verifications')
export class PhysicalVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Client, { nullable: false })
  client: Client;

  @Column({ name: 'client_id', type: 'uuid' })
  @Index()
  clientId: string;

  @Column({ name: 'physical_verification_type', type: 'varchar', length: 50, nullable: true })
  physicalVerificationType: string | null;

  @Column({ name: 'fi_type', type: 'varchar', length: 50, nullable: true })
  fiType: string | null;

  @Column({ name: 'applicant', type: 'json' })
  applicant: PhysicalPartyDetails;

  @Column({ name: 'has_co_applicant', type: 'boolean', default: false })
  hasCoApplicant: boolean;

  @Column({ name: 'co_applicant', type: 'json', nullable: true })
  coApplicant: PhysicalPartyDetails | null;

  @Column({ name: 'complete_remark', type: 'text', nullable: true })
  completeRemark: string | null;

  @Column({ name: 'document_type_verifications', type: 'json', nullable: true })
  documentTypeVerifications: DocumentTypeVerification[] | null;

  @Column({ name: 'report_payload', type: 'json', nullable: true })
  reportPayload: PhysicalReportPayload | null;

  @Column({ type: 'varchar', length: 50, default: 'DRAFT' })
  status: PhysicalVerificationStatus;

  @Column({ name: 'report_generated_at', type: 'timestamp', nullable: true })
  reportGeneratedAt: Date | null;

  /** Denormalized for search/listing */
  @Column({ name: 'agreement_number', type: 'varchar', length: 100, nullable: true })
  @Index()
  agreementNumber: string | null;

  @Column({ name: 'customer_name', type: 'varchar', length: 255, nullable: true })
  @Index()
  customerName: string | null;

  @Column({ name: 'product', type: 'varchar', length: 100, nullable: true })
  product: string | null;

  @Column({ name: 'mobile', type: 'varchar', length: 20, nullable: true })
  mobile: string | null;

  @Column({ name: 'city', type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ name: 'assigned_field_agent_user_id', type: 'uuid', nullable: true })
  @Index()
  assignedFieldAgentUserId: string | null;

  @Column({ name: 'assigned_field_agent_name', type: 'varchar', length: 255, nullable: true })
  assignedFieldAgentName: string | null;

  @Column({ name: 'assigned_at', type: 'timestamp', nullable: true })
  assignedAt: Date | null;

  @Column({ name: 'field_agent_submission', type: 'json', nullable: true })
  fieldAgentSubmission: FieldAgentSubmission | null;

  @Column({ name: 'rejection_reason', type: 'text', nullable: true })
  rejectionReason: string | null;

  @Column({ name: 'admin_review_note', type: 'text', nullable: true })
  adminReviewNote: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
