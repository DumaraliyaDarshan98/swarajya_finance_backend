import { Request } from 'express';

export type RequestMeta = {
  ipAddress: string | null;
  userAgent: string | null;
  method: string | null;
  path: string | null;
};

export function extractClientIp(req: Request): string | null {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string' && forwarded.trim()) {
    return forwarded.split(',')[0].trim();
  }
  if (Array.isArray(forwarded) && forwarded[0]) {
    return String(forwarded[0]).split(',')[0].trim();
  }
  const realIp = req.headers['x-real-ip'];
  if (typeof realIp === 'string' && realIp.trim()) {
    return realIp.trim();
  }
  const ip = req.ip || req.socket?.remoteAddress || null;
  if (!ip) return null;
  // Normalize IPv6-mapped IPv4
  return ip.replace(/^::ffff:/, '');
}

export function extractRequestMeta(req: Request): RequestMeta {
  return {
    ipAddress: extractClientIp(req),
    userAgent:
      typeof req.headers['user-agent'] === 'string'
        ? req.headers['user-agent']
        : null,
    method: req.method || null,
    path: (req.originalUrl || req.url || '').split('?')[0] || null,
  };
}

export function inferModuleFromPath(path: string | null): string {
  if (!path) return 'GENERAL';
  const clean = path.replace(/^\/api\//, '/').replace(/^\//, '');
  const segment = clean.split('/')[0] || 'general';
  const map: Record<string, string> = {
    auth: 'AUTH',
    users: 'USER_MANAGEMENT',
    clients: 'CLIENT_MANAGEMENT',
    roles: 'ROLE_MANAGEMENT',
    'digital-verifications': 'VERIFICATION',
    'ocr-verifications': 'VERIFICATION',
    'physical-verifications': 'PHYSICAL_VERIFICATION',
    'verification-requests': 'VERIFICATION',
    'field-assistants': 'FIELD_AGENT',
    'field-agent': 'FIELD_AGENT',
    'field-agent-wallet': 'FIELD_AGENT',
    'field-agent-attendance': 'FIELD_AGENT',
    trainings: 'TRAINING',
    'admin': 'ADMIN',
    'subscription-plans': 'SUBSCRIPTION',
    'report-customizations': 'REPORT_CUSTOMIZATION',
    'super-admin-settings': 'SETTINGS',
    exotel: 'TELEPHONY',
    geo: 'GEO',
    'audit-logs': 'AUDIT_LOG',
  };
  if (map[segment]) return map[segment];
  if (segment.startsWith('admin')) {
    const next = clean.split('/')[1];
    if (next === 'trainings') return 'TRAINING';
    if (next === 'subscription-plans') return 'SUBSCRIPTION';
    if (next === 'rcu-triggers') return 'RCU_TRIGGERS';
    if (next === 'forensic-checks') return 'FORENSIC_CHECKS';
    if (next === 'portal-list') return 'PORTAL_LIST';
    return 'ADMIN';
  }
  return segment.replace(/-/g, '_').toUpperCase().slice(0, 80);
}

export function inferActionFromMethod(
  method: string | null,
  path: string | null,
): 'CREATE' | 'UPDATE' | 'DELETE' | 'VIEW' | 'OTHER' {
  const m = (method || '').toUpperCase();
  const p = (path || '').toLowerCase();
  if (p.includes('login')) return 'OTHER';
  if (m === 'POST') return 'CREATE';
  if (m === 'PUT' || m === 'PATCH') return 'UPDATE';
  if (m === 'DELETE') return 'DELETE';
  if (m === 'GET') return 'VIEW';
  return 'OTHER';
}
