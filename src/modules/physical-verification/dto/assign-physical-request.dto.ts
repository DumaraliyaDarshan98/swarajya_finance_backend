import { IsOptional, IsString, IsUUID } from 'class-validator';

export class AssignPhysicalRequestDto {
  @IsUUID()
  fieldAssistantId: string;

  @IsOptional()
  @IsString()
  comment?: string;
}

