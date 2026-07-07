import { join } from 'path';
import { DataSource } from 'typeorm';
import { MysqlConnectionOptions } from 'typeorm/driver/mysql/MysqlConnectionOptions';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import * as dotenv from 'dotenv';

dotenv.config();

const ormDBconfig: MysqlConnectionOptions = {
  type: (process.env.DB_TYPE as 'mysql') ?? 'mysql',
  host: process.env.DB_HOST ?? 'localhost',
  port: Number(process.env.DB_PORT || 3306),
  username: process.env.DB_USERNAME ?? 'root',
  password: process.env.DB_PASSWORD ?? '',
  database: process.env.DB_NAME ?? 'swarajya_finance',
  connectorPackage: 'mysql2',
  namingStrategy: new SnakeNamingStrategy(),
  synchronize: process.env.DB_SYNCHRONIZE !== 'false',
  logging: process.env.DB_LOGGING === 'true',
};

const dbDataSource = new DataSource({
  ...ormDBconfig,
  entities: [join(__dirname, '../modules/**/entities/*.entity.{ts,js}')],
  migrations: [join(__dirname, 'migrations/*.{ts,js}')],
  migrationsTableName: 'migrations',
});

export default dbDataSource;
