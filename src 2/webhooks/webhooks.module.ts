import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { WebhooksService } from './webhooks.service';
import { WebhooksController } from './webhooks.controller';
import {
  WebhookDispatch,
  WebhookDispatchSchema,
} from '../schemas/webhook-dispatch.schema';
import { Order, OrderSchema } from '../schemas/order.schema';
import { Prompt, PromptSchema } from '../schemas/prompt.schema';
import { Video, VideoSchema } from '../schemas/video.schema';
import { CreditsModule } from '../credits/credits.module';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: WebhookDispatch.name, schema: WebhookDispatchSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Prompt.name, schema: PromptSchema },
      { name: Video.name, schema: VideoSchema },
    ]),
    CreditsModule,
  ],
  controllers: [WebhooksController],
  providers: [WebhooksService],
  exports: [WebhooksService],
})
export class WebhooksModule {}

