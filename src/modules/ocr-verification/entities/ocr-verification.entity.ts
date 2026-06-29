import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';
import { Client } from '../../client/entities/client.entity';
import type {
  OcrDocumentsPayload,
  OcrVerificationStatus,
} from '../interfaces/ocr-documents-payload.interface';

@Entity('ocr_verifications')
export class OcrVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Client, { nullable: false })
  client: Client;

  @Column({ name: 'client_id', type: 'uuid' })
  @Index()
  clientId: string;

  @Column({ name: 'documents_payload', type: 'json', nullable: true })
  documentsPayload: OcrDocumentsPayload | null;

  @Column({ type: 'varchar', length: 50, default: 'DRAFT' })
  status: OcrVerificationStatus;

  @Column({ name: 'report_generated_at', type: 'timestamp', nullable: true })
  reportGeneratedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
