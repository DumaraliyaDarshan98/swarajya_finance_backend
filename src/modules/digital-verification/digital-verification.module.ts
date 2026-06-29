import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DigitalVerification } from './entities/digital-verification.entity';
import { DigitalVerificationController } from './digital-verification.controller';
import { DigitalVerificationService } from './digital-verification.service';
import { ScrappingModule } from '../scrapping/scrapping.module';

@Module({
  imports: [TypeOrmModule.forFeature([DigitalVerification]), ScrappingModule],
  controllers: [DigitalVerificationController],
  providers: [DigitalVerificationService],
})
export class DigitalVerificationModule {}
