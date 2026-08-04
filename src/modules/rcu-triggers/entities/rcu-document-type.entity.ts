import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RcuCategory } from './rcu-category.entity';
import { RcuTrigger } from './rcu-trigger.entity';

export type RcuContentType = 'triggers' | 'logic' | 'tax-slabs';

@Entity('rcu_document_types')
export class RcuDocumentType {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => RcuCategory, (cat) => cat.documentTypes, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'category_id' })
  category: RcuCategory;

  @Index({ unique: true })
  @Column({ name: 'doc_key', type: 'varchar', length: 100 })
  key: string;

  @Column({ type: 'varchar', length: 255 })
  label: string;

  @Column({ name: 'sidebar_label', type: 'varchar', length: 150, nullable: true })
  sidebarLabel: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  badge: string | null;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  icon: string | null;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ name: 'info_note', type: 'text', nullable: true })
  infoNote: string | null;

  @Column({
    name: 'content_type',
    type: 'varchar',
    length: 30,
    default: 'triggers',
  })
  contentType: RcuContentType;

  /** PAN/TAN logic payload when contentType = logic */
  @Column({ type: 'json', nullable: true })
  logic: Record<string, unknown> | null;

  /** Tax slabs payload when contentType = tax-slabs */
  @Column({ name: 'tax_slabs', type: 'json', nullable: true })
  taxSlabs: Record<string, unknown> | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Whether this document type is used in OCR verification flows */
  @Column({ name: 'used_in_ocr', type: 'boolean', default: false })
  usedInOcr: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @OneToMany(() => RcuTrigger, (trigger) => trigger.documentType)
  triggers: RcuTrigger[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
