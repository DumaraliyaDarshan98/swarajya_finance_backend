import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortalCategory } from './entities/portal-category.entity';
import { Portal } from './entities/portal.entity';
import { PortalListService } from './services/portal-list.service';
import { PortalListAdminController } from './controllers/portal-list-admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([PortalCategory, Portal])],
  controllers: [PortalListAdminController],
  providers: [PortalListService],
  exports: [PortalListService],
})
export class PortalListModule {}
