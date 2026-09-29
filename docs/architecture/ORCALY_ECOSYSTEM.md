# Orçaly Ecosystem

State at 2026-09-26 UTC: PARTIAL. This document distinguishes working local code from the larger requested product roadmap.

The existing Next.js App Router repository remains a single application. Business keeps `/painel/**`, company permissions, subscriptions, jobs, integrations and payment boundaries. Its former public Home is preserved at `/business`; `/` now introduces eight sibling products. A verified account visiting Home goes to `/apps`.

`lib/ecosystem/products.ts` owns product identity, public availability, contexts, navigation, capabilities, release switches and asset availability. `experience.ts` maps those values to CSS tokens. No new authentication provider, enterprise permission engine, billing engine or generic job runner was created.

The authenticated App Hub reads the current user's company and partner associations through the existing Supabase RLS client. Wealth uses the same identity with a personal user boundary. It requires an explicit product entitlement, permission and the `ORCALY_WEALTH_ENABLED=true` release switch. New entitlements are never issued by an unprivileged client or inferred from a marketing plan name.

New persistence is additive in `supabase/migrations/20260926014103_ecosystem_identity_wealth.sql`. It adds entitlements, consent revocation, audit identifiers and personal Wealth profiles, financial entries and goals. No migration was applied to hosted Supabase. The only discovered Supabase branch is main; historical local/remote migration version drift prohibits a blind `db push`.

The new database suite runs the migration in PGlite (PostgreSQL in an isolated local runtime), assumes a minimal test representation of existing companies/members and tests actual grants/RLS. Browser tests drive the real Next application against a test-only Auth/PostgREST protocol gateway and that database. This does not certify hosted Supabase Auth, production schema compatibility or existing Business journeys.

Growth, Flow, Academy, Market and One remain explicitly in development. Their product descriptions express intended purpose, not implemented capability. Do not switch status to available based only on a page or a model interface.

Existing operational architecture remains documented in `docs/platform-evolution-3.md`, `docs/security-model.md`, `docs/operations-runbook.md`, `docs/pagamentos-isolados.md` and `docs/partner-portal-v2-implementation.md`.
