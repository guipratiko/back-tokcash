import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PromptDocument = Prompt & Document;

@Schema({ timestamps: true })
export class Prompt {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, type: Object })
  inputBrief: Record<string, any>;

  @Prop({ required: false })
  resultText: string;

  @Prop({ type: [String], default: [] })
  tags: string[];

  @Prop({ 
    type: String, 
    enum: ['processing', 'completed', 'failed'], 
    default: 'processing' 
  })
  status: string;
}

export const PromptSchema = SchemaFactory.createForClass(Prompt);

