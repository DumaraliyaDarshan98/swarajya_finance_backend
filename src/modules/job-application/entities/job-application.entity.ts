import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

export type JobApplicationStatus = 'NEW' | 'REVIEWED' | 'SHORTLISTED' | 'REJECTED';

@Entity('job_applications')
export class JobApplication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'full_name', type: 'varchar', length: 150 })
  fullName: string;

  @Index()
  @Column({ type: 'varchar', length: 180 })
  email: string;

  @Column({ name: 'mobile_number', type: 'varchar', length: 20 })
  mobileNumber: string;

  @Column({ type: 'varchar', length: 255 })
  skill: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  designation: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  department: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  location: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 12, nullable: true })
  pincode: string | null;

  @Column({ name: 'full_address', type: 'text', nullable: true })
  fullAddress: string | null;

  @Column({ name: 'about_yourself', type: 'text' })
  aboutYourself: string;

  @Column({ name: 'resume_stored_file_name', type: 'varchar', length: 255 })
  resumeStoredFileName: string;

  @Column({ name: 'resume_original_name', type: 'varchar', length: 255 })
  resumeOriginalName: string;

  @Column({ name: 'resume_mime_type', type: 'varchar', length: 120, nullable: true })
  resumeMimeType: string | null;

  @Column({ name: 'resume_size_bytes', type: 'int', nullable: true })
  resumeSizeBytes: number | null;

  @Column({ type: 'varchar', length: 30, default: 'NEW' })
  status: JobApplicationStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
