import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhysicalVerificationCalls1742000000000 implements MigrationInterface {
  name = 'AddPhysicalVerificationCalls1742000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS physical_verification_calls (
        id char(36) NOT NULL,
        physical_verification_id char(36) NOT NULL,
        visit_id char(36) NULL,
        customer_mobile varchar(20) NOT NULL,
        call_sid varchar(100) NULL,
        call_type varchar(50) NOT NULL,
        status varchar(50) NOT NULL DEFAULT 'INITIATED',
        recording_url text NULL,
        recording_duration int NULL,
        start_time timestamp NULL,
        end_time timestamp NULL,
        provider_response json NULL,
        provider_request json NULL,
        created_by char(36) NULL,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        KEY idx_pvc_physical_verification_id (physical_verification_id),
        KEY idx_pvc_visit_id (visit_id),
        KEY idx_pvc_call_sid (call_sid),
        CONSTRAINT fk_pvc_physical_verification
          FOREIGN KEY (physical_verification_id)
          REFERENCES physical_verifications(id)
          ON DELETE CASCADE
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS physical_verification_calls`);
  }
}
