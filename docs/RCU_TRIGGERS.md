# RCU Triggers Module

Admin tree: **category → document type → trigger**. Triggers marked for OCR are sent to the `ocr_extraction` verify API during OCR case processing.

## Entities

| Table | Purpose |
|-------|---------|
| `rcu_categories` | Top-level groups |
| `rcu_document_types` | Document type under a category; flags include `usedInOcr` |
| `rcu_triggers` | Trigger code/text/risk/section under a document type |

## Admin APIs (`SUPER_ADMIN`)

Base: `/api/admin/rcu-triggers`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tree` | Full tree (`?activeOnly=true` optional) |
| GET | `/categories` | List categories |
| POST | `/categories` | Create category |
| PUT | `/categories/:id` | Update category |
| DELETE | `/categories/:id` | Delete category |
| POST | `/document-types` | Create document type |
| PUT | `/document-types/:id` | Update document type |
| PATCH | `/document-types/:id/flags` | Update flags (e.g. OCR) |
| DELETE | `/document-types/:id` | Delete document type |
| POST | `/triggers` | Create trigger |
| PUT | `/triggers/:id` | Update trigger |
| PATCH | `/triggers/:id/flags` | Update trigger flags |
| DELETE | `/triggers/:id` | Delete trigger |

Service helpers resolve OCR triggers by identified document type for the OCR pipeline.

## Seed & helpers

```bash
npm run seed:rcu-triggers
npm run seed:rcu-triggers -- --force
npm run enable:rcu-ocr          # set usedInOcr flags for seed types
npm run reset:portal-rcu-flags  # reset related flags (script helper)
```

Seed JSON: `src/modules/rcu-triggers/seed/rcu-triggers.seed.json`. Seeded `usedInOcr` defaults to false until enabled.

## Module layout

```
src/modules/rcu-triggers/
  rcu-triggers.module.ts
  controllers/rcu-triggers-admin.controller.ts
  services/rcu-triggers.service.ts
  dto/rcu-triggers.dto.ts
  entities/
  seed/rcu-triggers.seed.json
```

## Current usage

- Super Admin **RCU Triggers** UI for catalog management.
- `OcrVerificationService` loads OCR triggers for the identified document type and passes them (with forensic configs) to `OcrService` → `ocr_extraction` `/api/document/verify`.
