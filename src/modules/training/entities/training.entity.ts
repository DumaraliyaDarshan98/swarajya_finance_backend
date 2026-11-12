import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type TrainingTargetRole = 'FIELD_AGENT' | 'CLIENT_ADMIN';

@Entity('trainings')
export class Training {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'varchar', length: 30 })
  role: TrainingTargetRole;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({ name: 'video_url', type: 'varchar', length: 1000 })
  videoUrl: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  /** Play order within a role (lower = earlier). */
  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  /**
   * Exam thresholds (percentage 0–100).
   * Pass: score >= passingMarks
   * Average: averagePassingMarks <= score < passingMarks
   * Fail: score < failMarks (typically failMarks === averagePassingMarks)
   */
  @Column({
    name: 'passing_marks',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 70,
  })
  passingMarks: number;

  @Column({
    name: 'average_passing_marks',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 50,
  })
  averagePassingMarks: number;

  @Column({
    name: 'fail_marks',
    type: 'decimal',
    precision: 5,
    scale: 2,
    default: 50,
  })
  failMarks: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
