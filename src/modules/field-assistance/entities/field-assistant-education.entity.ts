import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, Index } from 'typeorm';
import { FieldAssistant } from './field-assistant.entity';

@Entity('field_assistant_education_details')
export class FieldAssistantEducation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  @Index()
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  @Index()
  updatedBy: string | null;

  @ManyToOne(() => FieldAssistant, (fa) => fa.educationDetails, {
    onDelete: 'CASCADE',
  })
  fieldAssistant: FieldAssistant;

  @Column({ name: 'field_assistant_id', type: 'uuid' })
  @Index()
  fieldAssistantId: string;

  @Column({ name: 'education_category', type: 'varchar', length: 100 })
  educationCategory: string;

  @Column({ name: 'education_type', type: 'varchar', length: 100 })
  educationType: string;

  @Column({ name: 'specialization', type: 'varchar', length: 255, nullable: true })
  specialization: string | null;

  @Column({ name: 'institute', type: 'varchar', length: 255 })
  institute: string;

  @Column({ name: 'country', type: 'varchar', length: 100, nullable: true })
  country: string | null;

  @Column({ name: 'from_date', type: 'date' })
  from: string;

  @Column({ name: 'to_date', type: 'date' })
  to: string;

  @Column({ name: 'part_or_full_time', type: 'varchar', length: 20, nullable: true })
  partOrFullTime: string | null;
}

