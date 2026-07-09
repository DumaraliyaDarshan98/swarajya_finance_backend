import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  Req,
  Request,
  StreamableFile,
  UseGuards,
  UsePipes,
  ValidationPipe,
} from '@nestjs/common';
import type { Request as ExpressRequest } from 'express';
import { Readable } from 'stream';
import { TelephonyService } from '../telephony.service';
import { MakeCallDto } from '../dto/make-call.dto';
import { RecallCallDto } from '../dto/recall-call.dto';
import { JwtAuthGuard } from '../../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../../common/guards/roles.guard';
import { Roles } from '../../../common/decorators/roles.decorator';
import { Role } from '../../../common/enums/role.enum';
import type { TelephonyWebhookPayload } from '../interfaces/telephony.interface';

type AuthedReq = { user: { role: Role; clientId?: string; sub?: string } };

/**
 * Exotel telephony endpoints.
 *
 * POST /exotel/call              — initiate outbound call (Super Admin)
 * GET  /exotel/calls/:id         — list calls for a physical verification case
 * POST /exotel/webhook           — Exotel StatusCallback (public, form or JSON)
 * GET  /exotel/webhook           — fallback if Exotel/proxy uses query params
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

  /**
   * Exotel StatusCallback.
   * Sends application/x-www-form-urlencoded by default (CallSid, Status, RecordingUrl, …).
   * Global ValidationPipe (forbidNonWhitelisted) must NOT strip this payload.
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @UsePipes(
    new ValidationPipe({
      whitelist: false,
      forbidNonWhitelisted: false,
      transform: false,
    }),
  )
  webhookPost(
    @Req() req: ExpressRequest,
    @Body() body: Record<string, unknown>,
    @Query() query: Record<string, unknown>,
  ) {
    return this.telephonyService.handleWebhook(this.extractWebhookPayload(req, body, query));
  }

  @Get('webhook')
  @HttpCode(HttpStatus.OK)
  @UsePipes(
    new ValidationPipe({
      whitelist: false,
      forbidNonWhitelisted: false,
      transform: false,
    }),
  )
  webhookGet(@Req() req: ExpressRequest, @Query() query: Record<string, unknown>) {
    return this.telephonyService.handleWebhook(this.extractWebhookPayload(req, undefined, query));
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

  /**
   * Merge body + query + raw req.body so form-urlencoded, JSON, and query all work.
   * Never throws — empty payload is handled downstream with HTTP 200.
   */
  private extractWebhookPayload(
    req: ExpressRequest,
    body?: Record<string, unknown>,
    query?: Record<string, unknown>,
  ): TelephonyWebhookPayload {
    const reqBody =
      req.body && typeof req.body === 'object' && !Array.isArray(req.body)
        ? (req.body as Record<string, unknown>)
        : {};
    const safeBody =
      body && typeof body === 'object' && !Array.isArray(body) ? body : {};
    const safeQuery =
      query && typeof query === 'object' && !Array.isArray(query) ? query : {};

    const payload = {
      ...safeQuery,
      ...safeBody,
      ...reqBody,
    } as TelephonyWebhookPayload;

    console.log('[EXOTEL] Webhook request meta:', {
      method: req.method,
      contentType: req.headers['content-type'] ?? null,
      contentLength: req.headers['content-length'] ?? null,
      path: req.originalUrl ?? req.url,
      bodyKeys: Object.keys(safeBody),
      queryKeys: Object.keys(safeQuery),
      reqBodyKeys: Object.keys(reqBody),
      mergedKeys: Object.keys(payload),
    });

    return payload;
  }
}
