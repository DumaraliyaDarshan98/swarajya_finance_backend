import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddDigitalVerificationBusinessFields1739000000000 implements MigrationInterface {
  name = 'AddDigitalVerificationBusinessFields1739000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE digital_verifications
        ADD COLUMN IF NOT EXISTS has_business_address boolean NOT NULL DEFAULT false,
        ADD COLUMN IF NOT EXISTS company_domain varchar(255) NULL,
        ADD COLUMN IF NOT EXISTS business_pan varchar(20) NULL,
        ADD COLUMN IF NOT EXISTS cin_number varchar(30) NULL,
        ADD COLUMN IF NOT EXISTS business_type varchar(100) NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE digital_verifications
        DROP COLUMN IF EXISTS business_type,
        DROP COLUMN IF EXISTS cin_number,
        DROP COLUMN IF EXISTS business_pan,
        DROP COLUMN IF EXISTS company_domain,
        DROP COLUMN IF EXISTS has_business_address
    `);
  }
}
