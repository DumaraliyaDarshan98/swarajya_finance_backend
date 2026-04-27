import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  Index,
} from 'typeorm';
import { FieldAssistant } from './field-assistant.entity';

export type FieldAssistanceAddressType = 'Present' | 'Permanent' | 'Work';

@Entity('field_assistant_addresses')
export class FieldAssistantAddress {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  @Index()
  createdBy: string | null;

  @Column({ name: 'updated_by', type: 'uuid', nullable: true })
  @Index()
  updatedBy: string | null;

  @ManyToOne(() => FieldAssistant, (fa) => fa.addresses, { onDelete: 'CASCADE' })
  fieldAssistant: FieldAssistant;

  @Column({ name: 'field_assistant_id', type: 'uuid' })
  @Index()
  fieldAssistantId: string;

  @Column({ name: 'address_type', type: 'varchar', length: 20 })
  addressType: FieldAssistanceAddressType;

  @Column({ name: 'complete_address', type: 'text' })
  completeAddress: string;

  @Column({ name: 'landmark', type: 'varchar', length: 255, nullable: true })
  landmark: string | null;

  @Column({ name: 'city', type: 'varchar', length: 100 })
  city: string;

  @Column({ name: 'state', type: 'varchar', length: 100 })
  state: string;

  @Column({ name: 'country', type: 'varchar', length: 100 })
  country: string;

  @Column({ name: 'postal_code', type: 'varchar', length: 20 })
  postalCode: string;
}

