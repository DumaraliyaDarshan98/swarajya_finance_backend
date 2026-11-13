import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { JobApplication } from './entities/job-application.entity';
import { JobApplicationService } from './services/job-application.service';
import { JobApplicationPublicController } from './controllers/job-application-public.controller';
import { JobApplicationAdminController } from './controllers/job-application-admin.controller';
import { MailModule } from '../mail/mail.module';
import { HiringPosition } from '../hiring-positions/entities/hiring-position.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([JobApplication, HiringPosition]),
    MailModule,
  ],
  controllers: [JobApplicationPublicController, JobApplicationAdminController],
  providers: [JobApplicationService],
  exports: [JobApplicationService],
})
export class JobApplicationModule {}
