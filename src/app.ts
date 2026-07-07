import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

export async function createApp() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.enableCors({
    origin: config.get<string>('frontendUrl') ?? '*',
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
