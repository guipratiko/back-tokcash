/**
 * Webhook Worker
 * 
 * Worker in-memory que processa webhooks pendentes com retry exponencial.
 * Roda em background e processa a fila a cada intervalo configurado.
 * 
 * Para rodar: npm run webhook:worker
 */

import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { WebhooksService } from './webhooks.service';
import { Logger } from '@nestjs/common';

async function bootstrap() {
  const logger = new Logger('WebhookWorker');
  const app = await NestFactory.createApplicationContext(AppModule);
  const webhooksService = app.get(WebhooksService);

  const INTERVAL_MS = 10000; // Processar a cada 10 segundos

  logger.log('Webhook Worker iniciado');
  logger.log(`Processando a cada ${INTERVAL_MS}ms`);

  setInterval(async () => {
    try {
      await webhooksService.processQueue();
    } catch (error) {
      logger.error(`Erro ao processar fila de webhooks: ${error.message}`);
    }
  }, INTERVAL_MS);
}

bootstrap();

