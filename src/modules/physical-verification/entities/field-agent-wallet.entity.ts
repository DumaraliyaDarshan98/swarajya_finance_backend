import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { FieldAgentWalletTransaction } from './field-agent-wallet-transaction.entity';

@Entity('field_agent_wallets')
export class FieldAgentWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'field_assistant_id', type: 'uuid' })
  @Index({ unique: true })
  fieldAssistantId: string;

  @Column({ name: 'balance_paise', type: 'int', default: 0 })
  balancePaise: number;

  @OneToMany(() => FieldAgentWalletTransaction, (x) => x.wallet, {
    cascade: true,
  })
  transactions: FieldAgentWalletTransaction[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}

