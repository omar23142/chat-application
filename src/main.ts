import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Request, ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './utils/GlobalErrorHandler';
import helmet from 'helmet';
import compression from 'compression';
import express, { request } from 'express';
import cookieParser from 'cookie-parser';
import csurf from 'csurf';

 
async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  // app.setGlobalPrefix('api');
  // app.useGlobalPipes(
  //   new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true }),
  // );
   // 1. Security Headers
      app.use(
        helmet({
          crossOriginEmbedderPolicy: false, // Allows GraphQL Playground / Apollo Sandbox to run
        }),
      );
      // 2. Cookie Parser
      app.use(cookieParser());

      // 3. Response Compression (Gzip)
      app.use(compression());

      // 4. Body limits (protect against large body payload attacks)
      app.use(express.json({ limit: '1mb' }));
      app.use(express.urlencoded({ extended: true, limit: '1mb' }));
      // 5. Global Validation (Automatic sanitization & type safety)
      app.useGlobalPipes(
        new ValidationPipe({
          whitelist: true, // Strips unneeded fields (replaces manual sanitization)
          forbidNonWhitelisted: true,
          transform: true, // Automatically converts query strings to types
        }),
      );
  app.enableCors({ origin: '*', credentials: true });
  // app.use(csurf());
  app.useGlobalFilters(new GlobalExceptionFilter);
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
