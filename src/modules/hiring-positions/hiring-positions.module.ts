import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { HiringPosition } from './entities/hiring-position.entity';
import { Department } from '../departments/entities/department.entity';
import { Designation } from '../designations/entities/designation.entity';
import { JobApplication } from '../job-application/entities/job-application.entity';
import { HiringPositionsService } from './services/hiring-positions.service';
import { HiringPositionsAdminController } from './controllers/hiring-positions-admin.controller';
import { HiringPositionsPublicController } from './controllers/hiring-positions-public.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      HiringPosition,
      Department,
      Designation,
      JobApplication,
    ]),
  ],
  controllers: [HiringPositionsAdminController, HiringPositionsPublicController],
  providers: [HiringPositionsService],
  exports: [HiringPositionsService],
})
export class HiringPositionsModule {}
