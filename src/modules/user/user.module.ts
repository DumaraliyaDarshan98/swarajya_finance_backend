import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { User } from './entities/user.entity';
import { Role } from '../role/entities/role.entity';
import { Client } from '../client/entities/client.entity';
import { UsersService } from './services/users.service';
import { UsersController } from './controllers/users.controller';
import { UserDocumentsController } from './controllers/user-documents.controller';
import { UserRepository } from './repositories/user.repository';
import { SuperAdminSettingsModule } from '../super-admin-settings/super-admin-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Role, Client]),
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
    SuperAdminSettingsModule,
  ],
  providers: [UsersService, UserRepository],
  controllers: [UsersController, UserDocumentsController],
  exports: [UsersService, UserRepository],
})
export class UserModule {}
