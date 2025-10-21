import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type OrderDocument = Order & Document;

@Schema({ timestamps: true })
export class Order {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true })
  planCode: string;

  @Prop({ required: true })
  priceBRL: number;

  @Prop({ required: true })
  credits: number;

  @Prop({ 
    required: true, 
    enum: ['pending', 'paid', 'failed'], 
    default: 'pending' 
  })
  status: string;

  @Prop({ default: 'n8n' })
  provider: string;

  @Prop()
  providerRef?: string;

  @Prop()
  paidAt?: Date;
}

export const OrderSchema = SchemaFactory.createForClass(Order);

