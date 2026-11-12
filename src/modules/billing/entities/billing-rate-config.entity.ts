import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

@Entity('billing_rate_configs')
export class BillingRateConfig {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /** Charge per successfully OCR'd document */
  @Column({
    name: 'ocr_document_charge',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  ocrDocumentCharge: number;

  /** Charge per successfully scraped public site */
  @Column({
    name: 'scrape_site_charge',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  scrapeSiteCharge: number;

  @Column({
    name: 'server_cost_per_document',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  serverCostPerDocument: number;

  @Column({
    name: 'server_cost_per_scrape',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  serverCostPerScrape: number;

  @Column({
    name: 'triangulation_cost',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  triangulationCost: number;

  @Column({
    name: 'physical_verification_cost',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  physicalVerificationCost: number;

  @Column({
    name: 'monthly_sms_cost',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  monthlySmsCost: number;

  @Column({
    name: 'monthly_email_cost',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  monthlyEmailCost: number;

  @Column({
    name: 'monthly_other_cost',
    type: 'decimal',
    precision: 12,
    scale: 2,
    default: 0,
  })
  monthlyOtherCost: number;

  @Column({ type: 'varchar', length: 8, default: 'INR' })
  currency: string;

  @Column({ name: 'updated_by', type: 'varchar', length: 36, nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
