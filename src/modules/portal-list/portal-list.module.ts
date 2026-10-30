import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PortalCategory } from './entities/portal-category.entity';
import { Portal } from './entities/portal.entity';
import { PortalListService } from './services/portal-list.service';
import { PortalTestService } from './services/portal-test.service';
import { PortalListAdminController } from './controllers/portal-list-admin.controller';
import { ScrappingModule } from '../scrapping/scrapping.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([PortalCategory, Portal]),
    ScrappingModule,
  ],
  controllers: [PortalListAdminController],
  providers: [PortalListService, PortalTestService],
  exports: [PortalListService, PortalTestService],
})
export class PortalListModule {}
