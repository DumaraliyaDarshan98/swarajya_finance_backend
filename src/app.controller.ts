import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { APIResponseInterface } from './common/interfaces/response.interface';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  async getHello(): Promise<APIResponseInterface<string>> {
    return this.appService.getHello();
  }
}
