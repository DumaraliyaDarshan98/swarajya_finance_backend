import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, Index } from 'typeorm';
import { FieldAssistant } from './field-assistant.entity';

@Entity('field_assistant_previous_employments')
export class FieldAssistantPreviousEmployment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  @Index()
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  @Index()
  updatedBy: string | null;

  @ManyToOne(() => FieldAssistant, (fa) => fa.previousEmploymentDetails, {
    onDelete: 'CASCADE',
  })
  fieldAssistant: FieldAssistant;

  @Column({ name: 'field_assistant_id', type: 'uuid' })
  @Index()
  fieldAssistantId: string;

  @Column({ name: 'organization', type: 'varchar', length: 255 })
  organization: string;

  @Column({ name: 'designation_or_role', type: 'varchar', length: 255 })
  designationOrRole: string;

  @Column({ name: 'part_or_full_time', type: 'varchar', length: 20, nullable: true })
  partOrFullTime: string | null;

  @Column({ name: 'from_date', type: 'date' })
  from: string;

  @Column({ name: 'to_date', type: 'date' })
  to: string;

  @Column({ name: 'total_work_experience_yrs', type: 'float', nullable: true })
  totalWorkExperienceYrs: number | null;

  @Column({ name: 'city', type: 'varchar', length: 100 })
  city: string;

  @Column({ name: 'country', type: 'varchar', length: 100 })
  country: string;

  @Column({ name: 'hr_mail_id', type: 'varchar', length: 255, nullable: true })
  hrMailId: string | null;

  @Column({ name: 'hr_contact_no', type: 'varchar', length: 20, nullable: true })
  hrContactNo: string | null;
}

