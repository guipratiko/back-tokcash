import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from './config/config.module';
import { ConfigService } from './config/config.service';
import { AuthModule } from './auth/auth.module';
import { CreditsModule } from './credits/credits.module';
import { PlansModule } from './plans/plans.module';
import { OrdersModule } from './orders/orders.module';
import { PromptsModule } from './prompts/prompts.module';
import { VideosModule } from './videos/videos.module';
import { TrendsModule } from './trends/trends.module';
import { WebhooksModule } from './webhooks/webhooks.module';
import { AdminModule } from './admin/admin.module';
import { RolesGuard } from './auth/roles.guard';

@Module({
  imports: [
    ConfigModule,
    MongooseModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        uri: config.mongodbUri,
        dbName: config.mongodbDb,
      }),
    }),
    AuthModule,
    CreditsModule,
    PlansModule,
    OrdersModule,
    PromptsModule,
    VideosModule,
    TrendsModule,
    WebhooksModule,
    AdminModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: RolesGuard,
    },
  ],
})
export class AppModule {}

