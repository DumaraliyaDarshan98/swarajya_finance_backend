/**
 * Seed RCU categories, document types and triggers from static JSON.
 * Run from backend root: npm run seed:rcu-triggers
 *
 * Options:
 *   --force   Delete existing RCU data and re-seed from JSON
 *
 * Default behaviour: skip if any rcu_categories rows already exist.
 */

import { resolve, join } from 'path';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: resolve(__dirname, '../.env') });

import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { RcuCategory } from '../src/modules/rcu-triggers/entities/rcu-category.entity';
import { RcuDocumentType } from '../src/modules/rcu-triggers/entities/rcu-document-type.entity';
import { RcuTrigger } from '../src/modules/rcu-triggers/entities/rcu-trigger.entity';

interface SeedTrigger {
  id: string;
  text: string;
  risk: 'HIGH' | 'MEDIUM' | 'LOW';
  section?: string;
}

interface SeedDocumentType {
  key: string;
  label: string;
  sidebarLabel?: string;
  badge?: string;
  description?: string;
  icon?: string;
  note?: string;
  infoNote?: string;
  contentType?: 'triggers' | 'logic' | 'tax-slabs';
  triggers?: SeedTrigger[];
  logic?: Record<string, unknown>;
  taxSlabs?: Record<string, unknown>;
}

interface SeedCategory {
  key: string;
  label: string;
  documentTypes: SeedDocumentType[];
}

interface SeedFile {
  title: string;
  subtitle: string;
  badge: string;
  categories: SeedCategory[];
}

/** All seeded RCU document types / triggers default usedInOcr = false */

async function tableExists(ds: DataSource, table: string): Promise<boolean> {
  const rows: Array<{ cnt: number }> = await ds.query(
    `SELECT COUNT(*) AS cnt
     FROM information_schema.tables
     WHERE table_schema = DATABASE() AND table_name = ?`,
    [table],
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
    // Avoid sync on connect — dirty rows can block unique indexes.
    synchronize: false,
    logging: false,
    ssl:
      process.env.DB_SSL === 'false'
        ? undefined
        : {
            rejectUnauthorized: false,
          },
    entities: [RcuCategory, RcuDocumentType, RcuTrigger],
  };

  const dataSource = new DataSource(ormConfig);

  try {
    await dataSource.initialize();
    console.log('Database connected.');

    if (await tableExists(dataSource, 'rcu_categories')) {
      const [{ cnt }] = await dataSource.query(
        'SELECT COUNT(*) AS cnt FROM `rcu_categories`',
      );
      const existingCount = Number(cnt ?? 0);

      let corrupt = false;
      if (
        existingCount > 0 &&
        (await tableExists(dataSource, 'rcu_document_types'))
      ) {
        const hasDocKey = await dataSource.query(
          `SELECT COUNT(*) AS cnt FROM information_schema.columns
           WHERE table_schema = DATABASE()
             AND table_name = 'rcu_document_types'
             AND column_name = 'doc_key'`,
        );
        if (Number(hasDocKey?.[0]?.cnt ?? 0) === 0) {
          corrupt = true;
          console.log(
            'Detected legacy rcu_document_types without doc_key column — will re-seed.',
          );
        } else {
          const empty = await dataSource.query(
            "SELECT COUNT(*) AS cnt FROM `rcu_document_types` WHERE `doc_key` = '' OR `doc_key` IS NULL",
          );
          if (Number(empty?.[0]?.cnt ?? 0) > 0) {
            corrupt = true;
            console.log(
              'Detected document types with empty keys — will re-seed.',
            );
          }
        }
      }

      if (existingCount > 0 && !force && !corrupt) {
        console.log(
          `Found ${existingCount} RCU categor(ies). Skipping seed. Use --force to wipe and re-seed.`,
        );
        return;
      }
    }

    console.log(
      force
        ? '(--force) Recreating RCU tables…'
        : 'Preparing clean RCU tables…',
    );
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
    await dataSource.query('DROP TABLE IF EXISTS `rcu_triggers`');
    await dataSource.query('DROP TABLE IF EXISTS `rcu_document_types`');
    await dataSource.query('DROP TABLE IF EXISTS `rcu_categories`');
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
    await dataSource.synchronize();

    const categoryRepo = dataSource.getRepository(RcuCategory);
    const documentRepo = dataSource.getRepository(RcuDocumentType);
    const triggerRepo = dataSource.getRepository(RcuTrigger);

    const seedPath = join(
      __dirname,
      '../src/modules/rcu-triggers/seed/rcu-triggers.seed.json',
    );
    const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as SeedFile;

    let catCount = 0;
    let docCount = 0;
    let triggerCount = 0;

    for (let ci = 0; ci < seed.categories.length; ci++) {
      const cat = seed.categories[ci];
      const category = await categoryRepo.save(
        categoryRepo.create({
          key: cat.key,
          label: cat.label,
          sortOrder: ci,
          isActive: true,
          usedInOcr: false,
        }),
      );
      catCount += 1;

      for (let di = 0; di < (cat.documentTypes ?? []).length; di++) {
        const doc = cat.documentTypes[di];
        const documentType = await documentRepo.save(
          documentRepo.create({
            categoryId: category.id,
            key: doc.key,
            label: doc.label,
            sidebarLabel: doc.sidebarLabel ?? null,
            badge: doc.badge ?? null,
            description: doc.description ?? null,
            icon: doc.icon ?? null,
            note: doc.note ?? null,
            infoNote: doc.infoNote ?? null,
            contentType: doc.contentType ?? 'triggers',
            logic: doc.logic ?? null,
            taxSlabs: doc.taxSlabs ?? null,
            isActive: true,
            usedInOcr: false,
            sortOrder: di,
          }),
        );
        docCount += 1;

        const triggers = doc.triggers ?? [];
        for (let ti = 0; ti < triggers.length; ti++) {
          const t = triggers[ti];
          await triggerRepo.save(
            triggerRepo.create({
              documentTypeId: documentType.id,
              code: t.id,
              text: t.text,
              risk: t.risk,
              section: t.section ?? null,
              isActive: true,
              usedInOcr: false,
              sortOrder: ti,
            }),
          );
          triggerCount += 1;
        }
      }
    }

    console.log('RCU seed completed.');
    console.log(`  Categories     : ${catCount}`);
    console.log(`  Document types : ${docCount}`);
    console.log(`  Triggers       : ${triggerCount}`);
    console.log(`  Meta title     : ${seed.title}`);
  } catch (err) {
    console.error('RCU seed failed:', err);
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

run();
