import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';
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
  const app = await NestFactory.create(AppModule, {
    logger: false, // Usar pino
  });

  // CORS - Aceitar múltiplas origens
  const allowedOrigins = [
    'http://localhost:3000',
    'https://tokcash.com.br',
    'https://www.tokcash.com.br',
  ];

  if (process.env.FRONTEND_URL) {
    allowedOrigins.push(process.env.FRONTEND_URL);
  }

  app.enableCors({
    origin: (origin, callback) => {
      // Permitir requisições sem origin (ex: Postman, curl)
      if (!origin) return callback(null, true);
      
      if (allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        console.log('⚠️ Origin bloqueado:', origin);
        callback(new Error('Not allowed by CORS'));
      }
    },
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
  
  logger.info(`🚀 TokCash Backend rodando em http://localhost:${port}`);
  logger.info(`📊 MongoDB: ${process.env.MONGODB_URI ? 'Configurado' : 'Não configurado'}`);
  logger.info(`🔗 Frontend esperado em ${process.env.FRONTEND_URL}`);
}

bootstrap().catch((err) => {
  logger.error({ error: err }, 'Erro ao iniciar servidor');
  process.exit(1);
});
