# ORÇALY — M1A EVENT FABRIC STAGING IMPLEMENTATION SECURITY REVIEW

**Status:** IMPLEMENTATION_SECURITY_REVIEW_AUTHORIZED  
**Implementation changes:** NOT AUTHORIZED  
**Migration creation/modification:** NOT AUTHORIZED  
**Database mutation:** NOT AUTHORIZED  
**Staging mutation:** NOT AUTHORIZED  
**Production mutation:** NOT AUTHORIZED  
**Main merge:** NOT AUTHORIZED  
**Event Fabric activation:** NOT AUTHORIZED  

**Repository:** `viniciusaraujoop/grafica-flash`  
**Implementation branch:** `implement/m1a-event-fabric-staging`  
**Exact reviewed SHA:** `423f32dc0be34b8b9aaf7f87e67e9ba9ba529e63`  
**Authorized implementation base:** `34e7b8182eb077f1471d8c31f8169bd3227451e3`  
**Canonical main:** `fb2bf74090cb3f85df64187bd13a12d805b0a7a7`  
**Review date:** 2026-09-29

---

# 1. Executive Security Decision

```
M1A_IMPLEMENTATION_SECURITY_REVIEW:
HOLD
```

The implementation is substantially faithful to the frozen M1A design:

- diff scope matches the expected 10 files;
- the implementation branch is exactly at the requested SHA;
- the M1A migration exists once in staging;
- production remains untouched by M1A;
- scope-aware dedupe is correctly installed;
- claim isolation is correctly installed;
- privileged RPC grants and search paths are correctly hardened;
- browser/Data API access remains closed;
- outbox DELETE/TRUNCATE are revoked from ordinary service-role table access;
- the contract/handler registries are static;
- the dedicated Event Fabric cron secret is implemented;
- the legacy shared CRON_SECRET is not accepted by the Event Fabric route;
- privileged DB capability is loaded only after feature-gate and secret authentication;
- production handlers remain intentionally absent;
- no Event Fabric scheduler is enabled in `vercel.json`.

However, two P2 implementation defects block security approval:

1. **Atomic dispatch does not re-check `available_at <= DB current time` under the row lock.**
2. **The Event Contract Registry omits the frozen design's aggregate requirements, so `aggregate_type`, `aggregate_id` and payload resource identity are not cross-validated.**

The first defect is in the already-applied staging database function and therefore requires a schema follow-up. This review is not authorized to create or apply that correction.

Accordingly:

```
M1A_SCHEMA_FOLLOWUP_REQUIRED:
YES
```

No corrective action was performed.

---

# 2. Target / Drift / Diff Scope

Implementation branch live head:

`423f32dc0be34b8b9aaf7f87e67e9ba9ba529e63`

Requested target:

`423f32dc0be34b8b9aaf7f87e67e9ba9ba529e63`

`TARGET_DRIFT: NO`

Compare against authorized implementation base:

- ahead: 18 commits
- behind: 0
- changed files: exactly 10

Observed changed files:

1. `app/api/admin/system-health/route.ts`
2. `app/api/cron/event-fabric/route.ts`
3. `lib/event-fabric/contracts.ts`
4. `lib/event-fabric/handlers.ts`
5. `lib/event-fabric/health.ts`
6. `lib/event-fabric/relay.ts`
7. `lib/event-fabric/worker.ts`
8. `package.json`
9. `scripts/verify-m1a-event-fabric.mjs`
10. `supabase/migrations/20260929211421_m1a_event_fabric_safety_contract.sql`

No unexpected implementation file was found.

No M1B–M1E implementation was found in the delta.

`DIFF_SCOPE: PASS`

---

# 3. Migration Scope / Ledger

Staging project:

`zwxulgpjucxudadjdqov`

Read-only inspection confirms:

- migration version: `20260929211421`
- migration name: `m1a_event_fabric_safety_contract`
- ledger occurrence: exactly 1

Current staging row counts:

- `transactional_outbox = 0`
- `background_jobs = 0`
- `event_idempotency = 0`

The migration is additive to the existing shared Event Fabric objects.

No unrelated M1B–M1E schema object was observed in the migration.

The historical migrations were not modified by this target diff.

`MIGRATION_SCOPE: PASS`

---

# 4. Production Untouched

Production project:

`ozrasuktfthsvbqprtel`

Read-only inspection confirms:

- M1A migration ledger row: absent;
- M1A outbox additive columns: absent;
- M1A background-job additive columns: absent;
- M1A scope-aware indexes: absent;
- `claim_event_fabric_jobs`: absent;
- `orcaly_dispatch_outbox_event`: absent;
- `orcaly_settle_outbox_failure`: absent.

Current production counts observed:

- `transactional_outbox = 0`
- `background_jobs = 0`
- `event_idempotency = 0`

`PRODUCTION_UNTOUCHED: PASS`

No production mutation occurred in this review.

---

# 5. Staging Schema — Positive Findings

## transactional_outbox

Installed M1A fields include:

- `user_id uuid nullable`
- `producer text not null default 'business'`
- `event_version smallint not null default 1`
- `correlation_id uuid not null default gen_random_uuid()`
- `causation_id uuid nullable`
- `dedupe_key text nullable`

Constraints include:

- scope exclusivity;
- producer format/length;
- event version range;
- dedupe length;
- 32 KiB payload limit.

Existing company FK remains:

`company_id → companies(id) ON DELETE CASCADE`

## background_jobs

Installed M1A fields include:

- `user_id uuid nullable`
- `outbox_event_id uuid`
- `dedupe_key text nullable`
- `correlation_id uuid nullable`
- `job_version smallint not null default 1`

Source linkage:

`outbox_event_id → transactional_outbox(id) ON DELETE RESTRICT`

Constraints include:

- scope exclusivity;
- job version range;
- dedupe length;
- Event Fabric invariant requiring:
  - non-null dedupe key;
  - non-null correlation id;
  - <= 8 KiB job payload.

Existing company FK remains:

`company_id → companies(id) ON DELETE CASCADE`

This matches the approved additive compatibility model.

---

# 6. Scope-Aware Dedupe

Actual staging indexes correctly implement the required mutually exclusive scope identities.

## Outbox company

`(company_id, producer, event_type, dedupe_key)`

Predicate:

- dedupe non-null;
- company non-null;
- user null.

## Outbox personal

`(user_id, producer, event_type, dedupe_key)`

Predicate:

- dedupe non-null;
- user non-null;
- company null.

## Outbox platform

`(producer, event_type, dedupe_key)`

Predicate:

- dedupe non-null;
- company null;
- user null.

## Background job company

`(company_id, job_type, dedupe_key)`

## Background job personal

`(user_id, job_type, dedupe_key)`

## Background job platform

`(job_type, dedupe_key)`

The table scope checks prevent company + user simultaneously.

NULL dedupe keys intentionally receive no generic dedupe uniqueness.

No cross-tenant/cross-user uniqueness collision was found in the installed index design.

`SCOPE_AWARE_DEDUPE: PASS`

---

# 7. Claim Isolation

Actual staging `claim_background_jobs`:

- SECURITY DEFINER;
- search_path = pg_catalog;
- requires non-empty worker id;
- limit bounded 1..50;
- only `outbox_event_id IS NULL`;
- only queued/retrying;
- `run_after <= now()`;
- ordered by schedule/creation;
- `FOR UPDATE SKIP LOCKED`;
- increments attempts;
- writes locked_at/locked_by;
- writes started_at.

Actual staging `claim_event_fabric_jobs` has the same lifecycle properties but requires:

`outbox_event_id IS NOT NULL`

Consequences:

- Event Fabric worker cannot claim `integration.sync` / `google.calendar.full_resync` direct/shared jobs;
- generic worker cannot claim relay-derived Event Fabric jobs;
- both claims can execute concurrently without crossing the classification boundary.

Browser/authenticated callers cannot directly write the classification column because the table is internal and lacks browser table privileges.

`CLAIM_ISOLATION: PASS`

---

# 8. P2 IMPLEMENTATION DEFECT — Atomic Dispatch Eligibility

Classification:

**IMPLEMENTATION_DEFECT — P2**

Affected object:

`public.orcaly_dispatch_outbox_event`

The frozen design requires the atomic boundary to:

1. lock the exact row;
2. **verify it is still eligible**;
3. then dispatch.

The frozen relay contract also defines eligibility as:

- status queued/retrying;
- `available_at <= current DB time`.

The implementation does lock the exact row and validates status, but it does **not** validate:

`v_event.available_at <= now()`

after acquiring the row lock.

At the same time, `lib/event-fabric/relay.ts` performs candidate filtering with:

`new Date().toISOString()`

from the application runtime rather than DB current time.

## Security/integrity consequence

The trusted relay normally filters candidate rows first, but the DB RPC is the authoritative atomic boundary.

Without a DB-time eligibility check:

- application/DB clock skew can cause early dispatch;
- an internal service-role caller can invoke dispatch for a retrying event before `available_at`;
- a coding regression can bypass retry backoff without the database rejecting it;
- retry/load-control semantics are no longer enforced atomically by the function that owns dispatch state.

This is not a browser exploit because the RPC is service-role-only.

It is nevertheless an implementation defect in the privileged boundary and an activation blocker.

## Required correction

A follow-up migration must redefine `orcaly_dispatch_outbox_event` so that, after the row lock and before attempts/job creation, it refuses dispatch unless:

`available_at <= DB now()`

for queued/retrying rows.

The relay should also avoid treating application wall-clock time as the authoritative scheduling security boundary.

Because the function is already installed by an applied migration:

`M1A_SCHEMA_FOLLOWUP_REQUIRED: YES`

This review did not create that migration.

`ATOMIC_DISPATCH: ISSUE`

`RELAY_SECURITY: ISSUE`

---

# 9. Atomic Dispatch — Other Properties

Outside the eligibility defect, the installed function has strong fail-closed characteristics:

- exact outbox UUID required;
- p_jobs must be array;
- min 1 / max 20 specs;
- each spec must contain exactly:
  - job_type;
  - job_version;
  - max_attempts;
- job_type must be domain-qualified;
- version bounded 1..32767;
- max attempts bounded 1..25;
- duplicate job_type/version specs rejected;
- source row locked FOR UPDATE;
- producer/event/version rechecked;
- invalid company+user scope rejected;
- completed re-entry verifies all expected jobs exist;
- non-dispatchable statuses rejected;
- retry-budget exhaustion → needs_attention;
- deterministic job dedupe derived from source event UUID + job type + version;
- trusted scope copied from outbox columns;
- correlation copied from outbox column;
- job payload is minimal;
- `ON CONFLICT DO NOTHING` is followed by exact matching-row verification;
- all expected jobs are verified before outbox completion;
- no handler side effect occurs inside the RPC;
- transaction failure rolls back dispatch state/job inserts atomically.

## p_jobs trust boundary

`p_jobs` being supplied by a service-role relay is an:

**ACCEPTED_TRUST_BOUNDARY**

because:

- RPC is not callable by browser roles;
- relay builds specs from the static event contract registry;
- DB validates spec shape/bounds;
- worker later revalidates source event + handler allowlisting before side effect.

It must never be surfaced as a generic browser/user job creation RPC.

---

# 10. Failure Settlement

Actual staging `orcaly_settle_outbox_failure`:

- accepts no arbitrary status parameter;
- row-locks exact event;
- returns false for completed;
- mutates only queued/processing/retrying;
- increments attempts;
- retryable + remaining budget → retrying;
- otherwise → needs_attention;
- clamps future retry to max 15 minutes;
- enforces at least 1 second future;
- truncates stored error to 2000 chars;
- never deletes.

## Attempt-count review

No double-count defect was established.

If `orcaly_dispatch_outbox_event` raises during its transaction after an attempt increment, PostgreSQL rolls the failed function statement/transactional work back; the subsequent failure settlement then increments the durable attempt once.

Validation/no-consumer failures that occur before dispatch also consume one attempt through failure settlement.

`FAILURE_SETTLEMENT: PASS`

---

# 11. P2 IMPLEMENTATION DEFECT — Aggregate Contract Integrity

Classification:

**IMPLEMENTATION_DEFECT — P2**

Affected object:

`lib/event-fabric/contracts.ts`

The frozen design states that each event contract includes aggregate requirements and that relay validation checks aggregate fields required by the contract.

The implementation's `EventContract` type currently includes:

- producer;
- eventType;
- eventVersion;
- scopeKinds;
- consumers;
- validatePayload.

It does **not** model aggregate requirements.

`validateEventRecord()` does not validate:

- `aggregate_type`;
- `aggregate_id`;
- relationship between aggregate ID and payload resource ID.

For current Business events, the frozen contract should be capable of asserting conceptually:

- order.* → aggregate_type = order;
- aggregate_id = payload.order_id;
- proposal.accepted → aggregate_type = proposal;
- aggregate_id = payload.proposal_id.

## Security consequence

Current production handler registry is empty, so this does not currently create an exploitable side effect.

However, once a real handler exists, contradictory event identity can create a confused-deputy class of bug if:

- authorization uses aggregate identity;
- execution uses payload identity;

or vice versa.

The foundation is specifically intended to make these contracts explicit before consumers are activated.

Required correction is application-code-only, but code changes are not authorized in this review.

`CONTRACT_REGISTRY: ISSUE`

Activation must remain blocked until aggregate contract integrity is implemented and independently tested.

---

# 12. Contract Registry — Positive Findings

Current allowlisted event contracts are only:

- business / order.created / v1;
- business / order.ready / v1;
- business / payment.confirmed / v1;
- business / proposal.accepted / v1.

All are company scope only.

All currently have:

`consumers: []`

No fake/no-op consumer exists.

Payload validation uses:

- plain-object validation;
- exact allowed key sets;
- UUID validation;
- bounded strings;
- 32 KiB serialized payload limit;
- recursive forbidden-key scan.

Unexpected top-level fields are rejected.

Platform scope is not implicitly permitted by current Business contracts.

---

# 13. Secret / Payload Review

Recursive secret-key traversal exists through nested objects/arrays.

Key normalization is case/separator insensitive by:

lowercase + removal of non-alphanumerics.

Examples caught:

- access_token → accesstoken;
- access-token → accesstoken;
- AccessToken → accesstoken;
- API_KEY → apikey;
- OAuth code key → oauthcode.

Current exact Business schemas make arbitrary nested credential structures impossible because the allowed fields are scalar UUID/string values.

## Hardening recommendation

Classification:

**HARDENING_RECOMMENDATION — P3**

The generic forbidden-key set should be expanded before future nested contracts are introduced.

For example, `credential_bundle` normalizes to `credentialbundle`, which is not currently an explicit set member.

Similarly, future secret-class aliases such as `client_secret` should be reviewed.

This is not a current P1/P2 defect because:

- exact current payload schemas reject unexpected fields;
- no nested payload object is accepted by the four current contracts;
- there are no production handlers.

`PAYLOAD_SECURITY: PASS WITH P3 HARDENING`

---

# 14. Handler Registry

Current implementation:

- static TypeScript registry;
- no DB registry;
- job_type domain-qualified validation;
- version bounded;
- maxAttempts bounded;
- duplicate job_type/version ownership rejected;
- handler interface structurally requires:
  - authorize();
  - isAlreadyApplied();
  - execute();
- production registry intentionally empty.

No dynamic module path, eval, reflection or payload-selected function exists.

`HANDLER_REGISTRY: PASS`

Future handler registration must also be checked against known legacy/direct job_type ownership so a new Event Fabric handler does not accidentally reuse an existing non-Event-Fabric job family name.

That is a future registration QA requirement, not a current defect.

---

# 15. Worker Security

Actual Event Fabric worker calls only:

`claim_event_fabric_jobs`

It does not call:

`claim_background_jobs`.

For each claimed row it verifies:

- job UUID;
- outbox UUID;
- correlation UUID;
- <= 8 KiB job payload;
- exact handler presence;
- source outbox exists;
- source event contract valid;
- company equality;
- user equality;
- correlation equality;
- handler accepts exact producer/event/version;
- handler authorization hook;
- handler domain-idempotency hook;
- execute only after those checks;
- settlement through existing lease-bound function.

Unknown handler → needs_attention.

Source missing → needs_attention.

Scope/correlation mismatch → needs_attention.

Handler/event mismatch → needs_attention.

Authorization denial cannot execute the side effect.

Domain action already applied → completed without re-executing.

Lease ownership is not treated as authorization.

`WORKER_SECURITY: PASS`

`AUTHORIZATION_MODEL: PASS`

## P3 worker hardening

The current worker checks job payload size but does not require the relay-created payload to be exactly the expected minimal shape, e.g.:

`{ outbox_event_id: <matching UUID> }`.

Because service_role is the accepted trusted DB boundary and the worker never uses job payload as authorization, this is not a current P1/P2 defect.

Before real handlers use job payload fields, the job envelope should be positively validated or handlers should derive all trusted execution context from the source event/columns.

---

# 16. SECURITY DEFINER / Search Path

Actual staging privileged functions reviewed:

- claim_background_jobs;
- claim_event_fabric_jobs;
- orcaly_dispatch_outbox_event;
- orcaly_settle_outbox_failure;
- settle_background_job;
- recover_stale_background_jobs.

All reviewed functions:

- SECURITY DEFINER;
- fixed `search_path = pg_catalog`;
- schema-qualify target public tables in function bodies;
- contain no dynamic SQL;
- contain no payload-derived SQL object names;
- do not infer end-user authorization from function caller.

`SECURITY_DEFINER: PASS`

`SEARCH_PATH: PASS`

---

# 17. RPC Grants

Live staging function privileges:

For all reviewed privileged functions:

- PUBLIC EXECUTE: false;
- anon EXECUTE: false;
- authenticated EXECUTE: false;
- service_role EXECUTE: true.

This includes new/redefined M1A functions and existing job settlement/stale recovery functions.

`RPC_GRANTS: PASS`

---

# 18. Table Security / Data API

Live staging:

## transactional_outbox

- RLS enabled;
- no RLS policies;
- no anon grants;
- no authenticated grants;
- service_role retains:
  - INSERT;
  - SELECT;
  - UPDATE;
  - REFERENCES;
  - TRIGGER.

DELETE: revoked.

TRUNCATE: revoked.

## background_jobs

- RLS enabled;
- no RLS policies;
- no anon grants;
- no authenticated grants;
- service_role existing broad internal privileges remain.

## event_idempotency

- RLS enabled;
- no RLS policies;
- no anon grants;
- no authenticated grants.

No browser publishing path was found.

`TABLE_GRANTS: PASS`

`OUTBOX_DELETE_REVOKED: PASS`

`OUTBOX_TRUNCATE_REVOKED: PASS`

## P3 least-privilege note

`transactional_outbox` still exposes `REFERENCES` and `TRIGGER` table privileges to service_role from the historical broad grant.

They are not required by the normal M1A runtime.

This is a defense-in-depth hardening item, not a current P1/P2 browser/service exploit, because the service-role API capability does not itself provide arbitrary SQL DDL execution.

Do not expand this review into an unrelated privilege rewrite without migration-owner authorization.

---

# 19. Relay Security

Positive controls:

- bounded candidate read;
- queued/retrying only;
- availability prefilter;
- oldest-first ordering;
- exact event contract validation;
- no-consumer → failure settlement / needs_attention;
- consumer specs only from static registry;
- relay does not execute handler;
- atomic dispatch RPC used;
- failure reason sanitized;
- no raw payload logged.

Race model:

Two relays may observe one candidate.

DB row lock + deterministic enqueue + exact existence verification provide safe duplicate dispatch behavior.

The blocking issue is the missing DB-time availability recheck in the atomic RPC, documented in Finding #1.

`RELAY_SECURITY: ISSUE`

---

# 20. Dedicated Cron Authentication

Actual route:

`app/api/cron/event-fabric/route.ts`

Positive controls:

- Node runtime;
- dedicated `ORCALY_EVENT_FABRIC_CRON_SECRET`;
- no use of `process.env.CRON_SECRET`;
- Authorization Bearer only;
- no query-string secret;
- no cookie fallback;
- no session fallback;
- timingSafeEqual;
- unequal byte lengths fail safely;
- missing configured secret → 503;
- missing/invalid supplied secret → 401;
- feature gate checked first;
- service-role module dynamically imported only after:
  - feature enabled;
  - secret configured;
  - supplied secret authenticated.

Therefore unauthorized requests execute no Event Fabric service-role DB/RPC work through this route.

`DEDICATED_CRON_SECRET: PASS`

`LEGACY_CRON_SECRET_REJECTED: PASS`

`SERVICE_ROLE_AFTER_AUTH: PASS`

---

# 21. Feature Gate / Activation

`ORCALY_EVENT_FABRIC_ENABLED` is true only for explicit normalized value `true`.

Missing/empty/other values are OFF.

No automatic activation exists.

Repository `vercel.json` contains no Event Fabric cron schedule.

No code introduced production secret configuration.

`FEATURE_GATE: PASS`

---

# 22. Health / Observability

Event Fabric health helper reads:

- counts;
- event/job ids;
- type;
- status;
- timestamps/age;
- outbox_event_id.

It does not SELECT payload.

Event Fabric jobs are explicitly filtered by:

`outbox_event_id IS NOT NULL`.

Health returns Unknown on read failure.

Disabled relay + backlog → Degraded.

Persisted processing row while enabled → Down.

Admin system-health remains behind:

`requirePlatformAdmin(request, 'system.read')`.

No M1A change weakened that admin boundary.

`OBSERVABILITY: PASS`

---

# 23. Logging

Reviewed Event Fabric logging includes:

- event name;
- invocation ID;
- environment name;
- bounded summaries/counts;
- duration;
- outbox event id/type on relay settlement failure;
- sanitized diagnostic reason.

No code path was found logging:

- event payload;
- job payload;
- Authorization header;
- cron secret;
- Supabase service key;
- provider credential;
- cookie;
- raw credential bundle.

`LOGGING: PASS`

---

# 24. Test Quality / Evidence

## Static contract test

`scripts/verify-m1a-event-fabric.mjs` provides useful source-contract assertions for:

- additive columns;
- scope-aware indexes;
- claim predicates;
- SKIP LOCKED presence;
- DELETE/TRUNCATE revocation text;
- SECURITY DEFINER/search_path text;
- RPC revoke/grant text;
- payload bounds;
- current event contracts;
- no fake consumers;
- nested secret check;
- worker claim selection;
- relay RPC usage;
- empty handler registry;
- dedicated cron secret;
- no legacy secret fallback;
- feature gate;
- service-role source order;
- health select fields;
- no Event Fabric scheduler;
- package test integration.

This is meaningful static coverage.

It does **not** execute:

- Postgres concurrency;
- RPC grants against real roles;
- wrong-worker settlement;
- duplicate dispatch races;
- unique-index cross-tenant fixtures;
- transaction rollback;
- tenant cascade behavior.

Those remain Agent 3 responsibilities.

`TEST_QUALITY: PARTIAL`

## Existing evidence

Mission handoff reports:

- targeted tests: PASS;
- full tests: PASS;
- lint: PASS;
- build: PASS;
- P1 notification regression: PASS.

The exact target SHA has Vercel status SUCCESS and exact deployment:

`dpl_FsbxzoUuM6Vt9KagxfxTHCkWCoyw`

State:

`READY`

Commit:

`423f32dc0be34b8b9aaf7f87e67e9ba9ba529e63`

No GitHub Actions run was found for this SHA.

An explicit standalone `npm run typecheck` result was not independently available.

Per the mission requirement, build success is not being relabeled as explicit typecheck evidence.

`TYPECHECK_EVIDENCE: MISSING`

---

# 25. Hosted Runtime Security Test

The exact Preview is confirmed as READY at the exact target SHA.

However, this review could not independently prove that the Preview's runtime Supabase binding points to staging project:

`zwxulgpjucxudadjdqov`

without relying on secret/environment assumptions.

Therefore the Event Fabric cron route was **not executed** against the hosted Preview.

This follows the frozen review governance.

`HOSTED_RUNTIME_SECURITY_TEST: NOT_RUN_UNVERIFIED_BINDING`

---

# 26. Company CASCADE / outbox_event_id RESTRICT

Installed schema preserves:

- outbox.company_id → companies ON DELETE CASCADE;
- jobs.company_id → companies ON DELETE CASCADE;
- jobs.outbox_event_id → outbox ON DELETE RESTRICT.

This preserves the intended restrictive direct deletion semantics between Event Fabric jobs and source outbox events.

The interaction of the two company cascades with the restrictive job→outbox link should be covered by Agent 3's controlled tenant-delete fixture.

No rows were inserted during this security review, so no claim of executed hard-delete behavior is made.

Classification:

**QA_EVIDENCE_GAP**

No schema defect is asserted from this point alone.

---

# 27. Threat Matrix

| ID | Threat | Result |
|---|---|---|
| T1 | anon calls M1A RPC | PASS — EXECUTE denied |
| T2 | authenticated calls M1A RPC | PASS — EXECUTE denied |
| T3 | browser writes outbox/jobs | PASS — no table grants |
| T4 | generic worker captures EF job | PASS — NULL-only generic claim |
| T5 | EF worker captures integration/calendar job | PASS — non-NULL-only EF claim |
| T6 | duplicate relay dispatch | PASS by design; execution concurrency still Agent 3 QA |
| T7 | cross-company dedupe collision | PASS — company scope in uniqueness |
| T8 | cross-user dedupe collision | PASS — user scope in uniqueness |
| T9 | malicious payload scope override | PASS — columns are authoritative |
| T10 | malicious job_type injection | PASS at browser boundary; p_jobs service-role trust accepted |
| T11 | malformed p_jobs | PASS — exact DB validation |
| T12 | duplicate job specs | PASS — rejected |
| T13 | unknown event contract | PASS — contract error / needs_attention |
| T14 | no authorized consumer | PASS — needs_attention |
| T15 | unknown job handler | PASS — needs_attention |
| T16 | wrong worker settles job | PASS by function contract; runtime execution test pending Agent 3 |
| T17 | replay after authorization changes | PASS foundation — authorize() is mandatory before execute |
| T18 | secret-bearing payload | PASS current exact contracts; P3 scanner hardening noted |
| T19 | oversized payload | PASS — DB + runtime bounds |
| T20 | legacy CRON_SECRET used on EF route | PASS — not referenced |
| T21 | query-string secret | PASS — no query parser |
| T22 | feature disabled but auth valid | PASS — exits before DB |
| T23 | unauth request triggers service role | PASS — import occurs after auth |
| T24 | health leaks payload/secret | PASS |
| T25 | service_role DELETE/TRUNCATE outbox | PASS — revoked |
| T26 | known correlation/outbox UUID as auth | PASS — no browser RPC/table boundary |
| T27 | malicious/direct service process sets outbox_event_id | ACCEPTED TRUST BOUNDARY + worker source/scope/handler revalidation |
| T28 | partial dispatch transaction failure | PASS by transaction design; executable rollback fixture remains Agent 3 QA |
| T29 | retry event dispatched before available_at | **ISSUE — P2** |

---

# 28. Findings Classification

## M1A-I1 — Missing DB-time dispatch eligibility check

Classification:

`IMPLEMENTATION_DEFECT`

Severity:

`P2`

Status:

**BLOCKER**

Correction requires schema/function follow-up.

## M1A-I2 — Missing aggregate contract requirements

Classification:

`IMPLEMENTATION_DEFECT`

Severity:

`P2`

Status:

**BLOCKER**

Correction is application-code-level but not authorized here.

## M1A-H1 — Expand generic secret key aliases before nested future contracts

Classification:

`HARDENING_RECOMMENDATION`

Severity:

`P3`

## M1A-H2 — Remove unnecessary REFERENCES/TRIGGER table privileges from ordinary outbox service-role access when safely owned by migration governance

Classification:

`HARDENING_RECOMMENDATION`

Severity:

`P3`

## M1A-Q1 — Static tests do not prove Postgres concurrency/authorization

Classification:

`QA_EVIDENCE_GAP`

Owner:

Agent 3 independent QA.

## M1A-Q2 — Explicit typecheck evidence unavailable

Classification:

`QA_EVIDENCE_GAP`

## M1A-Q3 — Hosted Preview staging binding unverified

Classification:

`QA_EVIDENCE_GAP`

## M1A-T1 — p_jobs supplied only by authenticated service-role runtime

Classification:

`ACCEPTED_TRUST_BOUNDARY`

---

# 29. Required Follow-Up Before Independent QA

Because the review found P2 implementation defects, the current target is not ready to be certified by Agent 3 as a release candidate.

Required Coordinator/implementation follow-up:

1. create a separately authorized corrective schema migration that redefines `orcaly_dispatch_outbox_event` to enforce DB-time `available_at` eligibility under lock;
2. update the Event Contract Registry to model and validate aggregate requirements, including resource ID consistency;
3. update static tests to assert both requirements;
4. run explicit typecheck;
5. then hand the new exact SHA to Agent 3 for:
   - DB concurrency;
   - role grants;
   - duplicate dispatch;
   - wrong-worker settlement;
   - scope-aware dedupe fixtures;
   - transaction rollback;
   - tenant-delete cascade/restrict behavior;
   - hosted route tests only after staging binding is proven.

This document does not authorize any of those modifications.

---

# 30. Final Status

```
M1A_IMPLEMENTATION_SECURITY_REVIEW:
HOLD

TARGET_SHA:
423f32dc0be34b8b9aaf7f87e67e9ba9ba529e63

TARGET_DRIFT:
NO

DIFF_SCOPE:
PASS

MIGRATION_SCOPE:
PASS

STAGING_SCHEMA:
ISSUE

PRODUCTION_UNTOUCHED:
PASS

CLAIM_ISOLATION:
PASS

SCOPE_AWARE_DEDUPE:
PASS

ATOMIC_DISPATCH:
ISSUE

FAILURE_SETTLEMENT:
PASS

SECURITY_DEFINER:
PASS

SEARCH_PATH:
PASS

RPC_GRANTS:
PASS

TABLE_GRANTS:
PASS

OUTBOX_DELETE_REVOKED:
PASS

OUTBOX_TRUNCATE_REVOKED:
PASS

CONTRACT_REGISTRY:
ISSUE

HANDLER_REGISTRY:
PASS

RELAY_SECURITY:
ISSUE

WORKER_SECURITY:
PASS

AUTHORIZATION_MODEL:
PASS

DEDICATED_CRON_SECRET:
PASS

LEGACY_CRON_SECRET_REJECTED:
PASS

SERVICE_ROLE_AFTER_AUTH:
PASS

FEATURE_GATE:
PASS

OBSERVABILITY:
PASS

LOGGING:
PASS

TEST_QUALITY:
PARTIAL

TYPECHECK_EVIDENCE:
MISSING

HOSTED_RUNTIME_SECURITY_TEST:
NOT_RUN_UNVERIFIED_BINDING

M1A_SCHEMA_FOLLOWUP_REQUIRED:
YES

CODE_CHANGED:
NO

MIGRATIONS_CREATED:
NONE

DATABASE_MUTATION:
NONE

STAGING_MUTATION:
NONE

PRODUCTION_MUTATION:
NONE

READY_FOR_AGENT3_INDEPENDENT_QA:
NO
```

No code, migration or database correction was made.

**STOP — END OF MISSION**
