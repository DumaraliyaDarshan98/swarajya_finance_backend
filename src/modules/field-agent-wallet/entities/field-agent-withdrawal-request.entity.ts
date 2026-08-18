import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type WithdrawalRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

@Entity('field_agent_withdrawal_requests')
export class FieldAgentWithdrawalRequest {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'field_agent_user_id', type: 'uuid' })
  @Index()
  fieldAgentUserId: string;

  @Column({ name: 'field_agent_name', type: 'varchar', length: 255, nullable: true })
  fieldAgentName: string | null;

  @Column({ name: 'field_agent_code', type: 'varchar', length: 50, nullable: true })
  fieldAgentCode: string | null;

  @Column({ name: 'field_agent_email', type: 'varchar', length: 255, nullable: true })
  fieldAgentEmail: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 20, default: 'PENDING' })
  @Index()
  status: WithdrawalRequestStatus;

  @Column({ name: 'bank_account_id', type: 'uuid', nullable: true })
  bankAccountId: string | null;

  @Column({ name: 'bank_name', type: 'varchar', length: 255 })
  bankName: string;

  @Column({ name: 'account_number', type: 'varchar', length: 100 })
  accountNumber: string;

  @Column({ name: 'account_type', type: 'varchar', length: 100, nullable: true })
  accountType: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  branch: string | null;

  @Column({ type: 'varchar', length: 20 })
  ifsc: string;

  @Column({ name: 'upi_id', type: 'varchar', length: 255, nullable: true })
  upiId: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  remarks: string | null;

  @Column({ name: 'admin_remarks', type: 'varchar', length: 500, nullable: true })
  adminRemarks: string | null;

  @Column({ name: 'reviewed_by', type: 'uuid', nullable: true })
  reviewedBy: string | null;

  @Column({ name: 'reviewed_at', type: 'timestamp', nullable: true })
  reviewedAt: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
