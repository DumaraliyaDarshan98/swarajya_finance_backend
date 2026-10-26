import {
  BadRequestException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { join } from 'path';
import { existsSync, unlinkSync } from 'fs';
import {
  JobApplication,
  type JobApplicationStatus,
} from '../entities/job-application.entity';
import { ListJobApplicationQueryDto } from '../dto/list-job-application-query.dto';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';
import { MailService } from '../../mail/services/mail.service';

export const JOB_RESUME_UPLOAD_DIR = join(
  process.cwd(),
  'uploads',
  'job-applications',
);

@Injectable()
export class JobApplicationService {
  private readonly logger = new Logger(JobApplicationService.name);

  constructor(
    @InjectRepository(JobApplication)
    private readonly repo: Repository<JobApplication>,
    private readonly mailService: MailService,
  ) {}

  async submit(input: {
    fullName: string;
    email: string;
    mobileNumber: string;
    skill: string;
    aboutYourself: string;
    resumeStoredFileName: string;
    resumeOriginalName: string;
    resumeMimeType?: string | null;
    resumeSizeBytes?: number | null;
  }): Promise<APIResponseInterface<{ id: string }>> {
    const fullName = input.fullName?.trim();
    const email = input.email?.trim().toLowerCase();
    const mobileNumber = input.mobileNumber?.trim();
    const skill = input.skill?.trim();
    const aboutYourself = input.aboutYourself?.trim();

    if (!fullName || fullName.length < 2) {
      throw new BadRequestException('Please enter your full name');
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      throw new BadRequestException('Please enter a valid email address');
    }
    if (!mobileNumber || !/^[6-9]\d{9}$/.test(mobileNumber.replace(/\s+/g, ''))) {
      throw new BadRequestException('Please enter a valid 10-digit mobile number');
    }
    if (!skill || skill.length < 2) {
      throw new BadRequestException('Please enter your primary skill(s)');
    }
    if (!aboutYourself || aboutYourself.length < 20) {
      throw new BadRequestException('Please write a short note about yourself (min 20 characters)');
    }
    if (!input.resumeStoredFileName) {
      throw new BadRequestException('Resume file is required');
    }

    const row = this.repo.create({
      fullName,
      email,
      mobileNumber: mobileNumber.replace(/\s+/g, ''),
      skill,
      aboutYourself,
      resumeStoredFileName: input.resumeStoredFileName,
      resumeOriginalName: input.resumeOriginalName || input.resumeStoredFileName,
      resumeMimeType: input.resumeMimeType ?? null,
      resumeSizeBytes: input.resumeSizeBytes ?? null,
      status: 'NEW',
    });
    const saved = await this.repo.save(row);

    try {
      await this.mailService.sendJobApplicationReceived({
        email: saved.email,
        name: saved.fullName,
        applicationId: saved.id,
        mobileNumber: saved.mobileNumber,
        skill: saved.skill,
        resumeName: saved.resumeOriginalName,
      });
    } catch (err) {
      // Application is already saved — do not fail the public submit if mail is down.
      this.logger.error(
        `Job application confirmation mail failed id=${saved.id} to=${saved.email}`,
        err instanceof Error ? err.stack : String(err),
      );
    }

    return {
      code: HttpStatus.CREATED,
      message: 'Application submitted successfully. Our team will contact you soon.',
      data: { id: saved.id },
    };
  }

  async findAll(
    query: ListJobApplicationQueryDto,
  ): Promise<APIResponseInterface<JobApplication[]>> {
    const page = query.page ?? 1;
    const limit = query.limit ?? 20;
    const qb = this.repo.createQueryBuilder('j').orderBy('j.created_at', 'DESC');

    if (query.status) {
      qb.andWhere('j.status = :status', { status: query.status });
    }
    if (query.search?.trim()) {
      const q = `%${query.search.trim()}%`;
      qb.andWhere(
        '(j.full_name LIKE :q OR j.email LIKE :q OR j.mobile_number LIKE :q OR j.skill LIKE :q)',
        { q },
      );
    }

    const [rows, total] = await qb
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return {
      code: HttpStatus.OK,
      message: 'Job applications fetched',
      data: rows,
      pagination: { total, page, pagePerRecord: limit },
    };
  }

  async findOne(id: string): Promise<APIResponseInterface<JobApplication>> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Application not found');
    return {
      code: HttpStatus.OK,
      message: 'Job application fetched',
      data: row,
    };
  }

  async updateStatus(
    id: string,
    status: JobApplicationStatus,
  ): Promise<APIResponseInterface<JobApplication>> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Application not found');
    row.status = status;
    const saved = await this.repo.save(row);
    return {
      code: HttpStatus.OK,
      message: 'Application status updated',
      data: saved,
    };
  }

  async remove(id: string): Promise<APIResponseInterface<null>> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Application not found');
    const filePath = join(JOB_RESUME_UPLOAD_DIR, row.resumeStoredFileName);
    if (existsSync(filePath)) {
      try {
        unlinkSync(filePath);
      } catch {
        /* ignore disk cleanup errors */
      }
    }
    await this.repo.remove(row);
    return {
      code: HttpStatus.OK,
      message: 'Application deleted',
      data: null,
    };
  }

  resolveResumePath(storedFileName: string): string {
    if (!storedFileName || storedFileName.includes('..') || storedFileName.includes('/') || storedFileName.includes('\\')) {
      throw new BadRequestException('Invalid resume file');
    }
    const filePath = join(JOB_RESUME_UPLOAD_DIR, storedFileName);
    if (!existsSync(filePath)) {
      throw new NotFoundException('Resume file not found');
    }
    return filePath;
  }
}
