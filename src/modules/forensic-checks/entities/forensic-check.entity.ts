import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';

export type ForensicSeverity = 'low' | 'medium' | 'high';

/** File-type groups used to organize and run forensics on upload. */
export type ForensicCategory = 'PDF' | 'IMAGE' | 'DOC' | 'ZIP';

@Entity('forensic_checks')
@Unique(['code'])
export class ForensicCheck {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Admin / catalog code, e.g. PDF_FILE_FORMAT_MISMATCH */
  @Column({ type: 'varchar', length: 80 })
  code: string;

  /**
   * Engine signal code this catalog row overlays.
   * Defaults to `code` when empty (e.g. PDF_MODIFIED_AFTER_CREATE).
   */
  @Column({ name: 'engine_key', type: 'varchar', length: 80 })
  engineKey: string;

  /** Threat taxonomy code, e.g. T001 */
  @Column({ name: 'threat_code', type: 'varchar', length: 20 })
  threatCode: string;

  /** File-type group: PDF | IMAGE | DOC | ZIP */
  @Column({ type: 'varchar', length: 20 })
  category: ForensicCategory;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 20 })
  severity: ForensicSeverity;

  /** Risk points added when this signal fails */
  @Column({ type: 'int', default: 0 })
  score: number;

  /**
   * Optional OCR document-type matcher (salary/bank content rules).
   * Empty = applies for any document type within this file category.
   */
  @Column({ name: 'document_type_pattern', type: 'varchar', length: 255, nullable: true })
  documentTypePattern: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Included when finance app calls OCR /verify */
  @Column({ name: 'used_in_ocr', type: 'boolean', default: true })
  usedInOcr: boolean;

  /** Seeded Phase-1 checks — code cannot be renamed/deleted casually */
  @Column({ name: 'is_system', type: 'boolean', default: false })
  isSystem: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
