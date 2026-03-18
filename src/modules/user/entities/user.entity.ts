import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
} from 'typeorm';
import { Role } from '../../../enum/role.enum';
import { Client } from '../../client/entities/client.entity';
import { Role as RoleEntity } from '../../role/entities/role.entity';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  fullName: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ type: 'enum', enum: Role })
  role: Role;

  @ManyToOne(() => Client, (client) => client.users, { nullable: true })
  client: Client;

  @Column({ name: 'custom_role_id', type: 'uuid', nullable: true })
  customRoleId: string | null;

  @ManyToOne(() => RoleEntity, (r) => r.users, { nullable: true })
  customRole: RoleEntity | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  resetToken: string;

  @Column({ nullable: true, type: 'timestamp' })
  resetTokenExpiry: Date;

  // --- Internal Employee / Applicant Information ---
  @Column({
    name: 'employee_type',
    type: 'varchar',
    length: 100,
    nullable: true,
  })
  employeeType: string | null;

  @Column({
    name: 'mobile_number',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  mobileNumber: string | null;

  @Column({
    name: 'alternate_number',
    type: 'varchar',
    length: 20,
    nullable: true,
  })
  alternateNumber: string | null;

  @Column({ name: 'education_details', type: 'text', nullable: true })
  educationDetails: string | null;

  // --- Address Details ---
  @Column({
    name: 'flat_plot_no',
    type: 'varchar',
    length: 255,
    nullable: true,
  })
  flatPlotNo: string | null;

  @Column({
    name: 'address_line_1',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  addressLine1: string | null;

  @Column({
    name: 'address_line_2',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  addressLine2: string | null;

  @Column({ name: 'landmark', type: 'varchar', length: 255, nullable: true })
  landmark: string | null;

  @Column({ name: 'country', type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @Column({ name: 'state', type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ name: 'city', type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ name: 'pincode', type: 'varchar', length: 20, nullable: true })
  pincode: string | null;

  // --- Document URLs (uploaded files stored as URLs) ---
  @Column({ name: 'resume_url', type: 'varchar', length: 500, nullable: true })
  resumeUrl: string | null;

  @Column({ name: 'pan_url', type: 'varchar', length: 500, nullable: true })
  panUrl: string | null;

  @Column({
    name: 'address_proof_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  addressProofUrl: string | null;

  @Column({
    name: 'cancelled_cheque_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  cancelledChequeUrl: string | null;

  @Column({
    name: 'cancelled_cheque_url_2',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  cancelledChequeUrl2: string | null;

  @Column({
    name: 'offer_letter_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  offerLetterUrl: string | null;

  @Column({
    name: 'marksheet_12_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  marksheet12Url: string | null;

  @Column({
    name: 'graduation_marksheet_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  graduationMarksheetUrl: string | null;

  @Column({
    name: 'post_graduate_cert_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  postGraduateCertUrl: string | null;

  @Column({
    name: 'additional_cert_url',
    type: 'varchar',
    length: 500,
    nullable: true,
  })
  additionalCertUrl: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
