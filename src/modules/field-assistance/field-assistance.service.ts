import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { APIResponseInterface } from '../../interface/response.interface';
import { FieldAssistant } from './entities/field-assistant.entity';
import { ListFieldAssistantsQueryDto } from './dto/list-field-assistants-query.dto';
import { UpsertFieldAssistantDto } from './dto/field-assistant.dto';
import { FieldAssistantAddress } from './entities/field-assistant-address.entity';
import { FieldAssistantEmergencyContact } from './entities/field-assistant-emergency-contact.entity';
import { FieldAssistantEducation } from './entities/field-assistant-education.entity';
import { FieldAssistantBankAccount } from './entities/field-assistant-bank-account.entity';
import { FieldAssistantFamilyMember } from './entities/field-assistant-family-member.entity';
import { FieldAssistantIdentification } from './entities/field-assistant-identification.entity';
import { FieldAssistantPreviousEmployment } from './entities/field-assistant-previous-employment.entity';
import { FieldAssistantIdSequence } from './entities/field-assistant-id-sequence.entity';
import * as bcrypt from 'bcrypt';

@Injectable()
export class FieldAssistanceService {
  constructor(
    @InjectRepository(FieldAssistant)
    private readonly repo: Repository<FieldAssistant>,
    @InjectRepository(FieldAssistantIdSequence)
    private readonly seqRepo: Repository<FieldAssistantIdSequence>,
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

    if (dto.loginEmail?.trim()) {
      const existingLoginEmail = await this.repo.findOne({
        where: { loginEmail: dto.loginEmail.trim() } as any,
      });
      if (existingLoginEmail) {
        throw new ConflictException('Login email already exists');
      }
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

      loginEmail: dto.loginEmail?.trim() || null,
      password: dto.password?.trim()
        ? await bcrypt.hash(dto.password.trim(), 10)
        : null,

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
          fieldAssistantId: undefined as any, // set by relation on save
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
    return {
      code: HttpStatus.CREATED,
      message: 'Field assistant created successfully',
      data: saved,
    };
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

    if (dto.loginEmail?.trim()) {
      const existing = await this.repo.findOne({
        where: { loginEmail: dto.loginEmail.trim() } as any,
      });
      if (existing && existing.id !== fa.id) {
        throw new ConflictException('Login email already exists');
      }
    }

    // Field Agent ID is generated by backend; it cannot be edited.

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

    if (dto.loginEmail !== undefined) {
      fa.loginEmail = dto.loginEmail?.trim() || null;
    }
    if (dto.password?.trim()) {
      fa.password = await bcrypt.hash(dto.password.trim(), 10);
    }

    fa.partTimeOrFullTime = dto.partTimeOrFullTime ?? null;
    fa.fieldOrChoiceDepartment = dto.fieldOrChoiceDepartment ?? null;

    fa.previousEmploymentType = (dto.previousEmploymentType as any) ?? null;
    fa.documentUploads = dto.documentUploads ?? null;

    // keep existing fieldAgentId
    fa.status = dto.status as any;
    fa.assignCompanyClient = dto.assignCompanyClient ?? null;
    fa.reportingManager = dto.reportingManager ?? null;
    fa.joiningDate = dto.joiningDate ?? null;
    fa.remarks = dto.remarks ?? null;

    /**
     * IMPORTANT: During edits, TypeORM can attempt to "nullify" orphaned child rows
     * before deleting them. `field_assistant_id` is non-nullable, so nullify breaks FK.
     * We explicitly delete child rows first, then insert fresh rows.
     */
    await this.repo.manager.delete(FieldAssistantAddress, { fieldAssistantId: fa.id } as any);
    fa.addresses = (dto.addresses || []).map((a) =>
      Object.assign(new FieldAssistantAddress(), {
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
        fieldAssistantId: fa.id,
        addressType: a.addressType,
        completeAddress: a.completeAddress,
        landmark: a.landmark?.trim() || null,
        city: a.city,
        state: a.state,
        country: a.country,
        postalCode: a.postalCode,
      }),
    );

    await this.repo.manager.delete(FieldAssistantEmergencyContact, { fieldAssistantId: fa.id } as any);
    fa.emergencyDetails = (dto.emergencyDetails || []).map((e) =>
      Object.assign(new FieldAssistantEmergencyContact(), {
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
        fieldAssistantId: fa.id,
        name: e.name,
        relationship: e.relationship,
        landline: e.landline?.trim() || null,
        mobile: e.mobile,
      }),
    );

    await this.repo.manager.delete(FieldAssistantEducation, { fieldAssistantId: fa.id } as any);
    fa.educationDetails = (dto.educationDetails || []).map((e) =>
      Object.assign(new FieldAssistantEducation(), {
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
        fieldAssistantId: fa.id,
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

    await this.repo.manager.delete(FieldAssistantBankAccount, { fieldAssistantId: fa.id } as any);
    fa.bankDetails = (dto.bankDetails || []).map((b) =>
      Object.assign(new FieldAssistantBankAccount(), {
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
        fieldAssistantId: fa.id,
        bankName: b.bankName,
        accountNumber: b.accountNumber,
        accountType: b.accountType?.trim() || null,
        branch: b.branch?.trim() || null,
        ifsc: b.ifsc,
        upiId: b.upiId?.trim() || null,
        status: b.status as any,
      }),
    );

    await this.repo.manager.delete(FieldAssistantFamilyMember, { fieldAssistantId: fa.id } as any);
    fa.familyDetails = (dto.familyDetails || []).map((f) =>
      Object.assign(new FieldAssistantFamilyMember(), {
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
        fieldAssistantId: fa.id,
        name: f.name,
        relationship: f.relationship,
        dateOfBirth: f.dateOfBirth,
        emailId: f.emailId?.trim() || null,
        gender: f.gender,
        nationality: f.nationality?.trim() || null,
        mobile: f.mobile?.trim() || null,
      }),
    );

    await this.repo.manager.delete(FieldAssistantIdentification, { fieldAssistantId: fa.id } as any);
    fa.identificationDetails = (dto.identificationDetails || []).map((i) =>
      Object.assign(new FieldAssistantIdentification(), {
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
        fieldAssistantId: fa.id,
        identificationType: i.identificationType as any,
        identificationNo: i.identificationNo,
        uploadDocument: i.uploadDocument?.trim() || null,
      }),
    );

    await this.repo.manager.delete(FieldAssistantPreviousEmployment, { fieldAssistantId: fa.id } as any);
    fa.previousEmploymentDetails = (dto.previousEmploymentDetails || []).map((p) =>
      Object.assign(new FieldAssistantPreviousEmployment(), {
        createdBy: userId ?? null,
        updatedBy: userId ?? null,
        fieldAssistantId: fa.id,
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

    const saved = await this.repo.save(fa);
    return {
      code: HttpStatus.OK,
      message: 'Field assistant updated successfully',
      data: saved,
    };
  }

  /**
   * Delete field assistant (child tables are deleted via CASCADE).
   */
  async delete(id: string): Promise<APIResponseInterface<any>> {
    const fa = await this.repo.findOne({ where: { id } });
    if (!fa) throw new NotFoundException('Field assistant not found');
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

