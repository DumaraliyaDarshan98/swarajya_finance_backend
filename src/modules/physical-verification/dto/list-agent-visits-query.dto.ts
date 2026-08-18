import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';

export class ListAgentVisitsQueryDto {
  @IsUUID()
  fieldAgentUserId: string;

  @IsOptional()
  @IsIn(['all', 'assigned', 'inprogress', 'pending', 'completed'])
  tab?: 'all' | 'assigned' | 'inprogress' | 'pending' | 'completed';

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 10;
}
