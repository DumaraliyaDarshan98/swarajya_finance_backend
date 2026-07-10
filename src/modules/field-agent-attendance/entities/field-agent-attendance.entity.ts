import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';

export type AttendanceLocationType = 'RESIDENCE' | 'OFFICE' | 'CURRENT_LOCATION';
export type AttendanceStatus = 'Present' | 'Absent' | 'Half Day';

@Entity('field_agent_attendance')
@Unique('UQ_field_agent_attendance_user_date', ['fieldAgentUserId', 'attendanceDate'])
export class FieldAgentAttendance {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ name: 'field_agent_user_id', type: 'uuid' })
  @Index()
  fieldAgentUserId: string;

  @Column({ name: 'field_assistant_id', type: 'uuid', nullable: true })
  @Index()
  fieldAssistantId: string | null;

  @Column({ name: 'field_agent_code', type: 'varchar', length: 50, nullable: true })
  fieldAgentCode: string | null;

  @Column({ name: 'field_agent_name', type: 'varchar', length: 255, nullable: true })
  fieldAgentName: string | null;

  /** Calendar date of attendance (YYYY-MM-DD) */
  @Column({ name: 'attendance_date', type: 'date' })
  @Index()
  attendanceDate: string;

  @Column({ name: 'location_type', type: 'varchar', length: 30 })
  locationType: AttendanceLocationType;

  @Column({ name: 'location_label', type: 'varchar', length: 500, nullable: true })
  locationLabel: string | null;

  @Column({ name: 'latitude', type: 'decimal', precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @Column({ name: 'longitude', type: 'decimal', precision: 10, scale: 7, nullable: true })
  longitude: string | null;

  @Column({ name: 'selfie_url', type: 'varchar', length: 500 })
  selfieUrl: string;

  @Column({ name: 'selfie_file_name', type: 'varchar', length: 255, nullable: true })
  selfieFileName: string | null;

  @Column({ name: 'check_in_at', type: 'datetime' })
  checkInAt: Date;

  @Column({ name: 'check_out_at', type: 'datetime', nullable: true })
  checkOutAt: Date | null;

  @Column({ name: 'check_out_latitude', type: 'decimal', precision: 10, scale: 7, nullable: true })
  checkOutLatitude: string | null;

  @Column({ name: 'check_out_longitude', type: 'decimal', precision: 10, scale: 7, nullable: true })
  checkOutLongitude: string | null;

  @Column({ name: 'check_out_location_label', type: 'varchar', length: 500, nullable: true })
  checkOutLocationLabel: string | null;

  @Column({ name: 'status', type: 'varchar', length: 20, default: 'Present' })
  status: AttendanceStatus;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;
}
