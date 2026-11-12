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
import type { ScrapePayload } from '../../digital-verification/interfaces/scrape-payload.interface';
import type { ScrapeInput } from '../../verification-enrichment/interfaces/scrape-input.interface';

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

  /** Public-site scrapes driven by OCR-extracted fields (GST / WHOIS / address / portals). */
  @Column({ name: 'scrape_payload', type: 'json', nullable: true })
  scrapePayload: ScrapePayload | null;

  /** Normalized identity fields derived from OCR before scraping. */
  @Column({ name: 'derived_scrape_input', type: 'json', nullable: true })
  derivedScrapeInput: ScrapeInput | null;

  @Column({ type: 'varchar', length: 50, default: 'DRAFT' })
  status: OcrVerificationStatus;

  @Column({ name: 'progress_message', type: 'varchar', length: 500, nullable: true })
  progressMessage: string | null;

  @Column({ name: 'report_generated_at', type: 'timestamp', nullable: true })
  reportGeneratedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
