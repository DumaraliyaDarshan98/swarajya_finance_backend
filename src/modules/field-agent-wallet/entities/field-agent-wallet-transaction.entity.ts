import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  Index,
} from 'typeorm';

export type WalletTransactionStatus = 'CREDITED';

@Entity('field_agent_wallet_transactions')
export class FieldAgentWalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'field_agent_user_id', type: 'uuid' })
  @Index()
  fieldAgentUserId: string;

  @Column({ name: 'field_agent_name', type: 'varchar', length: 255, nullable: true })
  fieldAgentName: string | null;

  @Column({ name: 'physical_verification_id', type: 'uuid' })
  @Index()
  physicalVerificationId: string;

  @Column({ name: 'physical_verification_visit_id', type: 'uuid', nullable: true, unique: true })
  physicalVerificationVisitId: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount: number;

  @Column({ type: 'varchar', length: 20, default: 'CREDITED' })
  status: WalletTransactionStatus;

  @Column({ name: 'loan_no', type: 'varchar', length: 100, nullable: true })
  loanNo: string | null;

  @Column({ name: 'customer_name', type: 'varchar', length: 255, nullable: true })
  customerName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  product: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  location: string | null;

  @Column({ name: 'rcu_manager', type: 'varchar', length: 255, nullable: true })
  rcuManager: string | null;

  @Column({ name: 'verification_type', type: 'varchar', length: 50, nullable: true })
  verificationType: string | null;

  @Column({ name: 'completed_at', type: 'timestamp' })
  completedAt: Date;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
