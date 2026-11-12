import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ForensicCheck } from './entities/forensic-check.entity';
import { ForensicChecksService } from './services/forensic-checks.service';
import { ForensicChecksAdminController } from './controllers/forensic-checks-admin.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ForensicCheck])],
  controllers: [ForensicChecksAdminController],
  providers: [ForensicChecksService],
  exports: [ForensicChecksService],
})
export class ForensicChecksModule {}
