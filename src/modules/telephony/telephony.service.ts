import {
  BadRequestException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { PhysicalVerificationCall } from './entities/physical-verification-call.entity';
import { PhysicalVerification } from '../physical-verification/entities/physical-verification.entity';
import { PhysicalLog, PhysicalLogAction } from '../physical-verification/entities/physical-log.entity';
import { User } from '../user/entities/user.entity';
import { ExotelProvider } from './providers/exotel.provider';
import type { ITelephonyProvider } from './interfaces/telephony-provider.interface';
import type {
  TelephonyCallStatus,
  TelephonyCallType,
  TelephonyWebhookPayload,
} from './interfaces/telephony.interface';
import { APIResponseInterface } from '../../common/interfaces/response.interface';
import { Role } from '../../common/enums/role.enum';

type AuthedUser = { role: Role; clientId?: string; sub?: string };

const TERMINAL_STATUSES: TelephonyCallStatus[] = [
  'COMPLETED',
  'FAILED',
  'BUSY',
  'NO_ANSWER',
];

@Injectable()
export class TelephonyService {
  private readonly logger = new Logger(TelephonyService.name);
  private readonly provider: ITelephonyProvider;

  constructor(
    @InjectRepository(PhysicalVerificationCall)
    private readonly callRepo: Repository<PhysicalVerificationCall>,
    @InjectRepository(PhysicalVerification)
    private readonly physicalRepo: Repository<PhysicalVerification>,
    @InjectRepository(PhysicalLog)
    private readonly logRepo: Repository<PhysicalLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    private readonly exotelProvider: ExotelProvider,
    private readonly config: ConfigService,
  ) {
    const providerName = (this.config.get<string>('telephony.provider') ?? 'exotel').toLowerCase();
    this.provider = providerName === 'exotel' ? this.exotelProvider : this.exotelProvider;
  }

  private async resolvePerformerName(userId?: string | null): Promise<string | null> {
    if (!userId) return null;
    const user = await this.userRepo.findOne({ where: { id: userId } });
    return user?.fullName?.trim() || user?.email?.trim() || null;
  }

  private async addPhysicalLog(
    physicalVerificationId: string,
    action: PhysicalLogAction,
    message: string,
    performedByUserId?: string | null,
    metadata?: Record<string, unknown> | null,
    visitId?: string | null,
  ): Promise<void> {
    const performedByName = await this.resolvePerformerName(performedByUserId ?? undefined);
    const log = this.logRepo.create({
      physicalVerificationId,
      physicalVerificationVisitId: visitId ?? null,
      action,
      message,
      performedByUserId: performedByUserId ?? null,
      performedByName,
      metadata: metadata ?? null,
    });
    await this.logRepo.save(log);
  }

  private async assertAccess(
    physicalVerificationId: string,
    user: AuthedUser,
  ): Promise<PhysicalVerification> {
    const record = await this.physicalRepo.findOne({ where: { id: physicalVerificationId } });
    if (!record) {
      throw new NotFoundException('Physical verification not found');
    }
    if (user.role === Role.SUPER_ADMIN) {
      return record;
    }
    if (user.role === Role.FIELD_AGENT) {
      throw new ForbiddenException('Field agents cannot access call history');
    }
    if (record.clientId !== user.clientId) {
      throw new ForbiddenException('You can only access your own client verifications');
    }
    return record;
  }

  private resolveCustomerMobile(record: PhysicalVerification): string | null {
    const mobile = record.mobile?.trim() || record.applicant?.mobile?.trim();
    return mobile || null;
  }

  private parseWebhookDate(value?: string | null): Date | null {
    if (!value?.trim()) return null;
    const parsed = new Date(value.replace(' ', 'T'));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  private mapWebhookStatus(status?: string | null): TelephonyCallStatus {
    const normalized = (status ?? '').toLowerCase().replace(/-/g, '_');
    switch (normalized) {
      case 'queued':
        return 'QUEUED';
      case 'ringing':
        return 'RINGING';
      case 'in_progress':
        return 'IN_PROGRESS';
      case 'answered':
        return 'ANSWERED';
      case 'completed':
        return 'COMPLETED';
      case 'failed':
        return 'FAILED';
      case 'busy':
        return 'BUSY';
      case 'no_answer':
        return 'NO_ANSWER';
      default:
        return 'IN_PROGRESS';
    }
  }

  private parseDuration(payload: TelephonyWebhookPayload): number | null {
    const raw = payload.ConversationDuration ?? payload.Duration;
    if (raw == null || raw === '') return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  }

  private callTypeLabel(callType: TelephonyCallType): string {
    switch (callType) {
      case 'INITIAL_SUBMISSION':
        return 'Initial submission';
      case 'AGENT_ASSIGNED':
        return 'Agent assigned';
      case 'FINAL_REPORT':
        return 'Report completion';
      case 'RECALL':
        return 'Customer recall';
      default:
        return 'Customer call';
    }
  }

  async makeCall(
    physicalVerificationId: string,
    callType: TelephonyCallType,
    user: AuthedUser,
    visitId?: string | null,
  ): Promise<APIResponseInterface<PhysicalVerificationCall>> {
    console.log('[TELEPHONY] ========== Manual makeCall START ==========');
    console.log('[TELEPHONY] physicalVerificationId:', physicalVerificationId);
    console.log('[TELEPHONY] callType:', callType);
    console.log('[TELEPHONY] user:', { role: user.role, sub: user.sub });

    const record = await this.assertAccess(physicalVerificationId, user);
    const customerMobile = this.resolveCustomerMobile(record);
    if (!customerMobile) {
      console.error('[TELEPHONY] ERROR: Customer mobile missing on case', physicalVerificationId);
      throw new NotFoundException('Customer mobile number is not available for this case');
    }

    const callRecord = await this.createAndDialCall({
      physicalVerificationId,
      visitId: visitId ?? null,
      customerMobile,
      callType,
      createdBy: user.sub ?? null,
    });

    if (callRecord.status === 'FAILED') {
      const errorMessage =
        (callRecord.providerResponse?.error as string | undefined) ?? 'Call initiation failed';
      console.error('[TELEPHONY] Manual makeCall FAILED:', errorMessage);
      throw new BadRequestException(errorMessage);
    }

    console.log('[TELEPHONY] Manual makeCall SUCCESS:', {
      callRecordId: callRecord.id,
      callSid: callRecord.callSid,
      status: callRecord.status,
    });
    console.log('[TELEPHONY] ========== Manual makeCall END ==========');

    return {
      code: HttpStatus.CREATED,
      message: 'Outbound call initiated successfully',
      data: callRecord,
    };
  }

  private async createAndDialCall(params: {
    physicalVerificationId: string;
    visitId: string | null;
    customerMobile: string;
    callType: TelephonyCallType;
    createdBy: string | null;
  }): Promise<PhysicalVerificationCall> {
    console.log('[TELEPHONY] ---------- createAndDialCall START ----------');
    console.log('[TELEPHONY] Dial params:', {
      physicalVerificationId: params.physicalVerificationId,
      callType: params.callType,
      customerMobile: params.customerMobile,
      visitId: params.visitId,
      createdBy: params.createdBy,
    });

    const callRecord = this.callRepo.create({
      physicalVerificationId: params.physicalVerificationId,
      visitId: params.visitId,
      customerMobile: params.customerMobile,
      callType: params.callType,
      status: 'INITIATED',
      createdBy: params.createdBy,
    });
    const saved = await this.callRepo.save(callRecord);
    console.log('[TELEPHONY] Call record created:', saved.id, 'status=INITIATED');

    await this.addPhysicalLog(
      params.physicalVerificationId,
      'AUTO_CALL_INITIATED',
      `${this.callTypeLabel(params.callType)} call initiated to ${params.customerMobile}`,
      params.createdBy,
      { callRecordId: saved.id, callType: params.callType },
      params.visitId,
    );

    try {
      console.log('[TELEPHONY] Calling provider.makeCall()...');
      const result = await this.provider.makeCall({
        customerMobile: params.customerMobile,
        callType: params.callType,
        physicalVerificationId: params.physicalVerificationId,
        visitId: params.visitId,
        callRecordId: saved.id,
        createdBy: params.createdBy,
      });

      saved.callSid = result.callSid;
      saved.status = result.status;
      saved.providerRequest = result.providerRequest;
      saved.providerResponse = result.providerResponse;
      saved.startTime = result.startTime ?? new Date();
      const updated = await this.callRepo.save(saved);

      console.log('[TELEPHONY] SUCCESS: Call dialed');
      console.log('[TELEPHONY] Result:', {
        callRecordId: updated.id,
        callSid: updated.callSid,
        status: updated.status,
        customerMobile: updated.customerMobile,
        callType: updated.callType,
      });
      console.log('[TELEPHONY] ---------- createAndDialCall END (SUCCESS) ----------');
      return updated;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Call initiation failed';
      saved.status = 'FAILED';
      saved.providerResponse = { error: message };
      await this.callRepo.save(saved);

      console.error('[TELEPHONY] ERROR: Dial failed');
      console.error('[TELEPHONY] callRecordId:', saved.id);
      console.error('[TELEPHONY] callType:', params.callType);
      console.error('[TELEPHONY] customerMobile:', params.customerMobile);
      console.error('[TELEPHONY] error:', message);
      console.error('[TELEPHONY] ---------- createAndDialCall END (FAILED) ----------');

      await this.addPhysicalLog(
        params.physicalVerificationId,
        'AUTO_CALL_FAILED',
        `${this.callTypeLabel(params.callType)} call failed: ${message}`,
        params.createdBy,
        { callRecordId: saved.id, callType: params.callType, error: message },
        params.visitId,
      );

      return saved;
    }
  }

  /**
   * Fire-and-forget helper used after client submit.
   * Does not throw — verification submit must not be rolled back.
   */
  triggerInitialSubmissionCall(physicalVerificationId: string, createdBy?: string | null): void {
    console.log('[TELEPHONY] Auto-trigger INITIAL_SUBMISSION for case:', physicalVerificationId);
    void this.triggerAutoCall(physicalVerificationId, 'INITIAL_SUBMISSION', createdBy);
  }

  /**
   * Fire-and-forget helper used after super admin complete().
   */
  triggerFinalReportCall(physicalVerificationId: string, createdBy?: string | null): void {
    console.log('[TELEPHONY] Auto-trigger FINAL_REPORT for case:', physicalVerificationId);
    void this.triggerAutoCall(physicalVerificationId, 'FINAL_REPORT', createdBy);
  }

  private async triggerAutoCall(
    physicalVerificationId: string,
    callType: TelephonyCallType,
    createdBy?: string | null,
  ): Promise<void> {
    console.log('[TELEPHONY] ========== Auto call START ==========');
    console.log('[TELEPHONY] Auto call:', { physicalVerificationId, callType, createdBy });

    try {
      const record = await this.physicalRepo.findOne({ where: { id: physicalVerificationId } });
      if (!record) {
        console.error('[TELEPHONY] ERROR: Physical verification not found:', physicalVerificationId);
        return;
      }

      const customerMobile = this.resolveCustomerMobile(record);
      if (!customerMobile) {
        console.error('[TELEPHONY] ERROR: Customer mobile missing — skipping auto call');
        await this.addPhysicalLog(
          physicalVerificationId,
          'AUTO_CALL_FAILED',
          `${this.callTypeLabel(callType)} call skipped: customer mobile missing`,
          createdBy ?? null,
          { callType },
        );
        return;
      }

      console.log('[TELEPHONY] Auto call mobile resolved:', customerMobile);
      const callRecord = await this.createAndDialCall({
        physicalVerificationId,
        visitId: null,
        customerMobile,
        callType,
        createdBy: createdBy ?? null,
      });

      if (callRecord.status === 'FAILED') {
        console.error('[TELEPHONY] Auto call FAILED for case:', physicalVerificationId, {
          callRecordId: callRecord.id,
          error: callRecord.providerResponse?.error,
        });
      } else {
        console.log('[TELEPHONY] Auto call SUCCESS for case:', physicalVerificationId, {
          callRecordId: callRecord.id,
          callSid: callRecord.callSid,
          status: callRecord.status,
        });
      }
      console.log('[TELEPHONY] ========== Auto call END ==========');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Auto call failed';
      console.error('[TELEPHONY] Auto call EXCEPTION:', message);
      console.error('[TELEPHONY] ========== Auto call END (EXCEPTION) ==========');
      this.logger.warn(`Auto call (${callType}) failed for ${physicalVerificationId}: ${message}`);
    }
  }

  async recall(
    physicalVerificationId: string,
    user: AuthedUser,
    visitId?: string | null,
  ): Promise<APIResponseInterface<PhysicalVerificationCall>> {
    console.log('[TELEPHONY] ========== Recall START ==========');
    console.log('[TELEPHONY] Recall request:', { physicalVerificationId, visitId, user: user.sub });

    if (user.role !== Role.SUPER_ADMIN) {
      console.error('[TELEPHONY] ERROR: Recall denied — not SUPER_ADMIN');
      throw new ForbiddenException('Only super admin can recall customers');
    }

    const record = await this.assertAccess(physicalVerificationId, user);
    const customerMobile = this.resolveCustomerMobile(record);
    if (!customerMobile) {
      console.error('[TELEPHONY] ERROR: Recall failed — customer mobile missing');
      throw new NotFoundException('Customer mobile number is not available for this case');
    }

    const callRecord = await this.createAndDialCall({
      physicalVerificationId,
      visitId: visitId ?? null,
      customerMobile,
      callType: 'RECALL',
      createdBy: user.sub ?? null,
    });

    if (callRecord.status === 'FAILED') {
      const errorMessage =
        (callRecord.providerResponse?.error as string | undefined) ?? 'Recall call failed';
      console.error('[TELEPHONY] Recall FAILED:', errorMessage);
      throw new BadRequestException(errorMessage);
    }

    await this.addPhysicalLog(
      physicalVerificationId,
      'CALL_RECALLED',
      `Customer recalled at ${customerMobile}`,
      user.sub ?? null,
      { callRecordId: callRecord.id },
      visitId ?? null,
    );

    console.log('[TELEPHONY] Recall SUCCESS:', {
      callRecordId: callRecord.id,
      callSid: callRecord.callSid,
      status: callRecord.status,
    });
    console.log('[TELEPHONY] ========== Recall END ==========');

    return {
      code: HttpStatus.CREATED,
      message: 'Customer recall call initiated successfully',
      data: callRecord,
    };
  }

  async getCallsByPhysicalVerificationId(
    physicalVerificationId: string,
    user: AuthedUser,
  ): Promise<APIResponseInterface<PhysicalVerificationCall[]>> {
    await this.assertAccess(physicalVerificationId, user);
    const calls = await this.callRepo.find({
      where: { physicalVerificationId },
      order: { createdAt: 'DESC' },
    });
    return {
      code: HttpStatus.OK,
      message: 'Call history fetched successfully',
      data: calls,
    };
  }

  async handleWebhook(
    payload?: TelephonyWebhookPayload | null,
  ): Promise<{ received: boolean; code?: number; message?: string }> {
    console.log('[TELEPHONY] ========== Webhook START ==========');
    console.log('[TELEPHONY] Webhook raw payload:', payload);

    // Exotel expects HTTP 200 even on empty/malformed callbacks — never throw.
    if (!payload || typeof payload !== 'object') {
      console.warn(
        '[TELEPHONY] WARNING: Webhook body is empty/undefined. ' +
          'Exotel usually sends application/x-www-form-urlencoded. ' +
          'Check reverse-proxy Content-Type / body forwarding.',
      );
      console.log('[TELEPHONY] ========== Webhook END (empty) ==========');
      return {
        code: HttpStatus.OK,
        message: 'Webhook received (empty payload)',
        received: true,
      };
    }

    const normalized = this.provider.handleWebhook(payload) ?? payload;
    const callSid = String(normalized.CallSid ?? normalized['CallSid'] ?? '').trim() || undefined;
    const customField =
      String(normalized.CustomField ?? normalized['CustomField'] ?? '').trim() || undefined;
    const statusRaw = String(normalized.Status ?? normalized['Status'] ?? '').trim() || undefined;
    const recordingUrl =
      String(normalized.RecordingUrl ?? normalized['RecordingUrl'] ?? '').trim() || undefined;

    console.log('[TELEPHONY] Webhook parsed:', {
      callSid,
      customField,
      status: statusRaw,
      recordingUrl: recordingUrl ?? null,
    });

    let callRecord: PhysicalVerificationCall | null = null;
    if (customField) {
      callRecord = await this.callRepo.findOne({ where: { id: customField } });
    }
    if (!callRecord && callSid) {
      callRecord = await this.callRepo.findOne({ where: { callSid } });
    }
    if (!callRecord) {
      console.warn(
        '[TELEPHONY] Webhook for UNKNOWN call — CallSid:',
        callSid,
        'CustomField:',
        customField,
      );
      this.logger.warn(`Webhook received for unknown call: ${callSid ?? customField ?? 'n/a'}`);
      console.log('[TELEPHONY] ========== Webhook END (unknown) ==========');
      return {
        code: HttpStatus.OK,
        message: 'Webhook received (unknown call)',
        received: true,
      };
    }

    console.log('[TELEPHONY] Matched call record:', {
      callRecordId: callRecord.id,
      callType: callRecord.callType,
      previousStatus: callRecord.status,
      physicalVerificationId: callRecord.physicalVerificationId,
    });

    const status = this.mapWebhookStatus(statusRaw);
    callRecord.status = status;
    callRecord.callSid = callSid ?? callRecord.callSid;
    callRecord.startTime =
      this.parseWebhookDate(
        String(normalized.StartTime ?? normalized['StartTime'] ?? '') || null,
      ) ??
      callRecord.startTime ??
      new Date();
    callRecord.endTime =
      this.parseWebhookDate(String(normalized.EndTime ?? normalized['EndTime'] ?? '') || null) ??
      callRecord.endTime;

    const duration = this.parseDuration(normalized);
    if (duration != null) {
      callRecord.recordingDuration = duration;
    }

    if (recordingUrl) {
      const hadRecording = !!callRecord.recordingUrl;
      callRecord.recordingUrl = recordingUrl;
      console.log('[TELEPHONY] Recording URL received:', callRecord.recordingUrl);
      if (!hadRecording) {
        await this.addPhysicalLog(
          callRecord.physicalVerificationId,
          'RECORDING_RECEIVED',
          `Call recording received for ${this.callTypeLabel(callRecord.callType)}`,
          callRecord.createdBy,
          { callRecordId: callRecord.id, callSid: callRecord.callSid },
          callRecord.visitId,
        );
      }
    }

    callRecord.providerResponse = {
      ...(callRecord.providerResponse ?? {}),
      lastWebhook: normalized,
    };
    await this.callRepo.save(callRecord);

    console.log('[TELEPHONY] Webhook updated call:', {
      callRecordId: callRecord.id,
      callSid: callRecord.callSid,
      status,
      duration: callRecord.recordingDuration,
      hasRecording: !!callRecord.recordingUrl,
    });

    if (TERMINAL_STATUSES.includes(status)) {
      const logAction: PhysicalLogAction =
        status === 'COMPLETED' ? 'AUTO_CALL_COMPLETED' : 'AUTO_CALL_FAILED';
      const logMessage =
        status === 'COMPLETED'
          ? `${this.callTypeLabel(callRecord.callType)} call completed`
          : `${this.callTypeLabel(callRecord.callType)} call ended with status ${status}`;

      if (status === 'COMPLETED') {
        console.log('[TELEPHONY] SUCCESS: Call completed —', logMessage);
      } else {
        console.error('[TELEPHONY] ERROR: Call terminal failure —', logMessage);
      }

      await this.addPhysicalLog(
        callRecord.physicalVerificationId,
        logAction,
        logMessage,
        callRecord.createdBy,
        {
          callRecordId: callRecord.id,
          callSid: callRecord.callSid,
          status,
          duration: callRecord.recordingDuration,
        },
        callRecord.visitId,
      );
    }

    console.log('[TELEPHONY] ========== Webhook END ==========');
    return {
      code: HttpStatus.OK,
      message: 'Webhook processed',
      received: true,
    };
  }

  async getRecordingBuffer(callRecordId: string, user: AuthedUser): Promise<Buffer> {
    console.log('[TELEPHONY] getRecordingBuffer:', callRecordId);
    const callRecord = await this.callRepo.findOne({ where: { id: callRecordId } });
    if (!callRecord) {
      console.error('[TELEPHONY] ERROR: Call record not found:', callRecordId);
      throw new NotFoundException('Call record not found');
    }
    await this.assertAccess(callRecord.physicalVerificationId, user);
    if (!callRecord.recordingUrl?.trim()) {
      console.error('[TELEPHONY] ERROR: Recording URL missing for call:', callRecordId);
      throw new NotFoundException('Recording is not available for this call');
    }

    try {
      const buffer = await this.provider.downloadRecording(callRecord.recordingUrl);
      console.log('[TELEPHONY] Recording download SUCCESS: bytes=', buffer.length);
      return buffer;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Recording download failed';
      console.error('[TELEPHONY] Recording download ERROR:', message);
      throw error;
    }
  }
}
