import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { existsSync, mkdirSync, writeFileSync } from 'fs';
import { extname, join } from 'path';
import { randomUUID } from 'crypto';
import { APIResponseInterface } from '../../../common/interfaces/response.interface';
import { FieldAssistant } from '../../field-assistance/entities/field-assistant.entity';
import {
  AttendanceLocationType,
  FieldAgentAttendance,
} from '../entities/field-agent-attendance.entity';
import { CheckInAttendanceDto, CheckOutAttendanceDto, ListAttendanceQueryDto } from '../dto/attendance.dto';

export const ATTENDANCE_UPLOAD_DIR = join(process.cwd(), 'uploads', 'field-agent-attendance');

type UploadedFileLike = {
  buffer?: Buffer;
  size?: number;
  mimetype?: string;
  originalname?: string;
};

const ALLOWED_MIMES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024;

@Injectable()
export class FieldAgentAttendanceService {
  constructor(
    @InjectRepository(FieldAgentAttendance)
    private readonly repo: Repository<FieldAgentAttendance>,
    @InjectRepository(FieldAssistant)
    private readonly fieldAssistantRepo: Repository<FieldAssistant>,
  ) {}

  private todayDateString(date = new Date()): string {
    const yyyy = date.getFullYear();
    const mm = String(date.getMonth() + 1).padStart(2, '0');
    const dd = String(date.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  }

  private formatAddress(parts: Array<string | null | undefined>): string | null {
    const text = parts.filter((p) => p?.trim()).join(', ');
    return text || null;
  }

  private ensureUploadDir(): void {
    if (!existsSync(ATTENDANCE_UPLOAD_DIR)) {
      mkdirSync(ATTENDANCE_UPLOAD_DIR, { recursive: true });
    }
  }

  private saveSelfie(file: UploadedFileLike, userId: string): { url: string; fileName: string } {
    if (!file?.buffer?.length) {
      throw new BadRequestException('Selfie photo is required');
    }
    if ((file.size ?? file.buffer.length) > MAX_FILE_SIZE) {
      throw new BadRequestException('Selfie exceeds maximum size of 10MB');
    }
    if (!file.mimetype || !ALLOWED_MIMES.includes(file.mimetype)) {
      throw new BadRequestException('Selfie must be a JPG, PNG, or WEBP image');
    }

    this.ensureUploadDir();
    const ext = extname(file.originalname || '') || '.jpg';
    const fileName = `${userId}-${this.todayDateString()}-${randomUUID()}${ext}`;
    writeFileSync(join(ATTENDANCE_UPLOAD_DIR, fileName), file.buffer);
    return {
      fileName,
      url: `/api/field-agent-attendance/files/view/${fileName}`,
    };
  }

  private async findActiveAssistant(userId: string): Promise<FieldAssistant> {
    const fa = await this.fieldAssistantRepo.findOne({
      where: { userId },
      relations: ['addresses'],
    });
    if (!fa || fa.status !== 'Active') {
      throw new NotFoundException('Active field agent profile not found');
    }
    return fa;
  }

  async getLocationOptions(userId: string): Promise<
    APIResponseInterface<{
      residence: { label: string; address: string | null };
      office: { label: string; address: string | null };
      currentLocation: { label: string };
    }>
  > {
    const fa = await this.findActiveAssistant(userId);
    const list = fa.addresses || [];
    const present =
      list.find((a) => a.addressType === 'Present') ||
      list.find((a) => a.addressType === 'Permanent');
    const work = list.find((a) => a.addressType === 'Work');

    return {
      code: HttpStatus.OK,
      message: 'Location options fetched successfully',
      data: {
        residence: {
          label: 'Residence',
          address: present
            ? this.formatAddress([
                present.completeAddress,
                present.landmark,
                present.city,
                present.state,
                present.postalCode,
              ])
            : null,
        },
        office: {
          label: 'Office',
          address: work
            ? this.formatAddress([
                work.completeAddress,
                work.landmark,
                work.city,
                work.state,
                work.postalCode,
              ])
            : null,
        },
        currentLocation: {
          label: 'Current Location',
        },
      },
    };
  }

  async getTodayStatus(
    userId: string,
  ): Promise<APIResponseInterface<{ exists: boolean; record: FieldAgentAttendance | null }>> {
    const today = this.todayDateString();
    const record = await this.repo.findOne({
      where: { fieldAgentUserId: userId, attendanceDate: today },
    });
    return {
      code: HttpStatus.OK,
      message: record ? 'Attendance already marked for today' : 'No attendance for today',
      data: { exists: !!record, record },
    };
  }

  async checkIn(
    userId: string,
    dto: CheckInAttendanceDto,
    file: UploadedFileLike | undefined,
  ): Promise<APIResponseInterface<FieldAgentAttendance>> {
    const today = this.todayDateString();
    const existing = await this.repo.findOne({
      where: { fieldAgentUserId: userId, attendanceDate: today },
    });
    if (existing) {
      throw new ConflictException('Attendance already marked for today');
    }

    if (!dto.locationType) {
      throw new BadRequestException('locationType is required');
    }

    if (dto.locationType === 'CURRENT_LOCATION') {
      if (dto.latitude == null || dto.longitude == null) {
        throw new BadRequestException(
          'latitude and longitude are required for Current Location',
        );
      }
    }

    const fa = await this.findActiveAssistant(userId);
    const selfie = this.saveSelfie(file ?? {}, userId);

    let locationLabel = dto.locationLabel?.trim() || null;
    if (!locationLabel) {
      if (dto.locationType === 'RESIDENCE') locationLabel = 'Residence';
      else if (dto.locationType === 'OFFICE') locationLabel = 'Office';
      else locationLabel = 'Current Location';
    }

    if (dto.locationType === 'CURRENT_LOCATION' && dto.latitude != null && dto.longitude != null) {
      locationLabel = `Current Location (${Number(dto.latitude).toFixed(6)}, ${Number(
        dto.longitude,
      ).toFixed(6)})`;
    }

    const entity = this.repo.create({
      fieldAgentUserId: userId,
      fieldAssistantId: fa.id,
      fieldAgentCode: fa.fieldAgentId,
      fieldAgentName: fa.fullName || `${fa.firstName} ${fa.lastName}`.trim(),
      attendanceDate: today,
      locationType: dto.locationType as AttendanceLocationType,
      locationLabel,
      latitude:
        dto.locationType === 'CURRENT_LOCATION' && dto.latitude != null
          ? String(dto.latitude)
          : null,
      longitude:
        dto.locationType === 'CURRENT_LOCATION' && dto.longitude != null
          ? String(dto.longitude)
          : null,
      selfieUrl: selfie.url,
      selfieFileName: selfie.fileName,
      checkInAt: new Date(),
      checkOutAt: null,
      status: 'Present',
    });

    const saved = await this.repo.save(entity);
    return {
      code: HttpStatus.CREATED,
      message: 'Attendance marked successfully',
      data: saved,
    };
  }

  async checkOut(
    userId: string,
    dto: CheckOutAttendanceDto,
  ): Promise<APIResponseInterface<FieldAgentAttendance>> {
    const today = this.todayDateString();
    const record = await this.repo.findOne({
      where: { fieldAgentUserId: userId, attendanceDate: today },
    });
    if (!record) {
      throw new NotFoundException('No check-in found for today');
    }
    if (record.checkOutAt) {
      throw new ConflictException('Already checked out for today');
    }
    if (dto.latitude == null || dto.longitude == null) {
      throw new BadRequestException('Current location is required for check out');
    }

    const lat = Number(dto.latitude);
    const lng = Number(dto.longitude);
    if (Number.isNaN(lat) || Number.isNaN(lng)) {
      throw new BadRequestException('Invalid check-out coordinates');
    }

    record.checkOutAt = new Date();
    record.checkOutLatitude = String(lat);
    record.checkOutLongitude = String(lng);
    record.checkOutLocationLabel =
      dto.locationLabel?.trim() ||
      `Current Location (${lat.toFixed(6)}, ${lng.toFixed(6)})`;

    const saved = await this.repo.save(record);
    return {
      code: HttpStatus.OK,
      message: 'Checked out successfully',
      data: saved,
    };
  }

  async listMine(
    userId: string,
    query: ListAttendanceQueryDto,
  ): Promise<APIResponseInterface<FieldAgentAttendance[]>> {
    return this.listInternal({ ...query, fieldAgentUserId: userId });
  }

  async listAdmin(
    query: ListAttendanceQueryDto,
  ): Promise<APIResponseInterface<FieldAgentAttendance[]>> {
    return this.listInternal(query);
  }

  private async listInternal(
    query: ListAttendanceQueryDto,
  ): Promise<APIResponseInterface<FieldAgentAttendance[]>> {
    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const pagePerRecord =
      Number(query.pagePerRecord) > 0 ? Number(query.pagePerRecord) : 50;

    const qb = this.repo
      .createQueryBuilder('a')
      .orderBy('a.attendanceDate', 'DESC')
      .addOrderBy('a.checkInAt', 'DESC');

    if (query.fieldAgentUserId) {
      qb.andWhere('a.fieldAgentUserId = :userId', { userId: query.fieldAgentUserId });
    }
    if (query.fromDate) {
      qb.andWhere('a.attendanceDate >= :fromDate', { fromDate: query.fromDate });
    }
    if (query.toDate) {
      qb.andWhere('a.attendanceDate <= :toDate', { toDate: query.toDate });
    }
    if (query.search?.trim()) {
      qb.andWhere(
        `(a.fieldAgentName LIKE :search OR a.fieldAgentCode LIKE :search
          OR a.locationLabel LIKE :search OR a.locationType LIKE :search
          OR a.status LIKE :search OR CAST(a.attendanceDate AS CHAR) LIKE :search)`,
        { search: `%${query.search.trim()}%` },
      );
    }
    if (query.status?.trim()) {
      qb.andWhere('a.status = :status', { status: query.status.trim() });
    }

    const [rows, total] = await qb
      .skip((page - 1) * pagePerRecord)
      .take(pagePerRecord)
      .getManyAndCount();

    return {
      code: HttpStatus.OK,
      message: 'Attendance records fetched successfully',
      data: rows,
      pagination: { total, page, pagePerRecord },
    };
  }
}
