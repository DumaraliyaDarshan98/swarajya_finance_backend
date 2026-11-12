import {
  Injectable,
  HttpStatus,
  ConflictException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { Client } from '../entities/client.entity';
import { User } from '../../user/entities/user.entity';
import { Role } from '../../../common/enums/role.enum';
import { CreateClientDto } from '../dto/create-client.dto';
import { UpdateClientDto } from '../dto/update-client.dto';
import { RegisterClientDto } from '../dto/register-client.dto';
import { ListClientsQueryDto } from '../dto/list-clients-query.dto';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';
import { MailService } from '../../mail/services/mail.service';
import { SubscriptionPlanService } from '../../subscription-plan/services/subscription-plan.service';

@Injectable()
export class ClientsService {
  constructor(
    @InjectRepository(Client) private clientRepo: Repository<Client>,
    @InjectRepository(User) private userRepo: Repository<User>,
    private mailService: MailService,
    private subscriptionPlanService: SubscriptionPlanService,
  ) {}

  private normalizeOptionalString(value?: string | null): string | undefined {
    if (value == null) return undefined;
    const normalized = value.trim();
    return normalized.length ? normalized : undefined;
  }

  private normalizeNullableForUpdate(value?: string | null): string | null {
    if (value == null) return null;
    const normalized = value.trim();
    return normalized.length ? normalized : null;
  }

  async createClient(dto: CreateClientDto): Promise<APIResponseInterface<any>> {
    const existing = await this.clientRepo.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('A client with this email already exists');
    }

    let setting = dto.setting ?? null;
    let subscriptionPlanId: string | null = dto.subscriptionPlanId ?? null;

    if (dto.subscriptionPlanId) {
      const plan = await this.subscriptionPlanService.findEntity(
        dto.subscriptionPlanId,
      );
      if (!plan) {
        throw new BadRequestException('Subscription plan not found');
      }
      if (!plan.isActive) {
        throw new BadRequestException('Subscription plan is inactive');
      }
      setting = this.subscriptionPlanService.settingsFromPlan(plan);
      subscriptionPlanId = plan.id;
    }

    const clientEntity = this.clientRepo.create({
      companyName: dto.bankVendorName,
      email: dto.email,
      contactPerson: dto.bankVendorName,
      phone: dto.mobileNumber,
      bankVendorType: dto.bankVendorType,
      bankVendorName: dto.bankVendorName,
      mobileNumber: dto.mobileNumber,
      natureOfServices: dto.natureOfServices,
      address: dto.address,
      pinCode: dto.pinCode,
      country: dto.country ?? 'India',
      state: dto.state,
      city: dto.city,
      bankName: dto.bankName,
      accountHolderName: dto.accountHolderName,
      accountNumber: dto.accountNumber,
      ifscCode: dto.ifscCode,
      branchName: dto.branchName,
      panNumber: dto.panNumber,
      panDocumentUrl: this.normalizeOptionalString(dto.panDocumentUrl),
      gstNumber: dto.gstNumber,
      gstDocumentUrl: this.normalizeOptionalString(dto.gstDocumentUrl),
      addressProofUrl: this.normalizeOptionalString(dto.addressProofUrl),
      cancelledChequeUrl: this.normalizeOptionalString(dto.cancelledChequeUrl),
      taxApprovalUrl: this.normalizeOptionalString(dto.taxApprovalUrl),
      agreementDocumentUrl: this.normalizeOptionalString(dto.agreementDocumentUrl),
      attachment1Url: this.normalizeOptionalString(dto.attachment1Url),
      attachment2Url: this.normalizeOptionalString(dto.attachment2Url),
      dsaTrainingAcknowledgeUrl: this.normalizeOptionalString(
        dto.dsaTrainingAcknowledgeUrl,
      ),
      approvedAttachmentUrl: this.normalizeOptionalString(
        dto.approvedAttachmentUrl,
      ),
      dueDiligenceDocumentUrl: this.normalizeOptionalString(
        dto.dueDiligenceDocumentUrl,
      ),
      setting,
      subscriptionPlanId,
    });
    const client = await this.clientRepo.save(clientEntity);

    const password = Math.random().toString(36).slice(-8);
    const hashed = await bcrypt.hash(password, 10);

    const userEntity = this.userRepo.create({
      fullName: dto.bankVendorName,
      email: dto.email,
      password: hashed,
      role: Role.CLIENT_ADMIN,
      client,
    });
    await this.userRepo.save(userEntity);

    await this.mailService.sendClientCredentials(
      dto.email,
      dto.bankVendorName,
      password,
    );

    return {
      code: HttpStatus.CREATED,
      message: 'Client created successfully',
      data: client,
    };
  }

  async findAll(
    query: ListClientsQueryDto,
    user: { role: string; clientId?: string },
  ): Promise<APIResponseInterface<Client[]>> {
      // if (user.role !== Role.SUPER_ADMIN) {
      //   throw new ForbiddenException('Only super admin can list all clients');
      // }

    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const skip = (page - 1) * limit;

    const qb = this.clientRepo
      .createQueryBuilder('client')
      .leftJoinAndSelect('client.subscriptionPlan', 'subscriptionPlan')
      .orderBy('client.createdAt', 'DESC');

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        '(client.company_name LIKE :term OR client.bank_vendor_name LIKE :term OR client.email LIKE :term OR client.mobile_number LIKE :term)',
        { term },
      );
    }

    const [list, total] = await qb.skip(skip).take(limit).getManyAndCount();

    return {
      code: HttpStatus.OK,
      message: 'Clients fetched successfully',
      data: list,
      pagination: {
        total,
        page,
        pagePerRecord: limit,
      },
    };
  }

  async findMyClient(user: {
    role: string;
    clientId?: string;
  }): Promise<APIResponseInterface<Client>> {
    if (!user.clientId) {
      throw new ForbiddenException('No client organization linked to this user');
    }
    return this.findOne(user.clientId, user);
  }

  /**
   * Client admin switches subscription plan.
   * Applies plan feature settings immediately.
   * Payment gateway can be inserted before this apply step later.
   */
  async changeMyPlan(
    user: { role: string; clientId?: string },
    subscriptionPlanId: string,
  ): Promise<APIResponseInterface<Client>> {
    if (user.role !== Role.CLIENT_ADMIN) {
      throw new ForbiddenException('Only client admin can change the subscription plan');
    }
    if (!user.clientId) {
      throw new ForbiddenException('No client organization linked to this user');
    }

    const client = await this.clientRepo.findOne({
      where: { id: user.clientId },
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    const plan = await this.subscriptionPlanService.findEntity(subscriptionPlanId);
    if (!plan) {
      throw new BadRequestException('Subscription plan not found');
    }
    if (!plan.isActive) {
      throw new BadRequestException('This subscription plan is not available');
    }

    // TODO: integrate payment gateway here before applying the plan.

    client.subscriptionPlanId = plan.id;
    client.setting = this.subscriptionPlanService.settingsFromPlan(plan);
    await this.clientRepo.save(client);

    const updated = await this.clientRepo.findOne({
      where: { id: client.id },
      relations: ['subscriptionPlan'],
    });

    return {
      code: HttpStatus.OK,
      message: 'Subscription plan updated successfully',
      data: updated!,
    };
  }

  async findOne(
    id: string,
    user: { role: string; clientId?: string },
  ): Promise<APIResponseInterface<Client>> {
    const client = await this.clientRepo.findOne({
      where: { id },
      relations: ['subscriptionPlan'],
    });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (
      (user.role === Role.CLIENT_ADMIN || user.role === Role.CLIENT_USER) &&
      user.clientId !== id
    ) {
      throw new ForbiddenException('You can only view your own client details');
    }

    return {
      code: HttpStatus.OK,
      message: 'Client details fetched successfully',
      data: client,
    };
  }

  async update(
    id: string,
    dto: UpdateClientDto,
    user: { role: string; clientId?: string },
  ): Promise<APIResponseInterface<Client>> {
    const client = await this.clientRepo.findOne({ where: { id } });
    if (!client) {
      throw new NotFoundException('Client not found');
    }

    if (user.role === Role.CLIENT_ADMIN && user.clientId !== id) {
      throw new ForbiddenException(
        'You can only update your own client details',
      );
    }

    if (dto.email && dto.email !== client.email) {
      const existing = await this.clientRepo.findOne({
        where: { email: dto.email },
      });
      if (existing) {
        throw new ConflictException('A client with this email already exists');
      }
    }

    const updatePayload: Record<string, any> = { ...dto };
    if (dto.bankVendorName != null) {
      updatePayload.companyName = dto.bankVendorName;
      updatePayload.contactPerson = dto.bankVendorName;
    }
    if (dto.mobileNumber != null) {
      updatePayload.phone = dto.mobileNumber;
    }
    if (dto.panDocumentUrl !== undefined) {
      updatePayload.panDocumentUrl = this.normalizeNullableForUpdate(
        dto.panDocumentUrl,
      );
    }
    if (dto.gstDocumentUrl !== undefined) {
      updatePayload.gstDocumentUrl = this.normalizeNullableForUpdate(
        dto.gstDocumentUrl,
      );
    }
    if (dto.addressProofUrl !== undefined) {
      updatePayload.addressProofUrl = this.normalizeNullableForUpdate(
        dto.addressProofUrl,
      );
    }
    if (dto.cancelledChequeUrl !== undefined) {
      updatePayload.cancelledChequeUrl = this.normalizeNullableForUpdate(
        dto.cancelledChequeUrl,
      );
    }
    if (dto.taxApprovalUrl !== undefined) {
      updatePayload.taxApprovalUrl = this.normalizeNullableForUpdate(
        dto.taxApprovalUrl,
      );
    }
    if (dto.agreementDocumentUrl !== undefined) {
      updatePayload.agreementDocumentUrl = this.normalizeNullableForUpdate(
        dto.agreementDocumentUrl,
      );
    }
    if (dto.attachment1Url !== undefined) {
      updatePayload.attachment1Url = this.normalizeNullableForUpdate(
        dto.attachment1Url,
      );
    }
    if (dto.attachment2Url !== undefined) {
      updatePayload.attachment2Url = this.normalizeNullableForUpdate(
        dto.attachment2Url,
      );
    }
    if (dto.dsaTrainingAcknowledgeUrl !== undefined) {
      updatePayload.dsaTrainingAcknowledgeUrl = this.normalizeNullableForUpdate(
        dto.dsaTrainingAcknowledgeUrl,
      );
    }
    if (dto.approvedAttachmentUrl !== undefined) {
      updatePayload.approvedAttachmentUrl = this.normalizeNullableForUpdate(
        dto.approvedAttachmentUrl,
      );
    }
    if (dto.dueDiligenceDocumentUrl !== undefined) {
      updatePayload.dueDiligenceDocumentUrl = this.normalizeNullableForUpdate(
        dto.dueDiligenceDocumentUrl,
      );
    }

    if (dto.subscriptionPlanId !== undefined) {
      if (dto.subscriptionPlanId === null || dto.subscriptionPlanId === '') {
        updatePayload.subscriptionPlanId = null;
      } else {
        const plan = await this.subscriptionPlanService.findEntity(
          dto.subscriptionPlanId,
        );
        if (!plan) {
          throw new BadRequestException('Subscription plan not found');
        }
        updatePayload.subscriptionPlanId = plan.id;
        // Re-apply plan features whenever the assigned plan changes
        if (plan.id !== client.subscriptionPlanId) {
          updatePayload.setting =
            this.subscriptionPlanService.settingsFromPlan(plan);
        }
      }
    }

    const filtered = Object.fromEntries(
      Object.entries(updatePayload).filter(([, v]) => v !== undefined),
    );

    await this.clientRepo.update(id, filtered);
    const updated = await this.clientRepo.findOne({
      where: { id },
      relations: ['subscriptionPlan'],
    });

    return {
      code: HttpStatus.OK,
      message: 'Client updated successfully',
      data: updated!,
    };
  }

  async registerClient(
    dto: RegisterClientDto,
  ): Promise<APIResponseInterface<any>> {
    if (dto.password !== dto.confirmPassword) {
      throw new BadRequestException('Passwords do not match');
    }

    const existingUser = await this.userRepo.findOne({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new ConflictException('Email already registered');
    }

    const existingClient = await this.clientRepo.findOne({
      where: { email: dto.email },
    });
    if (existingClient) {
      throw new ConflictException('Email already registered');
    }

    const fullName = `${dto.firstName} ${dto.lastName}`;
    const client = await this.clientRepo.save({
      companyName: `${dto.firstName} ${dto.lastName}'s Company`,
      email: dto.email,
      contactPerson: fullName,
      phone: dto.mobileNumber,
    });

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = await this.userRepo.save({
      fullName: fullName,
      email: dto.email,
      password: hashedPassword,
      role: Role.CLIENT_ADMIN,
      client: client,
    });

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
