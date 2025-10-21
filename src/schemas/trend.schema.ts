import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TrendDocument = Trend & Document;

@Schema({ timestamps: true })
export class Trend {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true, enum: ['tiktok', 'shorts', 'reels'] })
  platform: string;

  @Prop({ type: [String], default: [] })
  keywords: string[];

  @Prop({ type: [String], default: [] })
  exampleHooks: string[];
}

export const TrendSchema = SchemaFactory.createForClass(Trend);

