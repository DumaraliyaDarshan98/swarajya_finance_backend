import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SuperAdminSettings } from './entities/super-admin-settings.entity';
import { SuperAdminSettingsService } from './super-admin-settings.service';
import { SuperAdminSettingsController } from './super-admin-settings.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SuperAdminSettings])],
  providers: [SuperAdminSettingsService],
  controllers: [SuperAdminSettingsController],
  exports: [SuperAdminSettingsService],
})
export class SuperAdminSettingsModule {}
