import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SubscriptionPlan } from './entities/subscription-plan.entity';
import { SubscriptionPlanService } from './services/subscription-plan.service';
import { SubscriptionPlanAdminController } from './controllers/subscription-plan-admin.controller';
import { SubscriptionPlanClientController } from './controllers/subscription-plan-client.controller';

@Module({
  imports: [TypeOrmModule.forFeature([SubscriptionPlan])],
  controllers: [
    SubscriptionPlanAdminController,
    SubscriptionPlanClientController,
  ],
  providers: [SubscriptionPlanService],
  exports: [SubscriptionPlanService, TypeOrmModule],
})
export class SubscriptionPlanModule {}
