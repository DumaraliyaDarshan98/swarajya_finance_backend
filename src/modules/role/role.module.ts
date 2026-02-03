import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { AppModule } from '../module/entities/app-module.entity';
import { RolesService } from './roles.service';
import { RolesController } from './roles.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([Role, RolePermission, AppModule]),
  ],
  providers: [RolesService],
  controllers: [RolesController],
  exports: [RolesService],
})
export class RoleModule implements OnModuleInit {
  constructor(private rolesService: RolesService) {}

  async onModuleInit() {
    await this.rolesService.seedModulesIfEmpty();
  }
}
