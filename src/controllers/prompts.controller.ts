import { Controller, Post, Get, Delete, Body, Param, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { z } from 'zod';
import { Prompt, PromptDocument } from '../schemas/prompt.schema';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CreditsService } from '../services/credits.service';

const generatePromptSchema = z.object({
  nicho: z.string(),
  objetivo: z.string(),
  cta: z.string().optional(),
  duracao: z.enum(['15s', '30s', '60s']).optional(),
  estilo: z.string().optional(),
  persona: z.string().optional(),
});

@Controller('prompts')
@UseGuards(JwtAuthGuard)
export class PromptsController {
  constructor(
    @InjectModel(Prompt.name) private promptModel: Model<PromptDocument>,
    private creditsService: CreditsService,
  ) {}

  @Post('generate')
  async generate(@Body() body: any, @CurrentUser() user: any) {
    const input = generatePromptSchema.parse(body);
    const cost = parseInt(process.env.PROMPT_CREDIT_COST || '1', 10);

    // Consumir créditos
    await this.creditsService.consumeCredits(
      user.id,
      cost,
      'Geração de prompt',
    );

    // Criar prompt com status "processing"
    const prompt = await this.promptModel.create({
      userId: user.id,
      inputBrief: input,
      resultText: '',
      tags: [input.nicho, input.estilo].filter(Boolean),
      status: 'processing',
    });

    // Enviar webhook assíncrono para Clerky API
    const clerkyUrl = process.env.CLERKY_PROMPT_WEBHOOK_URL;
    if (clerkyUrl) {
      // Fire-and-forget (não esperamos resposta)
      fetch(clerkyUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          promptId: prompt._id.toString(),
          userId: user.id,
          prompt: input.objetivo,
          nicho: input.nicho,
          cta: input.cta,
          duracao: input.duracao,
          estilo: input.estilo,
          persona: input.persona,
          callbackUrl: `${process.env.BACKEND_URL || 'http://localhost:4000'}/webhooks/prompt-callback`,
        }),
      }).catch((error) => {
        console.error('Erro ao enviar webhook para Clerky:', error);
        // Se falhar o envio, marcar como failed
        this.promptModel.findByIdAndUpdate(prompt._id, {
          status: 'failed',
          resultText: 'Erro ao enviar requisição para IA. Tente novamente.',
        }).catch(console.error);
      });
    } else {
      // Se não tiver URL configurada, gerar mock imediatamente
      const resultText = this.generateMockPrompt(input);
      prompt.resultText = resultText;
      prompt.status = 'completed';
      await prompt.save();
    }

    // Retorna imediatamente com status "processing"
    return { prompt };
  }

  @Get()
  async list(@CurrentUser() user: any) {
    const prompts = await this.promptModel
      .find({ userId: user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return { prompts };
  }

  @Get(':id')
  async getById(@Param('id') id: string, @CurrentUser() user: any) {
    const prompt = await this.promptModel.findOne({
      _id: id,
      userId: user.id,
    }).lean();

    if (!prompt) {
      throw new Error('Prompt não encontrado');
    }

    return { prompt };
  }

  @Delete(':id')
  async delete(@Param('id') id: string, @CurrentUser() user: any) {
    const prompt = await this.promptModel.findOne({
      _id: id,
      userId: user.id,
    });

    if (!prompt) {
      throw new Error('Prompt não encontrado');
    }

    await this.promptModel.findByIdAndDelete(id);

    return { success: true, message: 'Prompt deletado com sucesso' };
  }

  private generateMockPrompt(input: any): string {
    const templates = [
      `🎯 Vídeo ${input.duracao || '30s'} - Nicho: ${input.nicho}

📌 Gancho (3s):
"Você sabia que ${input.nicho} pode mudar sua vida em 30 dias?"

🎬 Desenvolvimento (20s):
Mostre ${input.objetivo} de forma visual e impactante.
Use transições rápidas, música trending e legendas grandes.

💰 CTA Final (7s):
${input.cta || 'Salve este vídeo e comece AGORA!'}

✨ Estilo: ${input.estilo || 'Dinâmico e autêntico'}
🎭 Persona: ${input.persona || 'Jovem empreendedor'}`,

      `🔥 PROMPT VIRAL - ${input.nicho}

Abertura explosiva (0-3s):
Pattern interrupt visual + texto em negrito
"Pare de scrollar! Isso vai mudar tudo..."

Core content (3-25s):
Mostre ${input.objetivo}
- Ponto 1: Problema
- Ponto 2: Solução rápida
- Ponto 3: Prova social

Fechamento (25-${input.duracao || '30s'}):
${input.cta || 'Segue para mais!'}

Audio: Trending do TikTok/Reels
Ritmo: Cortes a cada 2-3 segundos`,
    ];

    return templates[Math.floor(Math.random() * templates.length)];
  }
}

