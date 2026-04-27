import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  Index,
} from 'typeorm';
import { FieldAssistantAddress } from './field-assistant-address.entity';
import { FieldAssistantEmergencyContact } from './field-assistant-emergency-contact.entity';
import { FieldAssistantEducation } from './field-assistant-education.entity';
import { FieldAssistantBankAccount } from './field-assistant-bank-account.entity';
import { FieldAssistantFamilyMember } from './field-assistant-family-member.entity';
import { FieldAssistantIdentification } from './field-assistant-identification.entity';
import { FieldAssistantPreviousEmployment } from './field-assistant-previous-employment.entity';

export type FieldAssistanceStatus = 'Active' | 'Inactive';
export type FieldAssistanceGender = 'Male' | 'Female' | 'Other';
export type FieldAssistanceMaritalStatus =
  | 'Single'
  | 'Married'
  | 'Divorced'
  | 'Widowed';
export type FieldAssistancePreviousEmploymentType = 'Fresher' | 'Experience';

@Entity('field_assistants')
export class FieldAssistant {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  /**
   * Sequence number used to generate Field Agent ID.
   * NOTE: This is NOT auto-increment in MySQL because the table already has a UUID PK.
   * We generate this via a dedicated sequence table in the service.
   * Example: seq=3 -> fieldAgentId="SWFAID-003"
   */
  @Column({
    name: 'field_agent_seq',
    type: 'int',
    unique: true,
  })
  fieldAgentSeq: number;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  @Index()
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  @Index()
  updatedBy: string | null;

  // ===== Personal Details =====
  @Column({ name: 'first_name', type: 'varchar', length: 100 })
  firstName: string;

  @Column({ name: 'middle_name', type: 'varchar', length: 100, nullable: true })
  middleName: string | null;

  @Column({ name: 'last_name', type: 'varchar', length: 100 })
  lastName: string;

  @Column({ name: 'full_name', type: 'varchar', length: 255, nullable: true })
  @Index()
  fullName: string | null;

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth: string;

  @Column({ name: 'age', type: 'int', nullable: true })
  age: number | null;

  @Column({
    name: 'marital_status',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  maritalStatus: FieldAssistanceMaritalStatus | null;

  @Column({ name: 'marriage_date', type: 'date', nullable: true })
  marriageDate: string | null;

  @Column({ name: 'gender', type: 'varchar', length: 10 })
  gender: FieldAssistanceGender;

  @Column({ name: 'blood_group', type: 'varchar', length: 20, nullable: true })
  bloodGroup: string | null;

  @Column({ name: 'nationality', type: 'varchar', length: 50, nullable: true })
  nationality: string | null;

  // ===== Communication Details (denormalized for search/listing) =====
  @Column({ name: 'office_mobile', type: 'varchar', length: 20, nullable: true })
  @Index()
  officeMobile: string | null;

  @Column({ name: 'office_email_id', type: 'varchar', length: 255, nullable: true })
  @Index()
  officeEmailId: string | null;

  @Column({
    name: 'personal_mobile',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  @Index()
  personalMobile: string | null;

  @Column({
    name: 'personal_email_id',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  @Index()
  personalEmailId: string | null;

  /**
   * Field agent login email (used by the same /auth/login API).
   * Kept separate from office/personal emails to avoid ambiguity.
   */
  @Column({
    name: 'login_email',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  @Index({ unique: true })
  loginEmail: string | null;

  /**
   * Hashed password for field agent login (bcrypt).
   */
  @Column({ name: 'password', type: 'varchar', length: 255, nullable: true })
  password: string | null;

  // ===== Additional Fields =====
  @Column({
    name: 'part_time_or_full_time',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  partTimeOrFullTime: string | null;

  @Column({
    name: 'field_or_choice_department',
    type: 'varchar',
    length: 10,
    nullable: true,
  })
  fieldOrChoiceDepartment: string | null;

  // ===== Previous Employment =====
  @Column({
    name: 'previous_employment_type',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  previousEmploymentType: FieldAssistancePreviousEmploymentType | null;

  // ===== Document Upload Section (store URLs as JSON) =====
  @Column({ name: 'document_uploads', type: 'json', nullable: true })
  documentUploads: Record<string, any> | null;

  // ===== System fields =====
  @Column({ name: 'field_agent_id', type: 'varchar', length: 50, nullable: true })
  @Index({ unique: true })
  fieldAgentId: string | null;

  @Column({ name: 'status', type: 'varchar', length: 10, default: 'Active' })
  status: FieldAssistanceStatus;

  @Column({ name: 'assign_company_client', type: 'varchar', length: 50, nullable: true })
  assignCompanyClient: string | null;

  @Column({ name: 'reporting_manager', type: 'varchar', length: 50, nullable: true })
  reportingManager: string | null;

  @Column({ name: 'joining_date', type: 'date', nullable: true })
  joiningDate: string | null;

  @Column({ name: 'remarks', type: 'text', nullable: true })
  remarks: string | null;

  // ===== Relations (multiple records stored in separate tables) =====
  @OneToMany(() => FieldAssistantAddress, (x) => x.fieldAssistant, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  addresses: FieldAssistantAddress[];

  @OneToMany(() => FieldAssistantEmergencyContact, (x) => x.fieldAssistant, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  emergencyDetails: FieldAssistantEmergencyContact[];

  @OneToMany(() => FieldAssistantEducation, (x) => x.fieldAssistant, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  educationDetails: FieldAssistantEducation[];

  @OneToMany(() => FieldAssistantBankAccount, (x) => x.fieldAssistant, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  bankDetails: FieldAssistantBankAccount[];

  @OneToMany(() => FieldAssistantFamilyMember, (x) => x.fieldAssistant, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  familyDetails: FieldAssistantFamilyMember[];

  @OneToMany(() => FieldAssistantIdentification, (x) => x.fieldAssistant, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  identificationDetails: FieldAssistantIdentification[];

  @OneToMany(() => FieldAssistantPreviousEmployment, (x) => x.fieldAssistant, {
    cascade: true,
    orphanedRowAction: 'delete',
  })
  previousEmploymentDetails: FieldAssistantPreviousEmployment[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

