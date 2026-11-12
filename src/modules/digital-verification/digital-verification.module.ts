import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DigitalVerification } from './entities/digital-verification.entity';
import { DigitalVerificationController } from './controllers/digital-verification.controller';
import { DigitalVerificationService } from './services/digital-verification.service';
import { VerificationEnrichmentModule } from '../verification-enrichment/verification-enrichment.module';
import { NotificationModule } from '../notification/notification.module';
import { User } from '../user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([DigitalVerification, User]),
    VerificationEnrichmentModule,
    NotificationModule,
  ],
  controllers: [DigitalVerificationController],
  providers: [DigitalVerificationService],
})
export class DigitalVerificationModule {}
