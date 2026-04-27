import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { PhysicalVerificationRequest } from './physical-verification-request.entity';

@Entity('physical_verification_selfies')
export class PhysicalVerificationSelfie {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => PhysicalVerificationRequest, { nullable: false })
  request: PhysicalVerificationRequest;

  @Column({ name: 'request_id', type: 'uuid' })
  @Index()
  requestId: string;

  @Column({ name: 'url', type: 'varchar', length: 500 })
  url: string;

  @Column({ name: 'file_name', type: 'varchar', length: 255, nullable: true })
  fileName: string | null;

  @Column({ name: 'mime', type: 'varchar', length: 100, nullable: true })
  mime: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;
}

