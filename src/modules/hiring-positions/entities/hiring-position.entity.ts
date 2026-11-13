import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Department } from '../../departments/entities/department.entity';
import { Designation } from '../../designations/entities/designation.entity';

@Entity('hiring_positions')
export class HiringPosition {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Display title of the open role, e.g. "Field Verification Executive – Pune" */
  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'department_id', type: 'char', length: 36, nullable: true })
  departmentId: string | null;

  @ManyToOne(() => Department, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'department_id' })
  department: Department | null;

  @Column({ name: 'designation_id', type: 'char', length: 36, nullable: true })
  designationId: string | null;

  @ManyToOne(() => Designation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'designation_id' })
  designation: Designation | null;

  /** Snapshot names for stable public/career display */
  @Column({ name: 'department_name', type: 'varchar', length: 150 })
  departmentName: string;

  @Column({ name: 'designation_name', type: 'varchar', length: 150 })
  designationName: string;

  @Column({ type: 'varchar', length: 500, nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
