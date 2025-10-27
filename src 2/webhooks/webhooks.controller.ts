import {
  Controller,
  Post,
  Body,
  Headers,
  RawBodyRequest,
  Req,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Request } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { WebhooksService } from './webhooks.service';
import { CreditsService } from '../credits/credits.service';
import { Order, OrderDocument } from '../schemas/order.schema';
import { Prompt, PromptDocument } from '../schemas/prompt.schema';
import { Video, VideoDocument } from '../schemas/video.schema';

@Controller('webhooks')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);

  constructor(
    private webhooksService: WebhooksService,
    private creditsService: CreditsService,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(Prompt.name) private promptModel: Model<PromptDocument>,
    @InjectModel(Video.name) private videoModel: Model<VideoDocument>,
  ) {}

  /**
   * Recebe webhooks do N8N
   * 
   * Eventos suportados:
   * - payment.paid: Confirma pagamento e credita usuário
   * - prompt.generated: Salva resultado do prompt gerado
   * - video.ready: Marca vídeo como pronto
   * - video.failed: Marca vídeo como falho
   * - refund.created: Estorna créditos
   */
  @Post('incoming/n8n')
  async handleIncomingWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-tokcash-signature') signature: string,
    @Body() body: any,
  ) {
    // Validar assinatura
    const rawBody = JSON.stringify(body);
    const isValid = this.webhooksService.validateIncomingSignature(
      rawBody,
      signature,
    );

    if (!isValid) {
      this.logger.warn('Webhook com assinatura inválida recebido');
      throw new BadRequestException('Assinatura inválida');
    }

    const { event, data } = body;

    this.logger.log(`Webhook recebido: ${event}`);

    try {
      switch (event) {
        case 'payment.paid':
          await this.handlePaymentPaid(data);
          break;

        case 'prompt.generated':
          await this.handlePromptGenerated(data);
          break;

        case 'video.ready':
          await this.handleVideoReady(data);
          break;

        case 'video.failed':
          await this.handleVideoFailed(data);
          break;

        case 'video.progress':
          await this.handleVideoProgress(data);
          break;

        case 'refund.created':
          await this.handleRefund(data);
          break;

        default:
          this.logger.warn(`Evento desconhecido: ${event}`);
      }

      return { success: true, event };
    } catch (error) {
      this.logger.error(`Erro ao processar webhook ${event}: ${error.message}`);
      throw error;
    }
  }

  /**
   * Handler: Pagamento confirmado
   */
  private async handlePaymentPaid(data: any) {
    const { orderId, providerRef } = data;

    const order = await this.orderModel.findById(orderId);
    if (!order) {
      throw new BadRequestException('Pedido não encontrado');
    }

    if (order.status === 'paid') {
      this.logger.log(`Pedido ${orderId} já foi processado`);
      return;
    }

    // Atualizar pedido
    order.status = 'paid';
    order.providerRef = providerRef;
    order.paidAt = new Date();
    await order.save();

    // Creditar usuário
    await this.creditsService.addCredits(
      order.userId.toString(),
      order.credits,
      `Compra do plano ${order.planCode}`,
      orderId,
    );

    this.logger.log(
      `Pagamento confirmado: ${orderId} - ${order.credits} créditos creditados`,
    );

    // Enviar webhook de confirmação
    await this.webhooksService.dispatch('order.completed', {
      orderId,
      userId: order.userId.toString(),
      planCode: order.planCode,
      credits: order.credits,
      paidAt: order.paidAt,
    });
  }

  /**
   * Handler: Prompt gerado
   */
  private async handlePromptGenerated(data: any) {
    const { promptId, resultText, tags } = data;

    const prompt = await this.promptModel.findById(promptId);
    if (!prompt) {
      throw new BadRequestException('Prompt não encontrado');
    }

    prompt.resultText = resultText;
    if (tags) {
      prompt.tags = tags;
    }
    await prompt.save();

    this.logger.log(`Prompt gerado com sucesso: ${promptId}`);
  }

  /**
   * Handler: Vídeo pronto
   */
  private async handleVideoReady(data: any) {
    const { videoId, assets } = data;

    const video = await this.videoModel.findById(videoId);
    if (!video) {
      throw new BadRequestException('Vídeo não encontrado');
    }

    video.status = 'ready';
    video.assets = { ...video.assets, ...assets };
    video.updatedAt = new Date();
    await video.save();

    this.logger.log(`Vídeo pronto: ${videoId}`);

    // Enviar webhook de confirmação
    await this.webhooksService.dispatch('video.completed', {
      videoId,
      userId: video.userId.toString(),
      status: 'ready',
      assets: video.assets,
    });
  }

  /**
   * Handler: Vídeo falhou
   */
  private async handleVideoFailed(data: any) {
    const { videoId, error } = data;

    const video = await this.videoModel.findById(videoId);
    if (!video) {
      throw new BadRequestException('Vídeo não encontrado');
    }

    video.status = 'failed';
    video.updatedAt = new Date();
    await video.save();

    this.logger.error(`Vídeo falhou: ${videoId} - ${error}`);
  }

  /**
   * Handler: Progresso do vídeo
   */
  private async handleVideoProgress(data: any) {
    const { videoId, status, assets } = data;

    const video = await this.videoModel.findById(videoId);
    if (!video) {
      return;
    }

    if (status) {
      video.status = status;
    }
    if (assets) {
      video.assets = { ...video.assets, ...assets };
    }
    video.updatedAt = new Date();
    await video.save();

    this.logger.log(`Progresso do vídeo atualizado: ${videoId} - ${status}`);
  }

  /**
   * Handler: Reembolso
   */
  private async handleRefund(data: any) {
    const { orderId, userId, credits, reason } = data;

    await this.creditsService.refundCredits(
      userId,
      credits,
      reason || 'Reembolso',
      orderId,
    );

    this.logger.log(`Reembolso processado: ${orderId} - ${credits} créditos`);
  }
}

