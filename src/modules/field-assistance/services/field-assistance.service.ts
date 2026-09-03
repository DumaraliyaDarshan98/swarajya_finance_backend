import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, Repository } from 'typeorm';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';
import { FieldAssistant } from '../entities/field-assistant.entity';
import { ListFieldAssistantsQueryDto } from '../dto/list-field-assistants-query.dto';
import { UpsertFieldAssistantDto } from '../dto/field-assistant.dto';
import { UpdateFieldAssistantInsuranceDto } from '../dto/update-field-assistant-insurance.dto';
import { FieldAssistantAddress } from '../entities/field-assistant-address.entity';
import { FieldAssistantEmergencyContact } from '../entities/field-assistant-emergency-contact.entity';
import { FieldAssistantEducation } from '../entities/field-assistant-education.entity';
import { FieldAssistantBankAccount } from '../entities/field-assistant-bank-account.entity';
import { FieldAssistantFamilyMember } from '../entities/field-assistant-family-member.entity';
import { FieldAssistantIdentification } from '../entities/field-assistant-identification.entity';
import { FieldAssistantPreviousEmployment } from '../entities/field-assistant-previous-employment.entity';
import { FieldAssistantIdSequence } from '../entities/field-assistant-id-sequence.entity';
import { UsersService } from '../../user/services/users.service';
import { MailService } from '../../mail/services/mail.service';
import { PHYSICAL_CASE_REWARD_AMOUNT } from '../../field-agent-wallet/constants';

export interface FieldAgentOnboardingPayload {
  isAcceptTermAndCondition: boolean;
  profile: {
    fieldAgentId: string | null;
    fullName: string;
    joiningDate: string | null;
    reportingManager: string | null;
    partTimeOrFullTime: string | null;
    fieldOrChoiceDepartment: string | null;
    officeEmailId: string | null;
    officeMobile: string | null;
  };
  termsAndConditions: {
    title: string;
    version: string;
    content: string;
  };
  offerLetter: {
    referenceNo: string;
    issueDate: string;
    position: string;
    department: string;
    employmentType: string;
    reportingTo: string;
    content: string;
  };
  joinDateConfirm: {
    joiningDate: string | null;
    reportingManager: string | null;
    workLocation: string;
    confirmationNote: string;
  };
  petrolRate: {
    ratePerKm: number;
    currency: string;
    effectiveFrom: string;
    reimbursementCycle: string;
    note: string;
  };
  jobProfile: {
    role: string;
    department: string;
    responsibilities: string[];
    workingHours: string;
    toolsProvided: string[];
  };
  perCaseRate: {
    amount: number;
    currency: string;
    caseType: string;
    paymentTimeline: string;
    note: string;
  };
  salarySlip: {
    month: string;
    employeeName: string;
    employeeId: string | null;
    grossSalary: number;
    deductions: number;
    netSalary: number;
    note: string;
  };
  incentivePerformance: {
    period: string;
    completedCases: number;
    targetCases: number;
    bonusEligible: boolean;
    incentiveAmount: number;
    performanceNote: string;
    tiers: Array<{ label: string; cases: number; bonus: number }>;
  };
}

@Injectable()
export class FieldAssistanceService {
  constructor(
    @InjectRepository(FieldAssistant)
    private readonly repo: Repository<FieldAssistant>,
    @InjectRepository(FieldAssistantIdSequence)
    private readonly seqRepo: Repository<FieldAssistantIdSequence>,
    private readonly usersService: UsersService,
    private readonly mailService: MailService,
  ) {}

  private calculateAge(dob: string): number | null {
    if (!dob) return null;
    const d = new Date(dob);
    if (Number.isNaN(d.getTime())) return null;
    const today = new Date();
    let age = today.getFullYear() - d.getFullYear();
    const m = today.getMonth() - d.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
    return age >= 0 ? age : null;
  }

  private validateAgeGte18(dob: string): void {
    const age = this.calculateAge(dob);
    if (age == null) throw new BadRequestException('Invalid dateOfBirth');
    if (age < 18)
      throw new BadRequestException('Age must be 18 years or above');
  }

  private validateSingleActiveBankAccount(
    bankDetails: { status: string }[],
  ): void {
    const activeCount = (bankDetails || []).filter((b) => b?.status === 'Active')
      .length;
    if (activeCount > 1) {
      throw new BadRequestException(
        'Only one bank account can be Active at a time',
      );
    }
  }

  private formatFieldAgentId(seq: number): string {
    return `SWFAID-${String(seq).padStart(3, '0')}`;
  }

  private resolveLoginEmail(dto: UpsertFieldAssistantDto): string | null {
    const office = dto.officeContact?.emailId?.trim();
    const personal = dto.personalContact?.emailId?.trim();
    return office || personal || null;
  }

  async findByUserId(userId: string): Promise<FieldAssistant | null> {
    return this.repo.findOne({ where: { userId } });
  }

  private resolveLoginEmailFromEntity(fa: FieldAssistant): string | null {
    return fa.officeEmailId?.trim() || fa.personalEmailId?.trim() || null;
  }

  private async assertRegistrationEmailAvailable(dto: UpsertFieldAssistantDto): Promise<string> {
    const loginEmail = this.resolveLoginEmail(dto);
    if (!loginEmail) {
      throw new BadRequestException(
        'Office or personal email is required for field agent registration',
      );
    }
    const normalized = loginEmail.trim().toLowerCase();
    const existingUser = await this.usersService.findByEmail(normalized);
    if (existingUser) {
      throw new ConflictException('An account with this email already exists');
    }

    const existingApplication = await this.repo
      .createQueryBuilder('fa')
      .where(
        '(LOWER(fa.office_email_id) = :email OR LOWER(fa.personal_email_id) = :email)',
        { email: normalized },
      )
      .andWhere('fa.status IN (:...statuses)', { statuses: ['Pending', 'Active'] })
      .getOne();
    if (existingApplication) {
      throw new ConflictException('A field agent application with this email already exists');
    }
    return normalized;
  }

  private async provisionLoginAccountFromEntity(
    saved: FieldAssistant,
    approved = false,
  ): Promise<FieldAssistant> {
    const loginEmail = this.resolveLoginEmailFromEntity(saved);
    if (!loginEmail) {
      throw new BadRequestException(
        'Office or personal email is required to create a field agent login account',
      );
    }

    const { user, plainPassword } = await this.usersService.createFieldAgentUser({
      fullName: saved.fullName || `${saved.firstName} ${saved.lastName}`.trim(),
      email: loginEmail,
    });

    saved.userId = user.id;
    const linked = await this.repo.save(saved);

    try {
      await this.mailService.sendFieldAgentCredentials(
        loginEmail,
        linked.fullName || linked.firstName,
        linked.fieldAgentId || '',
        plainPassword,
        approved,
      );
    } catch {
      // Profile and user are created; mail failure should not roll back.
    }

    return linked;
  }

  async selfRegister(
    dto: UpsertFieldAssistantDto,
  ): Promise<APIResponseInterface<FieldAssistant>> {
    await this.assertRegistrationEmailAvailable(dto);
    return this.create(dto, undefined, { provisionLogin: false, status: 'Pending' });
  }

  private async syncLoginAccount(
    fa: FieldAssistant,
    dto: UpsertFieldAssistantDto,
  ): Promise<void> {
    if (!fa.userId) return;
    const loginEmail = this.resolveLoginEmail(dto);
    await this.usersService.updateFieldAgentLogin(fa.userId, {
      fullName:
        dto.fullName?.trim() ||
        [dto.firstName, dto.middleName, dto.lastName].filter(Boolean).join(' '),
      email: loginEmail || undefined,
    });
  }

  /**
   * Create a field assistant with all nested details.
   * - Validates age >= 18
   * - Ensures only one Active bank account in bankDetails
   */
  async create(
    dto: UpsertFieldAssistantDto,
    userId?: string,
    options?: { provisionLogin?: boolean; status?: 'Active' | 'Inactive' | 'Pending' },
  ): Promise<APIResponseInterface<FieldAssistant>> {
    this.validateAgeGte18(dto.dateOfBirth);
    this.validateSingleActiveBankAccount(dto.bankDetails || []);

    const status = options?.status ?? (dto.status as FieldAssistant['status']) ?? 'Active';
    const shouldProvisionLogin = options?.provisionLogin ?? status === 'Active';

    if (shouldProvisionLogin) {
      await this.assertRegistrationEmailAvailable(dto);
    }

    // Generate next sequence number from DB (AUTO_INCREMENT).
    const seqRow = await this.seqRepo.save(this.seqRepo.create({}));
    const nextSeq = seqRow.id;

    const entity = this.repo.create({
      createdBy: userId ?? null,
      updatedBy: userId ?? null,
      fieldAgentSeq: nextSeq,
      firstName: dto.firstName.trim(),
      middleName: dto.middleName?.trim() || null,
      lastName: dto.lastName.trim(),
      fullName:
        dto.fullName?.trim() ||
        [dto.firstName, dto.middleName, dto.lastName].filter(Boolean).join(' '),
      dateOfBirth: dto.dateOfBirth,
      age: this.calculateAge(dto.dateOfBirth),
      maritalStatus: (dto.maritalStatus as any) ?? null,
      marriageDate: dto.marriageDate ?? null,
      gender: dto.gender as any,
      bloodGroup: dto.bloodGroup?.trim() || null,
      nationality: dto.nationality?.trim() || null,

      officeMobile: dto.officeContact?.mobile?.trim() || null,
      officeEmailId: dto.officeContact?.emailId?.trim() || null,
      personalMobile: dto.personalContact?.mobile?.trim() || null,
      personalEmailId: dto.personalContact?.emailId?.trim() || null,

      partTimeOrFullTime: dto.partTimeOrFullTime ?? null,
      fieldOrChoiceDepartment: dto.fieldOrChoiceDepartment ?? null,

      previousEmploymentType: (dto.previousEmploymentType as any) ?? null,
      documentUploads: dto.documentUploads ?? null,

      fieldAgentId: this.formatFieldAgentId(nextSeq),
      status,
      assignCompanyClient: dto.assignCompanyClient ?? null,
      reportingManager: dto.reportingManager ?? null,
      joiningDate: dto.joiningDate ?? null,
      remarks: dto.remarks ?? null,

      addresses: (dto.addresses || []).map((a) =>
        Object.assign(new FieldAssistantAddress(), {
          createdBy: userId ?? null,
          updatedBy: userId ?? null,
          addressType: a.addressType,
          completeAddress: a.completeAddress,
          landmark: a.landmark?.trim() || null,
          city: a.city,
          state: a.state,
          country: a.country,
          postalCode: a.postalCode,
        }),
      ),
      emergencyDetails: (dto.emergencyDetails || []).map((e) =>
        Object.assign(new FieldAssistantEmergencyContact(), {
          createdBy: userId ?? null,
          updatedBy: userId ?? null,
          name: e.name,
          relationship: e.relationship,
          landline: e.landline?.trim() || null,
          mobile: e.mobile,
        }),
      ),
      educationDetails: (dto.educationDetails || []).map((e) =>
        Object.assign(new FieldAssistantEducation(), {
          createdBy: userId ?? null,
          updatedBy: userId ?? null,
          educationCategory: e.educationCategory,
          educationType: e.educationType,
          specialization: e.specialization?.trim() || null,
          institute: e.institute,
          country: e.country?.trim() || null,
          from: e.from,
          to: e.to,
          partOrFullTime: e.partOrFullTime ?? null,
        }),
      ),
      bankDetails: (dto.bankDetails || []).map((b) =>
        Object.assign(new FieldAssistantBankAccount(), {
          createdBy: userId ?? null,
          updatedBy: userId ?? null,
          bankName: b.bankName,
          accountNumber: b.accountNumber,
          accountType: b.accountType?.trim() || null,
          branch: b.branch?.trim() || null,
          ifsc: b.ifsc,
          upiId: b.upiId?.trim() || null,
          status: b.status as any,
        }),
      ),
      familyDetails: (dto.familyDetails || []).map((f) =>
        Object.assign(new FieldAssistantFamilyMember(), {
          createdBy: userId ?? null,
          updatedBy: userId ?? null,
          name: f.name,
          relationship: f.relationship,
          dateOfBirth: f.dateOfBirth,
          emailId: f.emailId?.trim() || null,
          gender: f.gender,
          nationality: f.nationality?.trim() || null,
          mobile: f.mobile?.trim() || null,
        }),
      ),
      identificationDetails: (dto.identificationDetails || []).map((i) =>
        Object.assign(new FieldAssistantIdentification(), {
          createdBy: userId ?? null,
          updatedBy: userId ?? null,
          identificationType: i.identificationType as any,
          identificationNo: i.identificationNo,
          uploadDocument: i.uploadDocument?.trim() || null,
        }),
      ),
      previousEmploymentDetails: (dto.previousEmploymentDetails || []).map((p) =>
        Object.assign(new FieldAssistantPreviousEmployment(), {
          createdBy: userId ?? null,
          updatedBy: userId ?? null,
          organization: p.organization,
          designationOrRole: p.designationOrRole,
          partOrFullTime: p.partOrFullTime ?? null,
          from: p.from,
          to: p.to,
          totalWorkExperienceYrs:
            p.totalWorkExperienceYrs != null ? Number(p.totalWorkExperienceYrs) : null,
          city: p.city,
          country: p.country,
          hrMailId: p.hrMailId?.trim() || null,
          hrContactNo: p.hrContactNo?.trim() || null,
        }),
      ),
    });

    const saved = await this.repo.save(entity);
    if (shouldProvisionLogin) {
      const withLogin = await this.provisionLoginAccountFromEntity(saved);
      return {
        code: HttpStatus.CREATED,
        message:
          'Field assistant created successfully. Login credentials have been emailed.',
        data: withLogin,
      };
    }

    return {
      code: HttpStatus.CREATED,
      message:
        status === 'Pending'
          ? 'Field agent registration submitted successfully. You will receive login credentials after super admin approval.'
          : 'Field assistant created successfully.',
      data: saved,
    };
  }

  private mapAddresses(
    fieldAssistantId: string,
    userId: string | undefined,
    dto: UpsertFieldAssistantDto,
  ): FieldAssistantAddress[] {
    return (dto.addresses || []).map((a) =>
      Object.assign(new FieldAssistantAddress(), {
        fieldAssistantId,
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
        addressType: a.addressType,
        completeAddress: a.completeAddress,
        landmark: a.landmark?.trim() || null,
        city: a.city,
        state: a.state,
        country: a.country,
        postalCode: a.postalCode,
      }),
    );
  }

  private mapEmergencyContacts(
    fieldAssistantId: string,
    userId: string | undefined,
    dto: UpsertFieldAssistantDto,
  ): FieldAssistantEmergencyContact[] {
    return (dto.emergencyDetails || []).map((e) =>
      Object.assign(new FieldAssistantEmergencyContact(), {
        fieldAssistantId,
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
        name: e.name,
        relationship: e.relationship,
        landline: e.landline?.trim() || null,
        mobile: e.mobile,
      }),
    );
  }

  private mapEducation(
    fieldAssistantId: string,
    userId: string | undefined,
    dto: UpsertFieldAssistantDto,
  ): FieldAssistantEducation[] {
    return (dto.educationDetails || []).map((e) =>
      Object.assign(new FieldAssistantEducation(), {
        fieldAssistantId,
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
        educationCategory: e.educationCategory,
        educationType: e.educationType,
        specialization: e.specialization?.trim() || null,
        institute: e.institute,
        country: e.country?.trim() || null,
        from: e.from,
        to: e.to,
        partOrFullTime: e.partOrFullTime ?? null,
      }),
    );
  }

  private mapBankAccounts(
    fieldAssistantId: string,
    userId: string | undefined,
    dto: UpsertFieldAssistantDto,
  ): FieldAssistantBankAccount[] {
    return (dto.bankDetails || []).map((b) =>
      Object.assign(new FieldAssistantBankAccount(), {
        fieldAssistantId,
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
        bankName: b.bankName,
        accountNumber: b.accountNumber,
        accountType: b.accountType?.trim() || null,
        branch: b.branch?.trim() || null,
        ifsc: b.ifsc,
        upiId: b.upiId?.trim() || null,
        status: b.status as any,
      }),
    );
  }

  private mapFamilyMembers(
    fieldAssistantId: string,
    userId: string | undefined,
    dto: UpsertFieldAssistantDto,
  ): FieldAssistantFamilyMember[] {
    return (dto.familyDetails || []).map((f) =>
      Object.assign(new FieldAssistantFamilyMember(), {
        fieldAssistantId,
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
        name: f.name,
        relationship: f.relationship,
        dateOfBirth: f.dateOfBirth,
        emailId: f.emailId?.trim() || null,
        gender: f.gender,
        nationality: f.nationality?.trim() || null,
        mobile: f.mobile?.trim() || null,
      }),
    );
  }

  private mapIdentifications(
    fieldAssistantId: string,
    userId: string | undefined,
    dto: UpsertFieldAssistantDto,
  ): FieldAssistantIdentification[] {
    return (dto.identificationDetails || []).map((i) =>
      Object.assign(new FieldAssistantIdentification(), {
        fieldAssistantId,
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
        identificationType: i.identificationType as any,
        identificationNo: i.identificationNo,
        uploadDocument: i.uploadDocument?.trim() || null,
      }),
    );
  }

  private mapPreviousEmployment(
    fieldAssistantId: string,
    userId: string | undefined,
    dto: UpsertFieldAssistantDto,
  ): FieldAssistantPreviousEmployment[] {
    return (dto.previousEmploymentDetails || []).map((p) =>
      Object.assign(new FieldAssistantPreviousEmployment(), {
        fieldAssistantId,
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
        organization: p.organization,
        designationOrRole: p.designationOrRole,
        partOrFullTime: p.partOrFullTime ?? null,
        from: p.from,
        to: p.to,
        totalWorkExperienceYrs:
          p.totalWorkExperienceYrs != null ? Number(p.totalWorkExperienceYrs) : null,
        city: p.city,
        country: p.country,
        hrMailId: p.hrMailId?.trim() || null,
        hrContactNo: p.hrContactNo?.trim() || null,
      }),
    );
  }

  /**
   * Replace all nested rows on update.
   * TypeORM cascade replace tries to NULL the FK on orphaned rows, which fails
   * because field_assistant_id is NOT NULL — so delete then insert explicitly.
   */
  private async replaceNestedDetails(
    manager: EntityManager,
    fieldAssistantId: string,
    userId: string | undefined,
    dto: UpsertFieldAssistantDto,
  ): Promise<void> {
    await manager.delete(FieldAssistantAddress, { fieldAssistantId });
    await manager.delete(FieldAssistantEmergencyContact, { fieldAssistantId });
    await manager.delete(FieldAssistantEducation, { fieldAssistantId });
    await manager.delete(FieldAssistantBankAccount, { fieldAssistantId });
    await manager.delete(FieldAssistantFamilyMember, { fieldAssistantId });
    await manager.delete(FieldAssistantIdentification, { fieldAssistantId });
    await manager.delete(FieldAssistantPreviousEmployment, { fieldAssistantId });

    const addresses = this.mapAddresses(fieldAssistantId, userId, dto);
    if (addresses.length) await manager.save(FieldAssistantAddress, addresses);

    const emergency = this.mapEmergencyContacts(fieldAssistantId, userId, dto);
    if (emergency.length) await manager.save(FieldAssistantEmergencyContact, emergency);

    const education = this.mapEducation(fieldAssistantId, userId, dto);
    if (education.length) await manager.save(FieldAssistantEducation, education);

    const banks = this.mapBankAccounts(fieldAssistantId, userId, dto);
    if (banks.length) await manager.save(FieldAssistantBankAccount, banks);

    const family = this.mapFamilyMembers(fieldAssistantId, userId, dto);
    if (family.length) await manager.save(FieldAssistantFamilyMember, family);

    const identifications = this.mapIdentifications(fieldAssistantId, userId, dto);
    if (identifications.length) await manager.save(FieldAssistantIdentification, identifications);

    const previous = this.mapPreviousEmployment(fieldAssistantId, userId, dto);
    if (previous.length) await manager.save(FieldAssistantPreviousEmployment, previous);
  }

  private applyScalarFields(
    fa: FieldAssistant,
    dto: UpsertFieldAssistantDto,
    userId?: string,
  ): void {
    fa.updatedBy = userId ?? fa.updatedBy ?? null;
    fa.firstName = dto.firstName.trim();
    fa.middleName = dto.middleName?.trim() || null;
    fa.lastName = dto.lastName.trim();
    fa.fullName =
      dto.fullName?.trim() ||
      [dto.firstName, dto.middleName, dto.lastName].filter(Boolean).join(' ');
    fa.dateOfBirth = dto.dateOfBirth;
    fa.age = this.calculateAge(dto.dateOfBirth);
    fa.maritalStatus = (dto.maritalStatus as any) ?? null;
    fa.marriageDate = dto.marriageDate ?? null;
    fa.gender = dto.gender as any;
    fa.bloodGroup = dto.bloodGroup?.trim() || null;
    fa.nationality = dto.nationality?.trim() || null;

    fa.officeMobile = dto.officeContact?.mobile?.trim() || null;
    fa.officeEmailId = dto.officeContact?.emailId?.trim() || null;
    fa.personalMobile = dto.personalContact?.mobile?.trim() || null;
    fa.personalEmailId = dto.personalContact?.emailId?.trim() || null;

    fa.partTimeOrFullTime = dto.partTimeOrFullTime ?? null;
    fa.fieldOrChoiceDepartment = dto.fieldOrChoiceDepartment ?? null;

    fa.previousEmploymentType = (dto.previousEmploymentType as any) ?? null;
    fa.documentUploads = dto.documentUploads ?? null;

    fa.status = dto.status as any;
    fa.assignCompanyClient = dto.assignCompanyClient ?? null;
    fa.reportingManager = dto.reportingManager ?? null;
    fa.joiningDate = dto.joiningDate ?? null;
    fa.remarks = dto.remarks ?? null;
  }

  /**
   * Listing API with search/sort/pagination.
   * Search supports: fullName, firstName, lastName, fieldAgentId, office/personal mobile/email.
   */
  async list(
    query: ListFieldAssistantsQueryDto,
  ): Promise<APIResponseInterface<FieldAssistant[]>> {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 10));
    const skip = (page - 1) * limit;

    const allowedSort: Record<string, string> = {
      createdAt: 'fa.createdAt',
      fullName: 'fa.fullName',
      fieldAgentId: 'fa.fieldAgentId',
      status: 'fa.status',
    };
    const sortBy = allowedSort[query.sortBy ?? 'createdAt'] ?? allowedSort.createdAt;
    const sortOrder =
      (query.sortOrder ?? 'DESC').toString().toUpperCase() === 'ASC'
        ? 'ASC'
        : 'DESC';

    const qb = this.repo.createQueryBuilder('fa').orderBy(sortBy, sortOrder as any);

    if (query.search?.trim()) {
      const term = `%${query.search.trim()}%`;
      qb.andWhere(
        `(fa.full_name LIKE :term OR fa.first_name LIKE :term OR fa.last_name LIKE :term OR fa.field_agent_id LIKE :term OR fa.office_mobile LIKE :term OR fa.personal_mobile LIKE :term OR fa.office_email_id LIKE :term OR fa.personal_email_id LIKE :term)`,
        { term },
      );
    }

    const [list, total] = await qb.skip(skip).take(limit).getManyAndCount();
    return {
      code: HttpStatus.OK,
      message: 'Field assistants fetched successfully',
      data: list,
      pagination: { total, page, pagePerRecord: limit },
    };
  }

  async getById(id: string): Promise<APIResponseInterface<FieldAssistant>> {
    const fa = await this.repo.findOne({
      where: { id },
      relations: [
        'addresses',
        'emergencyDetails',
        'educationDetails',
        'bankDetails',
        'familyDetails',
        'identificationDetails',
        'previousEmploymentDetails',
      ],
      order: {
        addresses: { addressType: 'ASC' as any },
      } as any,
    });
    if (!fa) throw new NotFoundException('Field assistant not found');
    return { code: HttpStatus.OK, message: 'Field assistant fetched', data: fa };
  }

  /** Logged-in field agent: full profile by user id (not FA uuid). */
  async getProfileForUser(
    userId: string,
  ): Promise<APIResponseInterface<FieldAssistant>> {
    const fa = await this.findByUserId(userId);
    if (!fa) {
      throw new NotFoundException('Field agent profile not found');
    }
    return this.getById(fa.id);
  }

  /**
   * Self-service profile update. Admin-only fields are locked to existing values.
   */
  async updateProfileForUser(
    userId: string,
    dto: UpsertFieldAssistantDto,
  ): Promise<APIResponseInterface<FieldAssistant>> {
    const fa = await this.findByUserId(userId);
    if (!fa) {
      throw new NotFoundException('Field agent profile not found');
    }

    const toDateStr = (value: unknown): string | undefined => {
      if (value == null || value === '') return undefined;
      if (value instanceof Date) return value.toISOString().slice(0, 10);
      return String(value).slice(0, 10);
    };

    const locked: UpsertFieldAssistantDto = {
      ...dto,
      status: fa.status,
      fieldAgentId: fa.fieldAgentId ?? undefined,
      assignCompanyClient: fa.assignCompanyClient ?? undefined,
      reportingManager: fa.reportingManager ?? undefined,
      joiningDate: toDateStr(fa.joiningDate),
      remarks: fa.remarks ?? undefined,
    };

    return this.update(fa.id, locked, userId);
  }

  /**
   * Edit/update field assistant with nested details.
   * - Validates age >= 18
   * - Ensures only one Active bank account in bankDetails
   */
  async update(
    id: string,
    dto: UpsertFieldAssistantDto,
    userId?: string,
  ): Promise<APIResponseInterface<FieldAssistant>> {
    this.validateAgeGte18(dto.dateOfBirth);
    this.validateSingleActiveBankAccount(dto.bankDetails || []);

    const fa = await this.repo.findOne({ where: { id } });
    if (!fa) throw new NotFoundException('Field assistant not found');

    this.applyScalarFields(fa, dto, userId);

    await this.repo.manager.transaction(async (manager) => {
      await manager.save(FieldAssistant, fa);
      await this.replaceNestedDetails(manager, fa.id, userId, dto);
    });

    await this.syncLoginAccount(fa, dto);

    const saved = await this.repo.findOne({
      where: { id },
      relations: [
        'addresses',
        'emergencyDetails',
        'educationDetails',
        'bankDetails',
        'familyDetails',
        'identificationDetails',
        'previousEmploymentDetails',
      ],
    });

    return {
      code: HttpStatus.OK,
      message: 'Field assistant updated successfully',
      data: saved!,
    };
  }

  /**
   * Delete field assistant (child tables are deleted via CASCADE).
   */
  async delete(id: string): Promise<APIResponseInterface<any>> {
    const fa = await this.repo.findOne({ where: { id } });
    if (!fa) throw new NotFoundException('Field assistant not found');
    if (fa.userId) {
      await this.usersService.deleteById(fa.userId);
    }
    await this.repo.delete(id);
    return {
      code: HttpStatus.OK,
      message: 'Field assistant deleted successfully',
      data: { id },
    };
  }

  /**
   * Save insurance details from field-agent view page (super admin).
   */
  async updateInsurance(
    id: string,
    dto: UpdateFieldAssistantInsuranceDto,
    userId?: string,
  ): Promise<APIResponseInterface<FieldAssistant>> {
    const fa = await this.repo.findOne({
      where: { id },
      relations: [
        'addresses',
        'emergencyDetails',
        'educationDetails',
        'bankDetails',
        'familyDetails',
        'identificationDetails',
        'previousEmploymentDetails',
      ],
    });
    if (!fa) throw new NotFoundException('Field assistant not found');

    const clean = (v?: string | null) => {
      if (v == null) return null;
      const t = String(v).trim();
      return t ? t : null;
    };

    fa.insuranceDetails = {
      providerCompany: clean(dto.providerCompany),
      policyNumber: clean(dto.policyNumber),
      insuranceType: clean(dto.insuranceType),
      coverageAmount: clean(dto.coverageAmount),
      premiumAmount: clean(dto.premiumAmount),
      startDate: clean(dto.startDate),
      endDate: clean(dto.endDate),
      nomineeName: clean(dto.nomineeName),
      nomineeRelation: clean(dto.nomineeRelation),
      notes: clean(dto.notes),
    };
    fa.updatedBy = userId ?? fa.updatedBy ?? null;
    const saved = await this.repo.save(fa);

    return {
      code: HttpStatus.OK,
      message: 'Insurance details saved successfully',
      data: saved,
    };
  }

  /**
   * Update status (Active/Inactive) for listing quick action.
   */
  async updateStatus(
    id: string,
    status: 'Active' | 'Inactive' | 'Pending',
    userId?: string,
  ): Promise<APIResponseInterface<FieldAssistant>> {
    const fa = await this.repo.findOne({ where: { id } });
    if (!fa) throw new NotFoundException('Field assistant not found');

    if (fa.status === 'Pending' && status === 'Active') {
      fa.status = 'Active';
      fa.updatedBy = userId ?? fa.updatedBy ?? null;
      let saved = await this.repo.save(fa);
      if (!saved.userId) {
        saved = await this.provisionLoginAccountFromEntity(saved, true);
      }
      return {
        code: HttpStatus.OK,
        message: 'Field agent approved successfully. Login credentials have been emailed.',
        data: saved,
      };
    }

    if (fa.status === 'Pending' && status === 'Inactive') {
      fa.status = 'Inactive';
      fa.updatedBy = userId ?? fa.updatedBy ?? null;
      const saved = await this.repo.save(fa);
      return {
        code: HttpStatus.OK,
        message: 'Field agent registration rejected',
        data: saved,
      };
    }

    fa.status = status;
    fa.updatedBy = userId ?? fa.updatedBy ?? null;
    const saved = await this.repo.save(fa);
    return {
      code: HttpStatus.OK,
      message: 'Status updated successfully',
      data: saved,
    };
  }

  private buildOnboardingPayload(fa: FieldAssistant): FieldAgentOnboardingPayload {
    const fullName =
      fa.fullName?.trim() || `${fa.firstName} ${fa.lastName}`.trim();
    const joiningDate = fa.joiningDate ?? null;
    const reportingManager = fa.reportingManager ?? 'Operations Manager';
    const employmentType = fa.partTimeOrFullTime ?? 'Full Time';
    const department =
      fa.fieldOrChoiceDepartment === 'Field'
        ? 'Field Operations'
        : 'Verification Operations';
    const perCaseAmount = PHYSICAL_CASE_REWARD_AMOUNT;
    const issueDate = joiningDate ?? new Date().toISOString().slice(0, 10);

    return {
      isAcceptTermAndCondition: !!fa.isAcceptTermAndCondition,
      profile: {
        fieldAgentId: fa.fieldAgentId,
        fullName,
        joiningDate,
        reportingManager,
        partTimeOrFullTime: fa.partTimeOrFullTime,
        fieldOrChoiceDepartment: fa.fieldOrChoiceDepartment,
        officeEmailId: fa.officeEmailId,
        officeMobile: fa.officeMobile,
      },
      termsAndConditions: {
        title: 'Field Agent Terms & Conditions',
        version: '1.0',
        content: [
          'You agree to perform assigned verification visits professionally and within agreed timelines.',
          'All case data, customer information, and reports are confidential and must not be shared outside the platform.',
          'Geo-tagged photos, attendance, and visit submissions must reflect actual on-site verification.',
          'Misrepresentation, falsified documents, or incomplete submissions may lead to case rejection and account suspension.',
          'Petrol reimbursement, per-case earnings, and incentives are governed by company policy and may be revised with notice.',
          'You must maintain valid identification documents and comply with local laws during field visits.',
          'The company may audit submitted visits and wallet transactions at any time.',
          'Continued use of the field agent portal constitutes acceptance of these terms.',
        ].join('\n\n'),
      },
      offerLetter: {
        referenceNo: `OL/${fa.fieldAgentId ?? fa.id.slice(0, 8).toUpperCase()}`,
        issueDate,
        position: 'Field Verification Agent',
        department,
        employmentType,
        reportingTo: reportingManager,
        content: [
          `Dear ${fullName},`,
          '',
          'We are pleased to offer you the position of Field Verification Agent with Swarajya Finance.',
          `Your Field Agent ID is ${fa.fieldAgentId ?? 'to be assigned'}.`,
          `Expected joining date: ${joiningDate ?? 'As communicated by HR'}.`,
          `You will report to ${reportingManager}.`,
          '',
          'This offer is subject to successful document verification and acceptance of company policies through the field agent portal.',
          '',
          'We look forward to your contribution to accurate and timely field verifications.',
        ].join('\n'),
      },
      joinDateConfirm: {
        joiningDate,
        reportingManager,
        workLocation: 'Assigned territory / client locations',
        confirmationNote:
          'Please confirm that the joining date and reporting details shown above are correct. Contact HR if any correction is required before accepting.',
      },
      petrolRate: {
        ratePerKm: 12,
        currency: 'INR',
        effectiveFrom: issueDate,
        reimbursementCycle: 'Monthly with supporting travel logs',
        note: 'Petrol reimbursement applies to approved field visits as per company travel policy.',
      },
      jobProfile: {
        role: 'Field Verification Agent',
        department,
        responsibilities: [
          'Accept and complete assigned physical verification cases.',
          'Capture geo-tagged photographs and accurate visit observations.',
          'Submit cases for review within SLA timelines.',
          'Maintain professional conduct with applicants and employers.',
          'Keep wallet and incentive performance targets in view.',
        ],
        workingHours: employmentType === 'Part Time' ? 'Flexible (Part Time)' : '9:30 AM – 6:30 PM',
        toolsProvided: ['Mobile app access', 'Case assignment portal', 'Wallet & earnings dashboard'],
      },
      perCaseRate: {
        amount: perCaseAmount,
        currency: 'INR',
        caseType: 'Physical verification (completed & approved)',
        paymentTimeline: 'Credited to wallet after case approval',
        note: `Current standard rate is ₹${perCaseAmount} per successfully completed case.`,
      },
      salarySlip: {
        month: new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
        employeeName: fullName,
        employeeId: fa.fieldAgentId,
        grossSalary: 18000,
        deductions: 1800,
        netSalary: 16200,
        note: 'Sample salary slip for reference. Actual payouts combine fixed components, per-case earnings, and approved incentives.',
      },
      incentivePerformance: {
        period: new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' }),
        completedCases: 0,
        targetCases: 20,
        bonusEligible: false,
        incentiveAmount: 0,
        performanceNote:
          'Complete more cases to unlock performance incentives. Sample tiers are shown below.',
        tiers: [
          { label: 'Bronze', cases: 15, bonus: 500 },
          { label: 'Silver', cases: 25, bonus: 1200 },
          { label: 'Gold', cases: 40, bonus: 2500 },
        ],
      },
    };
  }

  async getOnboardingForUser(
    userId: string,
  ): Promise<APIResponseInterface<FieldAgentOnboardingPayload>> {
    const fa = await this.repo.findOne({ where: { userId } });
    if (!fa) {
      throw new NotFoundException('Field assistant profile not found');
    }
    return {
      code: HttpStatus.OK,
      message: 'Field agent onboarding fetched successfully',
      data: this.buildOnboardingPayload(fa),
    };
  }

  async acceptTermsByUserId(
    userId: string,
  ): Promise<
    APIResponseInterface<{
      isAcceptTermAndCondition: boolean;
      termsAcceptedAt: string;
    }>
  > {
    const fa = await this.repo.findOne({ where: { userId } });
    if (!fa) {
      throw new NotFoundException('Field assistant profile not found');
    }
    fa.isAcceptTermAndCondition = true;
    fa.termsAcceptedAt = new Date();
    await this.repo.save(fa);
    return {
      code: HttpStatus.OK,
      message: 'Terms and conditions accepted successfully',
      data: {
        isAcceptTermAndCondition: true,
        termsAcceptedAt: fa.termsAcceptedAt.toISOString(),
      },
    };
  }
}

