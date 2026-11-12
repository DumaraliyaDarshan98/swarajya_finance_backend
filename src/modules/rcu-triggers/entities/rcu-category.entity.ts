import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { RcuDocumentType } from './rcu-document-type.entity';

@Entity('rcu_categories')
export class RcuCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'category_key', type: 'varchar', length: 100 })
  key: string;

  @Column({ type: 'varchar', length: 200 })
  label: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Whether this category is used in OCR verification flows */
  @Column({ name: 'used_in_ocr', type: 'boolean', default: false })
  usedInOcr: boolean;

  @OneToMany(() => RcuDocumentType, (doc) => doc.category)
  documentTypes: RcuDocumentType[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
