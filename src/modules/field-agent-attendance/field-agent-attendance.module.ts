import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { FieldAgentAttendance } from './entities/field-agent-attendance.entity';
import { FieldAssistant } from '../field-assistance/entities/field-assistant.entity';
import { FieldAssistantAddress } from '../field-assistance/entities/field-assistant-address.entity';
import { FieldAgentAttendanceService } from './services/field-agent-attendance.service';
import { FieldAgentAttendanceController } from './controllers/field-agent-attendance.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      FieldAgentAttendance,
      FieldAssistant,
      FieldAssistantAddress,
    ]),
  ],
  controllers: [FieldAgentAttendanceController],
  providers: [FieldAgentAttendanceService],
  exports: [FieldAgentAttendanceService],
})
export class FieldAgentAttendanceModule {}
