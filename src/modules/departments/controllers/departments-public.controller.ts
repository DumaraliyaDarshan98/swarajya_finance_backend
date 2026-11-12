import { Controller, Get } from '@nestjs/common';
import { DepartmentsService } from '../services/departments.service';

/** Public — active departments for hiring dropdown (no auth). */
@Controller('departments')
export class DepartmentsPublicController {
  constructor(private readonly service: DepartmentsService) {}

  @Get()
  listActive() {
    return this.service.listActiveOptions();
  }
}
