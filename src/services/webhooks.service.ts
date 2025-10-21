import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import { WebhookDispatch, WebhookDispatchDocument } from '../schemas/webhook-dispatch.schema';
import pino from 'pino';

const logger = pino({ level: 'info' });

@Injectable()
export class WebhooksService {
  private processing = false;

  constructor(
    @InjectModel(WebhookDispatch.name)
    private webhookModel: Model<WebhookDispatchDocument>,
  ) {
    // Iniciar worker in-memory integrado
    this.startWorker();
  }

  /**
   * Valida assinatura HMAC de webhook recebido
   */
  validateIncomingSignature(body: string, signature: string): boolean {
    const secret = process.env.WEBHOOK_INCOMING_SECRET;
    const hash = crypto.createHmac('sha256', secret).update(body).digest('hex');
    return hash === signature;
  }

  /**
   * Gera assinatura HMAC para webhook de saída
   */
  generateOutgoingSignature(payload: any): string {
    const secret = process.env.WEBHOOK_OUTGOING_SECRET;
    const body = JSON.stringify(payload);
    return crypto.createHmac('sha256', secret).update(body).digest('hex');
  }

  /**
   * Enfileira um webhook para envio
   */
  async dispatch(type: string, payload: any, targetUrl?: string): Promise<void> {
    const url = targetUrl || process.env.WEBHOOK_OUTGOING_TARGET;
    const signature = this.generateOutgoingSignature(payload);

    await this.webhookModel.create({
      type,
      payload,
      targetUrl: url,
      signature,
      status: 'queued',
      attempts: 0,
    });

    logger.info({ type, targetUrl: url }, 'Webhook enfileirado');
  }

  /**
   * Worker in-memory com retries exponenciais
   */
  private startWorker() {
    setInterval(async () => {
      if (this.processing) return;

      this.processing = true;
      try {
        await this.processQueue();
      } catch (error) {
        logger.error({ error }, 'Erro no worker de webhooks');
      } finally {
        this.processing = false;
      }
    }, 5000); // Processa a cada 5 segundos
  }

  private async processQueue() {
    const maxRetries = parseInt(process.env.WEBHOOK_MAX_RETRIES || '5', 10);
    const now = new Date();

    const pending = await this.webhookModel.find({
      status: { $in: ['queued', 'failed'] },
      attempts: { $lt: maxRetries },
      $or: [
        { nextRetryAt: { $exists: false } },
        { nextRetryAt: { $lte: now } },
      ],
    }).limit(10);

    for (const webhook of pending) {
      await this.sendWebhook(webhook, maxRetries);
    }
  }

  private async sendWebhook(webhook: WebhookDispatchDocument, maxRetries: number) {
    webhook.attempts += 1;

    try {
      const response = await fetch(webhook.targetUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-TokCash-Signature': webhook.signature,
        },
        body: JSON.stringify(webhook.payload),
      });

      if (response.ok) {
        webhook.status = 'sent';
        webhook.lastError = undefined;
        webhook.nextRetryAt = undefined;
        logger.info({ webhookId: webhook._id, type: webhook.type }, 'Webhook enviado com sucesso');
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (error) {
      webhook.lastError = error.message;

      if (webhook.attempts >= maxRetries) {
        webhook.status = 'dead';
        logger.error({ webhookId: webhook._id, error: error.message }, 'Webhook morreu após max retries');
      } else {
        webhook.status = 'failed';
        const backoff = parseInt(process.env.WEBHOOK_RETRY_BACKOFF_MS || '1000', 10);
        const delay = backoff * Math.pow(2, webhook.attempts - 1);
        webhook.nextRetryAt = new Date(Date.now() + delay);
        logger.warn(
          { webhookId: webhook._id, attempts: webhook.attempts, nextRetry: webhook.nextRetryAt },
          'Webhook falhou, agendando retry'
        );
      }
    }

    await webhook.save();
  }
}

