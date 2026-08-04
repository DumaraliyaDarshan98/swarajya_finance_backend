/**
 * Seed portal categories and portals from static SCRAP_DATA JSON.
 * Run from backend root: npm run seed:portal-list
 *
 * Options:
 *   --force   Wipe existing portal data and re-seed
 */

import { resolve, join } from 'path';
import { readFileSync } from 'fs';
import * as dotenv from 'dotenv';

dotenv.config({ path: resolve(__dirname, '../.env') });

import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { PortalCategory } from '../src/modules/portal-list/entities/portal-category.entity';
import { Portal } from '../src/modules/portal-list/entities/portal.entity';

interface SeedPortal {
  title: string;
  state: string;
  category: string;
  url: string;
}

interface SeedSection {
  category: string;
  portalCount?: number;
  portals: SeedPortal[];
}

function slugify(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 140);
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

async function run() {
  const force = process.argv.includes('--force');

  const dataSource = new DataSource({
    type: (process.env.DB_TYPE as any) || 'mysql',
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
        : { rejectUnauthorized: false },
    entities: [PortalCategory, Portal],
  } as any);

  try {
    await dataSource.initialize();
    console.log('Database connected.');

    if (await tableExists(dataSource, 'portal_categories')) {
      const [{ cnt }] = await dataSource.query(
        'SELECT COUNT(*) AS cnt FROM `portal_categories`',
      );
      const existingCount = Number(cnt ?? 0);
      if (existingCount > 0 && !force) {
        console.log(
          `Found ${existingCount} portal categor(ies). Skipping seed. Use --force to wipe and re-seed.`,
        );
        return;
      }
    }

    console.log(
      force
        ? '(--force) Recreating portal tables…'
        : 'Preparing clean portal tables…',
    );
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 0');
    await dataSource.query('DROP TABLE IF EXISTS `portals`');
    await dataSource.query('DROP TABLE IF EXISTS `portal_categories`');
    await dataSource.query('SET FOREIGN_KEY_CHECKS = 1');
    await dataSource.synchronize();

    const categoryRepo = dataSource.getRepository(PortalCategory);
    const portalRepo = dataSource.getRepository(Portal);

    const seedPath = join(
      __dirname,
      '../src/modules/portal-list/seed/portal-list.seed.json',
    );
    const seed = JSON.parse(readFileSync(seedPath, 'utf8')) as SeedSection[];

    let catCount = 0;
    let portalCount = 0;

    for (let ci = 0; ci < seed.length; ci++) {
      const section = seed[ci];
      const category = await categoryRepo.save(
        categoryRepo.create({
          key: slugify(section.category),
          name: section.category,
          sortOrder: ci,
          isActive: true,
          usedInDigitalReport: false,
        }),
      );
      catCount += 1;

      for (let pi = 0; pi < (section.portals ?? []).length; pi++) {
        const p = section.portals[pi];
        await portalRepo.save(
          portalRepo.create({
            categoryId: category.id,
            title: p.title,
            state: p.state,
            url: p.url,
            isActive: true,
            sortOrder: pi,
            usedInDigitalReport: false,
          }),
        );
        portalCount += 1;
      }
    }

    console.log('Portal list seed completed.');
    console.log(`  Categories : ${catCount}`);
    console.log(`  Portals    : ${portalCount}`);
  } catch (err) {
    console.error('Portal list seed failed:', err);
    process.exitCode = 1;
  } finally {
    if (dataSource.isInitialized) {
      await dataSource.destroy();
    }
  }
}

run();
