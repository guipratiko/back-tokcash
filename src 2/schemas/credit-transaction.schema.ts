import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CreditTransactionDocument = CreditTransaction & Document;

@Schema({ timestamps: true })
export class CreditTransaction {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ['credit', 'debit'] })
  type: string;

  @Prop({ required: true })
  amount: number;

  @Prop({ required: true })
  reason: string;

  @Prop()
  refId: string;

  @Prop({ default: Date.now })
  createdAt: Date;
}

export const CreditTransactionSchema =
  SchemaFactory.createForClass(CreditTransaction);

