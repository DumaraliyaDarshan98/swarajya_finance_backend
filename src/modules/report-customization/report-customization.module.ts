import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ReportCustomization } from './entities/report-customization.entity';
import { ReportCustomizationService } from './services/report-customization.service';
import { ReportCustomizationController } from './controllers/report-customization.controller';

@Module({
  imports: [TypeOrmModule.forFeature([ReportCustomization])],
  controllers: [ReportCustomizationController],
  providers: [ReportCustomizationService],
  exports: [ReportCustomizationService],
})
export class ReportCustomizationModule {}
