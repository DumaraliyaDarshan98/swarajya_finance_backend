import { Controller, Get } from '@nestjs/common';
import { DesignationsService } from '../services/designations.service';

/** Public — active designations for hiring dropdown (no auth). */
@Controller('designations')
export class DesignationsPublicController {
  constructor(private readonly service: DesignationsService) {}

  @Get()
  listActive() {
    return this.service.listActiveOptions();
  }
}
