import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as crypto from 'crypto';
import axios from 'axios';
import {
  WebhookDispatch,
  WebhookDispatchDocument,
} from '../schemas/webhook-dispatch.schema';
import { ConfigService } from '../config/config.service';

/**
 * WebhooksService
 * 
 * Gerencia webhooks de saída (dispatch) com:
 * - Assinatura HMAC SHA-256
 * - Persistência em MongoDB
 * - Retry exponencial
 * - Dead-letter após MAX_RETRIES
 */
@Injectable()
export class WebhooksService {
  private readonly logger = new Logger(WebhooksService.name);

  constructor(
    @InjectModel(WebhookDispatch.name)
    private webhookDispatchModel: Model<WebhookDispatchDocument>,
    private config: ConfigService,
  ) {}

  /**
   * Valida assinatura HMAC de webhook recebido
   */
  validateIncomingSignature(body: string, signature: string): boolean {
    const secret = this.config.webhookIncomingSecret;
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(body)
      .digest('hex');

    return signature === expectedSignature;
  }

  /**
   * Gera assinatura HMAC para webhook de saída
   */
  signOutgoingPayload(payload: string): string {
    const secret = this.config.webhookOutgoingSecret;
    return crypto.createHmac('sha256', secret).update(payload).digest('hex');
  }

  /**
   * Enfileira um webhook para envio
   * 
   * @param type - Tipo do evento (ex: 'order.created', 'prompt.requested')
   * @param payload - Dados do evento
   * @param targetUrl - URL de destino (opcional, usa default do config)
   */
  async dispatch(
    type: string,
    payload: Record<string, any>,
    targetUrl?: string,
  ): Promise<WebhookDispatchDocument> {
    const url = targetUrl || this.config.webhookOutgoingTarget;
    const payloadString = JSON.stringify(payload);
    const signature = this.signOutgoingPayload(payloadString);

    const dispatch = await this.webhookDispatchModel.create({
      type,
      payload,
      targetUrl: url,
      signature,
      status: 'queued',
      attempts: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    this.logger.log(`Webhook enfileirado: ${type} [${dispatch._id}]`);

    return dispatch;
  }

  /**
   * Busca dispatches pendentes para processamento
   */
  async getPendingDispatches(
    limit: number = 10,
  ): Promise<WebhookDispatchDocument[]> {
    const maxRetries = this.config.webhookMaxRetries;

    return this.webhookDispatchModel
      .find({
        status: { $in: ['queued', 'failed'] },
        attempts: { $lt: maxRetries },
      })
      .sort({ createdAt: 1 })
      .limit(limit);
  }

  /**
   * Envia um webhook
   */
  async sendWebhook(
    dispatchId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const dispatch = await this.webhookDispatchModel.findById(dispatchId);
    if (!dispatch) {
      return { success: false, error: 'Dispatch não encontrado' };
    }

    try {
      const payloadString = JSON.stringify(dispatch.payload);
      const signature = this.signOutgoingPayload(payloadString);

      await axios.post(dispatch.targetUrl, dispatch.payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-TokCash-Signature': signature,
          'X-TokCash-Event': dispatch.type,
        },
        timeout: 30000,
      });

      dispatch.status = 'sent';
      dispatch.attempts += 1;
      dispatch.updatedAt = new Date();
      await dispatch.save();

      this.logger.log(`Webhook enviado com sucesso: ${dispatch.type} [${dispatchId}]`);

      return { success: true };
    } catch (error) {
      const errorMessage = error.message || 'Erro desconhecido';
      dispatch.status = 'failed';
      dispatch.attempts += 1;
      dispatch.lastError = errorMessage;
      dispatch.updatedAt = new Date();

      // Marcar como dead se excedeu tentativas
      if (dispatch.attempts >= this.config.webhookMaxRetries) {
        dispatch.status = 'dead';
        this.logger.error(
          `Webhook marcado como DEAD após ${dispatch.attempts} tentativas: ${dispatch.type} [${dispatchId}]`,
        );
      }

      await dispatch.save();

      this.logger.warn(
        `Falha ao enviar webhook (tentativa ${dispatch.attempts}/${this.config.webhookMaxRetries}): ${dispatch.type} [${dispatchId}] - ${errorMessage}`,
      );

      return { success: false, error: errorMessage };
    }
  }

  /**
   * Processa webhooks pendentes (para ser chamado pelo worker)
   */
  async processQueue(): Promise<void> {
    const dispatches = await this.getPendingDispatches(5);

    for (const dispatch of dispatches) {
      // Calcular delay exponencial
      const backoff = this.config.webhookRetryBackoffMs;
      const delay = backoff * Math.pow(2, dispatch.attempts);

      // Verificar se já passou tempo suficiente desde última tentativa
      const now = new Date().getTime();
      const lastAttempt = new Date(dispatch.updatedAt).getTime();
      const timeSinceLastAttempt = now - lastAttempt;

      if (timeSinceLastAttempt < delay) {
        continue; // Ainda não é hora de tentar novamente
      }

      await this.sendWebhook(dispatch._id.toString());
    }
  }
}

