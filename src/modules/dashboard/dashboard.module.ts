import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from '../client/entities/client.entity';
import { User } from '../user/entities/user.entity';
import { DigitalVerification } from '../digital-verification/entities/digital-verification.entity';
import { OcrVerification } from '../ocr-verification/entities/ocr-verification.entity';
import { PhysicalVerification } from '../physical-verification/entities/physical-verification.entity';
import { AuditLog } from '../audit-log/entities/audit-log.entity';
import { Role } from '../role/entities/role.entity';
import { DashboardAnalyticsService } from './services/dashboard-analytics.service';
import { DashboardAnalyticsController } from './controllers/dashboard-analytics.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Client,
      User,
      DigitalVerification,
      OcrVerification,
      PhysicalVerification,
      AuditLog,
      Role,
    ]),
  ],
  controllers: [DashboardAnalyticsController],
  providers: [DashboardAnalyticsService],
  exports: [DashboardAnalyticsService],
})
export class DashboardModule {}
