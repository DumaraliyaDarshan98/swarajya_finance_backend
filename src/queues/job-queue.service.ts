import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';

export type JobHandler<T = unknown> = (payload: T) => Promise<void>;

type QueuedJob = {
  name: string;
  payload: unknown;
  enqueuedAt: number;
  attempts: number;
};

/**
 * Lightweight in-process job queue.
 * Swap for BullMQ/Redis by replacing this service — handlers stay the same.
 *
 * Example:
 *   jobQueue.register('ocr.verify', async (payload) => { ... });
 *   jobQueue.enqueue('ocr.verify', { recordId });
 */
@Injectable()
export class JobQueueService implements OnModuleDestroy {
  private readonly logger = new Logger(JobQueueService.name);
  private readonly handlers = new Map<string, JobHandler>();
  private readonly queue: QueuedJob[] = [];
  private running = false;
  private stopped = false;
  private readonly maxAttempts = 3;

  register<T>(name: string, handler: JobHandler<T>): void {
    this.handlers.set(name, handler as JobHandler);
    this.logger.log(`Registered job handler: ${name}`);
  }

  enqueue<T>(name: string, payload: T): void {
    if (!this.handlers.has(name)) {
      this.logger.warn(`No handler registered for job "${name}" — dropping`);
      return;
    }
    this.queue.push({
      name,
      payload,
      enqueuedAt: Date.now(),
      attempts: 0,
    });
    void this.pump();
  }

  get depth(): number {
    return this.queue.length;
  }

  onModuleDestroy(): void {
    this.stopped = true;
  }

  private async pump(): Promise<void> {
    if (this.running || this.stopped) return;
    this.running = true;
    try {
      while (this.queue.length && !this.stopped) {
        const job = this.queue.shift()!;
        const handler = this.handlers.get(job.name);
        if (!handler) continue;
        try {
          await handler(job.payload);
        } catch (err) {
          job.attempts += 1;
          this.logger.error(
            `Job ${job.name} failed (attempt ${job.attempts}): ${
              err instanceof Error ? err.message : String(err)
            }`,
          );
          if (job.attempts < this.maxAttempts) {
            this.queue.push(job);
          }
        }
      }
    } finally {
      this.running = false;
    }
  }
}
