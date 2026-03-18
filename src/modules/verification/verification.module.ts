import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { VerificationRequest } from './entities/verification-request.entity';
import { VerificationController } from './verification.controller';
import { VerificationService } from './verification.service';

@Module({
  imports: [TypeOrmModule.forFeature([VerificationRequest])],
  controllers: [VerificationController],
  providers: [VerificationService],
})
export class VerificationModule {}
