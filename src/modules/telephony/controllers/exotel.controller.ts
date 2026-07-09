import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Request,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import { Readable } from 'stream';
import { TelephonyService } from '../telephony.service';
import { MakeCallDto } from '../dto/make-call.dto';
import { RecallCallDto } from '../dto/recall-call.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';

type AuthedReq = { user: { role: Role; clientId?: string; sub?: string } };

/**
 * Exotel telephony endpoints.
 *
 * POST /exotel/call              — initiate outbound call (Super Admin)
 * GET  /exotel/calls/:id         — list calls for a physical verification case
 * POST /exotel/webhook           — Exotel StatusCallback (public)
 * POST /exotel/recall            — manual customer recall (Super Admin)
 * GET  /exotel/recordings/:id/audio — proxy authenticated recording playback
 */
@Controller('exotel')
export class ExotelController {
  constructor(private readonly telephonyService: TelephonyService) {}

  @Post('call')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  makeCall(@Body() dto: MakeCallDto, @Request() req: AuthedReq) {
    return this.telephonyService.makeCall(
      dto.physicalVerificationId,
      dto.callType,
      req.user,
      dto.visitId,
    );
  }

  @Get('calls/:physicalVerificationId')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.CLIENT_USER)
  getCalls(@Param('physicalVerificationId') physicalVerificationId: string, @Request() req: AuthedReq) {
    return this.telephonyService.getCallsByPhysicalVerificationId(physicalVerificationId, req.user);
  }

  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  webhook(@Body() body: Record<string, unknown>) {
    return this.telephonyService.handleWebhook(body);
  }

  @Post('recall')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN)
  recall(@Body() dto: RecallCallDto, @Request() req: AuthedReq) {
    return this.telephonyService.recall(dto.physicalVerificationId, req.user, dto.visitId);
  }

  @Get('recordings/:callRecordId/audio')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(Role.SUPER_ADMIN, Role.CLIENT_ADMIN, Role.CLIENT_USER)
  async streamRecording(
    @Param('callRecordId') callRecordId: string,
    @Request() req: AuthedReq,
  ): Promise<StreamableFile> {
    const buffer = await this.telephonyService.getRecordingBuffer(callRecordId, req.user);
    return new StreamableFile(Readable.from(buffer), {
      type: 'audio/mpeg',
      disposition: 'inline',
    });
  }
}
