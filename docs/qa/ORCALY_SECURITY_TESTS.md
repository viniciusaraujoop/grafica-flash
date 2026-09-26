# Security tests and explicit limits

`scripts/test-ecosystem-database.mjs` executes the additive migration inside PostgreSQL/PGlite. `scripts/helpers/ecosystem-test-db.mjs` creates only synthetic identities. These tests assert actual SQL outcomes rather than matching policy source strings:

- Every new table has RLS; anonymous reads fail by privilege denial.
- A can create/read A's rows; A cannot select/update/delete B's guessed ID.
- A cannot insert for B or change a row's owner to B.
- Unentitled user has no Wealth read/write access.
- Client cannot create/modify commercial entitlements or elevate permission names.
- Company A member sees only Company A's grant, not Company B or A owner's personal grant.
- Expired/revoked grants deny reads while original data remains stored.
- Read permission alone does not permit writes.
- Profile/goals remain personal; duplicate idempotency key cannot create a second financial entry.
- Invalid money/currency/permission constraints fail.
- Only the consent owner can revoke, and column grants prevent changing scope or unrevoking.
- Audit events are client-inaccessible and contain no title/amount payloads.
- Internal trigger function cannot be called directly by anonymous/authenticated clients.

Pure contract tests additionally reject cross-context consent usage, purpose changes, wildcard scope, expiry, missing endpoint authorization, protocol-relative login redirects and encoded backslash/control-character redirects.

Browser E2E reaches real Server Actions and PostgreSQL RLS through a deliberately limited test-only Auth/PostgREST protocol adapter. It proves the application's use of the identity/permission/data boundary for these flows, but does not prove Supabase's hosted auth configuration, OAuth, MFA challenges, refresh-token rotation, e-mail delivery, rate limiting or historical production schema behavior. No test adapter is imported by production application code.

Still required before release: real hosted user A/B tests in isolated staging; existing Business nested-resource and storage denial; workers/outbox tenant isolation; full permission review of existing APIs; LGPD export/delete/retention; production provider/webhook checks; whole-app dependency/security scanner triage. Do not substitute passing build or source grep for these tests.
