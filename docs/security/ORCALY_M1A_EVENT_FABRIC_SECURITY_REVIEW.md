# ORÇALY — M1A EVENT FABRIC SECURITY DESIGN REVIEW

**Status:** SECURITY_DESIGN_REVIEW_AUTHORIZED  
**Implementation:** NOT AUTHORIZED  
**Migration creation:** NOT AUTHORIZED  
**SQL execution:** NOT AUTHORIZED  
**Database mutation:** NOT AUTHORIZED  
**Staging mutation:** NOT AUTHORIZED  
**Production mutation:** NOT AUTHORIZED  
**Main merge:** NOT AUTHORIZED  

**Repository:** `viniciusaraujoop/grafica-flash`  
**Canonical main:** `fb2bf74090cb3f85df64187bd13a12d805b0a7a7`  
**Exact reviewed SHA:** `8ca155a23084d500c90a39ab8c2d45bc3a0aa3d5`  
**Previous design SHA:** `d0db8a0bd812e4b53f6da26d5acaf6bafa442c0b`  
**Coordinator reconciliation SHA:** `26b78cc716eb35da18a12500d22a7703e8ce0aa6`  
**Reviewed artifact:** `docs/migrations/ORCALY_M1A_EVENT_FABRIC_IMPLEMENTATION_DESIGN.md`  
**Review date:** 2026-09-29

---

# 1. Executive Security Decision

## Result

`M1A_SECURITY_REVIEW: PASS_WITH_REQUIREMENTS`

The amended M1A architecture is security-sound enough to proceed to **migration implementation planning**, but **not** to migration creation or activation without the requirements in this review.

The canonical architecture remains correct:

```
domain transaction
  → transactional_outbox
  → private relay
  → background_jobs
  → allowlisted handler
```

No second queue, outbox, event bus, worker table or integration layer is required.

The amendment successfully resolves the previously identified job-claim isolation gap:

- Event Fabric jobs are identified by `outbox_event_id IS NOT NULL`;
- legacy/direct/shared jobs are identified by `outbox_event_id IS NULL`;
- the new Event Fabric claim boundary accepts only non-null;
- the existing generic claim boundary is redefined, same signature, to accept only null;
- both claim families retain `FOR UPDATE SKIP LOCKED`, bounded batch size and lease metadata.

Two security requirements remain before implementation:

### REQUIRED AMENDMENT A — dedupe uniqueness must be scope-aware

The proposed global uniqueness keys:

- `producer + event_type + dedupe_key`;
- `job_type + dedupe_key`;

do not structurally include tenant/personal/platform scope.

A legitimate producer can use a deterministic key that is unique only inside one company or user scope. Without scope in the uniqueness identity, Company A can collide with Company B, or one personal subject can collide with another. The result is cross-tenant interference / denial of publication or enqueue, even without data disclosure.

The future migration design must make dedupe uniqueness **scope-aware** or impose an equivalent structural guarantee that the dedupe key is globally namespaced by trusted scope. Security preference is structural scope-aware uniqueness, not string-concatenation convention.

### REQUIRED RUNTIME REQUIREMENT B — Event Fabric must use a dedicated cron/worker secret

The design currently references the shared `CRON_SECRET`.

Current repository runtime contains another cron route that accepts the shared secret through a query-string fallback. Even though the future Event Fabric route correctly forbids query-string fallback, reusing the same secret would make Event Fabric authorization inherit the leakage/blast-radius of weaker cron surfaces.

Event Fabric must therefore use a dedicated secret, conceptually:

`ORCALY_EVENT_FABRIC_CRON_SECRET`

or equivalent.

The secret must be header-only, fail closed if absent, compared in timing-safe form, never logged, and checked **before** the service-role client is created or used.

This is a runtime requirement and does not require database schema work.

---

# 2. Target Integrity / Drift

The amended branch head was independently confirmed as:

`8ca155a23084d500c90a39ab8c2d45bc3a0aa3d5`

Therefore:

`TARGET_DRIFT: NO`

Comparison against canonical main `fb2bf740...` shows the reviewed target is ahead only by reconciliation/design documentation commits. The observed changed files relative to main are documentation artifacts, not runtime implementation.

This review therefore evaluates the amended design against the canonical runtime lineage without a hidden runtime branch delta.

---

# 3. Canonical Queue Classification

## Design

`outbox_event_id IS NOT NULL`

means:

**EVENT FABRIC JOB**

`outbox_event_id IS NULL`

means:

**LEGACY / DIRECT / SHARED JOB**

## Security assessment

`JOB_CLAIM_ISOLATION: PASS`

This discriminator is:

- unambiguous;
- stable;
- backed by a durable source-event reference;
- compatible with additive migration;
- materially safer than payload-based or job-name inference;
- sufficient without a second queue-name/family column.

The classification remains safe only if all of the following hold:

1. Event Fabric dispatch always writes a non-null `outbox_event_id`;
2. ordinary/direct/shared enqueue paths never accept a caller-supplied `outbox_event_id`;
3. Event Fabric claim filters non-null;
4. generic claim filters null;
5. Event Fabric worker re-loads and validates the source outbox row before execution;
6. `outbox_event_id` is not taken from event/job payload JSON;
7. browser/authenticated roles cannot write the queue directly.

### Can an Event Fabric worker claim integration/calendar jobs?

**NO**, if the amended claim predicate is implemented exactly.

Existing jobs such as:

- `integration.sync`;
- `google.calendar.full_resync`;

remain direct/shared jobs with `outbox_event_id = NULL`.

### Can generic worker claim Event Fabric jobs?

**NO**, if `claim_background_jobs` is atomically redefined to add:

`outbox_event_id IS NULL`.

### Can generic + Event Fabric claims race across the classification boundary?

**NO**, assuming both predicates are mutually exclusive and both functions retain row locking / `SKIP LOCKED`.

A row cannot be simultaneously NULL and non-NULL.

### Can a caller manipulate outbox_event_id to cross the boundary?

Normal user/browser callers: **NO**, because Event Fabric tables remain internal and browser roles receive no write path.

A holder of the service-role capability could technically write database state directly if granted table-level mutation. This is part of the existing trusted-server boundary. M1A must reduce the accidental surface by:

- never accepting `outbox_event_id` in public/user request schemas;
- never taking it from payload;
- constructing it inside trusted dispatch;
- revalidating the source event in the worker;
- keeping all direct Data API access closed to anon/authenticated.

A fully compromised service-role credential is already a database-security-root compromise and is not made safe by queue classification alone.

---

# 4. Generic Job Compatibility

`GENERIC_JOB_COMPATIBILITY: PASS`

Compatibility reasoning:

1. the new `outbox_event_id` column is nullable;
2. every pre-M1A job therefore receives NULL automatically;
3. existing direct/shared job families remain NULL;
4. existing workers keep calling the same `claim_background_jobs(text, integer)` signature;
5. the amended function adds only the classification predicate;
6. existing integration-specific unique indexes are unaffected;
7. the schema addition and both claim definitions are planned in one migration transaction.

The current canonical claim already has:

- queued/retrying eligibility;
- `run_after <= now()`;
- ordering by schedule/creation;
- bounded limit 1..50;
- `FOR UPDATE SKIP LOCKED`;
- attempts increment;
- running status;
- `locked_at`;
- `locked_by`;
- `started_at`.

M1A must preserve those properties while adding the NULL predicate.

---

# 5. Claim / Settlement Trust Boundary

`SETTLEMENT_BOUNDARY: PASS`

The existing `settle_background_job` remains acceptable for M1A.

Current important properties:

- service-role execution only;
- status allowlist:
  - completed;
  - failed;
  - retrying;
  - needs_attention;
- requires `status = running`;
- requires exact `locked_by = p_worker`;
- wrong-worker settlement updates zero rows and returns false;
- error is bounded;
- lease is released during settlement.

## locked_by is a lease, not authorization

This distinction is mandatory.

`locked_by` proves only:

> this worker instance currently owns the processing lease.

It does not prove:

- user permission;
- company permission;
- entitlement;
- consent;
- product access;
- domain authorization.

Those must be rechecked independently by the handler.

## Worker-id spoofing

A caller with no service-role capability cannot call the settlement RPC.

Within trusted worker runtime, the worker identifier must be:

- server-generated;
- not supplied by HTTP/query/body input;
- unique per worker process/run;
- preferably high entropy / UUID-based;
- never logged as a security credential.

If another service-role process knows both job ID and current worker ID, it could attempt settlement. This is why service role remains a trusted internal capability and why the worker ID must never be mistaken for a cryptographic authorization token.

## Job-id guessing

Knowledge of a job UUID alone creates no privilege because:

- the RPC is not executable by anon/authenticated;
- the row must be running;
- the worker lease must match.

## Is a narrower Event Fabric settlement RPC required?

**No for M1A.**

A narrower settlement function could add defense in depth, but it would not materially protect against a fully compromised service-role principal. The existing shared settlement is sufficient when:

- Event Fabric claims are isolated;
- Event Fabric worker settles only jobs returned by its own claim;
- handler/source-event validation runs before effect;
- current authorization is rechecked.

---

# 6. SECURITY DEFINER / Search Path

`SECURITY_DEFINER: PASS`

`SEARCH_PATH: PASS`

Privileged functions requiring review:

- `orcaly_dispatch_outbox_event`;
- `orcaly_settle_outbox_failure`;
- `claim_event_fabric_jobs`;
- redefined `claim_background_jobs`;
- existing `settle_background_job`;
- existing `recover_stale_background_jobs`.

## Mandatory implementation requirements

1. use SECURITY DEFINER only when privileged table access / atomic lifecycle mutation requires it;
2. no dynamic SQL driven by:
   - event_type;
   - producer;
   - job_type;
   - payload;
   - user-provided identifier;
3. all relations/functions referenced with explicit schema qualification;
4. fixed safe search path;
5. for newly created/redefined M1A functions, prefer:

   `search_path = pg_catalog`

   with explicit `public.<object>` qualification;

6. do not preserve the legacy broader `pg_catalog, public` search path merely because the old claim function used it;
7. validate all scalar arguments:
   - worker length/non-empty;
   - limits clamped;
   - UUID non-null where required;
   - bounded error/retry input;
8. no caller identity inferred from `current_user`;
9. no event payload interpreted as a relation/function/module identifier.

Current `settle_background_job` and `recover_stale_background_jobs` already use `search_path = pg_catalog` and schema-qualified target tables.

---

# 7. RPC Grants / Service Role

`RPC_GRANTS: PASS`

For every M1A privileged RPC:

- PUBLIC EXECUTE: revoke;
- anon: revoke/deny;
- authenticated: revoke/deny;
- service/worker only.

Service role is an acceptable **database execution boundary** for M1A because the Event Fabric endpoint is itself an internal server/cron surface.

However:

**service_role is not request authentication.**

Runtime must authenticate the cron/worker request first, then obtain/use service-role capability.

No ordinary user/session authentication is sufficient to invoke worker behavior.

---

# 8. Data API / Table Boundary

`DATA_API_BOUNDARY: PASS`

Canonical Event Fabric tables:

- `transactional_outbox`;
- `background_jobs`;
- `event_idempotency`.

They remain internal.

Required:

- RLS remains enabled;
- no new browser-facing policies;
- anon direct SELECT/INSERT/UPDATE/DELETE denied;
- authenticated direct SELECT/INSERT/UPDATE/DELETE denied;
- no public event-publishing Data API.

The current reliability migration already established the internal-table model and revoked anon/authenticated table access.

## Service-role privileges

M1A should minimize service-role table privileges to actual application requirements.

For `transactional_outbox`:

- producer path requires INSERT;
- relay/health may require SELECT;
- lifecycle changes should preferably happen through narrow privileged RPCs;
- ordinary DELETE is unnecessary;
- ordinary TRUNCATE is unnecessary.

Direct broad UPDATE should not be treated as a new producer API. If implementation can route all lifecycle mutation through the narrow dispatch/failure RPCs without breaking existing producer behavior, implementation review should prefer removing unnecessary direct UPDATE as additional defense in depth. This is recommended hardening, not a blocker for the current design review.

---

# 9. Destructive Outbox Privileges

## DELETE

`OUTBOX_DELETE_REVOKE: APPROVE`

No legitimate M1A producer requires DELETE.

No relay operation requires DELETE.

No retry operation requires DELETE.

No failure-settlement operation requires DELETE.

No retention operation is authorized by M1A.

Repository review found no versioned application cleanup/delete path that requires ordinary service-role deletion of `transactional_outbox`.

Migration/database-owner capability remains separate.

## TRUNCATE

`OUTBOX_TRUNCATE_REVOKE: APPROVE`

TRUNCATE has no legitimate application-runtime role.

It would bypass all row-level lifecycle semantics and could destroy queued/failed/needs_attention history in one operation.

Ordinary service role must not retain it.

Migration owner / database administrator authority remains distinct.

---

# 10. Company ON DELETE CASCADE

`COMPANY_CASCADE: ACCEPT`

Preserving existing CASCADE in M1A is security-acceptable and safer than silently changing the semantics of the shared queue now.

Alternatives:

## RESTRICT

Security benefit:

- preserves queued/history rows.

Compatibility risk:

- can unexpectedly block existing company hard-deletion paths whenever shared background jobs exist;
- changes integration/calendar behavior, not only Event Fabric.

## SET NULL

Rejected.

A company-scoped event/job becoming:

`company_id = NULL`

would look platform-scoped and changes authorization meaning.

That is worse than explicit deletion.

## CASCADE

Accepted as:

**explicit tenant lifecycle cancellation exception**.

It is not retention.

It is not worker cleanup.

It is not age-based purge.

## Mandatory tenant hard-delete governance

Future hard deletion must:

1. require privileged platform/admin authority;
2. require step-up/MFA for the destructive action;
3. present counts of:
   - queued;
   - retrying;
   - running/processing;
   - failed;
   - needs_attention;
4. prevent ordinary company/product routes from deleting the tenant casually;
5. record an append-only audit outside the rows/company data that will cascade away;
6. require explicit acknowledgement that queued work/history will be destroyed;
7. quiesce the tenant before deletion:
   - stop new claims/publications;
   - block or drain running work;
   - avoid deleting while a worker is actively performing an external side effect;
8. revoke/close provider integrations and credentials under their own lifecycle rules;
9. define whether outstanding work is drained, explicitly cancelled or abandoned;
10. never describe CASCADE deletion as retention.

The quiescence requirement is important: deleting the job row does not magically stop a worker that already began an external side effect.

---

# 11. user_id Historical Reference

`USER_ID_REFERENCE_MODEL: ACCEPT`

A nullable UUID without a cascading Auth FK is acceptable for M1A.

Security benefit:

- Auth account deletion does not erase Event Fabric history;
- an event does not silently change from personal to platform scope;
- historical causality remains stable.

## Required controls

1. trusted publisher validates the user exists/was valid at publication time where the contract requires a live user;
2. user ID never comes from payload authority;
3. personal event worker derives subject from the outbox column;
4. handler rechecks current user/account state when current authorization is required;
5. deleted/stale user references fail closed according to contract:
   - skip/no-op where semantically correct;
   - needs_attention where operator decision is required;
6. no browser query by arbitrary user_id;
7. no cross-user fetch based only on knowledge of UUID;
8. user UUID is never reclassified as platform scope after account deletion.

No new identity model or Auth FK is required by M1A.

---

# 12. Scope Integrity

`SCOPE_INTEGRITY: PASS`

Allowed:

- company != NULL, user = NULL → COMPANY;
- company = NULL, user != NULL → PERSONAL;
- both NULL → PLATFORM;
- both non-NULL → INVALID.

Required enforcement:

1. DB CHECK prevents company + user simultaneously;
2. runtime contract validator confirms expected scope kind;
3. dispatch derives job scope from outbox columns;
4. worker verifies job scope equals source event scope;
5. payload fields named `company_id`, `user_id`, `scope`, etc. have no authorization authority;
6. platform scope is accepted only for statically allowlisted contracts;
7. unknown/platform-mismatched contracts go to needs_attention.

A user-controlled payload can never promote itself to platform or another tenant.

---

# 13. Atomic Dispatch

`ATOMIC_DISPATCH: PASS`

The proposed DB transaction boundary is appropriate.

Required sequence:

1. lock exact outbox row;
2. verify status/eligibility;
3. verify expected producer/event/version;
4. derive stored scope/correlation;
5. transition transaction-local processing;
6. ensure every expected job;
7. derive/verify dedupe deterministically;
8. attach outbox_event_id;
9. copy trusted scope/correlation;
10. verify expected jobs exist;
11. mark completed;
12. commit.

If any step fails:

**transaction rollback**.

No partial enqueue + completed outbox state may commit.

## TOCTOU

The row lock protects DB state after function entry.

The TypeScript relay may validate before calling the DB function. Therefore:

- the function must re-check immutable event identity fields;
- worker must validate the source payload/contract again before side effect;
- ordinary application code must not mutate event payload/scope/identity after publication.

A fully trusted service-role process modifying the row between application validation and DB dispatch is outside the browser threat boundary, but implementation should reduce this accidental capability where possible.

## Malicious handler specs

Because the authoritative registry is TypeScript, the DB function cannot independently know which handler names are legitimate unless the caller supplies them.

Therefore the security chain is:

- static registry validates/specifies jobs;
- service-only dispatch accepts a bounded set of specs;
- DB constructs/verifies deterministic dedupe and scope;
- worker re-validates:
  - source event;
  - job type/version;
  - handler allowed for event;
  - scope/correlation;
  - payload;
  - authorization.

The dispatch RPC must additionally reject:

- zero consumer specs;
- duplicate specs;
- excessive consumer count;
- invalid job identifier shape;
- invalid version/attempt bounds;
- oversized job payload.

No dynamic SQL/module invocation is allowed.

## Unexpected event version

Fail closed → needs_attention.

## Zero-consumer case

Fail closed → needs_attention.

It must never mark the event completed with zero jobs.

---

# 14. Failure Settlement

`FAILURE_SETTLEMENT: PASS`

The narrow failure API is fail-closed because it accepts only:

- event id;
- bounded sanitized error;
- retryable boolean;
- bounded retry time.

It must never accept an arbitrary final status.

Rules:

- completed event is not reopened by failure settlement;
- attempts increment atomically;
- retryable + budget → retrying;
- non-retryable → needs_attention;
- exhausted → needs_attention;
- no delete;
- no failed-by-arbitrary-string transition.

Retry time must be derived/clamped server/DB-side. A caller cannot park an event arbitrarily far into the future.

Using the design retry family (bounded exponential delay, <= 15 minutes) is security-preferable.

---

# 15. Four Idempotency Boundaries

`IDEMPOTENCY_MODEL: PASS`

The design correctly keeps separate:

1. provider inbound:
   `event_idempotency(provider,event_id)`;
2. internal publication:
   outbox dedupe;
3. enqueue:
   background job dedupe;
4. domain side effect:
   handler/domain-specific idempotency.

No key at one layer proves idempotency at another.

A worker retry can happen even when enqueue was exactly-once.

A provider replay can happen even when domain action was already applied.

The domain handler must remain the final exactly-once-effect boundary.

---

# 16. Dedupe Uniqueness — REQUIRED AMENDMENT

`DEDUPE_UNIQUENESS: REQUIRED_AMENDMENT`

## Problem

Proposed publication uniqueness:

`producer + event_type + dedupe_key`

Proposed job uniqueness:

`job_type + dedupe_key`

These are global identities.

The design does not require a dedupe key itself to contain the trusted company/user/platform scope.

Example:

Company A produces:

`dedupe_key = invoice:123`

Company B independently produces:

`dedupe_key = invoice:123`

Both may be semantically valid inside their tenant.

A global unique index causes one tenant to prevent the other tenant's event.

That is cross-tenant interference.

## Required amendment — outbox

Dedupe identity must include canonical scope.

Security-preferred conceptual identities:

### Company event

`producer + event_type + company_id + dedupe_key`

### Personal event

`producer + event_type + user_id + dedupe_key`

### Platform event

`producer + event_type + dedupe_key`

with explicit platform-scope predicate.

This can be represented through scope-specific partial uniqueness without adding a new scope column.

## Required amendment — background jobs

Generic enqueue dedupe must also avoid cross-scope collision.

Conceptually:

### Company job

`company_id + job_type + dedupe_key`

### Personal job

`user_id + job_type + dedupe_key`

### Platform job

`job_type + dedupe_key`

For normal relay jobs, the dedupe key remains deterministically based on the globally unique outbox event plus handler identity, so scope inclusion is redundant but harmless.

For future direct/shared jobs, scope-aware uniqueness prevents tenant-local keys from colliding globally.

## Product / job namespace

`producer` already isolates publication by product/domain.

For jobs, `job_type` must be globally unique and registry-namespaced by owning domain, e.g. domain-qualified identifiers. CI/registry validation must reject duplicate ownership of the same job_type.

## Malicious dedupe influence

`dedupe_key` is trusted server contract metadata.

It must not be accepted raw from browser/provider payload.

The producer/dispatch implementation derives it from trusted identifiers.

---

# 17. Payload Security

`PAYLOAD_SECURITY: PASS`

The 32 KiB outbox and 8 KiB relay-job limits are acceptable.

The design correctly forbids:

- passwords;
- secrets;
- tokens;
- authorization;
- cookies;
- API keys;
- access/refresh tokens;
- credential bundles;
- OAuth codes;
- provider credentials;
- document/file bodies;
- unbounded provider responses.

## Mandatory implementation details

Secret-key detection must be recursive across:

- nested objects;
- arrays of objects.

Key normalization must be case-insensitive and separator-aware:

- `access_token`;
- `access-token`;
- `AccessToken`;
- `ACCESS_TOKEN`;

must not evade the rule.

Secret-key denial is **defense in depth**, not the primary validator.

The primary control must be contract-specific positive validation:

- exact allowed fields;
- type validation;
- length validation;
- unexpected-field policy.

## Encoded secret content

Generic detection cannot reliably prove that a base64/opaque string is or is not a credential.

M1A must not claim otherwise.

The correct control is:

- minimal allowlisted payload schemas;
- references/IDs instead of credential material;
- code review;
- contract tests.

## False positives

A harmless field such as `token_count` may trigger a naive secret-name detector.

Default should remain fail-closed unless the contract explicitly allowlists the harmless semantic field.

## PII

PII is not automatically a secret class, but payload must be minimal.

Prefer stable IDs and domain lookups over:

- names;
- emails;
- phone numbers;
- addresses;
- document contents.

---

# 18. Static Contract Registry

`REGISTRY_BOUNDARY: PASS`

Static TypeScript registry is safer than a mutable database handler registry for M1A.

Payload/database rows may never select:

- module;
- function;
- file path;
- dynamic import path;
- arbitrary handler;
- authorization scope.

Required:

- registry key = producer + event_type + event_version;
- consumer job_type/job_version must be allowlisted statically;
- job_type globally unique/namespaced;
- no `eval`;
- no reflection-based dynamic invocation;
- unknown contracts → needs_attention;
- unknown job_type/version → needs_attention.

Worker must independently verify that the claimed handler is permitted for the linked source event.

---

# 19. Compatibility Defaults

`COMPATIBILITY_DEFAULTS: PASS`

Temporary:

- `producer DEFAULT 'business'`;
- `event_version DEFAULT 1`;

are acceptable only as a bridge for the currently existing Business trigger.

Security reasoning:

- browser roles cannot insert Event Fabric rows;
- new producers are trusted server code;
- registry still rejects unknown business/v1 tuples;
- defaults do not grant user authorization.

## Mandatory governance

For every new producer after M1A:

1. producer must be explicit;
2. event_version must be explicit;
3. registry tuple must exist before activation;
4. CI/QA must include a negative fixture proving omission is rejected at the application contract layer;
5. code review must reject direct new producer inserts that rely on defaults;
6. later migration removes defaults after all legacy publishers are modernized.

Platform scope cannot be obtained merely by omitting company/user fields. The registry must additionally allow the exact contract for PLATFORM scope.

---

# 20. Correlation / Causation / Outbox IDs

These identifiers are:

**non-secret tracing metadata**.

They are not authorization credentials.

Knowing:

- correlation_id;
- causation_id;
- outbox_event_id;

must never grant:

- read access;
- job execution;
- replay;
- settlement;
- cross-tenant lookup.

Operational/admin APIs must apply their normal access control before resolving these identifiers.

Do not put them into public URLs as bearer-like access tokens.

---

# 21. Retention Enforcement

`RETENTION_ENFORCEMENT: PASS`

Canonical rule remains:

**UNPROCESSED OUTBOX IS NEVER PURGED BY AGE.**

Protected:

- queued;
- processing;
- retrying;
- failed;
- needs_attention.

M1A introduces no age cleanup.

Revoking ordinary service-role DELETE/TRUNCATE materially reinforces this rule.

Exceptions:

- explicit hard tenant deletion CASCADE under governed lifecycle cancellation;
- future completed-retention policy separately designed/approved.

The future completed-retention path must be a narrow privileged boundary and must coordinate dependent job retention.

---

# 22. Replay Security

`REPLAY_SECURITY: PASS`

A replay/worker retry does not inherit old authorization as a permanent grant.

Sensitive handlers must re-check at execution time:

- current company membership/permission;
- current product entitlement;
- current consent;
- current resource existence/status;
- current feature/business rule where relevant.

If a required authorization service is unavailable:

**fail closed**.

Do not perform the side effect optimistically.

## Stale job after consent revocation

No consent-gated effect.

Handler should settle according to contract:

- completed/skipped if revoked consent means the desired safe result is no action and that outcome is explicitly defined;
- needs_attention where operator/product semantics require intervention.

## Stale job after entitlement expiration

No protected side effect.

Same fail-closed rule.

## Explicit replay

Replay must:

- require privileged authorization;
- record audit;
- produce a new enqueue/dedupe identity;
- preserve original correlation/causation as appropriate;
- still pass current authorization;
- still pass domain-side-effect idempotency.

Lease ownership never bypasses any of these.

---

# 23. Observability / Leakage

`OBSERVABILITY_LEAKAGE: PASS`

Health may expose:

- counts by state;
- oldest age;
- bounded event IDs;
- event type;
- producer;
- job type;
- correlation reference when operationally needed.

Health must not expose:

- payload;
- job payload;
- credentials;
- Authorization header;
- cron secret;
- provider request/response body;
- cookies;
- secrets;
- user PII unless strictly required and separately authorized.

## Error/log sanitation

Existing `lib/observability/application-errors.ts` already contains:

- secret-key filtering;
- Bearer redaction;
- token/query-parameter redaction;
- nested metadata sanitization;
- bounded error/stack output.

M1A logging must use similarly structured, allowlisted metadata and never log raw Event Fabric payloads merely because sanitizer exists.

Sanitization is a last defense, not permission to log secrets.

---

# 24. Cron / Runtime Authentication

`CRON_SECURITY: ISSUE`

The design is correct on:

- Node runtime;
- Authorization Bearer header;
- no query-string fallback;
- fail closed if secret missing;
- feature gate OFF by default;
- service-role DB client only after authentication.

The issue is **secret reuse**.

Canonical repository contains a separate cron endpoint that accepts the shared `CRON_SECRET` through a query-string fallback.

Reusing `CRON_SECRET` for Event Fabric therefore imports the leakage/blast-radius of that weaker endpoint.

## Required runtime amendment

Use a dedicated Event Fabric secret:

`ORCALY_EVENT_FABRIC_CRON_SECRET`

or equivalent.

Requirements:

1. header-only;
2. no URL/query fallback;
3. absent/misconfigured secret → fail closed before DB access;
4. compare in timing-safe form;
5. never log supplied or configured secret;
6. never include secret in error metadata;
7. preview environments default Event Fabric disabled;
8. missing preview secret does not silently fall back to production/global cron secret;
9. service-role client instantiated/used only after:
   - feature gate decision;
   - request authentication.

The feature flag should fail closed independently from auth.

---

# 25. Migration Shape

`MIGRATION_SHAPE: ONE_MIGRATION_ACCEPTABLE`

One migration is security-preferable here because claim classification must switch atomically.

The same transaction should contain:

- additive outbox columns/constraints/indexes;
- additive background_jobs columns/constraints/indexes;
- scope-aware dedupe amendment;
- Event Fabric claim RPC;
- redefinition of generic claim with NULL boundary;
- atomic dispatch RPC;
- failure-settlement RPC;
- grant/revoke changes.

Splitting the discriminator from the generic-claim narrowing could create an unsafe committed window where Event Fabric rows exist but the generic claim still accepts them.

## Conditions

Immediately before migration creation/application, Migration Owner must revalidate:

- current main;
- migration ledger;
- row counts;
- current functions;
- grants;
- producer triggers;
- existing job families;
- index compatibility.

If tables are materially non-empty/large or facts drift, stop and reconsider index/migration rollout strategy.

This review did **not** execute SQL.

---

# 26. Threat Case Matrix

| ID | Threat | Result | Required control |
|---|---|---|---|
| T1 | authenticated user reads/writes Event Fabric tables | PASS | no anon/auth grants, RLS defense-in-depth |
| T2 | anon calls privileged RPC | PASS | revoke PUBLIC/anon/authenticated EXECUTE |
| T3 | Event Fabric worker claims integration/calendar job | PASS | claim requires non-null outbox_event_id |
| T4 | generic worker claims Event Fabric job | PASS | generic claim requires NULL |
| T5 | payload attempts company_id/user_id override | PASS | DB columns authoritative; payload rejected/ignored as authority |
| T6 | payload selects job_type/module/function | PASS | static registry only |
| T7 | duplicate relay calls | PASS | row lock + atomic dispatch + enqueue dedupe |
| T8 | dedupe collision across tenants/products | **REQUIRED AMENDMENT** | scope-aware uniqueness; global job_type namespace |
| T9 | secret-bearing payload | PASS with requirements | exact schema + recursive secret-key reject |
| T10 | oversized payload | PASS | 32 KiB / 8 KiB fail-closed bounds |
| T11 | wrong worker settles job | PASS | running + locked_by equality; service-only |
| T12 | stale replay after consent revoked | PASS | execution-time consent recheck |
| T13 | stale replay after entitlement expires | PASS | execution-time entitlement recheck |
| T14 | tenant deleted while jobs pending | ACCEPTED EXCEPTION | privileged hard-delete governance + quiescence |
| T15 | service-role DELETE/TRUNCATE outbox | PASS after amendment | revoke both ordinary privileges |
| T16 | new producer relies on business/v1 defaults | PASS with governance | explicit producer/version CI/review gate |
| T17 | unauthorized platform event | PASS | platform-scope registry allowlist + worker validation |
| T18 | another tenant knows correlation/outbox UUID | PASS | identifiers are non-secret, never authorization |

---

# 27. Additional Implementation Requirements

These requirements do not change the canonical architecture.

## Queue / classification

- generic enqueue APIs/helpers must not accept `outbox_event_id` from user/provider input;
- Event Fabric worker uses only Event Fabric claim;
- generic worker uses only generic claim;
- classification column must not be changed after enqueue by ordinary runtime code.

## Worker lease

- generate worker IDs server-side;
- preferably UUID/high-entropy;
- never accept worker ID from external request;
- never treat worker ID as authentication.

## Dispatch spec bound

- bounded number of consumers per event;
- reject duplicate handler/job specs;
- reject zero-consumer dispatch;
- validate job identifier format/version/max attempts.

## Service-role usage

- no service-role client in browser;
- Event Fabric cron auth before service-role use;
- no arbitrary generic API exposing service-role Event Fabric operations.

## Platform events

- both scope columns null is necessary but not sufficient;
- exact registry contract must explicitly allow PLATFORM.

---

# 28. Security Findings / Priorities

## Required before migration implementation

### M1A-S1 — Scope-unaware dedupe uniqueness

Severity:

**P1 design isolation risk / availability integrity**

Risk:

cross-tenant or cross-user key collision can suppress valid work.

Action:

amend uniqueness identity before migration creation.

## Required before runtime activation

### M1A-S2 — Shared CRON_SECRET blast radius

Severity:

**P1 runtime authorization design**

Risk:

existing weaker cron surface shares the secret and accepts query-string secret.

Action:

dedicated Event Fabric cron/worker secret.

## Governance requirement

### M1A-S3 — hard tenant deletion while work is active

Severity:

**P2 lifecycle/race risk**

Action:

privileged hard-delete flow must quiesce work and audit cancellation externally.

## Hardening recommendation

### M1A-S4 — minimize ordinary outbox UPDATE capability

Severity:

**P3 defense-in-depth**

Action:

prefer narrow RPC-controlled lifecycle mutation if implementation preflight confirms direct service-role UPDATE is unnecessary.

---

# 29. Required QA Additions

The Agent 3 matrix in the amended design is strong and must be retained.

Security additionally requires explicit tests for:

1. same dedupe_key in Company A and Company B → both valid events can coexist;
2. same dedupe_key for two personal users → both can coexist;
3. platform dedupe remains globally unique for the same producer/event/key;
4. same direct job dedupe_key across Company A/B → no collision;
5. Event Fabric cron called with shared legacy `CRON_SECRET` → rejected;
6. missing dedicated Event Fabric secret → fail closed before service-role access;
7. invalid Event Fabric secret → no DB/RPC call;
8. secret never appears in logs/errors;
9. nested `AccessToken`, `refresh-token`, `authorization` payload keys → rejected;
10. encoded opaque string in an allowed harmless field does not produce a false “secret scanner guarantees safety” assumption; exact contract validator remains authoritative;
11. zero handler specs → outbox not completed;
12. duplicate handler specs → rejected;
13. invalid handler spec → no job;
14. generic worker cannot claim non-null outbox_event_id;
15. Event Fabric worker cannot claim null outbox_event_id;
16. wrong worker settlement returns false/no mutation;
17. tenant deletion fixture cannot proceed through ordinary route and controlled hard-delete test demonstrates explicit cancellation/quiescence behavior.

---

# 30. Coordinator Implementation Decision

The design may proceed to migration implementation planning only if the Coordinator records:

1. scope-aware publication dedupe amendment;
2. scope-aware generic job dedupe amendment;
3. globally unique/namespaced job_type governance;
4. dedicated Event Fabric cron/worker secret;
5. tenant hard-delete quiescence requirement;
6. one migration remains atomic for discriminator + both claim definitions;
7. no implementation/deployment authorization is implied by this review.

No new queue/table is required.

No M1B/M1C/M1D/M1E implementation is required.

---

# 31. Final Status

```
M1A_SECURITY_REVIEW:
PASS_WITH_REQUIREMENTS

TARGET_SHA:
8ca155a23084d500c90a39ab8c2d45bc3a0aa3d5

TARGET_DRIFT:
NO

JOB_CLAIM_ISOLATION:
PASS

GENERIC_JOB_COMPATIBILITY:
PASS

SETTLEMENT_BOUNDARY:
PASS

SECURITY_DEFINER:
PASS

SEARCH_PATH:
PASS

RPC_GRANTS:
PASS

DATA_API_BOUNDARY:
PASS

OUTBOX_DELETE_REVOKE:
APPROVE

OUTBOX_TRUNCATE_REVOKE:
APPROVE

COMPANY_CASCADE:
ACCEPT

USER_ID_REFERENCE_MODEL:
ACCEPT

SCOPE_INTEGRITY:
PASS

ATOMIC_DISPATCH:
PASS

FAILURE_SETTLEMENT:
PASS

IDEMPOTENCY_MODEL:
PASS

DEDUPE_UNIQUENESS:
REQUIRED_AMENDMENT

PAYLOAD_SECURITY:
PASS

REGISTRY_BOUNDARY:
PASS

COMPATIBILITY_DEFAULTS:
PASS

RETENTION_ENFORCEMENT:
PASS

REPLAY_SECURITY:
PASS

OBSERVABILITY_LEAKAGE:
PASS

CRON_SECURITY:
ISSUE

MIGRATION_SHAPE:
ONE_MIGRATION_ACCEPTABLE

MIGRATION_FILES_CREATED:
NONE

CODE_CHANGED:
NO

DATABASE_MUTATION:
NONE

STAGING_MUTATION:
NONE

PRODUCTION_MUTATION:
NONE

READY_FOR_COORDINATOR_IMPLEMENTATION_DECISION:
YES
```

This is a security design approval with explicit requirements, not implementation authorization.

**STOP — END OF MISSION**
