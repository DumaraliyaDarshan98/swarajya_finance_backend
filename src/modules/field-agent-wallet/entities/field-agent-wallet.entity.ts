import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('field_agent_wallets')
export class FieldAgentWallet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'field_agent_user_id', type: 'uuid', unique: true })
  fieldAgentUserId: string;

  @Column({ name: 'field_agent_name', type: 'varchar', length: 255, nullable: true })
  fieldAgentName: string | null;

  @Column({ name: 'field_agent_code', type: 'varchar', length: 50, nullable: true })
  fieldAgentCode: string | null;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  balance: number;

  @Column({ name: 'total_earned', type: 'decimal', precision: 12, scale: 2, default: 0 })
  totalEarned: number;

  @Column({ name: 'completed_cases_count', type: 'int', default: 0 })
  completedCasesCount: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
