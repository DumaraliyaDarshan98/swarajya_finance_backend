import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FieldAgentWallet } from './field-agent-wallet.entity';

export type WalletTxnType = 'CREDIT' | 'DEBIT';
export type WalletReferenceType = 'PHYSICAL_REQUEST';

@Entity('field_agent_wallet_transactions')
export class FieldAgentWalletTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => FieldAgentWallet, { nullable: false })
  wallet: FieldAgentWallet;

  @Column({ name: 'wallet_id', type: 'uuid' })
  @Index()
  walletId: string;

  @Column({ name: 'field_assistant_id', type: 'uuid' })
  @Index()
  fieldAssistantId: string;

  @Column({ name: 'type', type: 'varchar', length: 10 })
  type: WalletTxnType;

  @Column({ name: 'amount_paise', type: 'int' })
  amountPaise: number;

  @Column({ name: 'reference_type', type: 'varchar', length: 30, nullable: true })
  referenceType: WalletReferenceType | null;

  @Column({ name: 'reference_id', type: 'uuid', nullable: true })
  referenceId: string | null;

  @Column({ name: 'note', type: 'varchar', length: 255, nullable: true })
  note: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

