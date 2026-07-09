import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PhysicalVerificationCall } from './entities/physical-verification-call.entity';
import { PhysicalVerification } from '../physical-verification/entities/physical-verification.entity';
import { PhysicalLog } from '../physical-verification/entities/physical-log.entity';
import { User } from '../user/entities/user.entity';
import { TelephonyService } from './telephony.service';
import { ExotelProvider } from './providers/exotel.provider';
import { ExotelController } from './controllers/exotel.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PhysicalVerificationCall,
      PhysicalVerification,
      PhysicalLog,
      User,
    ]),
  ],
  controllers: [ExotelController],
  providers: [TelephonyService, ExotelProvider],
  exports: [TelephonyService],
})
export class TelephonyModule {}
