import { IsNotEmpty, IsOptional, IsString, IsUUID, IsBoolean, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class ModulePermissionDto {
  @IsUUID()
  moduleId: string;

  @IsArray()
  @IsString({ each: true })
  permissions: string[]; // VIEW, ADD, EDIT, LIST, DELETE
}

export class CreateRoleDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsUUID()
  clientId?: string | null;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ModulePermissionDto)
  permissions: ModulePermissionDto[];
}
