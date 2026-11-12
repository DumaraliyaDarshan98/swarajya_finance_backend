# Swarajya Finance — Backend Architecture

## Overview

NestJS 11 API with TypeORM (MySQL) and JWT authentication. Domain logic lives in feature modules under `src/modules/`.

## Folder structure

```
src/
├── app.ts / main.ts / app.module.ts
├── config/                 # @nestjs/config (app, database)
├── common/                 # guards, decorators, interceptors, enums
├── database/               # TypeORM CLI data source, migrations, SCHEMA.md
├── queues/                 # Placeholder module (not wired to a job runner)
└── modules/                # Domain features (controllers / services / entities / dto)
```

## Request flow

```
HTTP Request
  → Controller (DTO + ValidationPipe)
  → Service
  → TypeORM repository / entity
  → APIResponseInterceptor → { code, message, data, pagination }
```

## Modules (implemented)

| Module | Responsibility |
|--------|----------------|
| `auth` | Login, password reset/change, create-super-admin |
| `user` | Platform & client users, profile, document upload |
| `client` | Tenant CRUD, public register, plan change |
| `role` | Custom roles & `app_modules` permissions (seeded on boot) |
| `verification` | Legacy verification requests; shared OCR HTTP client |
| `digital-verification` | Digital verification cases & reports |
| `ocr-verification` | OCR cases, file pipeline, Socket.IO progress |
| `physical-verification` | Parent cases, visits, agent workflow, reports |
| `telephony` | Exotel Voice (dial, webhook, recall, recording) |
| `field-assistance` | Field agent onboarding & admin CRUD |
| `field-agent-wallet` | Earnings & withdrawals |
| `field-agent-attendance` | Check-in / check-out |
| `training` | Videos, exam questions, certificates, reset duration |
| `subscription-plan` | Plan CRUD; maps to client settings |
| `report-customization` | Report layout templates by type |
| `rcu-triggers` | Category → document type → trigger tree (OCR consumer) |
| `forensic-checks` | Forensic check catalog (OCR verify payload) |
| `portal-list` | Portal category → portal tree (admin catalog) |
| `scrapping` | GST / WHOIS / pincode helpers |
| `geo` | Address geocode |
| `mail` / `notification` | Email templates; notification helper (SMS stub) |
| `super-admin-settings` | Platform key-value settings |

## Authentication

- JWT in `Authorization: Bearer <token>`
- `JwtAuthGuard` + `RolesGuard` (`@Roles(...)`)
- Login payload includes `permissions` for frontend RBAC (not a separate server PermissionGuard)

## Database

- MySQL, snake_case columns (`SnakeNamingStrategy`)
- Local default: `DB_SYNCHRONIZE=true`; production should use migrations with sync off
- Partial table notes: `src/database/SCHEMA.md`

## OCR integration

`OcrService` calls the `ocr_extraction` sidecar:

- Identify: `POST {OCR_SERVICE_URL}/api/document/identify`
- Verify: `POST {OCR_SERVICE_URL}/api/document/verify`

Used by `ocr-verification` background processing and `POST /api/verification-requests/ocr/extract-simple`.

## API contract

Global prefix: `/api` (`API_PREFIX`).

```json
{
  "code": 200,
  "message": "Success",
  "data": {},
  "pagination": null
}
```
