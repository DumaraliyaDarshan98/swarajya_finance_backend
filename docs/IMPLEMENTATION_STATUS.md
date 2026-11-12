# Gap closure — what was implemented (Oct 2026)

Payment gateway / subscription billing was **explicitly skipped** (plan changes still apply without payment capture).

---

## Implemented checklist

| # | Item | Status | How it works |
|---|------|--------|----------------|
| 1 | Notifications mock → real API | **Done** | Table `user_notifications` + `GET/PATCH/DELETE /api/notifications*`. Frontend store loads from API. |
| 2 | SMS | **Stub kept** | Still `console.log` when SA SMS flag is on. Email + in-app are real. |
| 3 | Payment gateway | **Skipped** | No change (as requested). |
| 4 | Portal list in digital reports | **Done** | On `generateReport`, portals with `usedInDigitalReport` are stored in `scrapePayload.portalCatalog`. |
| 5 | Server-side permissions | **Done** | `PermissionsGuard` + `@RequirePermissions` on digital / OCR / physical / audit / extract-simple. |
| 6 | OCR extract-simple unauthenticated | **Done** | Backend route now JWT + Roles + Permissions. OCR sidecar requires `X-OCR-API-Key`. |
| 7 | Queues empty | **Foundation done** | In-process `JobQueueService` + `ocr.health-ping` handler. Ready to swap for BullMQ. |
| 8 | generic-notification template | **Already present** | Confirmed; NotificationService uses it. |
| 9 | OCR auth / rate limit / health | **Done** | `/health`, `/ready`, API key middleware, in-memory rate limit. |
| 10 | Tesseract PDF | **Improved** | PDF text-layer heuristic fallback when Gemini misses; image-only PDFs still need Gemini. |
| 11 | Legacy `*-old.html` | **Removed** | Dead templates deleted; list links point to `digital-form`. |
| 12 | GST search not in menu | **Done** | Masters → GST Search. |
| 13 | Route typos | **Done** | Canonical `/attendance`, `/case-verification-form`; old misspellings redirect. |
| 14 | SCHEMA.md incomplete | **Updated** | `audit_logs`, `user_notifications`, portal digital-report note. |
| 15 | Shared list shell | **Partial** | Client dashboard analytics unified; full shared list component deferred. |
| P0 | OCR URL + health before jobs | **Done** | `OCR_SERVICE_URL` + `assertHealthy()` before identify/verify. |
| P0 | DB_SYNCHRONIZE production note | **Documented** | `.env.example` warns; keep `false` in prod + migrations. |
| P1 | S3 uploads | **Local abstraction** | `StorageService` (local root). S3 driver not wired yet. |
| P1 | Background OCR/Puppeteer queue | **Foundation** | Queue service ready; full pipeline enqueue not migrated yet. |
| P2 | Dedicated OCR prompts | **Done** | Address Proof, Agreement, Ownership Deed prompts in Gemini extractor. |
| P2 | E2E tests | **Not done** | Remaining. |

---

## How to use (examples)

### 1) OCR sidecar security

```bash
# ocr_extraction/.env
OCR_SERVICE_API_KEY=dev-ocr-shared-secret
PORT=3300

# backend .env (same key)
OCR_SERVICE_URL=http://localhost:3300
OCR_SERVICE_API_KEY=dev-ocr-shared-secret
```

Health check:

```http
GET http://localhost:3300/health
→ { "ok": true, "service": "ocr_extraction", "geminiConfigured": true }
```

Protected call (backend sends header automatically):

```http
POST http://localhost:3300/api/document/identify
X-OCR-API-Key: dev-ocr-shared-secret
Content-Type: multipart/form-data
```

Without the key → `401`. Too many requests → `429`.

### 2) Server-side permissions

```ts
@UseGuards(JwtAuthGuard, RolesGuard, PermissionsGuard)
@RequirePermissions('VERIFICATION', 'ADD')
@Post()
create(...) {}
```

Example: Client user with custom role missing `VERIFICATION:ADD` calling  
`POST /api/digital-verifications` → `403 Missing permission ADD on VERIFICATION`.

Super Admin always bypasses.

### 3) In-app notifications

Backend create (from any service):

```ts
await notificationService.sendSystemNotification({
  userId: user.id,
  toEmail: user.email,          // optional branded email
  subject: 'Report ready',
  title: 'Report ready',
  messageText: 'Your digital verification report is available.',
  icon: 'success',
  ctaUrl: `${frontendUrl}/client-admin/digital-report/${id}`,
});
```

Frontend (already wired in header store):

```http
GET /api/notifications
PATCH /api/notifications/:id/read
POST /api/notifications/mark-all-read
DELETE /api/notifications/:id
```

### 4) Portal catalog in digital report

1. Super Admin → Portal List → enable **Used in digital report** on category/portal.
2. Client generates digital report.
3. Payload includes:

```json
{
  "portalCatalog": {
    "source": "portal-list",
    "success": true,
    "data": {
      "portalCount": 3,
      "categories": [{ "name": "Maharashtra", "portals": [{ "title": "...", "url": "..." }] }]
    }
  }
}
```

### 5) Background jobs

```ts
// register once
jobQueue.register('ocr.health-ping', async () => ocr.assertHealthy());

// enqueue
jobQueue.enqueue('ocr.health-ping', {});
```

Replace `JobQueueService` with BullMQ later without changing call sites.

### 6) Client dashboard analytics

Open `/client-admin/dashboard` — KPIs load from live stats APIs (digital/OCR/physical, users, roles, audit).

---

## Still open / next

1. **Payment gateway** before plan activation (skipped on purpose).
2. **BullMQ + Redis** for OCR pipeline + Puppeteer (foundation only).
3. **S3** driver behind `StorageService`.
4. **SMS provider** (Exotel SMS or similar).
5. **E2E** happy paths digital → OCR → physical.
6. ~~Delete unused `verification-form-1/2/3` folders~~ (done — links point to digital/physical forms).
7. Full TypeORM migrations for every entity (prod `DB_SYNCHRONIZE=false`).

---

## Restart checklist

1. Set matching `OCR_SERVICE_API_KEY` on backend + `ocr_extraction`.
2. Restart Nest + OCR sidecar.
3. Re-login so permissions refresh.
4. Confirm `/health` on OCR and notifications badge loads (empty until events are created).
