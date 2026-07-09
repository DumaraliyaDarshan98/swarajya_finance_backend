# Physical Verification — Backend

Backend implementation for physical verification in `swarajya_finance_backend`.

**Module path:** `src/modules/physical-verification/`  
**Base route:** `/api/physical-verifications` (prefix from `API_PREFIX` env)

---

## 1. Module Structure

```
physical-verification/
├── physical-verification.module.ts
├── physical-verification.controller.ts
├── physical-verification.service.ts          # Parent case logic
├── physical-verification-visit.service.ts    # Visit workflow
├── entities/
│   ├── physical-verification.entity.ts       # Parent
│   ├── physical-verification-visit.entity.ts
│   └── physical-log.entity.ts
├── dto/
│   ├── upsert-physical-verification.dto.ts
│   ├── assign-field-agent.dto.ts
│   ├── save-field-agent-submission.dto.ts
│   ├── save-visit-field-agent-submission.dto.ts
│   ├── update-agent-tracking.dto.ts
│   ├── admin-review-note.dto.ts
│   └── reject-physical-verification.dto.ts
├── helpers/
│   ├── visit-workflow.helper.ts
│   └── build-report.helper.ts
└── interfaces/
    └── field-agent-submission.interface.ts
```

**Related modules:**
- `src/modules/field-agent-wallet/` — wallet credits on complete.
- `src/modules/telephony/` — Exotel Voice API (outbound calls, webhook, call history).

---

## 2. Entities

### 2.1 `physical_verifications` (parent)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `clientId` | UUID | FK → clients |
| `physicalVerificationType`, `fiType` | varchar | Case type |
| `applicant`, `coApplicant` | JSON | Party + address flags |
| `hasCoApplicant` | boolean | |
| `completeRemark` | text | Client remark |
| `documentTypeVerifications` | JSON | Document checklist |
| `priority` | varchar | `HIGH` \| `MEDIUM` \| `LOW` |
| `status` | varchar | Workflow status |
| `reportPayload` | JSON | Generated report |
| `reportGeneratedAt` | timestamp | |
| `agreementNumber`, `customerName`, `product`, `mobile`, `city` | varchar | Denormalized search |
| `assignedFieldAgentUserId` | uuid | **Legacy** parent assignment |
| `fieldAgentSubmission` | JSON | **Legacy** parent form |
| `rejectionReason`, `adminReviewNote` | text | **Legacy** parent review |
| `createdAt`, `updatedAt` | timestamps | |

**Relations:** `visits` → OneToMany `physical_verification_visits`

### 2.2 `physical_verification_visits` (child)

| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID | PK |
| `physicalVerificationId` | UUID | FK → parent, `ON DELETE CASCADE` |
| `addressType` | enum | `RESIDENTIAL` \| `OFFICE` |
| `addressSnapshot` | JSON | Frozen address at submit |
| `status` | varchar | Visit workflow |
| `assignedFieldAgentUserId` | uuid | Per-visit agent |
| `assignedFieldAgentName` | varchar | |
| `assignedAt` | timestamp | |
| `fieldAgentSubmission` | JSON | Form, GPS, photos |
| `rejectionReason` | text | Per-visit reject reason |
| `adminReviewNote` | text | Per-visit admin note |
| `createdAt`, `updatedAt` | timestamps | |

**Critical:** `@JoinColumn({ name: 'physical_verification_id' })` on `parent` relation — required for parent loading on visit operations.

### 2.3 `physical_logs`

| Column | Purpose |
|--------|---------|
| `physicalVerificationId` | Parent case |
| `physicalVerificationVisitId` | Optional visit scope |
| `action` | See §5 |
| `message`, `performedByUserId`, `performedByName`, `metadata` | Audit trail |

### 2.4 Visit creation rule

On parent `submit()`:

- `buildVisitsFromParent()` creates one visit per enabled applicant address.
- Residential if `applicant.hasResidentialAddress`.
- Office if `applicant.hasOfficeAddress`.
- At least one address required.
- Existing visits replaced on re-submit path (when allowed).

---

## 3. Status Values

Shared enum (parent and visits):

```
DRAFT
IN_PROGRESS
AGENT_ASSIGNED
AGENT_DRAFT
AGENT_SUBMITTED
APPROVED
REJECTED
REPORT_GENERATED
FAILED          ← defined but unused in service logic
```

### 3.1 Parent rollup (`rollupParentStatus`)

After visit mutations, `syncParentFromVisits()` recalculates parent status:

| Condition | Parent status |
|-----------|---------------|
| Any visit `REJECTED` | `REJECTED` |
| All visits `APPROVED` | `APPROVED` |
| All `AGENT_SUBMITTED` or mix with `APPROVED` | `AGENT_SUBMITTED` |
| Any `AGENT_DRAFT` | `AGENT_DRAFT` |
| Any `AGENT_ASSIGNED` (no draft) | `AGENT_ASSIGNED` |
| Default | `IN_PROGRESS` |

### 3.2 Editable visit states

Submission, upload, and tracking allowed only when visit status is:

- `AGENT_ASSIGNED`
- `AGENT_DRAFT`

---

## 4. API Endpoints

**Auth:** All routes use `JwtAuthGuard` + `RolesGuard`.

**Default controller roles:** `SUPER_ADMIN`, `CLIENT_ADMIN`, `CLIENT_USER`, `FIELD_AGENT`  
Method-level `@Roles()` narrows access.

> Visit routes are registered **before** `/:id` routes to avoid `visits` being captured as an id.

### 4.1 Parent endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/` | All 4 | Paginated list (scoped by role/client) |
| GET | `/stats` | All 4 | Status counts |
| POST | `/` | Client roles + SA | Create (`DRAFT`) |
| GET | `/:id` | All 4 | Get case + visits |
| PATCH | `/:id` | Client roles + SA | Update (blocked if `REPORT_GENERATED`) |
| POST | `/:id/submit` | Client roles + SA | Submit → `IN_PROGRESS`, create visits |
| GET | `/:id/visits` | All 4 | List child visits |
| GET | `/:id/logs` | `SUPER_ADMIN` | Activity log |
| POST | `/:id/assign-agent` | `SUPER_ADMIN` | **Legacy** parent assign |
| PATCH | `/:id/field-agent-submission` | `FIELD_AGENT` | **Legacy** save draft |
| POST | `/:id/field-agent-submit` | `FIELD_AGENT` | **Legacy** submit |
| PATCH | `/:id/agent-tracking` | `FIELD_AGENT`, `SUPER_ADMIN` | **Legacy** GPS |
| POST | `/:id/field-upload` | `FIELD_AGENT` | **Legacy** file upload |
| POST | `/:id/approve` | `SUPER_ADMIN` | **Legacy** approve parent |
| POST | `/:id/reject` | `SUPER_ADMIN` | **Legacy** reject parent |
| POST | `/:id/complete` | `SUPER_ADMIN` | Generate report + wallet + auto `FINAL_REPORT` call |
| POST | `/:id/recall` | `SUPER_ADMIN` | Manual customer recall (telephony) |
| DELETE | `/:id` | `SUPER_ADMIN` | Hard delete |
| GET | `/files/view/:filename` | All 4 | Stream uploaded file |

**List scoping:**
- Client users → own `clientId`
- Field agents → parents where `assignedFieldAgentUserId = user` (legacy list)
- Super admin → all, optional `clientId` filter

**Query params (list):** `page`, `limit`, `search`, `status`, `physicalVerificationType`, `fiType`, `sortBy`, `sortDir`

### 4.2 Visit endpoints

| Method | Path | Roles | Description |
|--------|------|-------|-------------|
| GET | `/visits/assigned` | `FIELD_AGENT` | Agent’s assigned visits |
| GET | `/visits/:visitId` | All 4 | Visit + parent |
| POST | `/visits/:visitId/assign-agent` | `SUPER_ADMIN` | Assign/reassign agent |
| PATCH | `/visits/:visitId/field-agent-submission` | `FIELD_AGENT` | Save visit draft |
| POST | `/visits/:visitId/field-agent-submit` | `FIELD_AGENT` | Submit visit |
| PATCH | `/visits/:visitId/agent-tracking` | `FIELD_AGENT`, `SUPER_ADMIN` | GPS ping |
| POST | `/visits/:visitId/start-trip` | `FIELD_AGENT` | Start trip + tracking |
| POST | `/visits/:visitId/end-trip` | `FIELD_AGENT` | End active trip |
| POST | `/visits/:visitId/decline` | `FIELD_AGENT` | Unassign self → `IN_PROGRESS` |
| POST | `/visits/:visitId/field-upload` | `FIELD_AGENT` | Visit file upload |
| POST | `/visits/:visitId/approve` | `SUPER_ADMIN` | Approve visit |
| POST | `/visits/:visitId/reject` | `SUPER_ADMIN` | Reject visit |

**Assigned visits query:** `page`, `limit`, `search` (parent customer/agreement/mobile)

---

## 5. Audit Log Actions

| Action | When |
|--------|------|
| `CREATED` | Case created |
| `SUBMITTED` | Client submitted |
| `AGENT_ASSIGNED` | Agent assigned |
| `AGENT_REASSIGNED` | Agent changed |
| `AGENT_DECLINED` | Agent declined visit |
| `TRIP_STARTED` | Start trip |
| `TRIP_ENDED` | End trip |
| `AGENT_DRAFT_SAVED` | Draft saved |
| `AGENT_SUBMITTED` | Agent submitted |
| `APPROVED` | Admin approved |
| `REJECTED` | Admin rejected |
| `COMPLETED` | Report generated |
| `FAILED` | (reserved) |
| `AUTO_CALL_INITIATED` | Outbound call started (submit/complete/recall) |
| `AUTO_CALL_COMPLETED` | Exotel webhook: call completed |
| `AUTO_CALL_FAILED` | Call initiation or terminal failure |
| `RECORDING_RECEIVED` | Recording URL received from webhook |
| `CALL_RECALLED` | Super Admin manual recall |
| `CALL_FAILED` | Reserved / generic call failure |

---

## 6. Services

### 6.1 `PhysicalVerificationService`

| Method | Purpose |
|--------|---------|
| `create` | New case `DRAFT` |
| `update` | Update case (not if `REPORT_GENERATED`) |
| `submit` | `IN_PROGRESS` + visits + **non-blocking** `INITIAL_SUBMISSION` call |
| `getById`, `list`, `stats` | Read operations |
| `delete` | Hard delete |
| `complete` | Report + wallet + **non-blocking** `FINAL_REPORT` call |
| `assignFieldAgent` | Legacy parent assign |
| `saveFieldAgentSubmission` | Legacy draft |
| `submitFieldAgentSubmission` | Legacy submit |
| `updateAgentTracking` | Legacy GPS |
| `uploadFieldFile` | Legacy upload |
| `approve`, `reject` | Legacy parent review |
| `getLogs`, `addLog` | Audit |

**Upload directory:** `{cwd}/uploads/physical-verifications/`  
**Max file size:** 10MB (PDF, JPEG, PNG, WebP)

### 6.2 `PhysicalVerificationVisitService`

| Method | Purpose |
|--------|---------|
| `createVisitsForParent` | Create/replace visits on submit |
| `listVisitsForParent` | Visits for parent id |
| `listAssignedVisits` | Field agent queue |
| `getVisitById` | Single visit + parent |
| `assignVisitAgent` | Assign/reassign |
| `saveVisitSubmission` | Draft → `AGENT_DRAFT` |
| `submitVisitSubmission` | Submit → `AGENT_SUBMITTED` |
| `startVisitTrip` | GPS + `isDriving`, `AGENT_DRAFT` |
| `endVisitTrip` | Stop driving, append route |
| `updateVisitTracking` | Live GPS pings |
| `declineVisitAssignment` | Clear agent, `IN_PROGRESS` |
| `approveVisit`, `rejectVisit` | Admin review |
| `uploadVisitFile` | Visit-scoped upload |
| `syncParentFromVisits` | Roll up parent status |
| `assertAllVisitsApproved` | Gate for `complete()` |

### 6.3 Helpers

**`visit-workflow.helper.ts`**
- `buildVisitsFromParent` — derive visit specs from addresses
- `rollupParentStatus` — aggregate visit statuses
- `allVisitsApproved` — completion check
- `visitAddressLabel`, `formatPartyAddress` — display helpers

**`build-report.helper.ts`**
- `buildPhysicalReport(record, visits)` → `PhysicalReportPayload` JSON

---

## 7. Report Generation

**Trigger:** `POST /physical-verifications/:id/complete` (Super Admin only)

**Preconditions:**
1. Parent not already `REPORT_GENERATED`
2. If visits exist → every visit must be `APPROVED`
3. If no visits (legacy) → parent must be `AGENT_SUBMITTED` or `APPROVED`

**Steps:**
1. Load visits via `getVisitsForParentId`
2. `buildPhysicalReport(record, visits)` produces JSON:
   - `caseDetails` — LAN, state, product, location, RCU manager
   - `trigger` — from `completeRemark`
   - `sampledDocuments` — per visit residential/office profile
   - `referNegativeFraud` — defaults
   - `finalReport` — metadata + dates
   - `fieldVisitPhotos` — from submission geo/photos
3. Save `reportPayload`, `status = REPORT_GENERATED`, `reportGeneratedAt`
4. `fieldAgentWalletService.creditForPhysicalCompletion`
5. Log `COMPLETED`

Report is stored as JSON on parent — no PDF generation in backend.

---

## 8. Wallet Credits

**Module:** `field-agent-wallet`  
**Constant:** `PHYSICAL_CASE_REWARD_AMOUNT = 50` (₹)

**Trigger:** Only on successful `complete()`

**Logic (`creditForPhysicalCompletion`):**
- **With visits:** one ₹50 credit per visit to that visit’s `assignedFieldAgentUserId`
- **Without visits (legacy):** one credit to parent’s assigned agent
- **Skip if:** no agent or transaction already exists for visit/parent (idempotent)

**Transaction fields:** amount, status `CREDITED`, loan/customer/product from parent, `physicalVerificationVisitId`, `completedAt`

**Wallet update:** `balance += 50`, `totalEarned += 50`, `completedCasesCount += 1`

**Example:** Residential + office visits with different agents → up to ₹100 total.

### Wallet API (related)

| Method | Path | Roles |
|--------|------|-------|
| GET | `/field-agent-wallet/me/summary` | `FIELD_AGENT` |
| GET | `/field-agent-wallet/me/dashboard` | `FIELD_AGENT` |
| GET | `/field-agent-wallet/me/transactions` | `FIELD_AGENT` |
| GET | `/field-agent-wallet/admin/summary` | `SUPER_ADMIN` |
| GET | `/field-agent-wallet/admin/agents` | `SUPER_ADMIN` |
| GET | `/field-agent-wallet/admin/transactions` | `SUPER_ADMIN` |

---

## 9. Field Agent Submission JSON

Stored in `fieldAgentSubmission` on visit (or legacy parent).

**Top level:**
- `agentLocation` — `{ latitude, longitude, capturedAt }`
- `agentTracking` — `{ isDriving, destination, startedAt, stoppedAt, routeHistory[] }`
- `verifyResidential` / `verifyOffice` — toggles
- `residential` — `HomeAddressVerification` block
- `office` — `OfficeAddressVerification` block
- `submittedAt` — ISO timestamp on submit

**Route history:** max 100 GPS points during trip.

**Upload keys:** e.g. `residential.photos.locationSelfie`, `office.salarySlipUrl`

---

## 10. DTOs

| DTO | Used for |
|-----|----------|
| `UpsertPhysicalVerificationDto` | Create/update parent |
| `ListPhysicalVerificationQueryDto` | List filters |
| `AssignFieldAgentDto` | `fieldAgentUserId`, optional `note` |
| `SaveFieldAgentSubmissionDto` | Legacy parent form |
| `SaveVisitFieldAgentSubmissionDto` | Visit form |
| `UpdateAgentTrackingDto` | `latitude`, `longitude`, `isDriving`, `destination`, `capturedAt` |
| `AdminReviewNoteDto` | Optional note on approve |
| `RejectPhysicalVerificationDto` | `reason`, optional `note` |

---

## 11. Database & Migrations

**Migration file:** `src/database/migrations/1741000000000-AddPhysicalVerificationVisits.ts`

**`up` changes:**
- Add `priority` to `physical_verifications`
- Create `physical_verification_visits` table
- Add `physical_verification_visit_id` to `physical_logs`

**Note:** Dev may use TypeORM `synchronize: true` for parent/logs tables. Migration SQL uses PostgreSQL syntax — adapt for MySQL in production if needed.

**Wallet tables:** `field_agent_wallets`, `field_agent_wallet_transactions` — include `physicalVerificationVisitId` for per-visit credits.

---

## 12. Access Control Summary

| Role | Parent | Visits |
|------|--------|--------|
| `CLIENT_ADMIN` / `CLIENT_USER` | Own client only | Via parent ownership |
| `FIELD_AGENT` | Legacy parent list by parent assignment | Visit ops by visit assignment |
| `SUPER_ADMIN` | All clients | All |

---

## 13. Architecture Notes

1. **Dual workflow:** Visit-centric flow is primary after client submit; parent-level agent endpoints remain for backward compatibility.
2. **Field agent queue:** Use `GET /visits/assigned` (not parent list) for current visit work.
3. **Completion gate:** All visits must be `APPROVED`, not merely submitted.
4. **Separate from `verification` module:** `verification_requests` physical payload is a different aggregate.
5. **File security:** Path traversal blocked on file view endpoint.
6. **Telephony is non-blocking:** Exotel failures never roll back `submit()` or `complete()`.

---

## 14. Telephony Module (Exotel)

**Module path:** `src/modules/telephony/`  
**Base route:** `/api/exotel`

### 14.1 Structure

```
telephony/
├── telephony.module.ts
├── telephony.service.ts
├── controllers/exotel.controller.ts
├── providers/exotel.provider.ts
├── entities/physical-verification-call.entity.ts
├── dto/
│   ├── make-call.dto.ts
│   ├── recall-call.dto.ts
│   └── exotel-webhook.dto.ts
└── interfaces/
    ├── telephony.interface.ts
    └── telephony-provider.interface.ts   # ITelephonyProvider
```

### 14.2 Entity `physical_verification_calls`

| Column | Notes |
|--------|-------|
| `physicalVerificationId` | Parent case |
| `visitId` | Optional |
| `customerMobile` | From parent `mobile` / applicant |
| `callSid` | Exotel SID |
| `callType` | `INITIAL_SUBMISSION` \| `AGENT_ASSIGNED` \| `FINAL_REPORT` \| `RECALL` \| `CUSTOM` |
| `status` | `INITIATED` … `COMPLETED` / `FAILED` / `BUSY` / `NO_ANSWER` |
| `recordingUrl`, `recordingDuration` | From webhook |
| `providerRequest`, `providerResponse` | Full Exotel payloads |
| `createdBy`, `startTime`, `endTime` | Audit |

**Migration:** `1742000000000-AddPhysicalVerificationCalls.ts`

### 14.3 API endpoints

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/exotel/call` | `SUPER_ADMIN` | Manual outbound call |
| GET | `/exotel/calls/:physicalVerificationId` | SA / Client | Call history (newest first) |
| POST | `/exotel/webhook` | **Public** | Exotel StatusCallback |
| POST | `/exotel/recall` | `SUPER_ADMIN` | Manual recall |
| GET | `/exotel/recordings/:callRecordId/audio` | SA / Client | Proxied recording stream |
| POST | `/physical-verifications/:id/recall` | `SUPER_ADMIN` | Alias for recall |

### 14.4 Auto-call triggers

| Event | Call type | Behavior |
|-------|-----------|----------|
| Client `submit()` success | `INITIAL_SUBMISSION` | Fire-and-forget |
| Super Admin `complete()` success | `FINAL_REPORT` | Fire-and-forget |
| Super Admin Recall | `RECALL` | Synchronous API; returns error if dial fails |

Greeting audio is played via Exotel **flow/applet** IDs configured in env (not hardcoded TTS in app code).

### 14.5 Provider interface

`ITelephonyProvider`: `makeCall()`, `getCall()`, `downloadRecording()`, `handleWebhook()`.  
Current implementation: `ExotelProvider` (Axios). Future: Twilio / Knowlarity / MyOperator.

---

## 15. Environment

Relevant `.env` keys (typical):

- `API_PREFIX` — API base prefix (default `api`)
- Database connection for TypeORM
- JWT secret for auth guards
- Telephony / Exotel:
  - `TELEPHONY_PROVIDER` (default `exotel`)
  - `EXOTEL_ACCOUNT_SID`, `EXOTEL_API_KEY`, `EXOTEL_API_TOKEN`, `EXOTEL_CALLER_ID`
  - `EXOTEL_WEBHOOK` — public API base, e.g. `https://host/api` → callback `{WEBHOOK}/exotel/webhook`
  - `EXOTEL_API_SUBDOMAIN` (default `api.in.exotel.com`)
  - `EXOTEL_FLOW_APP_ID_INITIAL_SUBMISSION`, `EXOTEL_FLOW_APP_ID_FINAL_REPORT`, `EXOTEL_FLOW_APP_ID_RECALL` (+ optional agent/custom)

Upload path is filesystem-relative to process `cwd`.

---

See also: [PHYSICAL_VERIFICATION_FLOW.md](./PHYSICAL_VERIFICATION_FLOW.md) | [PHYSICAL_VERIFICATION_FRONTEND.md](./PHYSICAL_VERIFICATION_FRONTEND.md)
