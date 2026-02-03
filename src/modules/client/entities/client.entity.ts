import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  OneToMany,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from '../../user/entities/user.entity';

@Entity('clients')
export class Client {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  // Legacy / backward compatibility (used by mail & user creation)
  @Column()
  companyName: string;

  @Column({ unique: true })
  email: string;

  @Column()
  contactPerson: string;

  @Column()
  phone: string;

  // --- Vendor Information (form) ---
  @Column({ name: 'bank_vendor_type', nullable: true })
  bankVendorType: string;

  @Column({ name: 'bank_vendor_name', nullable: true })
  bankVendorName: string;

  @Column({ name: 'mobile_number', nullable: true })
  mobileNumber: string;

  @Column({ name: 'nature_of_services', nullable: true })
  natureOfServices: string;

  // --- Communication Details ---
  @Column({ type: 'text', nullable: true })
  address: string;

  @Column({ name: 'pin_code', nullable: true })
  pinCode: string;

  @Column({ default: 'India' })
  country: string;

  @Column({ nullable: true })
  state: string;

  @Column({ nullable: true })
  city: string;

  // --- Bank Details ---
  @Column({ name: 'bank_name', nullable: true })
  bankName: string;

  @Column({ name: 'account_holder_name', nullable: true })
  accountHolderName: string;

  @Column({ name: 'account_number', nullable: true })
  accountNumber: string;

  @Column({ name: 'ifsc_code', nullable: true })
  ifscCode: string;

  @Column({ name: 'branch_name', nullable: true })
  branchName: string;

  // --- Document URLs (upload references) ---
  @Column({ name: 'pan_number', nullable: true })
  panNumber: string;

  @Column({ name: 'pan_document_url', nullable: true })
  panDocumentUrl: string;

  @Column({ name: 'gst_number', nullable: true })
  gstNumber: string;

  @Column({ name: 'gst_document_url', nullable: true })
  gstDocumentUrl: string;

  @Column({ name: 'address_proof_url', nullable: true })
  addressProofUrl: string;

  @Column({ name: 'cancelled_cheque_url', nullable: true })
  cancelledChequeUrl: string;

  @Column({ name: 'tax_approval_url', nullable: true })
  taxApprovalUrl: string;

  @Column({ name: 'agreement_document_url', nullable: true })
  agreementDocumentUrl: string;

  @Column({ name: 'attachment1_url', nullable: true })
  attachment1Url: string;

  @Column({ name: 'attachment2_url', nullable: true })
  attachment2Url: string;

  @Column({ name: 'dsa_training_acknowledge_url', nullable: true })
  dsaTrainingAcknowledgeUrl: string;

  @Column({ name: 'approved_attachment_url', nullable: true })
  approvedAttachmentUrl: string;

  @Column({ name: 'due_diligence_document_url', nullable: true })
  dueDiligenceDocumentUrl: string;

  @OneToMany(() => User, (user) => user.client)
  users: User[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
