import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MulterModule } from '@nestjs/platform-express';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { UserDocumentsController } from './user-documents.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([User]),
    MulterModule.register({ limits: { fileSize: 10 * 1024 * 1024 } }),
  ],
  providers: [UsersService],
  controllers: [UsersController, UserDocumentsController],
  exports: [UsersService],
})
export class UserModule {}
