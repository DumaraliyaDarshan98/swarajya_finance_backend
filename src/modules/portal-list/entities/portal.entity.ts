import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { PortalCategory } from './portal-category.entity';

@Entity('portals')
export class Portal {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'category_id', type: 'uuid' })
  categoryId: string;

  @ManyToOne(() => PortalCategory, (cat) => cat.portals, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'category_id' })
  category: PortalCategory;

  @Column({ type: 'varchar', length: 255 })
  title: string;

  @Column({ type: 'varchar', length: 120 })
  state: string;

  @Column({ type: 'varchar', length: 1000 })
  url: string;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Whether this portal is used in Digital Report flows */
  @Column({ name: 'used_in_digital_report', type: 'boolean', default: false })
  usedInDigitalReport: boolean;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
