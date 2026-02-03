/**
 * Script to create the default super admin user.
 * Run from backend root: npm run create-super-admin
 *
 * Credentials:
 *   Email: superadmin@gmail.com
 *   Password: Test@123
 */

import { resolve, join } from 'path';
import * as dotenv from 'dotenv';

// Load .env from backend root
dotenv.config({ path: resolve(__dirname, '../.env') });

import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { User } from '../src/modules/user/entities/user.entity';
import { Role } from '../src/enum/role.enum';

const SUPER_ADMIN_EMAIL = 'superadmin@gmail.com';
const SUPER_ADMIN_PASSWORD = 'Test@123';
const SUPER_ADMIN_FULL_NAME = 'Super Admin';

async function run() {
  const ormConfig: any = {
    type: process.env.DB_TYPE || 'mysql',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    username: process.env.DB_USERNAME || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'swarajya_finance',
    namingStrategy: new SnakeNamingStrategy(),
    synchronize: false,
    logging: false,
    entities: [join(__dirname, '../src/modules/**/entities/*.entity.{ts,js}')],
  };

  const dataSource = new DataSource(ormConfig);

  try {
    await dataSource.initialize();
    console.log('Database connected.');

    const userRepo = dataSource.getRepository(User);

    const existing = await userRepo.findOne({
      where: { email: SUPER_ADMIN_EMAIL },
    });

    const hashedPassword = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);

    if (existing) {
      await userRepo.update(
        { id: existing.id },
        {
          fullName: SUPER_ADMIN_FULL_NAME,
          password: hashedPassword,
          role: Role.SUPER_ADMIN,
        },
      );
      console.log('Super admin already existed. Password and name updated.');
    } else {
      await userRepo.insert({
        fullName: SUPER_ADMIN_FULL_NAME,
        email: SUPER_ADMIN_EMAIL,
        password: hashedPassword,
        role: Role.SUPER_ADMIN,
      });
      console.log('Super admin created successfully.');
    }

    console.log('');
    console.log('  Email:    ' + SUPER_ADMIN_EMAIL);
    console.log('  Password: ' + SUPER_ADMIN_PASSWORD);
    console.log('');
  } catch (err: any) {
    console.error('Error:', err?.message || err);
    process.exit(1);
  } finally {
    await dataSource.destroy();
    process.exit(0);
  }
}

run();
