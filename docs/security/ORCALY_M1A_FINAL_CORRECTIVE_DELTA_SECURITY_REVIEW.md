# ORÇALY — M1A FINAL CORRECTIVE FOLLOW-UP — SECURITY DELTA REVIEW

**Status:** FINAL_SECURITY_DELTA_REVIEW_AUTHORIZED  
**Implementation:** NOT AUTHORIZED  
**Code changes:** NOT AUTHORIZED  
**Migration creation/modification:** NOT AUTHORIZED  
**Database mutation:** NOT AUTHORIZED  
**Staging mutation:** NOT AUTHORIZED  
**Production mutation:** NOT AUTHORIZED  
**Main merge:** NOT AUTHORIZED  
**Event Fabric activation:** NOT AUTHORIZED  

**Repository:** `viniciusaraujoop/grafica-flash`  
**Exact implementation target:** `82056e08a0cdecf4a7f18146325ee83359828e95`  
**Corrective base:** `a4dfbeb52534c5718a3a92f42ab1aa4ca0b8808c`  
**Previous delta review:** `8b4d48b46c806d5406db14dc5b90c02dc0af1551`  
**Previous result:** HOLD  
**Review branch:** `security/m1a-final-corrective-delta-review`  
**Review date:** 2026-09-29

---

# 1. Executive Decision

```
M1A_FINAL_SECURITY_DELTA_REVIEW:
PASS_WITH_REQUIREMENTS
```

The single remaining P2 from the prior delta review is resolved.

The final corrective delta now enforces database-time eligibility at **both** state-mutating boundaries:

1. `orcaly_dispatch_outbox_event`;
2. `orcaly_settle_outbox_failure`.

The relay also:

- restores a DB-time candidate prefilter using PostgREST/PostgreSQL `now`;
- treats settlement `false` as **no mutation**, not successful settlement;
- does not increment retry/needs-attention metrics when the settlement RPC returns false.

No new P1/P2 was found.

The remaining requirement is independent transactional QA by Agent 3. This review was explicitly read-only and therefore did not insert staging fixtures to exercise the DB function dynamically.

That is an evidence handoff requirement, not a design/security defect.

`READY_FOR_AGENT3_INDEPENDENT_QA: YES`

---

# 2. Exact Target / Delta Scope

Exact target reviewed:

`82056e08a0cdecf4a7f18146325ee83359828e95`

The existing review branch is based exactly on that SHA.

Target content was reviewed by immutable SHA.

`TARGET_DRIFT: NO`

Delta from `a4dfbeb52534c5718a3a92f42ab1aa4ca0b8808c`:

- 4 commits;
- exactly 3 files.

Observed:

1. `lib/event-fabric/relay.ts`
2. `scripts/verify-m1a-event-fabric.mjs`
3. `supabase/migrations/20260929225302_m1a_event_fabric_failure_settlement_due_guard.sql`

No additional file exists in the delta.

`DELTA_SCOPE: PASS`

---

# 3. Migration Immutability

## Migration 1

`20260929211421_m1a_event_fabric_safety_contract.sql`

Blob before:

`a6f047f4e31c96dc32c89c04b117ffe75539589f`

Blob after:

`a6f047f4e31c96dc32c89c04b117ffe75539589f`

`MIGRATION_1_IMMUTABLE: PASS`

## Migration 2

`20260929222634_m1a_event_fabric_dispatch_eligibility_fix.sql`

Blob before:

`eecf69b692e88603ef28a9f7298e67fb1f029a14`

Blob after:

`eecf69b692e88603ef28a9f7298e67fb1f029a14`

`MIGRATION_2_IMMUTABLE: PASS`

Migration 3 is the only new migration.

---

# 4. Migration 3 Scope

New migration:

`20260929225302_m1a_event_fabric_failure_settlement_due_guard.sql`

It only:

1. redefines `public.orcaly_settle_outbox_failure`;
2. preserves/re-establishes the narrow RPC grant boundary.

No table, index, trigger, policy, unrelated function or M1B–M1E object is introduced.

`MIGRATION_3_SCOPE: PASS`

---

# 5. Staging Ledger / Fixtures

Staging:

`zwxulgpjucxudadjdqov`

Read-only inspection confirms exactly one ledger occurrence of each:

- `20260929211421 / m1a_event_fabric_safety_contract`
- `20260929222634 / m1a_event_fabric_dispatch_eligibility_fix`
- `20260929225302 / m1a_event_fabric_failure_settlement_due_guard`

Current row counts:

- transactional_outbox = 0
- background_jobs = 0
- event_idempotency = 0

No fixture remains.

`STAGING_LEDGER: PASS`

`STAGING_FIXTURES_REMAINING: 0`

---

# 6. Production Untouched

Production:

`ozrasuktfthsvbqprtel`

Read-only inspection confirms:

- zero M1A migration ledger entries among the three M1A versions;
- final settlement due guard not present.

No production mutation, environment change or Event Fabric activation occurred.

`PRODUCTION_UNTOUCHED: PASS`

---

# 7. Settlement DB-Time Guard

The live staging definition of:

`public.orcaly_settle_outbox_failure`

now performs:

1. load exact event;
2. `FOR UPDATE`;
3. not found → false;
4. completed → false;
5. unsupported status → false;
6. when status is queued/retrying:
   - if `available_at > now()` → false;
7. only then:
   - attempts increment;
   - retry time calculation;
   - status/error lifecycle update;
   - true return.

The authoritative due decision therefore occurs while the exact source row is locked and uses PostgreSQL time.

`SETTLEMENT_DB_TIME_GUARD: PASS`

---

# 8. Future queued/retrying No-Mutation Guarantee

For a future queued/retrying row, the false return occurs before:

- `v_attempts := attempts + 1`;
- UPDATE;
- status change;
- available_at change;
- last_error change;
- processed_at change;
- any job operation.

Therefore the function consumes zero retry budget.

The function contains no background-job mutation at all.

`FUTURE_INVALID_CONTRACT_NO_MUTATION: PASS`

`FUTURE_NO_CONSUMER_NO_MUTATION: PASS`

These conclusions are based on the **live staging function definition and mutation ordering**.

No synthetic database fixture was inserted by this read-only review.

Agent 3 should independently execute the transactional fixtures.

---

# 9. Processing Exception

`processing` is intentionally not covered by the future-`available_at` guard.

That is correct.

A processing row may represent a dispatch that was already eligible when it entered processing and later failed.

Blocking settlement merely because its historical `available_at` is future or was modified would risk a stuck processing lifecycle.

Processing rows remain settleable.

`PROCESSING_FAILURE_SETTLEMENT: PASS`

---

# 10. Boolean Settlement Contract

The function returns:

- `true` only after settlement mutation;
- `false` when no settlement mutation occurs.

Observed false paths include:

- row not found;
- completed;
- unsupported status;
- queued/retrying but not due.

The relay captures the scalar result:

`data: settled`

and returns:

`settled === true`.

It does not interpret false as successful mutation.

`SETTLEMENT_BOOLEAN_CONTRACT: PASS`

---

# 11. Relay DB-Time Prefilter

The candidate query now contains:

`.lte('available_at', 'now')`

It does not use:

- `new Date()`;
- `Date.now()`;

for candidate due eligibility.

Supabase JS `.lte()` is a PostgREST filter operation whose value is passed to the PostgreSQL comparison for the typed column.

Read-only staging verification also confirmed:

`'now'::timestamptz`

resolves to the same database instant as:

`now()`

inside the database statement.

Therefore the relay candidate prefilter uses PostgreSQL timestamp semantics rather than application wall-clock time.

The prefilter remains only an optimization.

The settlement and dispatch RPC row-lock guards remain authoritative.

`RELAY_DB_TIME_PREFILTER: PASS`

---

# 12. Clock / Race Model

## Application clock ahead

Candidate eligibility does not use Node/application clock.

No early mutation follows from application wall-clock skew.

## Application clock behind

Same result: candidate eligibility is DB-side.

## Row rescheduled after candidate read

The settlement or dispatch function re-loads and locks the exact row.

If queued/retrying becomes future before settlement lock:

- settlement returns false;
- no budget is consumed.

If it becomes future before dispatch lock:

- dispatch returns not_due;
- no dispatch mutation occurs.

## Two relay invocations

Both may observe a candidate.

The row-locking RPC determines authoritative mutation eligibility.

One relay cannot force the second to consume another failure budget when the row has become non-eligible/unsupported.

## Candidate due at read, future at settlement

Settlement returns false under lock.

## Invalid contract before dispatch

Relay may call failure settlement.

The settlement RPC independently guards due time.

## No consumer before dispatch

Same protection.

`CLOCK_RACE_MODEL: PASS`

---

# 13. Relay False Handling

## No-consumer path

Relay calls settlement.

If settlement returns true:

- needsAttention increments.

If settlement returns false:

- needsAttention does not increment;
- `settlementSkipped` increments.

## Catch / invalid-contract path

If settlement returns true:

- retrying or needsAttention increments as appropriate.

If settlement returns false:

- neither retrying nor needsAttention increments;
- `settlementSkipped` increments.

Therefore false is not reported as a successful lifecycle mutation.

`RELAY_FALSE_SETTLEMENT_HANDLING: PASS`

---

# 14. Relay Failure Path / Loop Behavior

The final delta introduces no security-relevant infinite mutation loop.

A row skipped because it is future is normally excluded by the DB-time prefilter on the next relay query until due.

If it was returned due and then rescheduled future during the race window, the authoritative settlement/dispatch guard prevents mutation.

The relay:

- executes no handler;
- logs no payload;
- logs no cron secret;
- does not report false settlement as success.

`RELAY_NOT_DUE_HANDLING: PASS`

---

# 15. Retry Timing

`retryAt()` still proposes a retry timestamp from application time.

This is not an early-mutation authority.

The DB settlement function clamps the accepted timestamp relative to DB `now()`:

- minimum: DB now + 1 second;
- maximum: DB now + 15 minutes.

Therefore remaining application/DB clock skew can affect the bounded future retry proposal but cannot bypass the DB-time eligibility guard or cause premature settlement.

This does not reopen the previous P2.

`DUE_FAILURE_SETTLEMENT: PASS`

---

# 16. Due Failure Settlement

When queued/retrying is already due:

- the guard does not return false;
- attempts increments exactly once in settlement;
- retryable + remaining budget → retrying;
- exhausted/non-retryable → needs_attention;
- retry time remains DB-bounded;
- last_error remains bounded to 2000 chars;
- function returns true.

`DUE_FAILURE_SETTLEMENT: PASS`

---

# 17. Previous P2 Regression Check

The final three-file delta does not modify:

`orcaly_dispatch_outbox_event`

Migration 2 remains blob-identical.

The previous dispatch DB-time fix therefore remains intact.

The final delta does not modify:

`lib/event-fabric/contracts.ts`

Its blob is unchanged from the prior corrective base.

Therefore these previously resolved findings remain intact:

- dispatch DB-time eligibility;
- dispatch not_due state preservation;
- aggregate contract model;
- order aggregate binding;
- proposal aggregate binding;
- confused-deputy prevention.

`ATOMIC_DISPATCH_REGRESSION: PASS`

`AGGREGATE_CONTRACT_REGRESSION: PASS`

---

# 18. RPC Security Regression

Live staging `orcaly_settle_outbox_failure` remains:

- SECURITY DEFINER;
- search_path = pg_catalog;
- PUBLIC EXECUTE: false;
- anon EXECUTE: false;
- authenticated EXECUTE: false;
- service_role EXECUTE: true.

No browser/Data API mutation path was introduced by this delta.

`RPC_SECURITY_REGRESSION: PASS`

---

# 19. Frozen Security Boundaries

The exact three-file delta does not modify:

- claim_background_jobs;
- claim_event_fabric_jobs;
- scope-aware dedupe indexes;
- cron route/auth;
- dedicated Event Fabric secret;
- feature gate implementation;
- handler registry;
- worker;
- contracts;
- health;
- notification code.

Blob checks confirm those reviewed files are unchanged from the previous corrective base.

Handler registry remains:

`buildHandlerRegistry([])`

Therefore:

`CLAIM_ISOLATION_REGRESSION: PASS`

`SCOPE_DEDUPE_REGRESSION: PASS`

`FEATURE_GATE: PASS`

`HANDLER_REGISTRY_EMPTY: YES`

---

# 20. Test Delta

The verifier preserves the prior M1A assertions and adds source-level checks for:

- migration 3;
- settlement guard ordering;
- false/true settlement source contract;
- relay DB-time prefilter;
- absence of application-time candidate eligibility;
- boolean settlement handling;
- no-consumer false metric behavior;
- catch-path false metric behavior;
- previous dispatch assertions;
- previous aggregate assertions;
- explicit typecheck;
- scoped lint.

`TEST_DELTA: PASS`

Important evidence distinction:

- these are static/source/runtime-local contract tests;
- this security review did **not** run staging transactional fixture mutations;
- Agent 3 remains responsible for executed DB fixtures proving future invalid/no-consumer, due settlement, processing settlement and race behavior.

That QA requirement is why the overall verdict is `PASS_WITH_REQUIREMENTS` rather than an assertion that runtime certification is already complete.

---

# 21. Execution / Typecheck Evidence

Agent 1 reports for the exact target:

- TARGETED_TESTS: PASS
- FULL_TESTS: PASS
- TYPECHECK: PASS
- TYPECHECK_EXIT_CODE: 0
- LINT: PASS
- BUILD: PASS
- P1_NOTIFICATION_REGRESSION: PASS

The verifier itself explicitly invokes:

`npm run typecheck`

and requires exit status 0.

It also invokes scoped ESLint for the final delta.

Exact target Vercel deployment:

`dpl_2gaUbXRDrzLBemhveY4auMs7758w`

Deployment commit:

`82056e08a0cdecf4a7f18146325ee83359828e95`

State:

`READY`

GitHub combined Vercel status:

`success`

No hosted Event Fabric execution is inferred from deployment readiness.

`TYPECHECK_EVIDENCE: PRESENT`

---

# 22. Security Advisor

A fresh read-only staging security advisor check was reviewed.

No finding specific to the new M1A settlement RPC appeared.

Existing project-wide findings remain, including:

- RLS-enabled/no-policy informational notices on internal tables such as transactional_outbox/background_jobs/event_idempotency;
- the existing authenticated SECURITY DEFINER warning for `get_my_platform_admin_access()`.

These are not attributed to this final corrective delta.

This report does **not** claim staging has zero security advisories.

---

# 23. Hosted Runtime

Event Fabric remains feature-gated OFF by default.

No scheduler is introduced by this delta.

Hosted runtime execution is not required to resolve this final P2.

The previous staging runtime binding remained unverified, so no hosted Event Fabric call was executed.

No production secret/environment mutation occurred.

---

# 24. New P1/P2 Assessment

The remaining P2 is fully resolved.

No new P1/P2 was found in the exact three-file delta.

```
NEW_P1_P2:
NONE
```

The remaining work is execution evidence owned by Agent 3, not a security correction owned by Agent 4.

---

# 25. Agent 3 Required Independent QA

Agent 3 should now execute the transactional cases that this read-only review could only verify structurally:

1. future retrying + invalid contract:
   - settlement false;
   - attempts unchanged;
   - status unchanged;
   - available_at unchanged;
   - last_error unchanged;
   - jobs 0;
2. future retrying + no consumer:
   - same no-mutation result;
3. due retryable failure:
   - true;
   - one attempt;
   - retrying;
   - DB-bounded run_after;
4. due non-retryable:
   - true;
   - one attempt;
   - needs_attention;
5. processing failure:
   - remains settleable regardless of old available_at;
6. row rescheduled future between relay read and settlement:
   - false/no mutation;
7. two relay invocations:
   - no duplicate budget consumption;
8. preserve previous claim/dedupe/dispatch/aggregate/P1-notification regression suite.

---

# 26. Final Status

```
M1A_FINAL_SECURITY_DELTA_REVIEW:
PASS_WITH_REQUIREMENTS

TARGET_SHA:
82056e08a0cdecf4a7f18146325ee83359828e95

TARGET_DRIFT:
NO

DELTA_SCOPE:
PASS

MIGRATION_1_IMMUTABLE:
PASS

MIGRATION_2_IMMUTABLE:
PASS

MIGRATION_3_SCOPE:
PASS

STAGING_LEDGER:
PASS

PRODUCTION_UNTOUCHED:
PASS

SETTLEMENT_DB_TIME_GUARD:
PASS

FUTURE_INVALID_CONTRACT_NO_MUTATION:
PASS

FUTURE_NO_CONSUMER_NO_MUTATION:
PASS

DUE_FAILURE_SETTLEMENT:
PASS

PROCESSING_FAILURE_SETTLEMENT:
PASS

SETTLEMENT_BOOLEAN_CONTRACT:
PASS

RELAY_DB_TIME_PREFILTER:
PASS

RELAY_FALSE_SETTLEMENT_HANDLING:
PASS

CLOCK_RACE_MODEL:
PASS

ATOMIC_DISPATCH_REGRESSION:
PASS

AGGREGATE_CONTRACT_REGRESSION:
PASS

RPC_SECURITY_REGRESSION:
PASS

CLAIM_ISOLATION_REGRESSION:
PASS

SCOPE_DEDUPE_REGRESSION:
PASS

FEATURE_GATE:
PASS

HANDLER_REGISTRY_EMPTY:
YES

TEST_DELTA:
PASS

TYPECHECK_EVIDENCE:
PRESENT

STAGING_FIXTURES_REMAINING:
0

NEW_P1_P2:
NONE

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
YES
```

No code, migration or database correction was performed by Agent 4.

**STOP — END OF MISSION**
