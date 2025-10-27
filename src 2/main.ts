import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';
import * as cookieParser from 'cookie-parser';
import { Logger } from 'nestjs-pino';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
    rawBody: true,
  });

  const config = app.get(ConfigService);

  // CORS
  app.enableCors({
    origin: config.frontendUrl,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-TokCash-Signature'],
  });

  // Middleware
  app.use(cookieParser());

  // Global prefix
  app.setGlobalPrefix('api');

  // Validation
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: false,
      transform: true,
    }),
  );

  const port = 4000;
  await app.listen(port);

  console.log('');
  console.log('🚀 TokCash Backend rodando!');
  console.log('');
  console.log(`📍 API: http://localhost:${port}/api`);
  console.log(`🔗 Frontend: ${config.frontendUrl}`);
  console.log(`💾 MongoDB: ${config.mongodbDb}`);
  console.log('');
}

bootstrap();

