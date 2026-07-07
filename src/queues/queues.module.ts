import { Module } from '@nestjs/common';

/**
 * Placeholder for background jobs (report generation, Puppeteer scraping, emails).
 * Wire BullMQ/Redis here when moving heavy work off the HTTP request path.
 */
@Module({})
export class QueuesModule {}
