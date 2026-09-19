import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './utils/GlobalErrorHandler';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  );
  app.enableCors({ origin: '*', credentials: true });
  app.useGlobalFilters(new GlobalExceptionFilter);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
