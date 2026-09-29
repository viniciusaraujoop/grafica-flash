# ORÇALY — M1A EVENT FABRIC — INDEPENDENT QA

**Status:** PASS  
**Repository:** `viniciusaraujoop/grafica-flash`  
**Implementation branch:** `fix/m1a-event-fabric-staging-final-followup`  
**Exact target SHA:** `82056e08a0cdecf4a7f18146325ee83359828e95`  
**Final security review branch:** `security/m1a-final-corrective-delta-review`  
**Final security review SHA:** `5a9a8edbebfe2af48e3701b2156dd8037b4339c7`  
**Canonical main:** `fb2bf74090cb3f85df64187bd13a12d805b0a7a7`  
**Staging project:** `zwxulgpjucxudadjdqov`  
**Production project:** `ozrasuktfthsvbqprtel`  
**QA date:** 2026-09-29

---

## 1. Executive decision

```
M1A_INDEPENDENT_QA:
PASS
```

The conversation-limit interruption did not represent a QA failure and did not require restarting the mission.

Recovery established that no final Agent 3 QA branch/artifact had been persisted. The implementation target, final security review and canonical main were therefore re-verified before continuing only the missing certification work.

No M1A defect was found in the independently exercised staging behavior.

No code, migration or schema correction was performed.

`READY_FOR_COORDINATOR_M1A_CERTIFICATION: YES`

---

## 2. Recovery and immutable target verification

Fresh GitHub comparison produced:

- implementation branch vs exact target: identical, ahead 0, behind 0;
- security review branch vs exact security review SHA: identical, ahead 0, behind 0;
- main vs canonical main SHA: identical, ahead 0, behind 0.

Therefore:

```
TARGET_DRIFT:
NO

MAIN_DRIFT:
NO
```

The suggested QA branch did not exist before recovery and no final Agent 3 QA commit/report was found. This report was therefore reconstructed from actual persisted evidence plus narrowly re-executed staging checks.

---

## 3. Migration ledger and production isolation

Staging migration ledger contains exactly one occurrence of each M1A migration:

1. `20260929211421_m1a_event_fabric_safety_contract`
2. `20260929222634_m1a_event_fabric_dispatch_eligibility_fix`
3. `20260929225302_m1a_event_fabric_failure_settlement_due_guard`

Production contains zero occurrences of those three migrations.

Read-only production inspection also confirmed the M1A dispatch and failure-settlement RPCs are absent.

```
MIGRATION_LEDGER:
PASS

PRODUCTION_M1A_LEDGER:
0
```

---

## 4. Settlement lifecycle

Controlled staging fixtures independently verified the following behavior.

### 4.1 Future retrying settlement

A retrying event with `available_at` approximately one hour in the future was passed to `orcaly_settle_outbox_failure`.

Observed after the call:

- status remained `retrying`;
- attempts remained `2`;
- `available_at` remained future;
- `last_error` remained `keep-me`;
- `processed_at` remained null.

No failure budget was consumed.

### 4.2 Due retryable

A due queued event settled as retryable:

- result accepted;
- attempts: `0 -> 1`;
- status: `retrying`;
- next availability approximately +300 seconds;
- supplied error recorded.

### 4.3 Due non-retryable

A due queued event settled as non-retryable:

- attempts: `0 -> 1`;
- status: `needs_attention`;
- error recorded.

### 4.4 Processing settlement

A `processing` event with a future historical `available_at` remained settleable:

- attempts: `1 -> 2`;
- status: `retrying`;
- retry time updated.

This confirms that the future-due guard correctly applies to queued/retrying rows without trapping an already-processing failure.

### 4.5 Reschedule race

A due queued event was moved to a future `available_at` immediately before settlement.

Observed:

- status remained `queued`;
- attempts remained `0`;
- future `available_at` remained intact;
- prior `last_error` remained intact.

### 4.6 Repeated settlement

A due event was settled retryably, then immediately settled again.

Observed final state:

- attempts remained `1`, not `2`;
- status remained `retrying`;
- first settlement error remained;
- retry time remained future.

The immediate second settlement therefore did not consume another retry budget.

```
SETTLEMENT_LIFECYCLE:
PASS
```

---

## 5. Settlement concurrency

Two independent database calls attempted failure settlement concurrently on the same due event.

Observed:

- one session returned `true`;
- the other returned `false`;
- final attempts = `1`;
- final status = `retrying`;
- no background job was created.

The row-lock/due-state boundary prevented duplicate failure-budget consumption.

```
SETTLEMENT_CONCURRENCY:
PASS
```

---

## 6. Dispatch behavior

### 6.1 Future event

A queued future event was dispatched through `orcaly_dispatch_outbox_event`.

Returned:

```json
{"status":"not_due","outbox_event_id":"00000000-0000-4000-8000-00000000b001"}
```

Observed state:

- status `queued`;
- attempts `0`;
- processed_at null;
- last_error null;
- jobs `0`.

```
DISPATCH_NOT_DUE:
PASS
```

### 6.2 Due event

A due event was dispatched once.

Returned:

- status `completed`;
- `jobs_ensured = 1`;
- `already_dispatched = false`.

Observed:

- event status `completed`;
- event attempts `1`;
- exactly one background job.

```
DISPATCH_DUE:
PASS
```

### 6.3 Re-dispatch idempotency

The same completed event was immediately dispatched again with the same expected job contract.

Returned:

- status `completed`;
- `already_dispatched = true`.

Final state remained:

- event attempts `1`;
- exactly one background job.

No second job and no second dispatch attempt were created.

```
REDISPATCH_IDEMPOTENCY:
PASS
```

---

## 7. Dispatch transaction rollback

A controlled event was prepared with a pre-existing conflicting second job. Dispatch requested two jobs.

The RPC failed with:

`P0001: event fabric job could not be ensured`

Post-error state proved transaction atomicity:

- source outbox remained `queued`;
- attempts remained `0`;
- processed_at remained null;
- first requested job count remained `0`;
- only the deliberately pre-existing conflicting job remained.

No partial dispatch mutation leaked from the failed RPC.

```
TRANSACTION_ROLLBACK:
PASS
```

---

## 8. Dispatch concurrency

Two independent database calls concurrently dispatched the same due event.

Observed:

- one call returned completed with `jobs_ensured = 1` and `already_dispatched = false`;
- the other returned completed with `already_dispatched = true`;
- final event attempts = `1`;
- final job count = `1`.

```
DISPATCH_CONCURRENCY:
PASS
```

---

## 9. Claim isolation and concurrent workers

Live staging definitions confirm:

- `claim_background_jobs` selects only rows with `outbox_event_id is null`;
- `claim_event_fabric_jobs` selects only rows with `outbox_event_id is not null`;
- both use due-state filtering and `FOR UPDATE SKIP LOCKED`.

Controlled staging fixtures contained:

- generic `google_calendar.sync`;
- generic `integration.oauth.refresh`;
- two Event Fabric jobs.

Observed:

- generic worker claimed only a generic calendar job;
- Event Fabric worker A claimed one EF job;
- Event Fabric worker B concurrently claimed the other EF job;
- the generic integration job remained untouched by the EF workers;
- no job was double-claimed;
- a subsequent generic worker successfully claimed the integration job.

```
CLAIM_ISOLATION:
PASS

INTEGRATION_JOB_COMPATIBILITY:
PASS
```

---

## 10. Wrong-worker settlement

A running Event Fabric job locked by `qa-ef-worker-a` was settled first using a different worker ID.

Observed:

- wrong worker result: `false`;
- correct worker result: `true`.

The live `settle_background_job` definition also requires both `status = 'running'` and exact `locked_by` equality.

```
WRONG_WORKER_SETTLEMENT:
PASS
```

---

## 11. Scope-aware dedupe

The same producer/event-type/dedupe key was inserted across different scopes.

Valid coexistence was observed for:

- company A vs company B;
- user A vs user B;
- company scope vs personal scope vs platform scope.

Expected duplicate attempts inside the same scope failed with PostgreSQL `23505` on the intended indexes:

- `uq_transactional_outbox_dedupe_company`;
- `uq_transactional_outbox_dedupe_personal`;
- `uq_transactional_outbox_dedupe_platform`.

Final controlled counts were exactly one row per intended scope.

```
COMPANY_DEDUPE:
PASS

PERSONAL_DEDUPE:
PASS

PLATFORM_DEDUPE:
PASS
```

---

## 12. RPC role grants

Live privilege inspection for the privileged job/Event Fabric RPCs confirmed:

- anon EXECUTE: false;
- authenticated EXECUTE: false;
- service_role EXECUTE: true.

Checked RPCs included:

- `claim_background_jobs`;
- `claim_event_fabric_jobs`;
- `orcaly_dispatch_outbox_event`;
- `orcaly_settle_outbox_failure`;
- `settle_background_job`.

```
RPC_ROLE_GRANTS:
PASS
```

---

## 13. Destructive grants and browser mutation boundary

Live table privilege inspection confirmed for `transactional_outbox`:

- service_role DELETE: false;
- service_role TRUNCATE: false;
- anon INSERT/UPDATE/DELETE: false;
- authenticated INSERT/UPDATE/DELETE: false.

RLS is enabled on:

- `transactional_outbox`;
- `background_jobs`;
- `event_idempotency`.

Each currently has zero browser-facing policies, preserving the internal-only mutation boundary.

```
OUTBOX_DESTRUCTIVE_GRANTS:
PASS

RLS_BROWSER_MUTATION_BOUNDARY:
PASS
```

---

## 14. Aggregate and payload contracts

The exact-target M1A verifier executes the real contracts module and covers:

- valid `order.created`;
- valid `order.ready`;
- valid `payment.confirmed`;
- valid `proposal.accepted`;
- invalid aggregate type;
- null/non-UUID aggregate ID;
- order aggregate/payload resource mismatch;
- proposal aggregate/payload resource mismatch;
- nested forbidden-secret validation.

The exact-target persisted test gate is PASS.

Independent database payload-boundary checks additionally proved:

- outbox payload above 32 KiB fails with `23514 / transactional_outbox_payload_bytes_check`;
- Event Fabric job payload above 8 KiB fails with `23514 / background_jobs_event_fabric_invariant_check`.

```
AGGREGATE_CONTRACTS:
PASS
```

---

## 15. Future invalid-contract and no-consumer lifecycle

Two future retrying events were exercised against the failure-settlement boundary.

### Future invalid-contract path

Settlement returned `false`.

State remained:

- `retrying`;
- attempts unchanged at `2`;
- original last_error unchanged;
- future available_at unchanged.

### Future no-consumer path

Settlement returned `false`.

State remained:

- `retrying`;
- attempts unchanged at `1`;
- original last_error unchanged;
- future available_at unchanged.

Together with the exact-target relay contract, which routes invalid-contract/no-consumer failures through this settlement RPC and treats `false` as no mutation, this proves no premature lifecycle mutation.

```
FUTURE_INVALID_CONTRACT:
PASS

FUTURE_NO_CONSUMER:
PASS
```

---

## 16. Database integrity

Live constraints and dynamic checks verified:

### Outbox -> job RESTRICT

Deleting an outbox row with a referencing job failed with PostgreSQL `23503` on:

`background_jobs_outbox_event_id_fkey`

Both parent and child remained after the failed delete.

### Company cascade

Deleting a controlled company with a controlled outbox row and no job blocker removed both company and outbox row as expected.

```
DATABASE_INTEGRITY:
PASS
```

---

## 17. Regression and repository gates

The exact immutable target includes:

- `npm test` with the P1 notification-isolation verifier and M1A verifier;
- M1A verifier invoking `npm run typecheck`;
- M1A verifier invoking scoped ESLint for the final M1A delta;
- standard Next.js build gate.

Persisted exact-target execution evidence reports:

- FULL_TESTS: PASS;
- TYPECHECK: PASS, exit code 0;
- LINT: PASS;
- BUILD: PASS;
- P1_NOTIFICATION_REGRESSION: PASS.

Independent recovery also verified the exact target deployment:

- deployment: `dpl_2gaUbXRDrzLBemhveY4auMs7758w`;
- Git commit SHA: `82056e08a0cdecf4a7f18146325ee83359828e95`;
- Git branch: `fix/m1a-event-fabric-staging-final-followup`;
- Vercel state: `READY`;
- GitHub combined Vercel status: success.

A fresh local Agent 3 checkout was attempted only as an extra re-execution path. The isolated container could not resolve `github.com`, so that redundant local rerun was environment-blocked. This did not invalidate the persisted execution evidence tied to the same immutable SHA and did not expose an evidence gap requiring destructive or duplicate QA work.

```
INTEGRATION_JOB_COMPATIBILITY:
PASS

P1_NOTIFICATION_REGRESSION:
PASS

FULL_TESTS:
PASS

TYPECHECK:
PASS

LINT:
PASS

BUILD:
PASS
```

---

## 18. Staging cleanliness

After all controlled fixtures, explicit cleanup was limited to known QA UUIDs.

Final staging counts:

- `transactional_outbox = 0`;
- `background_jobs = 0`;
- `event_idempotency = 0`;
- controlled QA companies = `0`.

```
STAGING_FIXTURES_REMAINING:
0
```

---

## 19. Mutation audit

No code was modified.

No migration was created or edited.

No permanent staging schema mutation was made.

Production was read-only.

Main was read-only and unchanged.

Event Fabric was not activated.

No cron or secret was configured.

No M1B/M1C/M1D/M1E work was performed.

```
CODE_CHANGED:
NO

MIGRATIONS_CREATED:
NONE

STAGING_SCHEMA_MUTATION:
NONE

PRODUCTION_MUTATION:
NONE

MAIN_MUTATION:
NONE
```

---

## 20. Final certification block

```
M1A_INDEPENDENT_QA:
PASS

TARGET_SHA:
82056e08a0cdecf4a7f18146325ee83359828e95

SECURITY_REVIEW_SHA:
5a9a8edbebfe2af48e3701b2156dd8037b4339c7

TARGET_DRIFT:
NO

MIGRATION_LEDGER:
PASS

SETTLEMENT_LIFECYCLE:
PASS

SETTLEMENT_CONCURRENCY:
PASS

DISPATCH_NOT_DUE:
PASS

DISPATCH_DUE:
PASS

REDISPATCH_IDEMPOTENCY:
PASS

DISPATCH_CONCURRENCY:
PASS

TRANSACTION_ROLLBACK:
PASS

CLAIM_ISOLATION:
PASS

WRONG_WORKER_SETTLEMENT:
PASS

COMPANY_DEDUPE:
PASS

PERSONAL_DEDUPE:
PASS

PLATFORM_DEDUPE:
PASS

RPC_ROLE_GRANTS:
PASS

OUTBOX_DESTRUCTIVE_GRANTS:
PASS

AGGREGATE_CONTRACTS:
PASS

FUTURE_INVALID_CONTRACT:
PASS

FUTURE_NO_CONSUMER:
PASS

INTEGRATION_JOB_COMPATIBILITY:
PASS

P1_NOTIFICATION_REGRESSION:
PASS

FULL_TESTS:
PASS

TYPECHECK:
PASS

LINT:
PASS

BUILD:
PASS

STAGING_FIXTURES_REMAINING:
0

CODE_CHANGED:
NO

MIGRATIONS_CREATED:
NONE

STAGING_SCHEMA_MUTATION:
NONE

PRODUCTION_MUTATION:
NONE

MAIN_MUTATION:
NONE

QA_ARTIFACT:
docs/qa/ORCALY_M1A_EVENT_FABRIC_INDEPENDENT_QA.md

READY_FOR_COORDINATOR_M1A_CERTIFICATION:
YES
```

**STOP — END OF M1A INDEPENDENT QA**
