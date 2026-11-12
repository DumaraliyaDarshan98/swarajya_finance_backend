import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Request,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { createReadStream, existsSync, statSync } from 'fs';
import { join } from 'path';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import {
  ATTENDANCE_UPLOAD_DIR,
  FieldAgentAttendanceService,
} from '../services/field-agent-attendance.service';
import { CheckInAttendanceDto, CheckOutAttendanceDto, ListAttendanceQueryDto } from '../dto/attendance.dto';

type AuthedReq = { user: { role: Role; sub?: string } };

@Controller('field-agent-attendance')
export class FieldAgentAttendanceController {
  constructor(private readonly service: FieldAgentAttendanceService) {}

  /** Public by unguessable filename so <img> tags can load selfies without Authorization headers. */
  @Get('files/view/:filename')
  viewFile(@Param('filename') filename: string): StreamableFile {
    if (!filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new BadRequestException('Invalid filename');
    }
    const filePath = join(ATTENDANCE_UPLOAD_DIR, filename);
    if (!existsSync(filePath) || !statSync(filePath).isFile()) {
      throw new BadRequestException('File not found');
    }
    const ext = filename.split('.').pop()?.toLowerCase();
    const mime: Record<string, string> = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      webp: 'image/webp',
    };
    return new StreamableFile(createReadStream(filePath), {
      type: mime[ext ?? ''] ?? 'application/octet-stream',
    });
  }

  @Get('me/today')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FIELD_AGENT)
  getToday(@Request() req: AuthedReq) {
    return this.service.getTodayStatus(req.user.sub!);
  }

  @Get('me/location-options')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FIELD_AGENT)
  getLocationOptions(@Request() req: AuthedReq) {
    return this.service.getLocationOptions(req.user.sub!);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FIELD_AGENT)
  listMine(@Query() query: ListAttendanceQueryDto, @Request() req: AuthedReq) {
    return this.service.listMine(req.user.sub!, query);
  }

  @Post('me/check-in')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FIELD_AGENT)
  @UseInterceptors(
    FileInterceptor('selfie', {
      storage: memoryStorage(),
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const allowed = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
        if (!file.mimetype || !allowed.includes(file.mimetype)) {
          return cb(new BadRequestException('Invalid selfie file type'), false);
        }
        cb(null, true);
      },
    }),
  )
  checkIn(
    @UploadedFile() file: any,
    @Body() dto: CheckInAttendanceDto,
    @Request() req: AuthedReq,
  ) {
    return this.service.checkIn(req.user.sub!, dto, file);
  }

  @Post('me/check-out')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.FIELD_AGENT)
  checkOut(@Body() dto: CheckOutAttendanceDto, @Request() req: AuthedReq) {
    return this.service.checkOut(req.user.sub!, dto);
  }

  @Get('admin')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.INTERNAL_USER)
  listAdmin(@Query() query: ListAttendanceQueryDto) {
    return this.service.listAdmin(query);
  }
}
