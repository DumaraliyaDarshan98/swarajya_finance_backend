import { Global, Module } from '@nestjs/common';
import { JobQueueService } from './job-queue.service';
import { OcrJobRegistrar } from './ocr-job.registrar';
import { VerificationModule } from '../modules/verification/verification.module';

/**
 * Background jobs foundation.
 * Currently in-process; set REDIS_URL later and migrate JobQueueService to BullMQ.
 */
@Global()
@Module({
  imports: [VerificationModule],
  providers: [JobQueueService, OcrJobRegistrar],
  exports: [JobQueueService],
})
export class QueuesModule {}
