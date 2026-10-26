# Test / fix pass — 23 Oct 2026

## Fixed in this pass

| Bug | Impact | Fix |
|-----|--------|-----|
| Digital list used `?id=` query but form reads route `:id` | Edit/continue opened empty form | Links → `/digital-form/:id`, report → `/digital-report/:id` |
| Physical list used query `id` + wrong report route (`digital-verification`) | Edit/report broken | Links → `/physical-form/:id`, report → `/physical-report/:id` |
| OCR mutate endpoints lacked `@RequirePermissions` | RBAC incomplete after list/create | Added VIEW/EDIT/ADD/DELETE on get/update/upload/report/delete |
| Physical create/update/submit/get/delete lacked permissions | Same | Decorators added |
| `User.customRole` missing `@JoinColumn` | Permissions DB load could mis-join | Added `@JoinColumn({ name: 'custom_role_id' })` |
| Sidebar active match used `/case-verifcation` | Wrong highlight | Updated to corrected + legacy paths |
| Notifications not refreshed after login | Empty bell until refresh | `notificationsStore.refresh()` on login |
| Legacy `verification-form-*` folders | Dead code | Already deleted; physical add → `physical-form` |

## Verified OK

| Check | Result |
|-------|--------|
| Backend `tsc --noEmit` | Pass |
| Frontend `ng build` (dev) | Pass |
| OCR `GET /health` | `{ ok: true, geminiConfigured: true }` |
| Backend `http://localhost:3200/api` | HTTP 200 |
| OCR list / digital form routes | Present in `app.routes.ts` |
| Audit / client dashboard / notifications code paths | Compile clean |

## Bugs / gaps still pending

| # | Item | Notes |
|---|------|--------|
| 1 | **Payment gateway** | Skipped by design — plans activate without billing |
| 2 | **SMS provider** | Still console stub |
| 3 | **BullMQ / Redis** | In-process queue only |
| 4 | **S3 uploads** | Local `StorageService` only |
| 5 | **OCR API key on live process** | Restart `ocr_extraction` so `.env` `OCR_SERVICE_API_KEY` is loaded (identify without file returned 400, not 401 — process may predate key middleware) |
| 6 | **E2E browser tests** | Not automated (digital → OCR → physical) |
| 7 | **Physical field-agent visit endpoints** | Still role-gated; not every method has `@RequirePermissions` (field agent paths use ROLE + expanded VERIFICATION map) |
| 8 | **Folder rename** | `attandance` / `case-verifcation-form` folder names still misspelled (routes redirect) |
| 9 | **Seed in-app notifications** | Table empty until `sendSystemNotification({ userId })` is called from business events |
| 10 | **Prod `DB_SYNCHRONIZE=false` + migrations** | Documented; not forced in local `.env` |

## Manual smoke checklist (recommended after restart)

1. Restart backend + OCR sidecar with matching `OCR_SERVICE_API_KEY`
2. Login as Super Admin → Audit Logs, GST Search menu, notifications bell
3. Login as Client Admin → Dashboard KPIs, Digital edit by id, Physical edit by id
4. Role without `VERIFICATION:ADD` → create digital case should 403
5. Generate digital report → `scrapePayload.portalCatalog` when portals flagged
