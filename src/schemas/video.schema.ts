import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VideoDocument = Video & Document;

@Schema({ timestamps: true })
export class Video {
  @Prop({ type: Types.ObjectId, ref: 'User', required: true })
  userId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, ref: 'Prompt' })
  promptId?: Types.ObjectId;

  @Prop({ 
    required: true, 
    enum: ['queued', 'processing', 'ready', 'failed'],
    default: 'queued'
  })
  status: string;

  @Prop({ type: Object, default: {} })
  assets: {
    scriptUrl?: string;
    audioUrl?: string;
    captionsUrl?: string;
    videoUrl?: string;
  };

  @Prop()
  updatedAt?: Date;
}

export const VideoSchema = SchemaFactory.createForClass(Video);

