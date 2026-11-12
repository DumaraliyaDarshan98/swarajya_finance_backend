import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPhysicalVerificationVisits1741000000000 implements MigrationInterface {
  name = 'AddPhysicalVerificationVisits1741000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE physical_verifications
        ADD COLUMN IF NOT EXISTS priority varchar(20) NOT NULL DEFAULT 'MEDIUM'
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS physical_verification_visits (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        physical_verification_id uuid NOT NULL REFERENCES physical_verifications(id) ON DELETE CASCADE,
        address_type varchar(20) NOT NULL,
        address_snapshot json NOT NULL,
        status varchar(50) NOT NULL DEFAULT 'IN_PROGRESS',
        assigned_field_agent_user_id uuid NULL,
        assigned_field_agent_name varchar(255) NULL,
        assigned_at timestamp NULL,
        field_agent_submission json NULL,
        rejection_reason text NULL,
        admin_review_note text NULL,
        created_at timestamp NOT NULL DEFAULT now(),
        updated_at timestamp NOT NULL DEFAULT now()
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_physical_verification_visits_parent
        ON physical_verification_visits (physical_verification_id)
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS idx_physical_verification_visits_agent
        ON physical_verification_visits (assigned_field_agent_user_id)
    `);

    await queryRunner.query(`
      ALTER TABLE physical_logs
        ADD COLUMN IF NOT EXISTS physical_verification_visit_id uuid NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE physical_logs DROP COLUMN IF EXISTS physical_verification_visit_id
    `);
    await queryRunner.query(`DROP TABLE IF EXISTS physical_verification_visits`);
    await queryRunner.query(`
      ALTER TABLE physical_verifications DROP COLUMN IF EXISTS priority
    `);
  }
}
