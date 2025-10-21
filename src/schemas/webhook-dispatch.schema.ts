import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type WebhookDispatchDocument = WebhookDispatch & Document;

@Schema({ timestamps: true })
export class WebhookDispatch {
  @Prop({ required: true })
  type: string;

  @Prop({ required: true, type: Object })
  payload: Record<string, any>;

  @Prop({ required: true })
  targetUrl: string;

  @Prop()
  signature?: string;

  @Prop({ 
    required: true, 
    enum: ['queued', 'sent', 'failed', 'dead'],
    default: 'queued'
  })
  status: string;

  @Prop({ default: 0 })
  attempts: number;

  @Prop()
  lastError?: string;

  @Prop()
  nextRetryAt?: Date;
}

export const WebhookDispatchSchema = SchemaFactory.createForClass(WebhookDispatch);

