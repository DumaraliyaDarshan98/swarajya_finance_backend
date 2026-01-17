import {
  Injectable,
  HttpStatus,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Client } from './entities/client.entity';
import { User } from '../user/entities/user.entity';
import { Role } from '../../enum/role.enum';
import { CreateClientDto } from './dto/create-client.dto';
import { RegisterClientDto } from './dto/register-client.dto';
import { APIResponseInterface } from '../../interface/response.interface';
import { MailService } from '../mail/mail.service';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private mailService: MailService,
  ) {}

  async createClient(dto: CreateClientDto): Promise<APIResponseInterface<any>> {
    const client = await this.clientRepo.save(dto);

    const password = Math.random().toString(36).slice(-8);
    const hashed = await bcrypt.hash(password, 10);

    await this.userRepo.save({
      fullName: dto.contactPerson,
      email: dto.email,
      password: hashed,
      role: Role.CLIENT_ADMIN,
      client,
    });

    // Send credentials email
    await this.mailService.sendClientCredentials(
      dto.email,
      dto.contactPerson,
      password,
    );

    return {
      code: HttpStatus.CREATED,
      message: 'Client created successfully',
      data: client,
    };
  }

  async registerClient(dto: RegisterClientDto): Promise<APIResponseInterface<any>> {
    // Validate password match
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    // Check if email already exists
    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    // Check if client email already exists
    const existingClient = await this.clientRepo.findOne({
      where: { email: dto.email },
    });

    if (existingClient) {
      throw new ConflictException('Email already registered');
    }

    // Create client entity
    const fullName = `${dto.firstName} ${dto.lastName}`;
    const client = await this.clientRepo.save({
      companyName: `${dto.firstName} ${dto.lastName}'s Company`,
      email: dto.email,
      contactPerson: fullName,
      phone: dto.mobileNumber,
    });

    // Hash password
    const hashedPassword = await bcrypt.hash(dto.password, 10);

    // Create user account
    const user = await this.userRepo.save({
      fullName: fullName,
      email: dto.email,
      password: hashedPassword,
      role: Role.CLIENT_ADMIN,
      client: client,
    });

    // Remove password from response
    const { password, ...userWithoutPassword } = user;

    return {
      code: HttpStatus.CREATED,
      message: 'Client registered successfully',
      data: {
        user: userWithoutPassword,
        client: client,
      },
    };
  }
}
