import { Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Role } from './entities/role.entity';
import { RolePermission } from './entities/role-permission.entity';
import { AppModule } from '../module/entities/app-module.entity';
import { Client } from '../client/entities/client.entity';
import { RolesService } from './services/roles.service';
import { RolesController } from './controllers/roles.controller';

@Module({
  imports: [TypeOrmModule.forFeature([Role, RolePermission, AppModule, Client])],
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
