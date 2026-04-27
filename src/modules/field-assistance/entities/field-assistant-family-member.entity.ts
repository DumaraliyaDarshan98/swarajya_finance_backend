import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, Index } from 'typeorm';
import { FieldAssistant } from './field-assistant.entity';

@Entity('field_assistant_family_members')
export class FieldAssistantFamilyMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  @Index()
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  @Index()
  updatedBy: string | null;

  @ManyToOne(() => FieldAssistant, (fa) => fa.familyDetails, { onDelete: 'CASCADE' })
  fieldAssistant: FieldAssistant;

  @Column({ name: 'field_assistant_id', type: 'uuid' })
  @Index()
  fieldAssistantId: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'relationship', type: 'varchar', length: 100 })
  relationship: string;

  @Column({ name: 'date_of_birth', type: 'date' })
  dateOfBirth: string;

  @Column({ name: 'email_id', type: 'varchar', length: 255, nullable: true })
  emailId: string | null;

  @Column({ name: 'gender', type: 'varchar', length: 10 })
  gender: string;

  @Column({ name: 'nationality', type: 'varchar', length: 50, nullable: true })
  nationality: string | null;

  @Column({ name: 'mobile', type: 'varchar', length: 20, nullable: true })
  mobile: string | null;
}

