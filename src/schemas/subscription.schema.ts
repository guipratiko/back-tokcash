import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type SubscriptionDocument = Subscription & Document;

@Schema({ timestamps: true })
export class Subscription {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  planCode: string;

  @Prop({ 
    required: true, 
    enum: ['active', 'cancelled', 'past_due', 'expired'],
    default: 'active'
  })
  status: string;

  @Prop({ required: true })
  priceBRL: number;

  @Prop({ required: true })
  creditsPerCycle: number;

  @Prop()
  provider?: string;

  @Prop()
  providerSubscriptionId?: string;

  @Prop({ required: true })
  currentPeriodStart: Date;

  @Prop({ required: true })
  currentPeriodEnd: Date;

  @Prop()
  nextBillingDate?: Date;

  @Prop()
  cancelledAt?: Date;
}

export const SubscriptionSchema = SchemaFactory.createForClass(Subscription);

