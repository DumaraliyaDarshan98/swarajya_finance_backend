import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  HttpStatus,
  HttpException,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { APIResponseInterface, Pagination } from '../interface/response.interface';

@Injectable()
export class APIResponseInterceptor<T> implements NestInterceptor<T, APIResponseInterface<T>> {
  intercept(context: ExecutionContext, next: CallHandler): Observable<APIResponseInterface<T>> {
    return next.handle().pipe(
      map((data) => {
        const controller: any = context.getClass();
        const response = context.switchToHttp().getResponse();
        
        // Skip transformation for file/document controllers (raw response or file stream)
        if (controller?.name === 'FileController' || controller?.name === 'UserDocumentsController') {
          return data;
        }

        // Handle error responses
        if (
          (response.statusCode === HttpStatus.OK || response.statusCode === HttpStatus.CREATED) &&
          data?.code !== HttpStatus.OK &&
          data?.code !== HttpStatus.CREATED
        ) {
          const errorCode = data?.code || response.statusCode;
          const errorMessage = data?.message || 'An error occurred';
          throw new HttpException(
            {
              statusCode: errorCode,
              message: errorMessage,
              data: data?.data || null,
              pagination: data?.pagination || null,
            },
            errorCode
          );
        }

        // Transform successful responses
        return {
          code: data?.code || response.statusCode,
          message: data?.message || 'Success',
          data: data?.data !== undefined ? data.data : data,
          pagination: data?.pagination || null,
        };
      })
    );
  }
}
