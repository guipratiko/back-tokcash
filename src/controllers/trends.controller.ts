import { Controller, Get } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Trend, TrendDocument } from '../schemas/trend.schema';

@Controller('trends')
export class TrendsController {
  constructor(
    @InjectModel(Trend.name) private trendModel: Model<TrendDocument>,
  ) {}

  @Get()
  async list() {
    const trends = await this.trendModel
      .find()
      .sort({ updatedAt: -1 })
      .limit(20)
      .lean();

    return { trends };
  }
}

