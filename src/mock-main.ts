import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { MockAppModule } from './mock-app.module';
import pino from 'pino';

const logger = pino({ 
  level: 'info',
  transport: {
    target: 'pino-pretty',
    options: {
      colorize: true,
      translateTime: 'SYS:standard',
      ignore: 'pid,hostname',
    },
  },
});

async function bootstrap() {
  const app = await NestFactory.create(MockAppModule, {
    logger: false, // Usar pino
  });

  // CORS
  app.enableCors({
    origin: process.env.FRONTEND_URL || 'http://localhost:3000',
    credentials: true,
  });

  // Cookies
  app.use(cookieParser());

  // Validation pipe global
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    transform: true,
  }));

  // Prefixo global
  app.setGlobalPrefix('api');

  const port = process.env.PORT || 4000;
  
  await app.listen(port);
  
  logger.info(`🚀 TokCash Backend MOCK rodando em http://localhost:${port}`);
  logger.info(`📊 Modo: MOCK (sem MongoDB)`);
  logger.info(`🔗 Frontend esperado em ${process.env.FRONTEND_URL}`);
  logger.info(`🧪 Use este modo para testar o frontend enquanto o MongoDB não está disponível`);
}

bootstrap().catch((err) => {
  logger.error({ error: err }, 'Erro ao iniciar servidor');
  process.exit(1);
});

