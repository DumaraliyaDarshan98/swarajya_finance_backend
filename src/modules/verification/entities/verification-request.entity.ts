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

export type VerificationStatus = 'DRAFT' | 'REPORT_GENERATED';

@Entity('verification_requests')
export class VerificationRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Client, { nullable: false })
  client: Client;

  @Column({ name: 'client_id', type: 'uuid' })
  @Index()
  clientId: string;

  // Step 1 (Digital verification)
  @Column({
    name: 'loan_application_no',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  loanApplicationNo: string | null;

  @Column({ name: 'loan_type', type: 'varchar', length: 100, nullable: true })
  loanType: string | null;

  @Column({
    name: 'applicant_name',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  applicantName: string | null;

  @Column({
    name: 'mobile_number',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  mobileNumber: string | null;

  @Column({ name: 'email_id', type: 'varchar', length: 255, nullable: true })
  emailId: string | null;

  @Column({ name: 'pan_number', type: 'varchar', length: 50, nullable: true })
  @Index()
  panNumber: string | null;

  @Column({ type: 'text', nullable: true })
  address: string | null;

  @Column({ name: 'do_document_verification', type: 'boolean', default: false })
  doDocumentVerification: boolean;

  // Step 2 (OCR & Triangulation)
  @Column({ name: 'document_payload', type: 'json', nullable: true })
  documentPayload: Record<string, unknown> | null;

  @Column({ name: 'do_physical_verification', type: 'boolean', default: false })
  doPhysicalVerification: boolean;

  // Step 3 (Physical verification)
  @Column({ name: 'physical_payload', type: 'json', nullable: true })
  physicalPayload: Record<string, unknown> | null;

  @Column({ type: 'json', nullable: true })
  reportJson: Record<string, unknown> | null;

  @Column({ name: 'report_generated_at', type: 'timestamp', nullable: true })
  reportGeneratedAt: Date | null;

  @Column({ type: 'varchar', length: 50, default: 'DRAFT' })
  status: VerificationStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
