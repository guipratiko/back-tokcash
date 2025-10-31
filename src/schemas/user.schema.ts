import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type UserDocument = User & Document;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true })
  email: string;

  @Prop({ required: true })
  passwordHash: string;

  @Prop({ default: 'user', enum: ['user', 'admin'] })
  role: string;

  @Prop({ default: 0 })
  promptCredits: number;

  @Prop({ default: 0 })
  videoCredits: number;

  @Prop()
  cpf?: string;

  @Prop()
  phone?: string;

  @Prop()
  sexo?: string;
}

export const UserSchema = SchemaFactory.createForClass(User);

