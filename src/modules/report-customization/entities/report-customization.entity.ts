import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type ReportCustomizationType =
  | 'DIGITAL'
  | 'OCR'
  | 'TRIANGULATION'
  | 'PHYSICAL';

export type ReportCustomizationStatus = 'Active' | 'Inactive';

export interface ReportTemplateField {
  key: string;
  label: string;
  visible: boolean;
}

export interface ReportTemplateSection {
  key: string;
  label: string;
  visible: boolean;
  order: number;
  fields?: ReportTemplateField[];
}

@Entity('report_customizations')
export class ReportCustomization {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'name', type: 'varchar', length: 150 })
  name: string;

  @Column({ name: 'report_type', type: 'varchar', length: 30 })
  @Index()
  reportType: ReportCustomizationType;

  /** Required when reportType = PHYSICAL (PD, FI, RCU, …). Null for other types. */
  @Column({ name: 'physical_sub_type', type: 'varchar', length: 50, nullable: true })
  @Index()
  physicalSubType: string | null;

  @Column({ name: 'title', type: 'varchar', length: 255 })
  title: string;

  @Column({ name: 'sections', type: 'json' })
  sections: ReportTemplateSection[];

  @Column({ name: 'status', type: 'varchar', length: 12, default: 'Inactive' })
  @Index()
  status: ReportCustomizationStatus;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  updatedBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
