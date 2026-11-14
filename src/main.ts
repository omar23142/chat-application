import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ConsoleLogger, Request, ValidationPipe } from '@nestjs/common';
import { GlobalExceptionFilter } from './utils/GlobalErrorHandler';
import helmet from 'helmet';
import compression from 'compression';
import express, { request } from 'express';
import cookieParser from 'cookie-parser';
import { doubleCsrf } from 'csrf-csrf';
import logger  from 'winston/winston';
// import { } from '#test/app.e2e-spec.js';
import   morgan from 'morgan';

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
    })
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
    })
  );
  // 6 -compain the winston logger with the morgan logger to log all requests and responses
app.use(
  morgan('combined', {
    stream: {
      write: (message: string) => {
        logger.info(message.trim());
      },
    },
  }),
);

  app.enableCors({ origin: '*', credentials: true });

  app.useGlobalFilters(new GlobalExceptionFilter());
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();


