# Audit logs

Immutable activity trail for logins and mutating API actions.

## What is recorded

| Event | Source | Details |
|-------|--------|---------|
| Successful login | `AuthService.login` | User, role, IP, user-agent, city/region/country (geo IP) |
| Failed login | `AuthService.login` | Attempted email, reason, IP, geo |
| Create / update / delete / status change | Global `AuditLogInterceptor` | Authenticated `POST`/`PUT`/`PATCH`/`DELETE` (skips auth/login & audit-log self) |

Geo lookup uses a public IP API (best-effort; private IPs skip). Writes never fail the user request.

## APIs

- `GET /api/audit-logs` — paginated list (filters: `search`, `action`, `module`, `userRole`, `userId`, `clientId`, `from`, `to`, `sortOrder`)
- `GET /api/audit-logs/filters` — distinct actions/modules for dropdowns

**Scope**

- Super Admin / Internal User: all tenants (optional `clientId` filter)
- Client Admin / Client User: only rows with their `clientId`

## UI

- Super Admin: `/super-admin/audit-logs` (module `AUDIT_LOG`)
- Client: `/client-admin/audit-logs` (module `AUDIT_LOG`)

Grant `VIEW`/`LIST` on `AUDIT_LOG` in Role Management for custom roles. Super Admin and Client Admin (default) already include full access.
