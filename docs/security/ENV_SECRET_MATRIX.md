# Environment & Secret Matrix

Snapshot: 2026-09-27  
Runtime SHA: `1990c17949f30bad2bfaa37c4addf30ed6e1d878`

Source scan found **51 environment-variable names**, **0 Client Components using non-NEXT_PUBLIC process.env variables**, and **0 Client Components importing the service-role key**.

The connected Vercel read interface used in this run does not expose environment-variable listing, so target presence/scope is **UNVERIFIED** rather than guessed.

| Name | Classification | .env.example | Client source use | Preview | Production | Source locations |
|---|---|---:|---:|---|---|---|
| `AI_GATEWAY_API_KEY` | SERVER_SECRET | NO | NO | UNVERIFIED | UNVERIFIED | app/api/internal/ai-gateway-health/route.ts, app/api/public/home-chat/route.ts |
| `ASAAS_API_BASE_URL` | SERVER_CONFIG | NO | NO | UNVERIFIED | UNVERIFIED | lib/payments/asaas-config.ts |
| `ASAAS_ENV` | SERVER_CONFIG | NO | NO | UNVERIFIED | UNVERIFIED | lib/payments/asaas-config.ts |
| `ASAAS_MASTER_API_KEY` | SERVER_SECRET | NO | NO | UNVERIFIED | UNVERIFIED | lib/payments/asaas-config.ts |
| `ASAAS_ROOT_WALLET_ID` | UNKNOWN | NO | NO | UNVERIFIED | UNVERIFIED | lib/payments/asaas-config.ts |
| `ASAAS_WEBHOOK_AUTH_TOKEN` | SERVER_SECRET | NO | NO | UNVERIFIED | UNVERIFIED | lib/payments/asaas-config.ts |
| `CRON_SECRET` | SERVER_SECRET | NO | NO | UNVERIFIED | UNVERIFIED | app/api/cron/founder-billing/route.ts, app/api/cron/jobs/route.ts, app/api/cron/smart-notifications/route.ts |
| `GOOGLE_INTEGRATIONS_CLIENT_ID` | SERVER_CONFIG | NO | NO | UNVERIFIED | UNVERIFIED | lib/integrations/google/oauth.ts |
| `GOOGLE_INTEGRATIONS_CLIENT_SECRET` | SERVER_SECRET | NO | NO | UNVERIFIED | UNVERIFIED | lib/integrations/google/oauth.ts |
| `GOOGLE_INTEGRATIONS_REDIRECT_URI` | SERVER_CONFIG | NO | NO | UNVERIFIED | UNVERIFIED | lib/integrations/google/oauth.ts |
| `INTEGRATION_OAUTH_STATE_SECRET` | SERVER_SECRET | NO | NO | UNVERIFIED | UNVERIFIED | lib/integrations/core/auth.ts |
| `MERCADO_PAGO_AUTH_URL` | SERVER_CONFIG | NO | NO | UNVERIFIED | UNVERIFIED | lib/mercado-pago.ts |
| `MP_MARKETPLACE_CLIENT_ID` | SERVER_CONFIG | YES | NO | UNVERIFIED | UNVERIFIED | app/api/system/health/route.ts, lib/payments/checkout-service.ts, lib/payments/marketplace/config.ts |
| `MP_MARKETPLACE_CLIENT_SECRET` | SERVER_SECRET | YES | NO | UNVERIFIED | UNVERIFIED | app/api/system/health/route.ts, lib/payments/marketplace/config.ts |
| `MP_MARKETPLACE_REDIRECT_URI` | SERVER_CONFIG | YES | NO | UNVERIFIED | UNVERIFIED | lib/payments/marketplace/config.ts |
| `MP_MARKETPLACE_WEBHOOK_SECRET` | SERVER_SECRET | YES | NO | UNVERIFIED | UNVERIFIED | app/api/system/health/route.ts, lib/payments/marketplace/config.ts |
| `MP_SIGNUP_ACCESS_TOKEN` | SERVER_SECRET | YES | NO | UNVERIFIED | UNVERIFIED | lib/payments/signup/mercado-pago.ts |
| `MP_SIGNUP_WEBHOOK_SECRET` | SERVER_SECRET | YES | NO | UNVERIFIED | UNVERIFIED | lib/payments/signup/mercado-pago.ts |
| `MP_SUBSCRIPTION_ACCESS_TOKEN` | SERVER_SECRET | YES | NO | UNVERIFIED | UNVERIFIED | lib/payments/subscription/mercado-pago.ts |
| `MP_SUBSCRIPTION_WEBHOOK_SECRET` | SERVER_SECRET | YES | NO | UNVERIFIED | UNVERIFIED | lib/payments/subscription/mercado-pago.ts |
| `NEXT_PUBLIC_APP_URL` | PUBLIC_INTENDED | YES | NO | UNVERIFIED | UNVERIFIED | app/api/checkout/lead/route.ts, app/api/parceiros/demos/route.ts, app/business/page.tsx, app/layout.tsx, app/page.tsx, app/robots.ts, app/site/[slug]/page.tsx … |
| `NEXT_PUBLIC_MP_MARKETPLACE_PUBLIC_KEY` | PUBLIC_INTENDED | YES | YES | UNVERIFIED | UNVERIFIED | components/checkout/CheckoutClient.tsx, lib/payments/checkout-service.ts |
| `NEXT_PUBLIC_MP_SIGNUP_PUBLIC_KEY` | PUBLIC_INTENDED | YES | YES | UNVERIFIED | UNVERIFIED | components/checkout/SignupCheckout.tsx |
| `NEXT_PUBLIC_MP_SUBSCRIPTION_PUBLIC_KEY` | PUBLIC_INTENDED | YES | YES | UNVERIFIED | UNVERIFIED | components/subscription/MercadoPagoSubscriptionCheckout.tsx |
| `NEXT_PUBLIC_ROOT_DOMAIN` | PUBLIC_INTENDED | YES | YES | UNVERIFIED | UNVERIFIED | app/api/security/report/route.ts, components/painel/PanelPremiumHeader.tsx, lib/company-url.ts |
| `NEXT_PUBLIC_SITE_URL` | PUBLIC_INTENDED | YES | YES | UNVERIFIED | UNVERIFIED | app/api/balcao/quick-proposal/route.ts, app/api/checkout/lead/route.ts, app/api/clientes/magic-link/route.ts, app/painel/central-operacional/ferramentas/page.tsx, lib/affiliates/portal-v2.ts, lib/affiliates/server.ts, lib/mercado-pago.ts … |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | PUBLIC_INTENDED | YES | NO | UNVERIFIED | UNVERIFIED | app/site/[slug]/page.tsx, lib/security/mfa.ts, lib/supabase-server.ts, lib/supabase.ts, proxy.ts |
| `NEXT_PUBLIC_SUPABASE_URL` | PUBLIC_INTENDED | YES | NO | UNVERIFIED | UNVERIFIED | app/api/checkout/lead/route.ts, app/api/company/check-subdomain/route.ts, app/api/leads/complete-account/route.ts, app/api/marketplace/coupon/route.ts, app/api/marketplace/store/[slug]/route.ts, app/api/mercado-pago/webhook-leads/route.ts, app/api/propostas/[token]/route.ts … |
| `NODE_ENV` | SERVER_CONFIG | NO | NO | UNVERIFIED | UNVERIFIED | lib/company-url.ts, lib/mercado-pago.ts, lib/observability/application-errors.ts, lib/orcaly-security.ts |
| `OPENAI_API_KEY` | SERVER_SECRET | NO | NO | UNVERIFIED | UNVERIFIED | app/api/admin/ai/route.ts, app/api/ai/business-assistant/route.ts, app/api/ai/orcamento/route.ts, app/api/ai/product-helper/route.ts, app/api/parceiros/ai/route.ts, app/api/system/health/route.ts, app/api/whatsapp/settings/route.ts … |
| `ORCALY_AI_MODEL` | SERVER_CONFIG | NO | NO | UNVERIFIED | UNVERIFIED | app/api/admin/ai/route.ts, app/api/ai/business-assistant/route.ts, app/api/ai/orcamento/route.ts, app/api/ai/product-helper/route.ts, app/api/parceiros/ai/route.ts, lib/whatsapp.ts |
| `ORCALY_APP_URL` | SERVER_CONFIG | YES | NO | UNVERIFIED | UNVERIFIED | app/api/checkout/lead/route.ts, app/api/parceiros/demos/route.ts, lib/affiliates/portal-v2.ts, lib/affiliates/server.ts, lib/mercado-pago.ts, lib/signup-checkout.ts, lib/subscription-service.ts |
| `ORCALY_HOME_AI_FALLBACK_MODEL` | SERVER_CONFIG | NO | NO | UNVERIFIED | UNVERIFIED | app/api/public/home-chat/route.ts |
| `ORCALY_HOME_AI_MODEL` | SERVER_CONFIG | NO | NO | UNVERIFIED | UNVERIFIED | app/api/internal/ai-gateway-health/route.ts, app/api/public/home-chat/route.ts |
| `ORCALY_MARKETPLACE_DEFAULT_COMMISSION_PERCENTAGE` | UNKNOWN | NO | NO | UNVERIFIED | UNVERIFIED | lib/marketplace-commission.ts |
| `ORCALY_PUBLIC_URL` | SERVER_CONFIG | NO | NO | UNVERIFIED | UNVERIFIED | lib/integrations/google/calendar.ts |
| `ORCALY_WEALTH_ENABLED` | UNKNOWN | NO | NO | UNVERIFIED | UNVERIFIED | lib/ecosystem/server.ts, lib/jobs/handlers/wealth-recurrence.ts |
| `PAYMENT_CREDENTIALS_ENCRYPTION_KEY` | SERVER_SECRET | YES | NO | UNVERIFIED | UNVERIFIED | lib/affiliates/server.ts, lib/payments/credential-encryption.ts, lib/signup-checkout.ts |
| `PAYMENT_PROVIDER_DEFAULT` | UNKNOWN | NO | NO | UNVERIFIED | UNVERIFIED | lib/payments/asaas-config.ts |
| `SUPABASE_SERVICE_ROLE_KEY` | SERVER_SECRET | YES | NO | UNVERIFIED | UNVERIFIED | app/api/checkout/lead/route.ts, app/api/company/check-subdomain/route.ts, app/api/leads/complete-account/route.ts, app/api/marketplace/coupon/route.ts, app/api/marketplace/store/[slug]/route.ts, app/api/mercado-pago/webhook-leads/route.ts, app/api/propostas/[token]/route.ts … |
| `VERCEL_DEPLOYMENT_ID` | UNKNOWN | NO | NO | UNVERIFIED | UNVERIFIED | lib/observability/application-errors.ts |
| `VERCEL_ENV` | SERVER_CONFIG | NO | NO | UNVERIFIED | UNVERIFIED | app/api/admin/system-health/route.ts, app/api/internal/ai-gateway-health/route.ts, app/api/internal/platform-evolution-build/route.ts, app/api/internal/preview-build/route.ts, lib/observability/application-errors.ts |
| `VERCEL_GIT_COMMIT_REF` | UNKNOWN | NO | NO | UNVERIFIED | UNVERIFIED | app/api/internal/platform-evolution-build/route.ts |
| `VERCEL_GIT_COMMIT_SHA` | UNKNOWN | NO | NO | UNVERIFIED | UNVERIFIED | app/api/internal/ai-gateway-health/route.ts, app/api/internal/platform-evolution-build/route.ts, app/api/internal/preview-build/route.ts, lib/observability/application-errors.ts |
| `VERCEL_OIDC_TOKEN` | UNKNOWN | NO | NO | UNVERIFIED | UNVERIFIED | app/api/internal/ai-gateway-health/route.ts, app/api/public/home-chat/route.ts |
| `WHATSAPP_ACCESS_TOKEN` | SERVER_SECRET | NO | NO | UNVERIFIED | UNVERIFIED | app/api/whatsapp/settings/route.ts, lib/whatsapp.ts |
| `WHATSAPP_APP_SECRET` | SERVER_SECRET | NO | NO | UNVERIFIED | UNVERIFIED | lib/whatsapp.ts |
| `WHATSAPP_CLOUD_API_TOKEN` | UNKNOWN | NO | NO | UNVERIFIED | UNVERIFIED | app/api/whatsapp/settings/route.ts, lib/whatsapp.ts |
| `WHATSAPP_GRAPH_VERSION` | UNKNOWN | NO | NO | UNVERIFIED | UNVERIFIED | app/api/whatsapp/settings/route.ts, lib/whatsapp.ts |
| `WHATSAPP_PHONE_NUMBER_ID` | UNKNOWN | NO | NO | UNVERIFIED | UNVERIFIED | app/api/whatsapp/settings/route.ts, lib/whatsapp.ts |
| `WHATSAPP_VERIFY_TOKEN` | UNKNOWN | NO | NO | UNVERIFIED | UNVERIFIED | app/api/whatsapp/settings/route.ts, app/api/whatsapp/webhook/route.ts |

## Conclusions

- Public-by-design: Supabase URL/anon-publishable key, site/app/root-domain values and provider public keys.
- Server-only: service role, access tokens, OAuth client secrets, webhook secrets, encryption keys, private API keys and CRON secret.
- No unsafe NEXT_PUBLIC secret name was found.
- No source-level client bundle import of the service-role key was found.
- **SECRETS EXPOSED: NO known source-boundary exposure.**
- Runtime environment completeness remains UNVERIFIED until an approved existence-only Vercel check can list NAME/SCOPE without values.
