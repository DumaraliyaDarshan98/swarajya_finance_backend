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
  DigitalVerificationStatus,
  ScrapePayload,
} from '../interfaces/scrape-payload.interface';

@Entity('digital_verifications')
export class DigitalVerification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Client, { nullable: false })
  client: Client;

  @Column({ name: 'client_id', type: 'uuid' })
  @Index()
  clientId: string;

  @Column({ name: 'loan_application_no', type: 'varchar', length: 100, nullable: true })
  loanApplicationNo: string | null;

  @Column({ name: 'loan_type', type: 'varchar', length: 100, nullable: true })
  loanType: string | null;

  @Column({ name: 'applicant_name', type: 'varchar', length: 255, nullable: true })
  applicantName: string | null;

  @Column({ name: 'mobile_number', type: 'varchar', length: 20, nullable: true })
  mobileNumber: string | null;

  @Column({ name: 'email_id', type: 'varchar', length: 255, nullable: true })
  emailId: string | null;

  @Column({ name: 'pan_number', type: 'varchar', length: 50, nullable: true })
  @Index()
  panNumber: string | null;

  @Column({ name: 'aadhaar_number', type: 'varchar', length: 20, nullable: true })
  aadhaarNumber: string | null;

  @Column({ name: 'residential_address', type: 'text', nullable: true })
  residentialAddress: string | null;

  @Column({ name: 'residential_landmark', type: 'varchar', length: 255, nullable: true })
  residentialLandmark: string | null;

  @Column({ name: 'residential_state', type: 'varchar', length: 100, nullable: true })
  residentialState: string | null;

  @Column({ name: 'residential_city', type: 'varchar', length: 100, nullable: true })
  residentialCity: string | null;

  @Column({ name: 'residential_pincode', type: 'varchar', length: 10, nullable: true })
  residentialPincode: string | null;

  @Column({ name: 'has_office_address', type: 'boolean', default: false })
  hasOfficeAddress: boolean;

  @Column({ name: 'has_business_address', type: 'boolean', default: false })
  hasBusinessAddress: boolean;

  @Column({ name: 'company_name', type: 'varchar', length: 255, nullable: true })
  companyName: string | null;

  @Column({ name: 'company_domain', type: 'varchar', length: 255, nullable: true })
  companyDomain: string | null;

  @Column({ name: 'gst_number', type: 'varchar', length: 20, nullable: true })
  gstNumber: string | null;

  @Column({ name: 'business_pan', type: 'varchar', length: 20, nullable: true })
  businessPan: string | null;

  @Column({ name: 'cin_number', type: 'varchar', length: 30, nullable: true })
  cinNumber: string | null;

  @Column({ name: 'business_type', type: 'varchar', length: 100, nullable: true })
  businessType: string | null;

  @Column({ name: 'office_address', type: 'text', nullable: true })
  officeAddress: string | null;

  @Column({ name: 'office_landmark', type: 'varchar', length: 255, nullable: true })
  officeLandmark: string | null;

  @Column({ name: 'office_state', type: 'varchar', length: 100, nullable: true })
  officeState: string | null;

  @Column({ name: 'office_city', type: 'varchar', length: 100, nullable: true })
  officeCity: string | null;

  @Column({ name: 'office_pincode', type: 'varchar', length: 10, nullable: true })
  officePincode: string | null;

  @Column({ name: 'scrape_payload', type: 'json', nullable: true })
  scrapePayload: ScrapePayload | null;

  @Column({ type: 'varchar', length: 50, default: 'DRAFT' })
  status: DigitalVerificationStatus;

  @Column({ name: 'report_generated_at', type: 'timestamp', nullable: true })
  reportGeneratedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
