import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Designation } from './entities/designation.entity';
import { DesignationsService } from './services/designations.service';
import { DesignationsAdminController } from './controllers/designations-admin.controller';
import { DesignationsPublicController } from './controllers/designations-public.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Designation])],
  controllers: [DesignationsAdminController, DesignationsPublicController],
  providers: [DesignationsService],
  exports: [DesignationsService],
})
export class DesignationsModule {}
