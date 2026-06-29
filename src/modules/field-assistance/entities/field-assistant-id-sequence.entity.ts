import { Entity, PrimaryGeneratedColumn, CreateDateColumn } from 'typeorm';

/**
 * Separate auto-increment sequence table for Field Agent IDs.
 * This avoids MySQL limitation: only one AUTO_INCREMENT column per table and it must be a key.
 */
@Entity('field_assistant_id_sequences')
export class FieldAssistantIdSequence {
  @PrimaryGeneratedColumn({ type: 'int' })
  id: number;

  @CreateDateColumn()
  createdAt: Date;
}

