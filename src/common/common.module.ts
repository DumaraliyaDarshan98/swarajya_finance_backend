import { Global, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../modules/user/entities/user.entity';
import { PermissionsService } from './services/permissions.service';
import { PermissionsGuard } from './guards/permissions.guard';
import { StorageService } from './storage/storage.service';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [PermissionsService, PermissionsGuard, StorageService],
  exports: [
    PermissionsService,
    PermissionsGuard,
    StorageService,
    TypeOrmModule,
  ],
})
export class CommonModule {}
