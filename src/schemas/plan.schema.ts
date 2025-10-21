import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type PlanDocument = Plan & Document;

@Schema({ timestamps: true })
export class Plan {
  @Prop({ required: true, unique: true, enum: ['START', 'PRO', 'INFINITY'] })
  code: string;

  @Prop({ required: true })
  name: string;

  @Prop({ required: true })
  priceBRL: number;

  @Prop({ required: true })
  credits: number;

  @Prop({ required: true })
  description: string;

  @Prop({ type: [String], default: [] })
  features: string[];

  @Prop({ default: true })
  isActive: boolean;
}

export const PlanSchema = SchemaFactory.createForClass(Plan);

