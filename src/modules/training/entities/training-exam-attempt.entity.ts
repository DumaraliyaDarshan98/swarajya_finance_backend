import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Training } from './training.entity';

export type TrainingExamResultBand = 'PASS' | 'AVERAGE' | 'FAIL';

export interface TrainingExamAnswerRow {
  questionId: string;
  selectedOptionKey: string;
  isCorrect: boolean;
}

@Entity('training_exam_attempts')
export class TrainingExamAttempt {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @Index()
  @Column({ name: 'training_id', type: 'uuid' })
  trainingId: string;

  @ManyToOne(() => Training, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'training_id' })
  training?: Training;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  score: number;

  @Column({ type: 'varchar', length: 20 })
  result: TrainingExamResultBand;

  /** True when result is PASS or AVERAGE (unlocks lesson completion). */
  @Column({ name: 'is_passed', type: 'boolean', default: false })
  isPassed: boolean;

  @Column({ type: 'int', default: 0 })
  totalQuestions: number;

  @Column({ type: 'int', default: 0 })
  correctAnswers: number;

  @Column({ type: 'json', nullable: true })
  answers: TrainingExamAnswerRow[] | null;

  @Column({ name: 'passing_marks', type: 'decimal', precision: 5, scale: 2, default: 70 })
  passingMarks: number;

  @Column({ name: 'average_passing_marks', type: 'decimal', precision: 5, scale: 2, default: 50 })
  averagePassingMarks: number;

  @Column({ name: 'fail_marks', type: 'decimal', precision: 5, scale: 2, default: 50 })
  failMarks: number;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
