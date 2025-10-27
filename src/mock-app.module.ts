import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { MockAuthController } from './controllers/mock-auth.controller';
import { MockPlansController } from './controllers/mock-plans.controller';
import { MockCreditsController } from './controllers/mock-credits.controller';
import { MockPromptsController } from './controllers/mock-prompts.controller';
import { MockVideosController } from './controllers/mock-videos.controller';
import { MockTrendsController } from './controllers/mock-trends.controller';
import { MockWebhooksController } from './controllers/mock-webhooks.controller';

@Module({
  imports: [
    ConfigModule.forRoot(),
  ],
  controllers: [
    MockAuthController,
    MockPlansController,
    MockCreditsController,
    MockPromptsController,
    MockVideosController,
    MockTrendsController,
    MockWebhooksController,
  ],
})
export class MockAppModule {}

