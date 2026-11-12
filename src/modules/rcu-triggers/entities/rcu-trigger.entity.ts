import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { RcuDocumentType } from './rcu-document-type.entity';

export type RcuRiskLevel = 'HIGH' | 'MEDIUM' | 'LOW';

@Entity('rcu_triggers')
@Unique(['documentTypeId', 'code'])
export class RcuTrigger {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'document_type_id', type: 'uuid' })
  documentTypeId: string;

  @ManyToOne(() => RcuDocumentType, (doc) => doc.triggers, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'document_type_id' })
  documentType: RcuDocumentType;

  /** Business code shown in UI, e.g. BS-M01 */
  @Column({ type: 'varchar', length: 50 })
  code: string;

  @Column({ type: 'text' })
  text: string;

  @Column({ type: 'varchar', length: 20 })
  risk: RcuRiskLevel;

  @Column({ type: 'varchar', length: 200, nullable: true })
  section: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Whether this trigger is used in OCR verification flows */
  @Column({ name: 'used_in_ocr', type: 'boolean', default: false })
  usedInOcr: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
