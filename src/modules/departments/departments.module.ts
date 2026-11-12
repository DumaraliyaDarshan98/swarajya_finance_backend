import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Department } from './entities/department.entity';
import { DepartmentsService } from './services/departments.service';
import { DepartmentsAdminController } from './controllers/departments-admin.controller';
import { DepartmentsPublicController } from './controllers/departments-public.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Department])],
  controllers: [DepartmentsAdminController, DepartmentsPublicController],
  providers: [DepartmentsService],
  exports: [DepartmentsService],
})
export class DepartmentsModule {}
