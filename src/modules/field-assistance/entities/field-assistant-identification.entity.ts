import { Entity, Column, PrimaryGeneratedColumn, ManyToOne, Index } from 'typeorm';
import { FieldAssistant } from './field-assistant.entity';

export type FieldAssistanceIdentificationType =
  | 'UAN'
  | 'Aadhar Card'
  | 'PAN Card'
  | 'DL'
  | 'PF Number';

@Entity('field_assistant_identifications')
export class FieldAssistantIdentification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  @Index()
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  @Index()
  updatedBy: string | null;

  @ManyToOne(() => FieldAssistant, (fa) => fa.identificationDetails, {
    onDelete: 'CASCADE',
  })
  fieldAssistant: FieldAssistant;

  @Column({ name: 'field_assistant_id', type: 'uuid' })
  @Index()
  fieldAssistantId: string;

  @Column({ name: 'identification_type', type: 'varchar', length: 20 })
  identificationType: FieldAssistanceIdentificationType;

  @Column({ name: 'identification_no', type: 'varchar', length: 100 })
  identificationNo: string;

  @Column({ name: 'upload_document', type: 'text', nullable: true })
  uploadDocument: string | null;
}

