import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { JobQueueService } from './job-queue.service';
import { OcrService } from '../modules/verification/services/ocr.service';

/**
 * Registers OCR-related background job names.
 * Enqueue from services with: jobQueue.enqueue('ocr.health-ping', {})
 */
@Injectable()
export class OcrJobRegistrar implements OnModuleInit {
  private readonly logger = new Logger(OcrJobRegistrar.name);

  constructor(
    private readonly jobs: JobQueueService,
    private readonly ocr: OcrService,
  ) {}

  onModuleInit(): void {
    this.jobs.register('ocr.health-ping', async () => {
      await this.ocr.assertHealthy();
      this.logger.debug('OCR health ping OK');
    });
  }
}
