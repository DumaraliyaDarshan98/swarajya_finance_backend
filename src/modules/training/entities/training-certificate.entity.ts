import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';
import { Training } from './training.entity';
import { UserTraining } from './user-training.entity';

@Entity('training_certificates')
export class TrainingCertificate {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ name: 'user_id', type: 'uuid' })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Index()
  @Column({ name: 'training_id', type: 'uuid' })
  trainingId: string;

  @ManyToOne(() => Training, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'training_id' })
  training: Training;

  @Column({ name: 'user_training_id', type: 'uuid', nullable: true })
  userTrainingId: string | null;

  @ManyToOne(() => UserTraining, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'user_training_id' })
  userTraining: UserTraining | null;

  @Index({ unique: true })
  @Column({ name: 'certificate_number', type: 'varchar', length: 80 })
  certificateNumber: string;

  @Column({ name: 'recipient_name', type: 'varchar', length: 200 })
  recipientName: string;

  @Column({ name: 'training_title', type: 'varchar', length: 200 })
  trainingTitle: string;

  @Column({ name: 'role', type: 'varchar', length: 30 })
  role: string;

  @Column({ name: 'issued_at', type: 'datetime' })
  issuedAt: Date;

  @Column({ name: 'valid_until', type: 'datetime', nullable: true })
  validUntil: Date | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}
