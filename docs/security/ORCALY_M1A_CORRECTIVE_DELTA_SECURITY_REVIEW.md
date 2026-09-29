# ORÇALY — M1A CORRECTIVE FOLLOW-UP — SECURITY DELTA REVIEW

**Status:** SECURITY_DELTA_REVIEW_AUTHORIZED  
**Implementation:** NOT AUTHORIZED  
**Code changes:** NOT AUTHORIZED  
**Migration creation/modification:** NOT AUTHORIZED  
**Database mutation:** NOT AUTHORIZED  
**Staging mutation:** NOT AUTHORIZED  
**Production mutation:** NOT AUTHORIZED  
**Main merge:** NOT AUTHORIZED  
**Event Fabric activation:** NOT AUTHORIZED  

**Repository:** `viniciusaraujoop/grafica-flash`  
**Corrective branch:** `fix/m1a-event-fabric-staging-followup`  
**Exact reviewed SHA:** `a4dfbeb52534c5718a3a92f42ab1aa4ca0b8808c`  
**Corrective base:** `423f32dc0be34b8b9aaf7f87e67e9ba9ba529e63`  
**Previous security review:** `14acb2958a92e746f0bb9bd5ff7e002ccc2bd0f2`  
**Previous result:** HOLD  
**Review date:** 2026-09-29

---

# 1. Executive Delta Decision

```
M1A_CORRECTIVE_SECURITY_DELTA_REVIEW:
HOLD
```

Both original P2 blockers are corrected in their intended locations:

1. the live staging dispatch RPC now enforces DB-time `available_at` eligibility after locking the source row and before attempt/status/job mutation;
2. the TypeScript Event Contract Registry now statically binds aggregate semantics and rejects contradictory aggregate/payload resource identities.

However, the corrective relay change introduced a **new P2 lifecycle-integrity regression**:

- the relay removed its `available_at` candidate filter;
- it performs contract validation and the no-consumer failure path **before** calling `orcaly_dispatch_outbox_event`;
- those pre-dispatch paths call `orcaly_settle_outbox_failure`, which does not enforce DB-time due eligibility.

Therefore a future `queued/retrying` event whose `available_at` is still in the future can still have its state/attempt budget mutated before it is due when:

- the event contract is invalid; or
- the contract has no authorized consumer.

This bypasses the intended system-level “not due means no lifecycle mutation” property even though the atomic dispatch RPC itself is now correct.

The current Event Fabric feature gate remains OFF and the handler registry remains empty, so this is not a currently activated production exploit. It is an **IMPLEMENTATION_DEFECT — P2** and blocks Agent 3 release-candidate QA under the mission's finding rule.

No corrective code or migration was created by this review.

---

# 2. Target / Exact Delta

Requested corrective HEAD:

`a4dfbeb52534c5718a3a92f42ab1aa4ca0b8808c`

Live branch head:

`a4dfbeb52534c5718a3a92f42ab1aa4ca0b8808c`

`TARGET_DRIFT: NO`

Delta from `423f32dc...`:

- 5 commits;
- 4 files exactly.

Observed files:

1. `lib/event-fabric/contracts.ts`
2. `lib/event-fabric/relay.ts`
3. `scripts/verify-m1a-event-fabric.mjs`
4. `supabase/migrations/20260929222634_m1a_event_fabric_dispatch_eligibility_fix.sql`

No additional file was changed.

`DELTA_SCOPE: PASS`

---

# 3. Original Migration Immutability

Original migration:

`supabase/migrations/20260929211421_m1a_event_fabric_safety_contract.sql`

Blob at corrective base:

`a6f047f4e31c96dc32c89c04b117ffe75539589f`

Blob at corrective HEAD:

`a6f047f4e31c96dc32c89c04b117ffe75539589f`

Therefore:

`ORIGINAL_MIGRATION_IMMUTABLE: PASS`

The original applied migration was not modified.

---

# 4. Corrective Migration Scope

Corrective migration:

`supabase/migrations/20260929222634_m1a_event_fabric_dispatch_eligibility_fix.sql`

It only:

1. redefines `public.orcaly_dispatch_outbox_event`;
2. restores the intended EXECUTE boundary:
   - PUBLIC denied;
   - anon denied;
   - authenticated denied;
   - service_role granted.

No table, column, index, trigger, RLS policy, grant family, M1B–M1E object or unrelated function is changed.

`CORRECTIVE_MIGRATION_SCOPE: PASS`

---

# 5. Staging Corrective Migration

Staging project:

`zwxulgpjucxudadjdqov`

Read-only catalog inspection confirms:

- `20260929211421 / m1a_event_fabric_safety_contract`: exactly once;
- `20260929222634 / m1a_event_fabric_dispatch_eligibility_fix`: exactly once.

Current row counts:

- `transactional_outbox = 0`
- `background_jobs = 0`
- `event_idempotency = 0`

No fixture row remains.

The live `orcaly_dispatch_outbox_event` definition contains the DB-time correction and retains the required privileged-function security properties.

`CORRECTIVE_MIGRATION_STAGING: PASS`

`STAGING_FIXTURES_REMAINING: 0`

---

# 6. Production Untouched

Production project:

`ozrasuktfthsvbqprtel`

Read-only inspection confirms:

- original M1A migration absent;
- corrective M1A migration absent;
- corrected `not_due` dispatch function absent.

No production mutation or activation occurred.

`PRODUCTION_UNTOUCHED: PASS`

---

# 7. P2-1 — DB-Time Eligibility Correction

The live staging dispatch function now performs the critical sequence:

1. load and lock exact outbox row with `FOR UPDATE`;
2. preserve completed-event idempotency;
3. validate expected producer/event/version;
4. validate scope;
5. require status queued/retrying;
6. check:

   `v_event.available_at > now()`

7. when true, return:

   `status = not_due`

8. only after this check:
   - inspect retry budget;
   - transition to processing;
   - increment attempts;
   - create jobs.

The authoritative clock is PostgreSQL `now()` while the row lock is held.

`DB_TIME_ELIGIBILITY: PASS`

---

# 8. not_due State Preservation

The `not_due` branch returns immediately.

Before that return, it does not:

- increment attempts;
- change status;
- change available_at;
- change last_error;
- insert a background job;
- consume retry budget.

Response is deterministic and limited to:

- status = `not_due`;
- outbox_event_id.

The identifier is already inside a service-role-only RPC trust boundary and is not used as authorization.

`NOT_DUE_STATE_PRESERVATION: PASS`

`NOT_DUE_NO_JOB_CREATION: PASS`

---

# 9. Race / Clock Model

## Application clock ahead of DB

For the atomic dispatch path:

safe.

Even if the application submits an event early, the locked DB row returns `not_due`.

## Application clock behind DB

The relay no longer uses application time to decide due eligibility, so a DB-due row may still be submitted and the DB decides authoritatively.

## Two relay instances

The source row lock remains authoritative.

Only one transaction can mutate the event at a time.

A second dispatch observes the committed result and preserves idempotent completed behavior.

## Row becomes due around lock acquisition

PostgreSQL evaluates due state from DB time while holding the source-row lock.

The dispatch RPC behavior is correct.

---

# 10. NEW P2 — Pre-Dispatch Failure Settlement Can Still Mutate Future Events

Classification:

**IMPLEMENTATION_DEFECT — P2**

Affected file:

`lib/event-fabric/relay.ts`

The corrective relay intentionally removed:

`.lte('available_at', ...)`

and now reads bounded queued/retrying candidates regardless of due time.

That is acceptable only if **every state-mutating path** is subsequently gated by the authoritative DB-time boundary.

The relay currently performs these operations before calling dispatch:

1. `validateEventRecord(event)`;
2. if validation throws:
   - catch;
   - call `orcaly_settle_outbox_failure`;
3. if `contract.consumers.length === 0`:
   - call `orcaly_settle_outbox_failure` directly;
   - mark needs_attention.

`orcaly_settle_outbox_failure` accepts queued/processing/retrying rows and does not reject:

`available_at > now()`.

Therefore a not-yet-due retrying event can still:

- increment attempts;
- move to needs_attention;
- alter last_error;
- consume retry budget;

before DB time says it is eligible.

This occurs without ever reaching the corrected dispatch RPC.

## Concrete cases

### Future retry + unknown/invalid contract

Relay selects it → validation fails → failure settlement mutates it early.

### Future retry + known contract but no consumer

Relay selects it → no-consumer branch → failure settlement moves it to needs_attention early.

Current production contract registry intentionally has zero consumers, so this behavior is especially easy to trigger if the Event Fabric route were activated while future retry rows existed.

Feature OFF prevents current activation, but the implementation lifecycle invariant remains broken.

## Required correction

Before Agent 3 release-candidate QA, the implementation must ensure that **no relay-driven state mutation can occur before DB-time due eligibility is established**.

The correction must cover both:

- invalid-contract failure settlement;
- no-consumer failure settlement.

A merely application-clock-based filter is not sufficient as the authoritative fix.

This review does not prescribe or create the corrective database/application change.

`RELAY_NOT_DUE_HANDLING: ISSUE`

---

# 11. Atomic Dispatch Security

The original P2 dispatch-boundary blocker itself is resolved.

The corrective migration keeps:

- exact row lock;
- contract identity recheck;
- scope check;
- p_jobs shape validation;
- duplicate spec rejection;
- bounded consumer count;
- deterministic dedupe;
- trusted scope/correlation copy;
- exact ensured-job verification;
- atomic completion;
- fixed search_path;
- SECURITY DEFINER;
- service-role-only EXECUTE.

No new dynamic SQL or caller-selected SQL object exists.

`ATOMIC_DISPATCH_SECURITY: PASS`

---

# 12. P2-2 — Aggregate Contract Model

The corrective TypeScript model adds:

`EventAggregateContract`

Each Event Contract statically defines:

- expected aggregate type;
- payload resource ID resolver.

Payload cannot select the aggregate type.

Event type strings are not parsed to infer aggregate authority.

`AGGREGATE_CONTRACT_MODEL: PASS`

---

# 13. Exact Business Aggregate Bindings

Observed registry:

## business / order.created / v1

- aggregate type: `order`
- resource: `payload.order_id`

## business / order.ready / v1

- aggregate type: `order`
- resource: `payload.order_id`

## business / payment.confirmed / v1

- aggregate type: `order`
- resource: `payload.order_id`

## business / proposal.accepted / v1

- aggregate type: `proposal`
- resource: `payload.proposal_id`

No additional event/product contract was added.

`ORDER_AGGREGATE_BINDING: PASS`

`PROPOSAL_AGGREGATE_BINDING: PASS`

---

# 14. Aggregate Validation Semantics

`validateEventRecord()` now:

1. resolves exact producer/event/version contract;
2. validates scope;
3. positively validates payload;
4. compares aggregate_type to static contract;
5. requires aggregate_id to be UUID-valid;
6. resolves resource identity using static contract code;
7. requires resource identity UUID-valid;
8. requires exact aggregate/resource identity equality.

Stable failure classes include:

- `invalid_aggregate_type`;
- `invalid_aggregate_id`;
- `aggregate_resource_mismatch`.

Contradictory resource identities cannot proceed through relay validation or worker source-event revalidation.

`CONFUSED_DEPUTY_PREVENTION: PASS`

Threat cases:

- order aggregate A + payload order B → reject;
- order event + proposal aggregate type → reject;
- proposal aggregate A + proposal payload B → reject;
- null aggregate ID → reject;
- malformed aggregate ID → reject;
- matching order → pass;
- matching proposal → pass.

---

# 15. Legacy Producer Compatibility

The existing `orcaly_record_business_event` producer already writes compatible identities:

## order.created

- aggregate_type = order
- aggregate_id = new.id
- payload.order_id = new.id

## order.ready

- aggregate_type = order
- aggregate_id = new.id
- payload.order_id = new.id

## payment.confirmed

- aggregate_type = order
- aggregate_id = new.id
- payload.order_id = new.id

## proposal.accepted

- aggregate_type = proposal
- aggregate_id = new.id
- payload.proposal_id = new.id

No legacy producer rewrite was part of the corrective delta.

`LEGACY_PRODUCER_COMPATIBILITY: PASS`

---

# 16. RPC Security Regression

The live corrected dispatch function remains:

- SECURITY DEFINER;
- `search_path = pg_catalog`;
- PUBLIC EXECUTE false;
- anon EXECUTE false;
- authenticated EXECUTE false;
- service_role EXECUTE true.

No RPC security regression was introduced.

`RPC_SECURITY_REGRESSION: PASS`

---

# 17. Direct Regression Surface

The corrective delta does not modify:

- claim_background_jobs;
- claim_event_fabric_jobs;
- scope-aware dedupe indexes;
- cron route;
- feature gate;
- handler registry;
- notification isolation hotfix;
- original M1A migration.

Original migration blob is unchanged.

Current package test chain still includes:

`verify:notification-isolation`

and:

`verify:m1a-event-fabric`.

Handler registry remains:

`buildHandlerRegistry([])`

Feature gate remains:

`ORCALY_EVENT_FABRIC_ENABLED`

Therefore:

`CLAIM_ISOLATION_REGRESSION: PASS`

`SCOPE_DEDUPE_REGRESSION: PASS`

`FEATURE_GATE: PASS`

`HANDLER_REGISTRY_EMPTY: YES`

---

# 18. Test Delta

The corrective verifier now covers:

- corrective migration presence;
- DB-time check ordering;
- not_due response;
- aggregate model presence;
- three order bindings;
- proposal binding;
- valid order contracts;
- valid proposal contract;
- wrong aggregate type;
- null aggregate ID;
- malformed aggregate ID;
- order aggregate/resource mismatch;
- proposal aggregate/resource mismatch;
- relay recognition of `not_due`;
- absence of application `.lte('available_at'...)` filtering;
- explicit TypeScript typecheck.

However, it does **not** cover the new lifecycle regression identified in this review:

> future/not-due event reaches pre-dispatch contract/no-consumer failure settlement and must remain untouched.

The current static assertion that removal of `.lte('available_at'...)` is intentional does not prove that every pre-dispatch mutation respects DB due time.

`TEST_DELTA: ISSUE`

A regression test is required before resubmission.

---

# 19. Typecheck Evidence

The exact corrective verifier executes:

`npm run typecheck`

through `spawnSync` and asserts:

exit status = 0.

Repository chain:

- `npm test` includes `verify:m1a-event-fabric`;
- build pre-hook includes `npm test`.

Exact HEAD:

`a4dfbeb52534c5718a3a92f42ab1aa4ca0b8808c`

Vercel deployment:

`dpl_8ZtHTJzxGzwJgQJs9bLsNNY6Dyy9`

State:

`READY`

Commit metadata matches the exact corrective HEAD.

For this delta review, that is sufficient to classify the explicit typecheck evidence as present.

`TYPECHECK_EVIDENCE: PRESENT`

No claim is made beyond the executed build chain.

---

# 20. New P1/P2 Finding

```
NEW_P1_P2:
FOUND
```

New finding:

**P2 — future/not-due candidate can be failure-settled before authoritative DB due eligibility when relay fails before dispatch.**

This is a direct regression surface of the corrective relay change.

Therefore the mission rule requires:

`HOLD`

and:

`READY_FOR_AGENT3_INDEPENDENT_QA: NO`

---

# 21. Required Next Delta

Before Agent 3 independent QA:

1. ensure DB-time due eligibility gates every relay-driven mutation, including validation/no-consumer failure settlement;
2. add a regression test for future `available_at` + invalid/no-consumer paths;
3. preserve the corrected atomic dispatch function;
4. preserve aggregate contract integrity;
5. do not modify the original `20260929211421` migration;
6. re-review only the resulting narrow delta.

No implementation is authorized by this report.

---

# 22. Final Status

```
M1A_CORRECTIVE_SECURITY_DELTA_REVIEW:
HOLD

TARGET_SHA:
a4dfbeb52534c5718a3a92f42ab1aa4ca0b8808c

TARGET_DRIFT:
NO

DELTA_SCOPE:
PASS

ORIGINAL_MIGRATION_IMMUTABLE:
PASS

CORRECTIVE_MIGRATION_SCOPE:
PASS

CORRECTIVE_MIGRATION_STAGING:
PASS

PRODUCTION_UNTOUCHED:
PASS

DB_TIME_ELIGIBILITY:
PASS

NOT_DUE_STATE_PRESERVATION:
PASS

NOT_DUE_NO_JOB_CREATION:
PASS

RELAY_NOT_DUE_HANDLING:
ISSUE

ATOMIC_DISPATCH_SECURITY:
PASS

AGGREGATE_CONTRACT_MODEL:
PASS

ORDER_AGGREGATE_BINDING:
PASS

PROPOSAL_AGGREGATE_BINDING:
PASS

CONFUSED_DEPUTY_PREVENTION:
PASS

LEGACY_PRODUCER_COMPATIBILITY:
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
ISSUE

TYPECHECK_EVIDENCE:
PRESENT

STAGING_FIXTURES_REMAINING:
0

NEW_P1_P2:
FOUND

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

No code, migration or database correction was performed.

**STOP — END OF MISSION**
