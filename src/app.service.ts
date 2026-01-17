import { Injectable, HttpStatus } from '@nestjs/common';
import { APIResponseInterface } from './interface/response.interface';

@Injectable()
export class AppService {
  async getHello(): Promise<APIResponseInterface<string>> {
    return {
      code: HttpStatus.OK,
      message: 'Hello World!',
      data: 'Hello World!',
    };
  }
}
