# Swarajya Finance — Backend Architecture

## Overview

NestJS 11 API with TypeORM (MySQL), JWT authentication, and a **feature-module** layout designed for teams and scale (~10k concurrent users with proper infra: connection pooling, Redis queues, horizontal scaling).

## Folder structure

```
src/
├── app.ts                 # App bootstrap (CORS, validation, prefix)
├── main.ts                # Entry point
├── app.module.ts          # Root module wiring
├── config/                # Centralized env config (@nestjs/config)
├── common/                # Cross-cutting code
│   ├── base/              # BaseRepository
│   ├── decorators/        # @Roles()
│   ├── enums/             # Role, Permission
│   ├── guards/            # JwtAuthGuard, RolesGuard
│   ├── interceptors/      # API response wrapper, timeout
│   ├── interfaces/        # Shared response types
│   ├── middlewares/
│   └── jwt.strategy.ts
├── database/
│   ├── databaseConfig.ts  # TypeORM CLI data source
│   ├── migrations/        # Schema migrations
│   └── SCHEMA.md          # Table reference
├── queues/                # Background jobs (BullMQ-ready)
└── modules/               # Domain features
    └── <feature>/
        ├── <feature>.module.ts
        ├── controllers/
        ├── services/
        ├── repositories/  # Data access (extend BaseRepository)
        ├── dto/
        ├── entities/
        ├── helpers/       # Optional pure functions
        └── interfaces/
```

## Request flow

```
HTTP Request
  → Controller (validation via DTO)
  → Service (business logic)
  → Repository / TypeORM (persistence)
  → APIResponseInterceptor (uniform { code, message, data })
```

## Modules

| Module | Responsibility |
|--------|----------------|
| `auth` | Login, password reset, super-admin bootstrap |
| `user` | Platform & client users, document upload |
| `client` | Tenant (client) CRUD & settings |
| `role` | Custom roles & module permissions |
| `verification` | Legacy multi-step verification requests |
| `digital-verification` | Digital verification workflow |
| `ocr-verification` | OCR document verification |
| `physical-verification` | Physical visits & field-agent workflow |
| `field-assistance` | Field agent HR onboarding |
| `field-agent-wallet` | Agent earnings & transactions |
| `scrapping` | GST / WHOIS / pincode integrations |
| `super-admin-settings` | Platform key-value settings |
| `mail` / `notification` | Email & notification helpers |

## Authentication & authorization

- **JWT** in `Authorization: Bearer <token>` (1 day expiry).
- **JwtAuthGuard** on protected routes.
- **RolesGuard** enforces `@Roles(Role.SUPER_ADMIN, ...)` metadata.
- Login returns `permissions` array for frontend RBAC.

## Database

- MySQL with **snake_case** columns (`SnakeNamingStrategy`).
- Set `DB_SYNCHRONIZE=false` in production; use migrations.
- See `src/database/SCHEMA.md` for tables and relationships.

## Scaling notes (10k users)

1. **API layer**: Run multiple Node instances behind a load balancer.
2. **MySQL**: Connection pool tuning, read replicas for list/report queries.
3. **Heavy work**: Move Puppeteer scraping & PDF reports to `queues/` (BullMQ + Redis).
4. **Files**: Move `uploads/` to S3-compatible storage for multi-instance deploys.
5. **Caching**: Redis for session-less JWT validation extras, settings, stats endpoints.

## API contract

Global prefix: `/api` (configurable via `API_PREFIX`).

All successful JSON responses:

```json
{
  "code": 200,
  "message": "Success",
  "data": {},
  "pagination": null
}
```

**No breaking changes** were made to route paths during this restructure.
