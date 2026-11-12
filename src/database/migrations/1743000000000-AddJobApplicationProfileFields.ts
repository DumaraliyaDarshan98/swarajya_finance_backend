import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddJobApplicationProfileFields1743000000000
  implements MigrationInterface
{
  name = 'AddJobApplicationProfileFields1743000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE job_applications
        ADD COLUMN designation varchar(150) NULL,
        ADD COLUMN department varchar(150) NULL,
        ADD COLUMN location varchar(150) NULL,
        ADD COLUMN city varchar(100) NULL,
        ADD COLUMN state varchar(100) NULL,
        ADD COLUMN pincode varchar(12) NULL,
        ADD COLUMN full_address text NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE job_applications
        DROP COLUMN designation,
        DROP COLUMN department,
        DROP COLUMN location,
        DROP COLUMN city,
        DROP COLUMN state,
        DROP COLUMN pincode,
        DROP COLUMN full_address
    `);
  }
}
