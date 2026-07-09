import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import type { TelephonyCallStatus, TelephonyCallType } from '../interfaces/telephony.interface';

@Entity('physical_verification_calls')
export class PhysicalVerificationCall {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'physical_verification_id', type: 'uuid' })
  @Index()
  physicalVerificationId: string;

  @Column({ name: 'visit_id', type: 'uuid', nullable: true })
  @Index()
  visitId: string | null;

  @Column({ name: 'customer_mobile', type: 'varchar', length: 20 })
  customerMobile: string;

  @Column({ name: 'call_sid', type: 'varchar', length: 100, nullable: true })
  @Index()
  callSid: string | null;

  @Column({ name: 'call_type', type: 'varchar', length: 50 })
  callType: TelephonyCallType;

  @Column({ type: 'varchar', length: 50, default: 'INITIATED' })
  status: TelephonyCallStatus;

  @Column({ name: 'recording_url', type: 'text', nullable: true })
  recordingUrl: string | null;

  @Column({ name: 'recording_duration', type: 'int', nullable: true })
  recordingDuration: number | null;

  @Column({ name: 'start_time', type: 'timestamp', nullable: true })
  startTime: Date | null;

  @Column({ name: 'end_time', type: 'timestamp', nullable: true })
  endTime: Date | null;

  @Column({ name: 'provider_response', type: 'json', nullable: true })
  providerResponse: Record<string, unknown> | null;

  @Column({ name: 'provider_request', type: 'json', nullable: true })
  providerRequest: Record<string, unknown> | null;

  @Column({ name: 'created_by', type: 'uuid', nullable: true })
  createdBy: string | null;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
