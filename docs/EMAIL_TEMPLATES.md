# Email templates (current implementation)

All outbound emails use branded HTML (Handlebars) aligned with the frontend theme:

- Primary: `#F16300`
- Brand: **Swarajya RAC**
- Layout: `src/modules/mail/templates/layouts/base.hbs`
- Partials: `button`, `info-card` under `templates/partials/`

Templates are compiled by `MailService` and wrapped in the layout automatically.

## When which template is sent

| Template file | Trigger | Caller | Subject (approx.) |
|---------------|---------|--------|-------------------|
| `forgot-password.hbs` | User requests password reset | `AuthService.forgotPassword` → `MailService.sendForgotPasswordEmail` | Reset your Swarajya RAC password |
| `client-credentials.hbs` | Super Admin creates a client | `ClientsService.create` → `MailService.sendClientCredentials` | Your Swarajya RAC login credentials |
| `field-agent-credentials.hbs` | Field agent login provisioned / approved | `FieldAssistanceService` → `MailService.sendFieldAgentCredentials` | Field agent account approved / login credentials |
| `field-agent-withdrawal-approved.hbs` | Admin approves wallet withdrawal | `FieldAgentWalletService` → `sendFieldAgentWithdrawalApproved` | Wallet withdrawal approved |
| `field-agent-withdrawal-rejected.hbs` | Admin rejects wallet withdrawal | `FieldAgentWalletService` → `sendFieldAgentWithdrawalRejected` | Wallet withdrawal rejected |
| `generic-notification.hbs` | System notification helper (when email flag on) | `NotificationService.sendSystemNotification` | Caller-provided `subject` |

> `generic-notification` is ready for task/assignment emails. Callers must invoke `NotificationService` with Super Admin **send email notifications** enabled.

## Template variables

### Shared (injected by `MailService` for every email)

| Variable | Source | Example |
|----------|--------|---------|
| `brandName` | `MAIL_BRAND_NAME` or default | `Swarajya RAC` |
| `brandPrimary` | `MAIL_BRAND_PRIMARY` or `#F16300` | `#F16300` |
| `frontendUrl` | `FRONTEND_URL` | `http://localhost:4200` |
| `loginUrl` | derived | `http://localhost:4200/auth/login` |
| `supportEmail` | `MAIL_SUPPORT_EMAIL` / `MAIL_FROM` | `info@swarajyarac.com` |
| `supportPhone` | `MAIL_SUPPORT_PHONE` | `+91 76663 22270` |
| `year` | current year | `2026` |
| `preheader` | per-mail or subject | Inbox preview text |

### Per template

**forgot-password**

| Variable | Example |
|----------|---------|
| `resetLink` | `http://localhost:4200/reset-password?token=abc-123` |

**client-credentials**

| Variable | Example |
|----------|---------|
| `name` | `HDFC Vendor` |
| `email` | `client@yopmail.com` |
| `password` | `a8f3k2xq` |

**field-agent-credentials**

| Variable | Example |
|----------|---------|
| `name` | `Ravi Patel` |
| `email` | `agent@yopmail.com` |
| `fieldAgentId` | `FA-10021` |
| `password` | `tmpPass9x` |
| `approved` | `true` / `false` |

**field-agent-withdrawal-approved**

| Variable | Example |
|----------|---------|
| `name` | `Ravi Patel` |
| `amount` | `2500` |
| `requestId` | `uuid…` |
| `bankName` | `SBI` |
| `accountNumber` | `XXXX1234` |
| `ifsc` | `SBIN0001234` |
| `adminRemarks` | `Processed on 23 Oct` (optional) |

**field-agent-withdrawal-rejected**

| Variable | Example |
|----------|---------|
| `name` | `Ravi Patel` |
| `amount` | `2500` |
| `requestId` | `uuid…` |
| `adminRemarks` | `Incomplete bank details` (optional) |

**generic-notification**

| Variable | Example |
|----------|---------|
| `title` | `Case assigned` |
| `name` | `Ravi Patel` (optional) |
| `message` | `You have been assigned physical visit #PV-88.` |
| `details` | Extra block text (optional) |
| `ctaUrl` | `http://localhost:4200/field-agent/loan-case-list` (optional) |
| `ctaLabel` | `Open case` (optional; default “Open portal”) |

## Example payloads (code)

### Forgot password

```ts
await mailService.sendForgotPasswordEmail('user@example.com', resetToken);
```

### Client credentials

```ts
await mailService.sendClientCredentials(
  'client@yopmail.com',
  'HDFC Vendor',
  'a8f3k2xq',
);
```

### Field agent credentials

```ts
await mailService.sendFieldAgentCredentials(
  'agent@yopmail.com',
  'Ravi Patel',
  'FA-10021',
  'tmpPass9x',
  true, // approved
);
```

### Withdrawal approved / rejected

```ts
await mailService.sendFieldAgentWithdrawalApproved({
  email: 'agent@yopmail.com',
  name: 'Ravi Patel',
  amount: 2500,
  requestId: 'req-uuid',
  bankName: 'SBI',
  accountNumber: 'XXXX1234',
  ifsc: 'SBIN0001234',
  adminRemarks: 'Processed',
});

await mailService.sendFieldAgentWithdrawalRejected({
  email: 'agent@yopmail.com',
  name: 'Ravi Patel',
  amount: 2500,
  requestId: 'req-uuid',
  adminRemarks: 'Incomplete bank details',
});
```

### Generic system notification

```ts
await notificationService.sendSystemNotification({
  toEmail: 'agent@yopmail.com',
  subject: 'Case assigned — Swarajya RAC',
  title: 'Case assigned',
  name: 'Ravi Patel',
  messageText: 'You have been assigned physical visit #PV-88.',
  ctaUrl: 'http://localhost:4200/field-agent/loan-case-list',
  ctaLabel: 'Open cases',
});
```

## Optional env (branding)

```env
FRONTEND_URL=http://localhost:4200
MAIL_FROM=noreply@swarajya.com
MAIL_SUPPORT_EMAIL=info@swarajyarac.com
MAIL_SUPPORT_PHONE=+91 76663 22270
MAIL_BRAND_NAME=Swarajya RAC
MAIL_BRAND_PRIMARY=#F16300
```

## Folder layout

```
src/modules/mail/
  services/mail.service.ts
  templates/
    layouts/base.hbs
    partials/button.hbs
    partials/info-card.hbs
    forgot-password.hbs
    client-credentials.hbs
    field-agent-credentials.hbs
    field-agent-withdrawal-approved.hbs
    field-agent-withdrawal-rejected.hbs
    generic-notification.hbs
```
