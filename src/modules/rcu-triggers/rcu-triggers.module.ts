import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RcuCategory } from './entities/rcu-category.entity';
import { RcuDocumentType } from './entities/rcu-document-type.entity';
import { RcuTrigger } from './entities/rcu-trigger.entity';
import { RcuTriggersService } from './services/rcu-triggers.service';
import { RcuTriggersAdminController } from './controllers/rcu-triggers-admin.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([RcuCategory, RcuDocumentType, RcuTrigger]),
  ],
  controllers: [RcuTriggersAdminController],
  providers: [RcuTriggersService],
  exports: [RcuTriggersService],
})
export class RcuTriggersModule {}
