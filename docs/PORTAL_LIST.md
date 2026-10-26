# Portal List Module

Admin catalog of verification portals grouped by category. Used by Super Admin UI for CRUD and flags. Seed data ships in `src/modules/portal-list/seed/portal-list.seed.json`.

## Entities

| Table | Purpose |
|-------|---------|
| `portal_categories` | Category name, sort order, active |
| `portals` | Portal under a category; URL/metadata; `usedInDigitalReport` flag |

## Admin APIs (`SUPER_ADMIN`)

Base: `/api/admin/portal-list`

| Method | Path | Description |
|--------|------|-------------|
| GET | `/tree` | Full tree (`?activeOnly=true` optional) |
| GET | `/categories` | List categories |
| POST | `/categories` | Create category |
| PUT | `/categories/:id` | Update category |
| DELETE | `/categories/:id` | Delete category |
| POST | `/portals` | Create portal |
| PUT | `/portals/:id` | Update portal |
| PATCH | `/portals/:id/flags` | Update flags (e.g. `usedInDigitalReport`) |
| DELETE | `/portals/:id` | Delete portal |

## Seed

```bash
npm run seed:portal-list
npm run seed:portal-list -- --force
```

## Module layout

```
src/modules/portal-list/
  portal-list.module.ts
  controllers/portal-list-admin.controller.ts
  services/portal-list.service.ts
  dto/portal-list.dto.ts
  entities/
  seed/portal-list.seed.json
```

## Current usage

- Managed in Super Admin **Portal list** UI.
- Flag `usedInDigitalReport` is stored on portals; digital-verification report generation does not currently load this catalog at runtime.
