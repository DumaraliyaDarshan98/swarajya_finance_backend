/**
 * Seed Phase-1 forensic checks into forensic_checks.
 * Run from backend root: npm run seed:forensic-checks
 *
 * Options:
 *   --force   Drop table and re-seed from JSON
 *
 * Rebuilds automatically when schema is missing engine_key or uses legacy categories.
 */

import { resolve, join } from 'path';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: resolve(__dirname, '../.env') });

import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import {
  ForensicCategory,
  ForensicCheck,
  ForensicSeverity,
} from '../src/modules/forensic-checks/entities/forensic-check.entity';

interface SeedCheck {
  code: string;
  engineKey?: string;
  threatCode: string;
  category: ForensicCategory;
  title: string;
  description: string;
  severity: ForensicSeverity;
  score: number;
  documentTypePattern?: string;
  sortOrder?: number;
}

interface SeedFile {
  checks: SeedCheck[];
}

async function tableExists(ds: DataSource, table: string): Promise<boolean> {
  const rows: Array<{ cnt: number }> = await ds.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [table],
  );
  return Number(rows?.[0]?.cnt ?? 0) > 0;
}

async function hasColumn(
  ds: DataSource,
  table: string,
  column: string,
): Promise<boolean> {
  const rows: Array<{ cnt: number }> = await ds.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.columns
     WHERE table_schema = DATABASE()
       AND table_name = ?
       AND column_name = ?`,
    [table, column],
  );
  return Number(rows?.[0]?.cnt ?? 0) > 0;
}

async function run() {
  const force = process.argv.includes('--force');

  const ormConfig: any = {
    type: process.env.DB_TYPE || 'mysql',
    connectorPackage: 'mysql2',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'swarajya_finance',
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    logging: false,
    ssl:
      process.env.DB_SSL === 'false'
        ? undefined
        : {
            rejectUnauthorized: false,
          },
    entities: [ForensicCheck],
  };

  const dataSource = new DataSource(ormConfig);

  try {
    await dataSource.initialize();
    console.log('Database connected.');

    const exists = await tableExists(dataSource, 'forensic_checks');
    const idOk = exists ? await hasColumn(dataSource, 'forensic_checks', 'id') : false;
    const engineKeyOk = exists
      ? await hasColumn(dataSource, 'forensic_checks', 'engine_key')
      : false;

    let legacyCategories = false;
    let existingCount = 0;
    if (exists && idOk) {
      const [{ cnt }] = await dataSource.query(
        'SELECT COUNT(*) AS cnt FROM `forensic_checks`',
      );
      existingCount = Number(cnt ?? 0);
      if (existingCount > 0) {
        const [{ legacy }] = await dataSource.query(
          `SELECT COUNT(*) AS legacy FROM \`forensic_checks\`
           WHERE \`category\` NOT IN ('PDF','IMAGE','DOC','ZIP')`,
        );
        legacyCategories = Number(legacy ?? 0) > 0;
      }
    }

    const needsRebuild =
      force || !exists || !idOk || !engineKeyOk || legacyCategories;

    if (!needsRebuild && existingCount > 0) {
      console.log(
        `Found ${existingCount} forensic check(s). Skipping seed. Use --force to wipe and re-seed.`,
      );
      return;
    }

    if (legacyCategories) {
      console.log('Detected legacy forensic categories — rebuilding for PDF/IMAGE/DOC/ZIP…');
    } else if (!engineKeyOk && exists) {
      console.log('Detected missing engine_key column — rebuilding…');
    } else if (!idOk && exists) {
      console.log('Detected broken forensic_checks table — rebuilding…');
    } else if (force) {
      console.log('(--force) Recreating forensic_checks table…');
    } else {
      console.log('Creating forensic_checks table via TypeORM synchronize…');
    }

    await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
    await dataSource.query('DROP TABLE IF EXISTS `forensic_checks`');
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
    await dataSource.synchronize();

    const repo = dataSource.getRepository(ForensicCheck);
    const seedPath = join(
      __dirname,
      '../src/modules/forensic-checks/seed/forensic-checks.seed.json',
    );
    const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as SeedFile;

    const rows = (seed.checks ?? []).map((c, idx) => {
      const code = c.code.trim().toUpperCase();
      const engineKey = (c.engineKey || code).trim().toUpperCase();
      return repo.create({
        code,
        engineKey,
        threatCode: c.threatCode.trim().toUpperCase(),
        category: c.category,
        title: c.title,
        description: c.description,
        severity: c.severity,
        score: c.score ?? 0,
        documentTypePattern: c.documentTypePattern?.trim() || null,
        isActive: true,
        usedInOcr: true,
        isSystem: true,
        sortOrder: c.sortOrder ?? (idx + 1) * 10,
      });
    });

    await repo.save(rows);

    const byCat: Record<string, number> = {};
    for (const r of rows) {
      byCat[r.category] = (byCat[r.category] ?? 0) + 1;
    }
    console.log(`Seeded ${rows.length} forensic check(s):`, byCat);
  } catch (err) {
    console.error('Seed failed:', err);
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) await dataSource.destroy();
  }
}

run();
