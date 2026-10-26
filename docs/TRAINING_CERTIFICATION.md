# Training & Certification Module

## Overview

Mandatory role-based training for **Field Agent** and **Client Admin**. Super Admin is exempt. Active training must be completed before other modules (and Field Agent attendance) are available. Certificates are generated on completion. Validity is controlled by **Training Reset Duration** (days).

## Tables

| Table | Purpose |
|-------|---------|
| `trainings` | Training master (role, title, video URL, description, active) |
| `user_trainings` | Per-user completion + expiry |
| `training_certificates` | Issued certificates |
| `training_completion_history` | Completion / reset audit trail |
| `super_admin_settings` key `TRAINING_RESET_DURATION_DAYS` | Validity period (default 365) |

## Admin APIs (`SUPER_ADMIN`)

| Method | Path | Description |
|--------|------|-------------|
| POST | `/api/admin/trainings` | Create |
| GET | `/api/admin/trainings` | List (`?role=`) |
| GET | `/api/admin/trainings/:id` | Details |
| PUT | `/api/admin/trainings/:id` | Update |
| PATCH | `/api/admin/trainings/:id/status` | Activate / deactivate |
| DELETE | `/api/admin/trainings/:id` | Delete |
| GET | `/api/admin/trainings/reset-config` | Get reset days |
| PUT | `/api/admin/trainings/reset-config` | Update reset days |
| GET | `/api/admin/trainings/:id/questions` | List exam questions |
| POST | `/api/admin/trainings/:id/questions` | Create question |
| PUT | `/api/admin/trainings/:id/questions/:questionId` | Update question |
| DELETE | `/api/admin/trainings/:id/questions/:questionId` | Delete question |
| GET | `/api/admin/trainings/certificates/by-client/:clientId` | Certificates for a client |
| GET | `/api/admin/trainings/certificates/by-field-agent/:fieldAssistantId` | Certificates for a field agent |

## User flow (multi-video per role)

1. Super Admin can add **multiple active videos** for the same role (ordered by `sort_order`).
2. User must complete videos **in order** — next video unlocks after the previous is marked complete.
3. After **all** videos are completed, **Generate Certificate** is shown.
4. Certificate generation unlocks the application.
5. Reset duration expiry clears completions so the user must redo all videos and get a new certificate.

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/trainings/me/status` | Training gate status |
| GET | `/api/trainings/me/assigned` | Assigned lessons (ordered) |
| POST | `/api/trainings/me/complete` | Complete current video (`{ trainingId }`) |
| GET | `/api/trainings/me/:trainingId/exam` | Load exam for a lesson |
| POST | `/api/trainings/me/:trainingId/exam/submit` | Submit exam answers |
| POST | `/api/trainings/me/generate-certificate` | Generate certificate after all videos (and exams if configured) done |
| GET | `/api/trainings/me/certificates` | Current user certificates |
| GET | `/api/trainings/me/certificates/:id` | Certificate by id |

## Login

After successful auth, response includes `trainingStatus` and user flags:

- `trainingRequired` — block app until complete
- `trainingCompleted`

## Field Agent order

1. Terms / onboarding (existing)
2. Mandatory training (if assigned & incomplete)
3. Attendance check-in (existing)
