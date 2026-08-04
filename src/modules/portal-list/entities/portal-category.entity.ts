import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  OneToMany,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Portal } from './portal.entity';

@Entity('portal_categories')
export class PortalCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column({ name: 'category_key', type: 'varchar', length: 150 })
  key: string;

  @Column({ type: 'varchar', length: 200 })
  name: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Whether this category is used in Digital Report flows */
  @Column({ name: 'used_in_digital_report', type: 'boolean', default: false })
  usedInDigitalReport: boolean;

  @OneToMany(() => Portal, (portal) => portal.category)
  portals: Portal[];

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
