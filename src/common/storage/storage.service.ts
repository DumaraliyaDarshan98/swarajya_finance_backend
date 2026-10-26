import { Injectable, Logger } from '@nestjs/common';
import { promises as fs } from 'fs';
import * as path from 'path';
import { randomUUID } from 'crypto';

/**
 * Local filesystem storage (default).
 * When STORAGE_DRIVER=s3 is configured later, swap implementation without
 * changing callers — keep this interface stable.
 */
@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly root = (
    process.env.UPLOAD_ROOT || path.join(process.cwd(), 'uploads')
  ).replace(/\\/g, '/');

  async save(
    folder: string,
    originalName: string,
    buffer: Buffer,
  ): Promise<{ key: string; absolutePath: string; urlPath: string }> {
    const safeFolder = folder.replace(/[^a-zA-Z0-9/_-]/g, '').replace(/^\/+|\/+$/g, '');
    const ext = path.extname(originalName || '').slice(0, 12) || '';
    const key = `${safeFolder}/${randomUUID()}${ext}`;
    const absolutePath = path.join(this.root, key);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, buffer);
    this.logger.debug(`Stored file ${key}`);
    return {
      key,
      absolutePath,
      urlPath: `/uploads/${key}`,
    };
  }

  async remove(key: string): Promise<void> {
    const absolutePath = path.join(this.root, key);
    try {
      await fs.unlink(absolutePath);
    } catch {
      /* ignore missing */
    }
  }
}
