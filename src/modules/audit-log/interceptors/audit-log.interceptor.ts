import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';
import { Request, Response } from 'express';
import { AuditLogService } from '../services/audit-log.service';
import {
  extractRequestMeta,
  inferActionFromMethod,
  inferModuleFromPath,
} from '../helpers/request-meta.helper';
import { AuthedUser } from '../../../common/interfaces/authed-user.interface';

const SKIP_PREFIXES = [
  '/api/audit-logs',
  '/api/auth/login',
  '/api/auth/forgot-password',
  '/api/auth/reset-password',
  '/api/exotel/webhook',
  '/api/geo/',
];

@Injectable()
export class AuditLogInterceptor implements NestInterceptor {
  constructor(private readonly auditLogService: AuditLogService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const http = context.switchToHttp();
    const req = http.getRequest<Request & { user?: AuthedUser }>();
    const method = (req.method || '').toUpperCase();

    // Log mutating authenticated requests (and successful GETs for sensitive exports later if needed)
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
      return next.handle();
    }

    const meta = extractRequestMeta(req);
    const path = meta.path || '';
    if (SKIP_PREFIXES.some((p) => path.startsWith(p))) {
      return next.handle();
    }

    // Only authenticated users for interceptor-based action logs
    if (!req.user?.sub) {
      return next.handle();
    }

    const started = Date.now();
    return next.handle().pipe(
      tap({
        next: () => {
          const res = http.getResponse<Response>();
          this.writeLog(req, meta, res.statusCode || 200, started);
        },
        error: (err: { status?: number; statusCode?: number; message?: string }) => {
          const status = err?.status || err?.statusCode || 500;
          this.writeLog(req, meta, status, started, err?.message);
        },
      }),
    );
  }

  private writeLog(
    req: Request & { user?: AuthedUser },
    meta: ReturnType<typeof extractRequestMeta>,
    statusCode: number,
    started: number,
    errorMessage?: string,
  ) {
    const user = req.user;
    const module = inferModuleFromPath(meta.path);
    const action = inferActionFromMethod(meta.method, meta.path);
    const durationMs = Date.now() - started;

    const description = errorMessage
      ? `${meta.method} ${meta.path} failed (${statusCode})`
      : `${meta.method} ${meta.path}`;

    this.auditLogService.logAsync({
      action,
      module,
      description,
      userId: user?.sub ?? null,
      userEmail: user?.email ?? null,
      userName: user?.fullName ?? null,
      userRole: user?.role ? String(user.role) : null,
      clientId: user?.clientId ?? null,
      ipAddress: meta.ipAddress,
      userAgent: meta.userAgent,
      method: meta.method,
      path: meta.path,
      statusCode,
      metadata: {
        durationMs,
        query: req.query && Object.keys(req.query).length ? req.query : undefined,
        error: errorMessage || undefined,
      },
    });
  }
}
