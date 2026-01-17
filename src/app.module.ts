import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { TypeOrmModule } from '@nestjs/typeorm';
import dbDataSource from './database/databaseConfig';
import { JwtService } from '@nestjs/jwt';
import { APP_INTERCEPTOR } from '@nestjs/core';
import { TimeoutInterceptor } from './interceptor/timeout.interceptor';
import { APIResponseInterceptor } from './interceptor/api-response.interceptor';
import { AuthModule } from './modules/auth/auth.module';
import { MailModule } from './modules/mail/mail.module';
import { UserModule } from './modules/user/user.module';
import { ClientsModule } from './modules/client/client.module';

@Module({
  imports: [
    TypeOrmModule.forRoot(dbDataSource.options),
    AuthModule,
    MailModule,
    UserModule,
    ClientsModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    JwtService,
    {
      provide: APP_INTERCEPTOR,
      useClass: TimeoutInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: APIResponseInterceptor,
    },
  ],
})
export class AppModule {}
