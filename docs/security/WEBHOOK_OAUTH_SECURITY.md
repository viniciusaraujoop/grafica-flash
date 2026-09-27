# Webhook & OAuth Security

Snapshot: 2026-09-27

| Route | Class | Authenticity | Validation | Idempotency | Replay | Status |
|---|---|---|---|---|---|---|
| `POST /api/assinatura/checkout/webhook` | WEBHOOK_SIGNED | yes | detected | no/not detected | not detected | **PASS** |
| `POST /api/integrations/google/calendar/webhook` | WEBHOOK_SIGNED | yes | limited/not detected | yes | detected | **PASS** |
| `GET /api/integrations/google/callback` | OAUTH_CALLBACK | OAuth state/callback contract | limited/not detected | no/not detected | n/a | **PASS** |
| `POST /api/integrations/resend/webhook/[connectionId]` | WEBHOOK_SIGNED | yes | detected | yes | detected | **PASS** |
| `GET /api/marketplace/payments/mercado-pago/callback` | OAUTH_CALLBACK | OAuth state/callback contract | detected | no/not detected | n/a | **PASS** |
| `POST /api/marketplace/payments/webhook/mercado-pago` | WEBHOOK_SIGNED | yes | detected | no/not detected | not detected | **PASS** |
| `GET,POST /api/mercado-pago/webhook-leads` | WEBHOOK_SIGNED | yes | detected | no/not detected | not detected | **PASS** |
| `POST,GET /api/mercado-pago/webhook` | WEBHOOK_SIGNED | yes | detected | no/not detected | not detected | **PASS** |
| `POST /api/webhooks/asaas` | WEBHOOK_SIGNED | yes | detected | yes | detected | **PASS** |
| `GET,POST /api/whatsapp/webhook` | WEBHOOK_SIGNED | yes | limited/not detected | no/not detected | not detected | **PARTIAL** |

## OAuth

Google OAuth uses persisted state with provider/company/user binding, expiry, one-time consume and PKCE/code_verifier. Required scopes are validated and secrets remain server-side.

Mercado Pago marketplace OAuth remains a callback contract rather than a normal user mutation. Generic CSRF middleware was not forced onto callbacks. Credential connect/disconnect mutations require MFA after Phase A hardening.

## Provider review

- Google Calendar: channel/resource/token/expiry checks and event idempotency.
- Resend: Svix signature, timestamp tolerance, event idempotency.
- Mercado Pago: signature validation and payment-event reconciliation/idempotency controls.
- Asaas: webhook token comparison is constant-time and request body is bounded.
- WhatsApp: signature exists; explicit max-body/replay/idempotency evidence remains PARTIAL and runtime is frozen by ownership instruction.
- No real production webhook was emitted by this audit.
