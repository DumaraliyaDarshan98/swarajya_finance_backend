import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Training } from './training.entity';

export interface TrainingQuestionOption {
  key: string;
  text: string;
}

@Entity('training_questions')
export class TrainingQuestion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'training_id', type: 'uuid' })
  trainingId: string;

  @ManyToOne(() => Training, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'training_id' })
  training?: Training;

  @Column({ name: 'question_text', type: 'text' })
  questionText: string;

  /** [{ key: 'A', text: '...' }, ...] */
  @Column({ type: 'json' })
  options: TrainingQuestionOption[];

  @Column({ name: 'correct_option_key', type: 'varchar', length: 20 })
  correctOptionKey: string;

  @Column({ name: 'sort_order', type: 'int', default: 0 })
  sortOrder: number;

  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive: boolean;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
