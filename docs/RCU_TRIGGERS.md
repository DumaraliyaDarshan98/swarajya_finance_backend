# RCU Triggers Module

See the shared project doc: [`../../docs/RCU_TRIGGERS.md`](../../docs/RCU_TRIGGERS.md) (or `docs/RCU_TRIGGERS.md` at repo root).

## Quick commands

```bash
# From swarajya_finance_backend
npm run seed:rcu-triggers
npm run seed:rcu-triggers -- --force
```

## Module layout

```
src/modules/rcu-triggers/
  rcu-triggers.module.ts
  controllers/rcu-triggers-admin.controller.ts
  services/rcu-triggers.service.ts
  dto/rcu-triggers.dto.ts
  entities/
    rcu-category.entity.ts
    rcu-document-type.entity.ts
    rcu-trigger.entity.ts
  seed/rcu-triggers.seed.json
```
