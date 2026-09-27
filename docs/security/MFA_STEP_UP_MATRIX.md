# MFA / Step-Up Matrix

Snapshot: 2026-09-27

Declared sensitive actions: `pix.update`, `finance.write`, `subscription.manage`, `team.elevated.manage`, `api_keys.manage`, `integrations.credentials.manage`, `data.export`, `platform.impersonation.write`, `platform.config.manage`.

| Operation | Required assurance | Current evidence | Status |
|---|---|---|---|
| Pix payout-key update/removal | AAL2 | `pix.update`, Asaas payout-key PUT/DELETE | PASS |
| finance-critical mutation | AAL2 | `finance.write` on privileged finance/platform changes | PASS where wired |
| subscription create/renew/cancel/create Pix | AAL2 | `subscription.manage` | PASS |
| elevated company/admin team mutation | AAL2 | `team.elevated.manage` | PASS |
| API key/provider credential mutation | AAL2 | `api_keys.manage`, `integrations.credentials.manage` | PASS where wired |
| data export | AAL2 | `data.export` policy exists | PARTIAL; every export caller still needs explicit inventory |
| support write impersonation | AAL2 | `platform.impersonation.write` | PASS |
| platform critical configuration | AAL2 | `platform.config.manage` | PASS |
| password change/account security | context-sensitive | same-origin + body/rate controls; first-access flow cannot require a factor before enrollment | PARTIAL by design |
| MFA factor removal | AAL2 in UI | Supabase MFA list/challenge/unenroll | PASS implementation; hosted lifecycle pending |

## API routes with static MFA signals

- `PATCH /api/admin/company/[id]` — platform permission/role
- `GET,POST,PATCH /api/admin/feature-flags` — platform permission/role
- `POST /api/admin/support-mode` — platform permission/role
- `GET,POST /api/admin/team-v2` — platform permission/role
- `GET,POST /api/admin/team` — platform permission/role
- `GET,PATCH /api/company/settings` — company/resource context
- `GET,POST /api/company/subscription` — company/resource context
- `GET,POST,PATCH,DELETE /api/company/team` — company/resource context
- `GET,PATCH /api/integrations/[provider]/config` — company/resource context
- `DELETE /api/integrations/[provider]` — company/resource context
- `DELETE /api/integrations/api-keys/[keyId]` — company/resource context
- `GET,POST /api/integrations/api-keys` — company/resource context
- `GET,PATCH /api/integrations/resend/config` — company/resource context
- `POST /api/marketplace/payments/mercado-pago/connect` — company/resource context
- `POST /api/marketplace/payments/mercado-pago/disconnect` — company/resource context
- `GET,POST,PUT,DELETE /api/payments/asaas/payout-key` — company/resource context
- `POST /api/payments/asaas/payouts/retry` — company/resource context
- `POST,PATCH /api/platform-admin/commission-rules` — platform permission/role

## Open

- Recovery codes are not implemented; UI advises a second authenticator.
- Exact-head hosted login/refresh/logout/revoke/step-up cannot be certified until a Vercel Preview can build.
- Leaked-password protection is a production Auth configuration action, not a code commit in Phase A.
