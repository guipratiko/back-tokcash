import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule } from '@nestjs/config';

// Schemas
import { User, UserSchema } from './schemas/user.schema';
import { Plan, PlanSchema } from './schemas/plan.schema';
import { Order, OrderSchema } from './schemas/order.schema';
import { Subscription, SubscriptionSchema } from './schemas/subscription.schema';
import { CreditTransaction, CreditTransactionSchema } from './schemas/credit-transaction.schema';
import { Prompt, PromptSchema } from './schemas/prompt.schema';
import { Video, VideoSchema } from './schemas/video.schema';
import { Trend, TrendSchema } from './schemas/trend.schema';
import { WebhookDispatch, WebhookDispatchSchema } from './schemas/webhook-dispatch.schema';

// Services
import { AuthService } from './services/auth.service';
import { CreditsService } from './services/credits.service';
import { WebhooksService } from './services/webhooks.service';

// Controllers
import { AuthController } from './controllers/auth.controller';
import { PlansController } from './controllers/plans.controller';
import { CreditsController } from './controllers/credits.controller';
import { PromptsController } from './controllers/prompts.controller';
import { VideosController } from './controllers/videos.controller';
import { TrendsController } from './controllers/trends.controller';
import { WebhooksController } from './controllers/webhooks.controller';

// Guards
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Module({
  imports: [
    ConfigModule.forRoot(),
    MongooseModule.forRoot(process.env.MONGODB_URI, {
      dbName: process.env.MONGODB_DB,
    }),
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Plan.name, schema: PlanSchema },
      { name: Order.name, schema: OrderSchema },
      { name: Subscription.name, schema: SubscriptionSchema },
      { name: CreditTransaction.name, schema: CreditTransactionSchema },
      { name: Prompt.name, schema: PromptSchema },
      { name: Video.name, schema: VideoSchema },
      { name: Trend.name, schema: TrendSchema },
      { name: WebhookDispatch.name, schema: WebhookDispatchSchema },
    ]),
    JwtModule.register({
      global: true,
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: process.env.JWT_EXPIRES_IN || '15m' },
    }),
  ],
  controllers: [
    AuthController,
    PlansController,
    CreditsController,
    PromptsController,
    VideosController,
    TrendsController,
    WebhooksController,
  ],
  providers: [
    AuthService,
    CreditsService,
    WebhooksService,
    JwtAuthGuard,
  ],
})
export class AppModule {}

