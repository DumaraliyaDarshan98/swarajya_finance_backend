import { IsNotEmpty, IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignFieldAgentDto {
  @IsUUID()
  @IsNotEmpty()
  fieldAgentUserId: string;

  @IsOptional()
  @IsString()
  note?: string;
}
