import { Controller, Post, Body, Headers, Req, BadRequestException } from '@nestjs/common';
import { Request } from 'express';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { z } from 'zod';
import { WebhooksService } from '../services/webhooks.service';
import { CreditsService } from '../services/credits.service';
import { Order, OrderDocument } from '../schemas/order.schema';
import { User, UserDocument } from '../schemas/user.schema';
import { Prompt, PromptDocument } from '../schemas/prompt.schema';
import pino from 'pino';

const logger = pino({ level: 'info' });

const incomingWebhookSchema = z.object({
  transactionId: z.string(),
  name: z.string(),
  email: z.string().email(),
  amount: z.number(),
  status: z.string(),
  cpf: z.string().optional(),
  phone: z.string().optional(),
  plan: z.string().optional(),
  credits: z.number().optional(),
  WEBHOOK_SECRET: z.string(),
});

const promptCallbackSchema = z.object({
  promptId: z.string(),
  result: z.string(),
  status: z.enum(['success', 'failed']).optional(),
  WEBHOOK_SECRET: z.string().optional(),
});

@Controller('webhooks')
export class WebhooksController {
  constructor(
    private webhooksService: WebhooksService,
    private creditsService: CreditsService,
    @InjectModel(Order.name) private orderModel: Model<OrderDocument>,
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    @InjectModel(Prompt.name) private promptModel: Model<PromptDocument>,
  ) {}

  @Post('incoming/n8n')
  async handleIncoming(
    @Body() body: any,
    @Headers('x-tokcash-signature') signature: string,
    @Req() req: Request,
  ) {
    // Validar assinatura HMAC
    const rawBody = JSON.stringify(body);
    const isValid = this.webhooksService.validateIncomingSignature(rawBody, signature || '');

    // Também aceitar WEBHOOK_SECRET no body (compatibilidade n8n)
    const secretValid = body.WEBHOOK_SECRET === process.env.WEBHOOK_INCOMING_SECRET;

    if (!isValid && !secretValid) {
      logger.warn({ signature, body }, 'Assinatura de webhook inválida');
      throw new BadRequestException('Assinatura inválida');
    }

    const payload = incomingWebhookSchema.parse(body);

    logger.info({ payload }, 'Webhook recebido do n8n');

    // Processar pagamento aprovado
    if (payload.status === 'paid' || payload.status === 'approved') {
      await this.processPayment(payload);
    }

    return { success: true, message: 'Webhook processado' };
  }

  @Post('dispatch')
  async dispatchWebhook(@Body() body: any) {
    const { type, payload, targetUrl } = z.object({
      type: z.string(),
      payload: z.any(),
      targetUrl: z.string().url().optional(),
    }).parse(body);

    await this.webhooksService.dispatch(type, payload, targetUrl);

    return { success: true, message: 'Webhook enfileirado' };
  }

  @Post('prompt-callback')
  async handlePromptCallback(@Body() body: any) {
    // Validar WEBHOOK_SECRET se fornecido
    const secret = process.env.WEBHOOK_PROMPT_CALLBACK_SECRET;
    if (secret && body.WEBHOOK_SECRET !== secret) {
      logger.warn({ body }, 'Webhook de prompt com secret inválido');
      throw new BadRequestException('Secret inválido');
    }

    const payload = promptCallbackSchema.parse(body);
    logger.info({ promptId: payload.promptId }, 'Callback de prompt recebido do Clerky/n8n');

    // Buscar prompt no banco usando promptId
    const prompt = await this.promptModel.findById(payload.promptId);

    if (!prompt) {
      logger.warn({ promptId: payload.promptId }, 'Prompt não encontrado para callback');
      throw new BadRequestException('Prompt não encontrado');
    }

    // Atualizar prompt com resultado
    prompt.resultText = payload.result;
    prompt.status = payload.status === 'failed' ? 'failed' : 'completed';
    await prompt.save();

    logger.info(
      { 
        promptId: prompt._id, 
        userId: prompt.userId, 
        status: prompt.status 
      }, 
      'Prompt atualizado com sucesso via callback'
    );

    return { success: true, message: 'Prompt atualizado' };
  }

  private async processPayment(payload: any) {
    // Buscar ou criar usuário
    let user = await this.userModel.findOne({ email: payload.email });

    if (!user) {
      // Criar usuário automaticamente
      const bcrypt = require('bcryptjs');
      const tempPassword = Math.random().toString(36).slice(-8);

      user = await this.userModel.create({
        name: payload.name,
        email: payload.email,
        passwordHash: await bcrypt.hash(tempPassword, 10),
        cpf: payload.cpf,
        phone: payload.phone,
        role: 'user',
        credits: 0,
      });

      logger.info({ userId: user._id, email: user.email }, 'Usuário criado automaticamente');
    }

    // Criar ou atualizar pedido
    let order = await this.orderModel.findOne({ providerRef: payload.transactionId });

    if (!order) {
      order = await this.orderModel.create({
        userId: user._id,
        planCode: this.getPlanCodeFromAmount(payload.amount),
        priceBRL: payload.amount,
        credits: payload.credits || this.getCreditsFromAmount(payload.amount),
        status: 'paid',
        provider: 'appmax',
        providerRef: payload.transactionId,
        paidAt: new Date(),
      });
    } else if (order.status !== 'paid') {
      order.status = 'paid';
      order.paidAt = new Date();
      await order.save();
    } else {
      // Já processado
      logger.info({ orderId: order._id }, 'Pedido já processado anteriormente');
      return;
    }

    // Creditar usuário
    await this.creditsService.addCredits(
      user._id as any,
      order.credits,
      `Compra do plano ${order.planCode}`,
      order._id.toString(),
    );

    logger.info(
      { userId: user._id, orderId: order._id, credits: order.credits },
      'Créditos adicionados com sucesso'
    );

    // Disparar webhook de saída
    await this.webhooksService.dispatch('order.paid', {
      orderId: order._id,
      userId: user._id,
      email: user.email,
      planCode: order.planCode,
      credits: order.credits,
      paidAt: order.paidAt,
    });
  }

  private getPlanCodeFromAmount(amount: number): string {
    if (amount >= 400) return 'INFINITY';
    if (amount >= 150) return 'PRO';
    return 'START';
  }

  private getCreditsFromAmount(amount: number): number {
    if (amount >= 400) return 100;
    if (amount >= 150) return 30;
    return 15;
  }
}

