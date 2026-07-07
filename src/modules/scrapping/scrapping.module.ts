import { Module } from '@nestjs/common';
import { ScrappingController } from './controllers/scrapping.controller';
import { ScrappingService } from './services/scrapping.service';

@Module({
  controllers: [ScrappingController],
  providers: [ScrappingService],
  exports: [ScrappingService],
})
export class ScrappingModule {}

