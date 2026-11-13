import { Controller, Get } from '@nestjs/common';
import { HiringPositionsService } from '../services/hiring-positions.service';

/** Public — active open roles for the Career page (no auth). */
@Controller('hiring-positions')
export class HiringPositionsPublicController {
  constructor(private readonly service: HiringPositionsService) {}

  @Get()
  listActive() {
    return this.service.listActivePublic();
  }
}
