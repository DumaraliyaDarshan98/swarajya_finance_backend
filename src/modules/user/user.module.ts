import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserDocumentsController } from './user-documents.controller';
import { SuperAdminSettingsModule } from '../super-admin-settings/super-admin-settings.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
    SuperAdminSettingsModule,
  ],
  providers: [UsersService],
  controllers: [UsersController, UserDocumentsController],
  exports: [UsersService],
})
export class UserModule {}
