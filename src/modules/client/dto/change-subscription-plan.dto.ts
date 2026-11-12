import { IsNotEmpty, IsUUID } from 'class-validator';

export class ChangeSubscriptionPlanDto {
  @IsUUID()
  @IsNotEmpty()
  subscriptionPlanId: string;
}
