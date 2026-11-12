import { MigrationInterface, QueryRunner } from 'typeorm';
import { randomUUID } from 'crypto';

export class CreateDepartmentsAndDesignations1744000000000
  implements MigrationInterface
{
  name = 'CreateDepartmentsAndDesignations1744000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS departments (
        id char(36) NOT NULL,
        name varchar(150) NOT NULL,
        description varchar(255) NULL,
        is_active tinyint NOT NULL DEFAULT 1,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_departments_name (name),
        KEY idx_departments_is_active (is_active)
      )
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS designations (
        id char(36) NOT NULL,
        name varchar(150) NOT NULL,
        description varchar(255) NULL,
        is_active tinyint NOT NULL DEFAULT 1,
        created_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at timestamp NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (id),
        UNIQUE KEY uq_designations_name (name),
        KEY idx_designations_is_active (is_active)
      )
    `);

    const departments = [
      ['Operations', 'Field and operations teams'],
      ['Engineering', 'Software and product engineering'],
      ['Human Resources', 'People and recruitment'],
      ['Finance', 'Accounts and finance'],
      ['Sales', 'Business development and sales'],
      ['Compliance', 'Risk and compliance'],
    ] as const;

    for (const [name, description] of departments) {
      await queryRunner.query(
        `INSERT IGNORE INTO departments (id, name, description, is_active)
         VALUES (?, ?, ?, 1)`,
        [randomUUID(), name, description],
      );
    }

    const designations = [
      ['Field Executive', 'On-ground verification executive'],
      ['Field Agent', 'Field agent role'],
      ['Software Engineer', 'Backend / frontend engineer'],
      ['Senior Software Engineer', 'Senior engineering role'],
      ['Team Lead', 'Team leadership'],
      ['Operations Manager', 'Operations leadership'],
      ['HR Executive', 'HR operations'],
      ['Business Analyst', 'Analysis and reporting'],
    ] as const;

    for (const [name, description] of designations) {
      await queryRunner.query(
        `INSERT IGNORE INTO designations (id, name, description, is_active)
         VALUES (?, ?, ?, 1)`,
        [randomUUID(), name, description],
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS designations`);
    await queryRunner.query(`DROP TABLE IF EXISTS departments`);
  }
}
