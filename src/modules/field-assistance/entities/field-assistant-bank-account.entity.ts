import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, Index } from 'typeorm';
import { FieldAssistant } from './field-assistant.entity';

export type FieldAssistanceBankStatus = 'Active' | 'Inactive';

@Entity('field_assistant_bank_accounts')
export class FieldAssistantBankAccount {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  @Index()
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  @Index()
  updatedBy: string | null;

  @ManyToOne(() => FieldAssistant, (fa) => fa.bankDetails, { onDelete: 'CASCADE' })
  fieldAssistant: FieldAssistant;

  @Column({ name: 'field_assistant_id', type: 'uuid' })
  @Index()
  fieldAssistantId: string;

  @Column({ name: 'bank_name', type: 'varchar', length: 255 })
  bankName: string;

  @Column({ name: 'account_number', type: 'varchar', length: 100 })
  accountNumber: string;

  @Column({ name: 'account_type', type: 'varchar', length: 100, nullable: true })
  accountType: string | null;

  @Column({ name: 'branch', type: 'varchar', length: 255, nullable: true })
  branch: string | null;

  @Column({ name: 'ifsc', type: 'varchar', length: 20 })
  @Index()
  ifsc: string;

  @Column({ name: 'upi_id', type: 'varchar', length: 255, nullable: true })
  upiId: string | null;

  @Column({ name: 'status', type: 'varchar', length: 10, default: 'Inactive' })
  status: FieldAssistanceBankStatus;
}

