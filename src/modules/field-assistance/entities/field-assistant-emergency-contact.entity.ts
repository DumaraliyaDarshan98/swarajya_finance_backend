import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, Index } from 'typeorm';
import { FieldAssistant } from './field-assistant.entity';

@Entity('field_assistant_emergency_contacts')
export class FieldAssistantEmergencyContact {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  @Index()
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  @Index()
  updatedBy: string | null;

  @ManyToOne(() => FieldAssistant, (fa) => fa.emergencyDetails, {
    onDelete: 'CASCADE',
  })
  fieldAssistant: FieldAssistant;

  @Column({ name: 'field_assistant_id', type: 'uuid' })
  @Index()
  fieldAssistantId: string;

  @Column({ name: 'name', type: 'varchar', length: 255 })
  name: string;

  @Column({ name: 'relationship', type: 'varchar', length: 100 })
  relationship: string;

  @Column({ name: 'landline', type: 'varchar', length: 20, nullable: true })
  landline: string | null;

  @Column({ name: 'mobile', type: 'varchar', length: 20 })
  mobile: string;
}

