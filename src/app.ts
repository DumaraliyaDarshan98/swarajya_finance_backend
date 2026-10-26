import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { json, urlencoded } from 'express';
import { AppModule } from './app.module';

export async function createApp() {
  const app = await NestFactory.create(AppModule, { cors: true });
  const config = app.get(ConfigService);

  // Honor X-Forwarded-For when behind a reverse proxy (accurate audit IP/geo).
  const expressApp = app.getHttpAdapter().getInstance();
  if (typeof expressApp?.set === 'function') {
    expressApp.set('trust proxy', 1);
  }

  // Exotel StatusCallback posts application/x-www-form-urlencoded — ensure parsers are on.
  app.use(urlencoded({ extended: true, limit: '2mb' }));
  app.use(json({ limit: '2mb' }));

  app.enableCors({
    origin: '*',
    credentials: true,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const globalPrefix = config.get<string>('apiPrefix') ?? 'api';
  app.setGlobalPrefix(globalPrefix);

  return app;
}

export async function bootstrap() {
  const app = await createApp();
  const config = app.get(ConfigService);
  const port = config.get<number>('port') ?? 3000;
  const apiPrefix = config.get<string>('apiPrefix') ?? 'api';

  await app.listen(port);
  console.log(`Application is running on: http://localhost:${port}/${apiPrefix}`);
}
