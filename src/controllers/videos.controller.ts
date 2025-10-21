import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { z } from 'zod';
import { Video, VideoDocument } from '../schemas/video.schema';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { CurrentUser } from '../decorators/current-user.decorator';
import { CreditsService } from '../services/credits.service';

const generateVideoSchema = z.object({
  promptId: z.string().optional(),
  textContent: z.string().optional(),
});

@Controller('videos')
@UseGuards(JwtAuthGuard)
export class VideosController {
  constructor(
    @InjectModel(Video.name) private videoModel: Model<VideoDocument>,
    private creditsService: CreditsService,
  ) {}

  @Post('generate')
  async generate(@Body() body: any, @CurrentUser() user: any) {
    const input = generateVideoSchema.parse(body);
    const cost = parseInt(process.env.VIDEO_CREDIT_COST || '5', 10);

    // Consumir créditos
    await this.creditsService.consumeCredits(
      user.id,
      cost,
      'Geração de vídeo',
    );

    const video = await this.videoModel.create({
      userId: user.id,
      promptId: input.promptId || undefined,
      status: 'queued',
      assets: {},
    });

    // Simular pipeline de geração (em produção seria chamada ao n8n)
    this.mockVideoGeneration(video._id.toString());

    return { video };
  }

  @Get()
  async list(@CurrentUser() user: any) {
    const videos = await this.videoModel
      .find({ userId: user.id })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('promptId')
      .lean();

    return { videos };
  }

  @Get(':id')
  async getById(@Param('id') id: string, @CurrentUser() user: any) {
    const video = await this.videoModel
      .findOne({
        _id: id,
        userId: user.id,
      })
      .populate('promptId')
      .lean();

    if (!video) {
      throw new Error('Vídeo não encontrado');
    }

    return { video };
  }

  private async mockVideoGeneration(videoId: string) {
    // Simula pipeline: queued -> processing -> ready
    setTimeout(async () => {
      await this.videoModel.findByIdAndUpdate(videoId, {
        status: 'processing',
        updatedAt: new Date(),
      });
    }, 2000);

    setTimeout(async () => {
      await this.videoModel.findByIdAndUpdate(videoId, {
        status: 'ready',
        assets: {
          scriptUrl: 'https://example.com/script.txt',
          audioUrl: 'https://example.com/audio.mp3',
          captionsUrl: 'https://example.com/captions.srt',
          videoUrl: 'https://example.com/video.mp4',
        },
        updatedAt: new Date(),
      });
    }, 10000);
  }
}

