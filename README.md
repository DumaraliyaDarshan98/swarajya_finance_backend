# Swarajya Finance — Backend

NestJS 11 API for multi-tenant RAC (Risk Assessment / Credit) verification: digital, OCR, and physical flows, plus field-agent ops, training, and admin catalogs.

## Stack

- NestJS 11, TypeScript
- TypeORM + MySQL (`mysql2`)
- JWT auth (`passport-jwt`)
- Socket.IO (`/ocr-progress`) for OCR job progress
- Nodemailer (email), Axios (Exotel), Puppeteer (GST/WHOIS scraping)

## Quick start

```bash
cp .env.example .env   # set DB_*, JWT_SECRET, MAIL_*, optional Exotel
npm install
npm run start:dev      # default http://localhost:3200/api
npm run create-super-admin
```

Optional seeds:

```bash
npm run seed:rcu-triggers
npm run seed:forensic-checks
npm run seed:portal-list
```

## Environment (see `.env.example`)

| Area | Keys |
|------|------|
| Server | `PORT`, `API_PREFIX`, `NODE_ENV` |
| DB | `DB_HOST`, `DB_PORT`, `DB_USERNAME`, `DB_PASSWORD`, `DB_NAME`, `DB_SYNCHRONIZE`, `DB_LOGGING` |
| Auth | `JWT_SECRET`, `JWT_EXPIRES_IN`, `SUPER_ADMIN_SECRET` |
| Mail | `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASS`, `MAIL_FROM` |
| Frontend | `FRONTEND_URL` |
| OCR sidecar | `OCR_SERVICE_URL` (default `http://localhost:3300`) |
| Telephony | `TELEPHONY_PROVIDER`, `EXOTEL_*` |

## Roles

`SUPER_ADMIN` · `INTERNAL_USER` · `CLIENT_ADMIN` · `CLIENT_USER` · `FIELD_AGENT`

Protected routes use `JwtAuthGuard` + `RolesGuard`. Login returns a `permissions` array for the frontend; server enforcement is role-based.

## Feature modules (current)

| Module | What it does |
|--------|----------------|
| `auth` | Login, password flows, create-super-admin |
| `user` / `client` / `role` | Users, tenants, custom roles |
| `digital-verification` | Digital cases + GST/WHOIS/pincode helpers |
| `ocr-verification` | OCR cases, uploads, background pipeline, Socket progress |
| `verification` | Legacy verification requests + shared `OcrService` / extract-simple |
| `physical-verification` | Parent cases, visits, agent trip, reports |
| `telephony` | Exotel dial, webhook, recall, recording proxy |
| `field-assistance` / `field-agent-wallet` / `field-agent-attendance` | Agents, wallet, check-in |
| `training` | Role videos, exams, certificates |
| `subscription-plan` / `report-customization` / `super-admin-settings` | Plans, report layouts, settings |
| `rcu-triggers` / `forensic-checks` / `portal-list` | Admin catalogs (RCU/forensics used by OCR; portal list is admin CRUD) |
| `scrapping` / `geo` / `mail` / `notification` | Integrations & notifications |

## Docs

| Doc | Topic |
|-----|--------|
| [ARCHITECTURE.md](./ARCHITECTURE.md) | Layout, request flow, modules |
| [docs/PHYSICAL_VERIFICATION_FLOW.md](./docs/PHYSICAL_VERIFICATION_FLOW.md) | Physical status machine |
| [docs/PHYSICAL_VERIFICATION_BACKEND.md](./docs/PHYSICAL_VERIFICATION_BACKEND.md) | Physical APIs & telephony |
| [docs/TRAINING_CERTIFICATION.md](./docs/TRAINING_CERTIFICATION.md) | Training & exams |
| [docs/RCU_TRIGGERS.md](./docs/RCU_TRIGGERS.md) | RCU admin tree |
| [docs/PORTAL_LIST.md](./docs/PORTAL_LIST.md) | Portal catalog |
| [docs/CLIENT_API_REFERENCE.md](./docs/CLIENT_API_REFERENCE.md) | Client APIs |
| [docs/EMAIL_TEMPLATES.md](./docs/EMAIL_TEMPLATES.md) | Branded email templates & triggers |
| [docs/ROLE_PERMISSIONS.md](./docs/ROLE_PERMISSIONS.md) | Role modules & CRUD permissions |
| [docs/AUDIT_LOGS.md](./docs/AUDIT_LOGS.md) | Login & action audit trail APIs / UI |
| [docs/IMPLEMENTATION_STATUS.md](./docs/IMPLEMENTATION_STATUS.md) | Gap list: what shipped, how it works, examples |
| [src/database/SCHEMA.md](./src/database/SCHEMA.md) | Partial schema notes |

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run start:dev` | Watch mode |
| `npm run create-super-admin` | Upsert default super admin |
| `npm run seed:rcu-triggers` / `seed:forensic-checks` / `seed:portal-list` | Seed catalogs (`--force` to replace) |
| `npm run db:clean` | Wipe DB data (dev) |
| `npm run migration:run` | Run TypeORM migrations |

## Related apps

- Frontend: `swarajya_finance_frontend` (Angular, typically `:4200`)
- OCR service: `ocr_extraction` (Express, typically `:3300`)
