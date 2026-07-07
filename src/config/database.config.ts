import { registerAs } from '@nestjs/config';
import { join } from 'path';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';

export default registerAs('database', () => ({
  type: process.env.DB_TYPE ?? 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '3306', 10),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'swarajya_finance',
  connectorPackage: 'mysql2' as const,
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: process.env.DB_SYNCHRONIZE !== 'false',
  logging: process.env.DB_LOGGING === 'true',
  entities: [join(__dirname, '../modules/**/entities/*.entity.{ts,js}')],
  migrations: [join(__dirname, '../database/migrations/*.{ts,js}')],
  migrationsTableName: 'migrations',
}));
