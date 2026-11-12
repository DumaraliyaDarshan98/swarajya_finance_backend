# Database schema reference

MySQL database for Swarajya Finance. Column names are **snake_case** in the database (TypeORM `SnakeNamingStrategy`).

## Core identity & access

### `users`
Platform users, client users, and field agents.

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | PK |
| email | varchar | unique |
| password | varchar | bcrypt hash |
| role | enum | SUPER_ADMIN, INTERNAL_USER, CLIENT_ADMIN, CLIENT_USER, FIELD_AGENT |
| client_id | UUID | FK → clients (nullable for platform users) |
| custom_role_id | UUID | FK → roles (nullable) |
| is_active | boolean | |
| reset_token / reset_token_expiry | | password reset flow |

### `clients`
Tenant organizations.

| Column | Notes |
|--------|-------|
| id | UUID PK |
| name, email, mobile_number | |
| setting | JSON — feature flags (digitalFlow, physical, ocr, maxUsers, …) |
| is_active | |

### `roles` / `role_permissions` / `app_modules`
Custom roles per client (or internal). Permissions: VIEW, ADD, EDIT, LIST, DELETE per module code.

## Verification domain

### `verification_requests` (legacy combined flow)
Parent record linking digital, document, and physical steps.

### `digital_verifications`
Standalone digital verification cases with scrape payload & report data.

### `ocr_verifications`
OCR cases with document slots, merged files, extracted data.

### `physical_verifications`
Physical verification parent with applicant & business details.

### `physical_verification_visits`
Per-visit sub-cases assigned to field agents (trip, submission, approval).

### `physical_logs`
Audit trail for physical verification actions.

## Field operations

### `field_assistants` + child tables
Field agent onboarding: addresses, banks, education, family, emergency contacts, identification, previous employment.

### `field_agent_wallets` / `field_agent_wallet_transactions`
Agent balance and per-visit earnings.

## Security & activity

### `audit_logs`
Immutable trail of logins and mutating API actions (IP, geo, user-agent, module, status).

| Column | Notes |
|--------|-------|
| action | LOGIN, LOGIN_FAILED, CREATE, UPDATE, DELETE, … |
| module | AUTH, VERIFICATION, … |
| user_id / user_email / user_role / client_id | actor context |
| ip_address / city / region / country / location_label | request geo |
| method / path / status_code / metadata | HTTP context |

### `user_notifications`
In-app notifications per user (email/SMS still go through NotificationService).

| Column | Notes |
|--------|-------|
| user_id | recipient |
| title / body / icon | display |
| read | boolean |
| cta_url | optional deep link |

## Platform

### `super_admin_settings`
Key-value platform configuration.

### Portal catalog
`portal_categories` / `portals` — flagged with `used_in_digital_report` and embedded into digital report `scrapePayload.portalCatalog`.

## Migrations

Located in `src/database/migrations/`. Run:

```bash
npm run migration:run
```

For new environments, keep `DB_SYNCHRONIZE=true` only in local dev. Production must use `DB_SYNCHRONIZE=false`.

## Entity files

Each table maps to `src/modules/<module>/entities/*.entity.ts`.
