import {
  BadRequestException,
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

  private async provisionLoginAccount(
    saved: FieldAssistant,
    dto: UpsertFieldAssistantDto,
  ): Promise<FieldAssistant> {
    const loginEmail = this.resolveLoginEmail(dto);
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
      );
    } catch {
      // Profile and user are created; mail failure should not roll back.
    }

    return linked;
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
  ): Promise<APIResponseInterface<FieldAssistant>> {
    this.validateAgeGte18(dto.dateOfBirth);
    this.validateSingleActiveBankAccount(dto.bankDetails || []);

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
      status: dto.status as any,
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
    const withLogin = await this.provisionLoginAccount(saved, dto);
    return {
      code: HttpStatus.CREATED,
      message:
        'Field assistant created successfully. Login credentials have been emailed.',
      data: withLogin,
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
   * Update status (Active/Inactive) for listing quick action.
   */
  async updateStatus(
    id: string,
    status: 'Active' | 'Inactive',
    userId?: string,
  ): Promise<APIResponseInterface<FieldAssistant>> {
    const fa = await this.repo.findOne({ where: { id } });
    if (!fa) throw new NotFoundException('Field assistant not found');
    fa.status = status;
    fa.updatedBy = userId ?? fa.updatedBy ?? null;
    const saved = await this.repo.save(fa);
    return {
      code: HttpStatus.OK,
      message: 'Status updated successfully',
      data: saved,
    };
  }
}

