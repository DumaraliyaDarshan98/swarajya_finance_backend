import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Client } from './entities/client.entity';
import { User } from '../user/entities/user.entity';
import { ClientsService } from './services/clients.service';
import { ClientsController } from './controllers/clients.controller';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [TypeOrmModule.forFeature([Client, User]), MailModule],
  providers: [ClientsService],
  controllers: [ClientsController],
})
export class ClientsModule {}
