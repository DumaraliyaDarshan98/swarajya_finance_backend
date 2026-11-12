import {
  BadRequestException,
  Controller,
  HttpStatus,
  Post,
  Req,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { randomUUID } from 'crypto';
import { existsSync, mkdirSync } from 'fs';
import type { Request } from 'express';
import {
  JobApplicationService,
  JOB_RESUME_UPLOAD_DIR,
} from '../services/job-application.service';

const MAX_SIZE = 5 * 1024 * 1024;
const ALLOWED_MIMES = [
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
];

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 100);
}

/** Public career application — no auth required. */
@Controller('job-applications')
export class JobApplicationPublicController {
  constructor(private readonly service: JobApplicationService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor('resume', {
      limits: { fileSize: MAX_SIZE },
      storage: diskStorage({
        destination: (_req, _file, cb) => {
          if (!existsSync(JOB_RESUME_UPLOAD_DIR)) {
            mkdirSync(JOB_RESUME_UPLOAD_DIR, { recursive: true });
          }
          cb(null, JOB_RESUME_UPLOAD_DIR);
        },
        filename: (_req, file, cb) => {
          const base = (file.originalname || 'resume').replace(/\.[^/.]+$/, '');
          const ext = (file.originalname && file.originalname.split('.').pop()) || 'pdf';
          cb(null, `${randomUUID()}-${sanitizeFilename(base)}.${ext}`);
        },
      }),
      fileFilter: (_req, file, cb) => {
        if (!file.mimetype || !ALLOWED_MIMES.includes(file.mimetype)) {
          return cb(
            new BadRequestException('Resume must be PDF or Word (.pdf, .doc, .docx)'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  submit(@Req() req: Request) {
    const file = (
      req as Request & {
        file?: {
          filename: string;
          originalname: string;
          mimetype: string;
          size: number;
        };
      }
    ).file;

    if (!file?.filename) {
      throw new BadRequestException('Please upload your resume');
    }

    const body = req.body as Record<string, string>;
    return this.service.submit({
      fullName: body.fullName ?? body.full_name ?? '',
      email: body.email ?? '',
      mobileNumber: body.mobileNumber ?? body.mobile_number ?? '',
      skill: body.skill ?? '',
      designation: body.designation ?? '',
      department: body.department ?? '',
      location: body.location ?? '',
      city: body.city ?? '',
      state: body.state ?? '',
      pincode: body.pincode ?? '',
      fullAddress: body.fullAddress ?? body.full_address ?? '',
      aboutYourself: body.aboutYourself ?? body.about_yourself ?? '',
      resumeStoredFileName: file.filename,
      resumeOriginalName: file.originalname,
      resumeMimeType: file.mimetype,
      resumeSizeBytes: file.size,
    });
  }
}
