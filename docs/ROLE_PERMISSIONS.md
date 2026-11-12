# Role & module permissions (current)

Permissions are `VIEW` · `LIST` · `ADD` · `EDIT` · `DELETE` per `app_modules` row.

- **Nav visibility:** `VIEW` or `LIST`
- **Add buttons / add routes:** `ADD`
- **Edit buttons / edit routes:** `EDIT`
- **Delete buttons:** `DELETE`
- **Detail / report:** `VIEW` or `LIST` (via `canViewModule`)

Super Admin always bypasses UI guards. Custom roles (internal or client) use permissions returned at login.

## Modules in role management (seeded)

| Code | Name | Platform role UI | Client role UI | Nav area |
|------|------|------------------|----------------|----------|
| `DASHBOARD` | Dashboard | Yes | Yes | Dashboard |
| `CLIENT_MANAGEMENT` | Client Management | Yes | No | Client listing |
| `USER_MANAGEMENT` | User Management | Yes | Yes | Client users |
| `ROLE_MANAGEMENT` | Role Management | Yes | Yes | Roles |
| `SETTINGS` | Settings | Yes | Yes | Settings |
| `INTERNAL_USER_MANAGEMENT` | Internal User Management | Yes | No | Internal users |
| `VERIFICATION` | Verification | Yes | Yes | Digital / OCR / Physical |
| `FIELD_AGENT` | Field Agent | Yes | No | Agents, wallet, attendance |
| `REPORT_CUSTOMIZATION` | Report Customization | Yes | No | Report templates |
| `PORTAL_LIST` | Portal List | Yes | No | Masters |
| `AI_TOOLS` | AI Tools | Yes | No | Masters |
| `RCU_TRIGGERS` | RCU Triggers | Yes | No | Masters |
| `FORENSIC_CHECKS` | Forensic Checks | Yes | No | Masters |
| `TRAINING` | Training | Yes | Yes | Training / lessons |
| `SUBSCRIPTION` | Subscription | Yes | Yes | Plans / subscription |
| `AUDIT_LOG` | Audit Logs | Yes | Yes | Security / activity trail |

New codes are inserted on API boot via `RolesService.seedModulesIfEmpty()` (missing codes only).

## After deploy

1. Restart backend so new modules are seeded.
2. Re-open **Role Management → Edit** for each custom role and tick permissions for new modules (Portal, AI Tools, RCU, Forensics, Training, Subscription, Dashboard, Audit Logs).
3. Ask affected users to **log out and log in** so JWT/localStorage permissions refresh.
