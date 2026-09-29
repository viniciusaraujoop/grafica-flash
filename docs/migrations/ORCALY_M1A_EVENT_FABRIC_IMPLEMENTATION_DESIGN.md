# ORÇALY — M1A EVENT FABRIC IMPLEMENTATION DESIGN DELTA

## Status

```
M1A_IMPLEMENTATION_DESIGN:
COMPLETE

BASE_SHA:
26b78cc716eb35da18a12500d22a7703e8ce0aa6

IMPLEMENTATION:
NOT_AUTHORIZED

MIGRATION_CREATION:
NOT_AUTHORIZED

SQL_EXECUTION:
NOT_AUTHORIZED

DATABASE_MUTATION:
NONE

STAGING_MUTATION:
NONE

PRODUCTION_MUTATION:
NONE
```

This artifact is an **implementation-design package only**.

It creates no migration, executes no SQL, changes no runtime code, mutates no database, and authorizes no deployment.

---

# 1. Authority and Baseline

Repository:

`viniciusaraujoop/grafica-flash`

Current canonical main:

`fb2bf74090cb3f85df64187bd13a12d805b0a7a7`

Coordinator reconciliation branch:

`reconcile/m1-coordinator-final`

Coordinator reconciliation exact SHA / this design base:

`26b78cc716eb35da18a12500d22a7703e8ce0aa6`

Authoritative reconciliation:

`docs/migrations/ORCALY_M1_COORDINATOR_FINAL_RECONCILIATION.md`

Historical inputs reviewed:

- M1 original design: `2ad113837a25a6ed3e04f00453bec3ac45a9e960`
- Agent 2 architecture challenge: `ee35fb9835939b2edd15247ee29aee5fc3de0c26`
- Agent 7 product ratification: `516dd5eca95dc8fc6f71786d33b5c2f7c9f41ea0`
- Agent 4 security triage: `7cb078250e014cffa941efb73997b312d8468c89`

Where older documents conflict with the Coordinator reconciliation, the Coordinator reconciliation wins.

Most importantly:

- Agent 2's choice of `transactional_outbox → background_jobs` is retained.
- Agent 2's rejection of long-lived outbox lock columns is retained.
- Agent 2's requirement for generic job enqueue dedupe is retained.
- Agent 2's recommendation to leave the relay outside the then-current M1A scope is superseded by the Coordinator, which explicitly places the private relay/dispatcher contract inside current M1A implementation design.

---

# 2. Canonical M1A Architecture

The canonical path is:

```
domain transaction
    ↓
transactional_outbox
    ↓
private relay / dispatcher
    ↓
background_jobs
    ↓
allowlisted domain handler
```

Responsibilities are intentionally separated.

### transactional_outbox

Represents:

> a durable domain fact was published transactionally and still needs dispatch, or dispatch has been completed.

It does **not** represent domain-side-effect completion.

### background_jobs

Represents:

> executable work for one allowlisted handler.

It remains the only generic execution queue.

### event_idempotency

Represents:

> idempotency and processing state for inbound external/provider events.

It is not the internal event bus and is not expanded by M1A.

### handler

Represents:

> one allowlisted executable consumer contract.

Handlers may perform a domain side effect only after current authorization and domain idempotency checks.

---

# 3. Read-Only Live Facts Revalidated

Production read-only verification during this design confirmed:

| Object | Rows |
|---|---:|
| transactional_outbox | 0 |
| background_jobs | 0 |
| event_idempotency | 0 |

Latest observed production order:

`2026-08-09 17:23:18.314245+00`

Latest observed production proposal:

`2026-07-29 19:11:30.401+00`

The zero outbox count is therefore not evidence that no producer exists.

Current triggers are enabled:

- `trg_orcaly_orders_business_event`
- `trg_orcaly_proposals_business_event`

Current Business outbox event keys produced by `orcaly_record_business_event()` are:

- `order.created`
- `order.ready`
- `payment.confirmed`
- `proposal.accepted`

The same trigger also writes domain history to `timeline_events`, which is intentionally outside M1A Event Fabric execution.

Current worker primitives remain:

- `claim_background_jobs`
- `settle_background_job`
- `recover_stale_background_jobs`

Positive worker properties confirmed in production:

- SECURITY DEFINER
- fixed search path
- service_role EXECUTE
- no anon/authenticated EXECUTE
- `FOR UPDATE SKIP LOCKED` job claim
- worker ownership through `locked_by`
- settlement bound to matching worker
- stale recovery bounded
- exhausted stale work reaches `needs_attention`.

All three Event Fabric tables have RLS enabled.

The inspected role grants expose the tables to `service_role`, not `anon` or `authenticated`.

---

# 4. What Current Contracts Are Already Sufficient

## 4.1 event_idempotency — sufficient as-is

Current columns already cover the inbound-provider responsibility:

- provider
- external event_id
- company scope
- event type
- payload hash
- received/processed timestamps
- processing status
- attempt count
- error
- metadata.

Current uniqueness:

`(provider, event_id)`

Current statuses already include:

- received
- processing
- processed
- ignored
- failed
- retrying
- needs_attention.

### M1A decision

**NO SCHEMA DELTA.**

External provider idempotency must remain independent from:

- internal event publication dedupe;
- relay/job enqueue dedupe;
- domain action idempotency.

---

## 4.2 transactional_outbox — core lifecycle is sufficient

Already sufficient:

- durable UUID row identity
- company scope
- event_type
- aggregate_type
- aggregate_id
- payload
- queued/processing/completed/failed/retrying/needs_attention states
- attempts/max_attempts
- available_at
- created_at
- processed_at
- last_error
- eligible-row index.

The existing status model and retry scheduling columns are reused.

No second outbox is required.

---

## 4.3 background_jobs — execution lifecycle is sufficient

Already sufficient:

- UUID job identity
- company scope
- job_type
- payload
- queued/running/completed/failed/retrying/needs_attention states
- attempts/max_attempts
- run_after
- locked_at/locked_by
- created/started/completed timestamps
- last_error
- metadata
- SKIP LOCKED claim
- settlement
- stale recovery.

No second job queue is required.

---

# 5. Additive Schema Delta Actually Required

M1A should be one additive Event Fabric migration boundary.

The future migration working name should be:

`m1a_event_fabric_safety_contract`

No timestamp is assigned by this document.

The real filename must be generated only after implementation authorization and migration-version revalidation.

---

## 5.1 transactional_outbox additions

### user_id

Type:

`uuid nullable`

Purpose:

Personal-user scope for future personal-product events.

M1A intentionally does **not** make this a cascading Auth FK.

Reason:

An operational event must not silently become platform-scoped because an Auth user was deleted, and account deletion behavior must not be coupled accidentally to outbox retention.

Trusted publishers validate the subject when publishing.

Execution-time handlers revalidate any current authorization that is still required.

### producer

Type:

`text not null`

Compatibility default:

`business`

Purpose:

Stable product/domain ownership of the event contract.

The default preserves current `orcaly_record_business_event` behavior without rewriting the trigger.

DB responsibility:

- bounded length;
- stable identifier shape.

TypeScript registry responsibility:

- allowed producer values;
- ownership of event keys.

### event_version

Type:

`smallint not null`

Compatibility default:

`1`

Purpose:

Version the payload/contract of a stable event key.

Rules:

- version starts at 1;
- incompatible payload semantics require a new version;
- an event key is not renamed merely because payload shape evolves;
- old handlers remain available until backlog for the old version is resolved.

### correlation_id

Type:

`uuid not null`

Root default:

fresh UUID.

Purpose:

Trace one logical workflow across:

outbox
→ jobs
→ downstream event publications
→ domain audit/notification where applicable.

If a producer already has a trusted correlation UUID, it propagates it.

If no trusted correlation exists, publication starts a new root correlation.

### causation_id

Type:

`uuid nullable`

Purpose:

Identify the immediate prior **internal event instance** that caused this event.

Normal downstream rule:

`causation_id = parent transactional_outbox.id`

An external provider event starts a new internal event chain unless a trusted internal parent exists.

No FK is required because historical retention must not invalidate causality references.

### dedupe_key

Type:

`text nullable`

Bounded.

Purpose:

Optional **event publication** dedupe for contracts that have a deterministic semantic publication identity.

Canonical uniqueness:

`producer + event_type + dedupe_key`

when dedupe_key is not null.

Do not include contract version in publication uniqueness.

Reason:

Changing a schema version must not silently republish the same semantic event.

### scope integrity

Canonical scope rule:

```
company_id != null, user_id = null → company scope
company_id = null, user_id != null → personal user scope
company_id = null, user_id = null → platform scope
company_id != null, user_id != null → INVALID
```

No polymorphic scope table is introduced.

### payload bound

Event Fabric payload is bounded.

Design maximum:

**32 KiB serialized JSON** per outbox event.

Purpose:

Prevent the outbox from becoming storage for:

- raw provider payloads;
- documents;
- secrets;
- oversized snapshots.

Large data belongs in its owning domain/storage and is referenced by stable IDs.

### error bound

Relay error persisted to `last_error` must be sanitized and limited to **2,000 characters**.

No stack dump or secret-bearing provider response is stored.

---

## 5.2 transactional_outbox indexes / constraints

Required future structural rules:

1. existing PK remains;
2. existing status/max-attempt checks remain;
3. company/user mutual-exclusion check;
4. producer identifier shape/length check;
5. event_version positive bounded check;
6. dedupe_key bounded check;
7. payload serialized-size bound;
8. partial unique publication-dedupe index:
   `(producer, event_type, dedupe_key)`
   where dedupe_key is not null.

No `locked_at` or `locked_by` columns are added to outbox.

---

## 5.3 background_jobs additions

### user_id

Type:

`uuid nullable`

Purpose:

Carry personal scope as first-class trusted metadata for event-derived jobs.

The same scope exclusivity rule applies:

at most one of company_id/user_id.

### outbox_event_id

Type:

`uuid nullable`

Purpose:

Deterministic durable linkage from a relay-generated job to its source outbox event.

For M1A relay-created jobs this field is mandatory.

Foreign-key behavior:

**RESTRICT deletion of the referenced outbox row while the job row exists.**

This also protects traceability during later retention work.

Existing non-event jobs remain valid with null outbox_event_id.

### dedupe_key

Type:

`text nullable`

Purpose:

Generic enqueue dedupe.

Required for every relay-generated job.

Canonical uniqueness:

`(job_type, dedupe_key)`

where dedupe_key is not null.

Normal relay key is deterministic from:

- outbox event id;
- handler/job type.

The database-side dispatch boundary should construct or verify the normal key rather than trusting an external/user payload.

### correlation_id

Type:

`uuid nullable`

Required for relay-generated jobs.

It is copied from the outbox row, never trusted from event payload JSON.

### job_version

Type:

`smallint not null`

Compatibility default:

`1`

Purpose:

Version the handler/job contract.

Existing direct jobs remain version 1.

An incompatible handler input contract requires an explicit version change.

### relay-derived job invariant

For rows with non-null outbox_event_id:

- dedupe_key must be non-null;
- correlation_id must be non-null;
- job_version must be valid;
- company/user scope must match the source outbox row;
- payload remains a minimal dispatch reference, not a second copy of the event payload.

### relay-job payload bound

For relay-derived jobs only:

**8 KiB serialized JSON maximum.**

Canonical relay-derived job payload should normally contain only durable linkage/dispatch metadata such as the outbox event reference.

The actual event payload remains in `transactional_outbox`.

---

# 6. Changes Explicitly NOT Required

M1A does **not** require:

- changes to `event_idempotency`;
- a second event bus;
- a second outbox;
- a second job queue;
- Kafka;
- event sourcing;
- CQRS;
- an external workflow engine;
- outbox `locked_at`;
- outbox `locked_by`;
- another dead-letter table;
- a DB Action Registry table;
- changes to `timeline_events`;
- M1B audit implementation;
- M1C entitlement implementation;
- M1D consent implementation;
- M1E notification implementation;
- Customer Identity work;
- a generic M1F validation migration;
- disabling the existing orders/proposals producer triggers;
- an arbitrary completed-event retention duration;
- any new external provider integration.

---

# 7. Event Identity Model

Four identities must not be confused.

## 7.1 Event instance identity

Canonical:

`transactional_outbox.id`

This identifies exactly one durable publication instance.

It never means:

- aggregate identity;
- correlation identity;
- provider event identity.

## 7.2 Event semantic key

Canonical:

`event_type`

Examples already produced:

- `order.created`
- `order.ready`
- `payment.confirmed`
- `proposal.accepted`

Keys are stable.

Do not rename a published event contract casually.

Deprecate old keys after producers stop and backlog is drained.

## 7.3 Contract version

Canonical:

`event_version`

Registry lookup key:

`producer + event_type + event_version`

A version identifies the exact payload validator and consumer mapping.

Breaking payload change:

increment version.

Non-breaking internal implementation change:

do not increment merely for code churn.

## 7.4 Aggregate identity

Existing:

- aggregate_type
- aggregate_id

This identifies the domain resource the event describes.

It is not the event ID.

---

# 8. Producer / Product Ownership

`producer` is durable shared metadata.

Examples of conceptual producer domains:

- business
- wealth
- growth
- flow
- academy
- market
- partners
- platform
- integration.

The database does not maintain an authoritative product registry table.

The TypeScript Event Contract Registry owns:

- which producer exists;
- which event key belongs to it;
- supported event versions;
- payload validator;
- consumers.

Current Business trigger compatibility:

`producer = business`

through the migration default.

---

# 9. Scope Model

Scope never comes from untrusted JSON payload.

## Company event

Trusted:

`transactional_outbox.company_id`

Required:

- company_id non-null;
- user_id null.

Relay copies company_id to every generated background job.

Handler re-checks current company authorization where the action depends on mutable authorization.

## Personal event

Trusted:

`transactional_outbox.user_id`

Required:

- user_id non-null;
- company_id null.

Relay copies user_id to every generated background job.

The payload cannot override it.

## Platform event

Both scope columns null.

Only allowlisted platform contracts may use this.

A malformed event that supplies contradictory scope is non-retryable and goes to `needs_attention`.

---

# 10. Correlation Model

## Root event

If a trusted upstream correlation UUID exists:

reuse it.

Otherwise:

create a fresh UUID at publication.

## Outbox → job

Relay copies:

`outbox.correlation_id → job.correlation_id`

unchanged.

## Job → downstream event

If a handler produces another event:

- reuse the same correlation_id;
- set the new event's causation_id to the source event's outbox id.

## External request IDs

Arbitrary textual request IDs are not used as correlation keys.

They may belong in specialized audit/diagnostic metadata only after bounding/sanitization.

---

# 11. Causation Model

`causation_id` answers:

> Which immediate internal durable event caused this event?

For an event derived from another event:

`causation_id = parent transactional_outbox.id`

For a background job:

`outbox_event_id` is its immediate cause.

Therefore a separate job causation column is unnecessary.

A root domain transaction may have no causation_id.

---

# 12. Four Separate Idempotency Boundaries

## 12.1 External provider idempotency

Object:

`event_idempotency`

Key:

`provider + provider event_id`

Purpose:

Prevent re-processing provider webhook deliveries as new inbound events.

M1A change:

NONE.

---

## 12.2 Event publication dedupe

Object:

`transactional_outbox`

Key:

contract-specific `dedupe_key`

Uniqueness:

`producer + event_type + dedupe_key`

Purpose:

Prevent the same semantic domain event from being published twice when the producer can deterministically identify it.

Not every event requires publication dedupe.

Current transition-based Business triggers are not blindly assigned fabricated dedupe semantics by M1A.

Future detector/temporal producers must define deterministic publication keys.

---

## 12.3 Job enqueue dedupe

Object:

`background_jobs`

Normal relay key:

deterministic from:

`outbox_event_id + handler job_type`

Uniqueness:

`job_type + dedupe_key`

Purpose:

Two relay executions cannot enqueue the same consumer work twice.

This is generic enqueue idempotency.

It is not domain-side-effect idempotency.

---

## 12.4 Domain action idempotency

Owner:

the domain handler / target domain.

Purpose:

A worker retry, stale recovery, explicit replay, or provider uncertainty must not duplicate the real-world/domain side effect.

Examples conceptually:

- payment capture/refund uses payment-domain idempotency;
- notification delivery uses notification-domain delivery key;
- integration write uses provider/domain idempotency;
- automation action uses action execution key.

A job row existing exactly once does **not** prove a side effect executed exactly once.

Every side-effecting handler must check its own action idempotency before effect.

---

# 13. Private Relay / Dispatcher Contract

## 13.1 Runtime boundary

The relay is server/worker-only.

It is never callable by normal product users.

Likely runtime entrypoint:

`app/api/cron/event-fabric/route.ts`

Authentication pattern:

- Node runtime;
- `Authorization: Bearer <CRON_SECRET>`;
- no query-string secret fallback;
- fail closed if secret unavailable;
- service-role database client only after route authentication.

A separate dedicated worker secret may be required by Agent 4, but M1A does not accept user/session auth as worker authorization.

## 13.2 Activation gate

Runtime code may be deployed before dispatch activation.

Use a fail-closed environment gate conceptually equivalent to:

`ORCALY_EVENT_FABRIC_ENABLED`

Default:

disabled.

Relay activation is allowed only when:

1. migration is present;
2. Agent 4 security gate passed;
3. Agent 3 staging QA passed;
4. every event key/version currently possible from enabled producers has a registry entry;
5. every dispatchable event contract has at least one allowlisted handler;
6. observability is live;
7. backlog handling runbook is ready.

## 13.3 Candidate read

Relay reads only:

- status queued/retrying;
- available_at <= current DB time;
- bounded batch;
- oldest eligible first.

A candidate SELECT does not create ownership.

Two relay instances are allowed to observe the same candidate.

Correctness does not depend on an application-level lease.

## 13.4 Contract validation

Before dispatch:

1. validate producer;
2. validate event key;
3. validate event_version;
4. validate scope columns;
5. validate aggregate fields required by contract;
6. validate payload serialized size;
7. reject secret-like keys/forbidden payload fields;
8. run the exact registry payload validator;
9. resolve allowlisted consumers.

Invalid contract:

fail closed.

No job is created.

Outbox goes to `needs_attention` through the narrow failure-settlement boundary.

## 13.5 Allowlisted mapping

The registry maps:

`producer + event_type + event_version`

to one or more:

`job_type + job_version + maxAttempts`

Nothing from payload may choose:

- job_type;
- handler module;
- function name;
- file path;
- authorization scope.

## 13.6 Atomic DB dispatch boundary

M1A should add one narrow service-only DB dispatch function conceptually named:

`orcaly_dispatch_outbox_event`

This name is a design identifier, not executable SQL.

The function must:

1. lock the requested outbox row transactionally;
2. verify it is still eligible;
3. verify expected producer/event key/version still match;
4. derive company/user/correlation from the stored row;
5. transition to processing inside the transaction;
6. insert every allowlisted job spec;
7. construct/verify deterministic job dedupe;
8. set outbox_event_id on jobs;
9. copy trusted scope to jobs;
10. copy correlation_id to jobs;
11. use minimal job payload;
12. treat existing matching jobs as idempotent success;
13. verify all expected jobs now exist;
14. mark the outbox row completed;
15. set processed_at;
16. commit atomically.

The relay itself never performs the domain side effect.

### Important processing-state semantic

`processing` is transaction-local for the new relay path.

Because dispatch and completion occur in one DB transaction, a normal committed M1A dispatch does not leave long-lived `processing` rows.

A persisted `processing` row observed by health checks is therefore an anomaly and must be surfaced.

## 13.7 Duplicate relay prevention

Two relay workers may call dispatch for the same event.

Correct result:

- first worker locks row and ensures all expected jobs;
- second worker either waits/skips and then observes completed, or encounters already-existing deterministic jobs;
- unique job dedupe prevents a second enqueue;
- outbox completion is idempotent.

No persistent outbox lease is required.

---

# 14. Relay Failure Settlement

M1A should add one narrow service-only failure settlement boundary conceptually named:

`orcaly_settle_outbox_failure`

It must not accept an arbitrary status string.

Inputs conceptually:

- outbox id;
- bounded sanitized error code/message;
- retryable true/false;
- next retry time when retryable.

It transactionally:

1. locks the event;
2. ignores already completed events;
3. increments dispatch attempts;
4. if retryable and attempts remain:
   - status = retrying;
   - available_at = bounded future retry time;
5. otherwise:
   - status = needs_attention;
6. stores sanitized bounded error;
7. never deletes the row.

If the DB is unavailable and failure settlement itself cannot run:

- the event remains queued/retrying;
- structured runtime error is emitted;
- backlog age health check detects it later.

Durability beats pretending the failure was recorded.

---

# 15. Handler Registry Contract

Likely file:

`lib/event-fabric/handlers.ts`

The registry is static TypeScript code.

No DB handler registry table.

Each handler definition contains conceptually:

- stable job_type;
- job_version;
- owning domain/product;
- accepted producer/event contracts;
- maxAttempts;
- retry classification;
- authorization-recheck requirements;
- domain idempotency requirement;
- execute function.

Unknown job_type/job_version:

`needs_attention`

No dynamic module path may come from the database or payload.

No `eval`, reflection-based function invocation, or user-supplied action names.

---

# 16. Event Contract Registry

Likely file:

`lib/event-fabric/contracts.ts`

Each event contract contains:

- producer;
- event_type;
- event_version;
- expected scope kinds;
- aggregate requirements;
- max payload bytes;
- runtime validator;
- forbidden/secret field rules;
- allowlisted consumers.

No new schema-validation package is required merely for M1A.

The repository currently has no Zod/AJV-style dependency.

M1A can use explicit TypeScript runtime validators with deterministic test fixtures.

A later library adoption requires separate justification.

---

# 17. Payload Validation Rules

Payload validation is both structural and security-sensitive.

Mandatory rules:

1. payload must be a plain JSON object for M1A shared contracts;
2. serialized event payload <= 32 KiB;
3. relay-derived job payload <= 8 KiB;
4. no secret-bearing field classes:
   - password
   - secret
   - token
   - authorization
   - cookie
   - api_key
   - access_token
   - refresh_token
   - credential bundle;
5. no raw OAuth code;
6. no raw provider credential;
7. no document/file body;
8. no unbounded provider response;
9. company/user/product scope from payload is never authoritative;
10. resource IDs are validated by the contract;
11. unexpected fields follow the contract's explicit policy;
12. handler validates again at execution because a stored row may predate current code.

Existing `lib/observability/application-errors.ts` sanitization should be reused for diagnostic error output.

Event payload is not an error log.

---

# 18. Background Worker Contract

Likely file:

`lib/event-fabric/worker.ts`

The generic worker continues to use existing:

- `claim_background_jobs`
- `settle_background_job`
- `recover_stale_background_jobs`.

For each claimed job:

1. lookup exact job_type/job_version;
2. unknown contract → needs_attention;
3. validate job envelope;
4. if outbox_event_id exists:
   - load source outbox row;
   - verify correlation;
   - verify scope equality;
   - verify event contract;
   - verify this handler is allowlisted for this event;
5. validate source payload;
6. derive trusted execution context from columns, not JSON;
7. re-check current authorization when handler policy requires;
8. re-check entitlement when required;
9. re-check consent when required;
10. check domain action idempotency;
11. execute handler;
12. settle completed/retrying/needs_attention;
13. sanitize every persisted/logged failure.

Worker claim is only a lease.

It never creates authorization.

---

# 19. Retry Contract

Default handler retry budget:

existing `background_jobs.max_attempts` default remains 5.

Individual allowlisted handlers may request a lower value.

M1A does not raise the DB maximum beyond the existing 25.

Recommended deterministic retry delay for event-fabric runtime:

```
delay_seconds = min(30 * 2^(attempt - 1), 900)
```

Meaning:

- first retry: 30s;
- then 60s;
- 120s;
- 240s;
- bounded at 15 minutes.

This is execution scheduling, not retention.

A handler may classify an error as non-retryable and immediately move to needs_attention.

No retry loop is performed inside one server request.

---

# 20. Failure Model

## 20.1 Outbox states

### queued

Meaning:

published, dispatch not yet ensured.

Transitions:

- successful atomic dispatch → completed;
- retryable relay/DB/temporary contract infrastructure failure → retrying;
- invalid/unknown contract or no handler mapping → needs_attention.

### processing

Meaning in M1A:

transaction-local dispatch state.

It should not remain committed after normal M1A dispatch.

Persisted processing row:

critical anomaly.

No age-based purge.

### completed

Meaning:

all expected background jobs were durably ensured.

It does **not** mean handlers completed.

Only completed outbox rows may later become eligible for an explicit retention policy.

No retention duration is defined by M1A.

### retrying

Meaning:

dispatch failed for a retryable reason and has a future available_at.

Transition:

- retry succeeds → completed;
- further retryable failure → retrying;
- retry budget exhausted → needs_attention;
- newly deterministic invalidity → needs_attention.

### failed

Legacy/reserved unresolved terminal failure state.

M1A relay should not normally create new failed rows.

If encountered:

- retain;
- health = degraded/critical operational finding;
- explicit operator resolution required.

Never purge by age.

### needs_attention

Canonical relay dead-letter/operator state.

Examples:

- unknown event contract;
- invalid payload;
- contradictory scope;
- no allowlisted handler after relay activation;
- retry budget exhausted.

No automatic purge.

No silent drop.

---

## 20.2 Background job states

### queued

Ready/future work not leased.

### running

Existing background_jobs execution state corresponding to active processing.

Claimed with worker id and locked_at.

### completed

Handler finished successfully or proved the domain action had already been applied idempotently.

### retrying

Retryable handler failure with future run_after.

### failed

Reserved explicit terminal unresolved failure.

M1A automatic worker policy should prefer:

- retrying for retryable;
- needs_attention for non-retryable/exhausted.

Existing failed rows remain supported and unpurged.

### needs_attention

Canonical handler dead-letter/operator state.

Examples:

- unknown job handler;
- invalid job contract;
- source outbox mismatch;
- non-retryable payload violation;
- exhausted retries;
- revoked/changed authorization where the correct outcome requires human/product intervention.

---

# 21. Specific Failure Cases

| Case | Relay / worker response | Final automatic state |
|---|---|---|
| retryable relay DB error | settle retry with bounded backoff when DB reachable | outbox retrying |
| relay DB unavailable entirely | leave durable row untouched + emit runtime error | outbox queued/retrying |
| invalid event contract | no job; sanitized reason | outbox needs_attention |
| unknown event version | no job | outbox needs_attention |
| no allowlisted consumer after activation | no job | outbox needs_attention |
| duplicate relay execution | deterministic job conflict/no-op | one job per handler; outbox completed |
| unknown job handler | no side effect | job needs_attention |
| invalid handler payload | no side effect | job needs_attention |
| retryable handler exception | no silent completion | job retrying |
| handler retries exhausted | no further auto retry | job needs_attention |
| stale worker lease | existing recover_stale_background_jobs | retrying or needs_attention |
| domain action already applied | handler proves idempotency | job completed with bounded duplicate-result metadata |
| permission revoked after enqueue | re-check current permission | handler-specific deny; usually needs_attention or safe no-op according to contract |
| entitlement expired after enqueue | re-check entitlement | no protected side effect |
| consent revoked after enqueue | re-check consent | no consent-gated side effect |

---

# 22. Existing Outbox Producers Before Relay Activation

## What happens if a new order/proposal occurs first?

Current trigger behavior remains.

The domain transaction commits.

A `transactional_outbox` row is durably inserted.

Without relay activation:

- it stays queued;
- no background job is generated;
- no domain side effect is executed;
- it is not deleted;
- health reports backlog.

This is preferable to silently dropping the fact.

## Should current producer triggers remain enabled?

**YES.**

Reason:

Disabling them loses durable business events.

Current volume is low and producers are already part of production schema.

M1A does not disable or alter them.

## Temporary containment before relay activation

Required containment:

1. do not add any new outbox producer;
2. do not purge outbox rows;
3. retain existing triggers;
4. deploy backlog observability before or with relay runtime;
5. keep relay feature gate disabled until contract/handler coverage is certified;
6. while relay is disabled, any unprocessed outbox row makes Event Fabric health **Degraded** immediately;
7. operator must be able to see event id/type/age/status without seeing sensitive payload.

No database mutation is performed by this design.

---

# 23. Relay Readiness Gate for Current Producer Keys

Before first activation, registry coverage must explicitly account for:

- business / order.created / v1
- business / order.ready / v1
- business / payment.confirmed / v1
- business / proposal.accepted / v1.

M1A does not invent fake/no-op consumers simply to empty the outbox.

If no real handler exists for an event contract:

relay activation is not ready for that event.

If a supposedly covered event reaches an active relay with no consumer mapping:

fail closed to `needs_attention`.

No silent “completed with zero consumers”.

---

# 24. Mandatory Observability

Likely helper:

`lib/event-fabric/health.ts`

Likely current endpoint to extend:

`app/api/admin/system-health/route.ts`

The existing Health UI renders services generically, so an initial Event Fabric service card does not require a new frontend component solely to show status.

## Required outbox metrics

- queued count
- retrying count
- processing count
- failed count
- needs_attention count
- completed count
- oldest eligible queued/retrying timestamp
- oldest unprocessed timestamp
- latest processed_at
- events by event_type/status, bounded top set for ops diagnostics.

Do not expose event payloads in health responses.

## Required job metrics

- queued count
- retrying count
- running count
- failed count
- needs_attention count
- oldest eligible job age
- oldest running lock age
- relay-derived jobs count
- latest completed event-fabric job
- job_type/status counts.

No job payload in health response.

## Health classification

### Relay disabled

If unprocessed outbox count = 0:

health may be Operational/Standby.

If any queued/retrying/processing/failed/needs_attention row exists:

**Degraded: RELAY_DISABLED_WITH_BACKLOG**

immediately.

### Relay enabled

Define:

`relayCadenceSeconds`

from deployment/runtime configuration.

Warning age:

`max(300 seconds, 3 × relayCadenceSeconds)`

Critical age:

`max(1800 seconds, 12 × relayCadenceSeconds)`

Rules:

- oldest eligible outbox > warning → Degraded;
- oldest eligible outbox > critical → Down/Critical;
- any persisted outbox processing row → Critical anomaly;
- any outbox needs_attention → Degraded;
- any outbox failed → Degraded;
- running job older than stale-recovery boundary → Degraded;
- any job needs_attention/failed → Degraded;
- DB health query failure → Unknown, never fake Operational.

## Structured runtime telemetry

Relay batch log fields:

- invocation id
- environment
- candidate count
- dispatched event count
- jobs ensured count
- duplicate enqueue count
- retrying count
- needs_attention count
- duration
- bounded event ids/types when needed.

Never log:

- raw payload;
- secrets;
- auth headers;
- OAuth data;
- provider credentials.

Existing application error sanitizer should be reused.

---

# 25. Backlog Alerting

Operational alerts are based on durable state, not request success alone.

Minimum alert conditions:

1. relay disabled + backlog exists;
2. oldest eligible row exceeds warning age;
3. oldest eligible row exceeds critical age;
4. any persisted processing row;
5. needs_attention count increases;
6. failed count increases;
7. stale running job exists after expected recovery window;
8. relay route repeatedly errors;
9. handler registry mismatch occurs;
10. invalid/secret-bearing payload is rejected.

M1A does not introduce a second alert storage table.

Initial machine-readable health can be exposed through the existing admin health endpoint and structured runtime logs.

External paging integration is deployment/operations configuration, not another M1A database system.

---

# 26. Retention Contract

Canonical rule:

**UNPROCESSED OUTBOX IS NEVER PURGED BY AGE.**

Protected statuses:

- queued
- processing
- retrying
- failed
- needs_attention.

## M1A database protection

The future M1A migration should remove ordinary application-service direct DELETE capability from `transactional_outbox`.

Relay does not need DELETE.

No time-based delete RPC is introduced by M1A.

If a future operations policy introduces retention, it must use a narrow service-only boundary that can delete **only**:

`status = completed`

under an explicitly approved cutoff.

## FK protection

Relay-derived jobs reference outbox rows through outbox_event_id with restrictive deletion behavior.

Therefore a completed outbox row cannot disappear while dependent job history still requires it.

Future retention policy must coordinate completed job/outbox retention explicitly.

## No day count

M1A deliberately defines no:

- 7-day
- 30-day
- 90-day
- arbitrary completed-row retention.

That decision belongs to a later operations policy.

---

# 27. Future Migration Shape

## Proposed migration count

**1**

Working name:

`m1a_event_fabric_safety_contract`

Exact timestamp:

**NOT ASSIGNED**

## Migration responsibilities

The one future migration should own:

### transactional_outbox

- additive contract columns;
- scope constraint;
- event version constraint;
- producer/dedupe bounds;
- payload bound;
- publication-dedupe index.

### background_jobs

- additive event-fabric linkage columns;
- user scope;
- job_version;
- correlation;
- generic dedupe;
- outbox link;
- partial generic enqueue-dedupe index;
- relay-derived invariant checks.

### relay DB boundaries

- narrow atomic dispatch function;
- narrow relay failure settlement function;
- fixed safe search_path;
- service-only execution grants.

### grants

- preserve no anon/authenticated access;
- preserve service worker requirements;
- remove direct service-role DELETE from outbox if Agent 4 confirms the retention hardening model.

## No separate generic validation migration

M1F was removed by Coordinator reconciliation.

Validation belongs to this owning domain change.

Current live tables are empty.

The additive checks can be validated as part of the same M1A migration boundary after mandatory preflight.

If implementation-time facts materially differ, the Migration Owner must stop and re-split rather than blindly preserve this count.

---

# 28. Mandatory Preflight Before Migration Creation

Immediately before any future M1A migration file is created, Agent 1 must re-read:

- canonical main SHA;
- production migration ledger;
- staging migration ledger;
- next safe migration version;
- row counts for the three event tables;
- existing outbox event types;
- max payload sizes;
- current grants/RLS;
- current worker functions;
- current producer trigger definitions.

Stop/reconcile if:

1. another agent created a newer migration;
2. event fabric rows are unexpectedly non-empty with unknown producers/contracts;
3. current triggers changed;
4. worker RPC grants changed;
5. a second queue/event implementation appeared;
6. production/staging schema drift changes the proposed delta.

---

# 29. Compatibility / Rollout Sequence

Future implementation should use this order:

## Phase 1 — Schema

Apply the single M1A migration to authorized staging only.

No relay activation yet.

Existing producer triggers remain compatible because:

- producer defaults to business;
- event_version defaults to 1;
- correlation gets a root UUID;
- new optional fields remain nullable where compatibility requires.

## Phase 2 — Runtime code deployed disabled

Deploy:

- event contract registry;
- handler registry;
- relay;
- worker;
- health queries.

Feature gate remains OFF.

## Phase 3 — QA

Agent 4 review.

Agent 3 acceptance matrix.

Concurrency, security, dedupe, replay and health checks must pass.

## Phase 4 — Registry coverage gate

Confirm every currently possible production producer contract is known.

No empty/no-op consumer trick.

## Phase 5 — Controlled activation

Enable relay/worker in approved environment.

Drain intentionally seeded test backlog first.

Observe health.

## Phase 6 — Producer expansion

Only after relay health is certified may future work add new outbox producers.

---

# 30. Application / Runtime File Impact

No application file is modified by this design.

The following are the **likely exact implementation files** for a later authorized mission.

## DATABASE

Future new migration:

generated via migration tooling with working name:

`m1a_event_fabric_safety_contract`

No existing applied migration file is edited.

## RELAY

Create:

`lib/event-fabric/relay.ts`

Responsibilities:

- read eligible outbox batch;
- validate registry contract;
- resolve handler specs;
- call atomic dispatch/failure RPCs;
- emit sanitized batch telemetry.

Create:

`app/api/cron/event-fabric/route.ts`

Responsibilities:

- Authorization Bearer cron/worker authentication;
- fail-closed feature gate;
- invoke bounded relay + worker ticks;
- return sanitized operational summary.

Modify at activation time:

`vercel.json`

Purpose:

schedule the Event Fabric tick only after environment authorization.

The cadence is a deployment decision and is not frozen by this document.

## HANDLER REGISTRY

Create:

`lib/event-fabric/contracts.ts`

Create:

`lib/event-fabric/handlers.ts`

Create:

`lib/event-fabric/worker.ts`

No database handler-registry table.

## OBSERVABILITY

Create:

`lib/event-fabric/health.ts`

Modify:

`app/api/admin/system-health/route.ts`

Initial UI component modification is **not required** merely to add an Event Fabric service card because the current Health UI renders the service array generically.

If additional Event Fabric metric cards are later approved, then:

`components/admin/AdminSystemHealthV3.tsx`

may be modified in that implementation mission.

## EXISTING SANITIZER REUSE

Reuse without required M1A change:

`lib/observability/application-errors.ts`

## TESTS

Create:

`scripts/verify-m1a-event-fabric.mjs`

Modify:

`package.json`

to add the M1A verification command to the canonical test/prebuild gate after implementation is authorized.

---

# 31. Agent 3 Acceptance Matrix

| ID | Acceptance test | Expected result |
|---|---|---|
| QA-01 | Same outbox event relayed twice sequentially | exactly one background job per handler |
| QA-02 | Two relay workers dispatch same row concurrently | no duplicate job; one completed dispatch result |
| QA-03 | Relay retries after crash before atomic dispatch | event remains dispatchable; no loss |
| QA-04 | Relay repeats after jobs already inserted | existing deterministic jobs treated as success; no new jobs |
| QA-05 | Invalid event key/version | no job; outbox needs_attention |
| QA-06 | Valid event with invalid payload | no job; outbox needs_attention |
| QA-07 | Secret-like payload field | rejected fail-closed; secret absent from logs/errors |
| QA-08 | Active relay event has no handler mapping | no silent completion; needs_attention |
| QA-09 | Unknown job_type/job_version | no handler invocation; job needs_attention |
| QA-10 | Retryable handler exception | same job moves retrying; no duplicate enqueue |
| QA-11 | Retry budget exhausted | job needs_attention |
| QA-12 | Wrong worker attempts settlement | existing settle function rejects/no update |
| QA-13 | Two job workers claim concurrently | same job cannot be claimed twice |
| QA-14 | Stale running job | existing recovery returns retrying or needs_attention by attempt budget |
| QA-15 | Correlation propagation | exact UUID survives outbox → job |
| QA-16 | Company scope propagation | job company_id exactly equals source outbox; payload cannot override |
| QA-17 | Personal scope propagation | job user_id exactly equals source outbox; payload cannot override |
| QA-18 | Contradictory company+user scope | event rejected; no job |
| QA-19 | Platform scope for non-allowlisted contract | rejected |
| QA-20 | Domain action already applied | handler proves idempotency; no repeated side effect; job completes |
| QA-21 | Entitlement revoked after enqueue for protected handler | execution denies side effect |
| QA-22 | Consent revoked after enqueue for consent-gated handler | execution denies side effect |
| QA-23 | Worker lease obtained | lease alone does not bypass authorization |
| QA-24 | Outbox queued before relay enabled | row persists; health reports Degraded |
| QA-25 | Unprocessed retention attempt through application service role | direct delete denied / row preserved |
| QA-26 | Completed event with dependent job | restrictive link prevents accidental source deletion |
| QA-27 | anon calls relay/worker RPC | denied |
| QA-28 | authenticated calls relay/worker RPC | denied |
| QA-29 | anon/authenticated reads/writes event tables directly | denied |
| QA-30 | service relay error includes token-like input | persisted/logged error is sanitized and bounded |
| QA-31 | event payload > 32 KiB | fail closed |
| QA-32 | relay-derived job payload > 8 KiB | fail closed |
| QA-33 | existing order/proposal trigger after schema migration | event inserts successfully using compatibility defaults |
| QA-34 | event_idempotency schema/behavior regression | unchanged inbound-provider idempotency contract |
| QA-35 | existing integration/calendar background-job indexes | remain valid and unmodified |
| QA-36 | processing outbox row visible after normal dispatch | test fails; normal transaction must commit completed or roll back |
| QA-37 | needs_attention / failed rows | health degrades and rows are not purged |
| QA-38 | no payload leakage in admin health | health output contains counts/ids/types only |
| QA-39 | registry attempts dynamic handler from payload | impossible by API/type design |
| QA-40 | full repository test command | passes without weakening prior P1 notification isolation |

---

# 32. Agent 4 Security Handoff

Agent 4 must review the implementation against the exact points below.

## SECURITY DEFINER

Review:

- atomic outbox dispatch function;
- outbox failure settlement function;
- unchanged claim/settle/recover job functions.

Requirements:

- SECURITY DEFINER only where technically required;
- no user identity inferred from function caller;
- explicit argument validation;
- no arbitrary table/function names.

## search_path

Every privileged M1A function:

- fixed safe search_path;
- prefer `pg_catalog` plus explicit qualified object names;
- no caller-controlled schema resolution.

## grants

Verify:

- PUBLIC EXECUTE revoked where applicable;
- anon EXECUTE denied;
- authenticated EXECUTE denied;
- service/worker only;
- no anon/authenticated table grants introduced;
- proposed outbox DELETE hardening does not break legitimate operational tooling.

## Data API exposure

Confirm:

- Event Fabric tables remain internal/server surfaces;
- no browser RLS policy is added merely because tables are in public schema;
- RLS remains enabled as defense in depth.

## scope trust boundary

Confirm:

- company_id/user_id never trusted from payload;
- relay derives job scope from stored outbox columns;
- external/provider input cannot select tenant;
- personal UUID historical-reference design without Auth FK is acceptable, or require an alternative that preserves semantics on user deletion.

## payload validation

Confirm:

- 32 KiB outbox bound;
- 8 KiB relay-job bound;
- secret-like fields rejected;
- no provider credential/raw document payload;
- runtime validators are exact by event version.

## job ownership

Confirm:

- locked_by is lease identity only;
- settlement remains bound to worker;
- domain authorization is separate.

## idempotency

Confirm all four boundaries remain separate:

1. provider inbound;
2. publication;
3. enqueue;
4. domain action.

No generic key is accepted as proof of all four.

## replay

Confirm:

- replay cannot bypass current permission;
- replay cannot bypass expired entitlement;
- replay cannot bypass revoked consent;
- explicit privileged replay uses new enqueue identity only after authorization;
- domain idempotency still prevents repeated effect.

## metadata / error leakage

Confirm:

- no raw payload in Health Center;
- no secrets in job metadata;
- bounded sanitized last_error;
- structured logs redact auth/provider secrets;
- correlation/causation identifiers are non-secret.

## retention

Confirm:

- direct application DELETE of outbox is unnecessary and may be revoked;
- unprocessed rows have no age-based deletion path;
- later completed-row retention requires separate explicit approval.

---

# 33. Security Properties Required Before Activation

Relay/worker activation is prohibited unless all are true:

- no anon RPC execution;
- no authenticated RPC execution;
- no browser Event Fabric write path;
- fixed safe search paths;
- registry is static/allowlisted;
- payload validators active;
- scopes are DB-derived;
- error sanitization active;
- job dedupe index active;
- correlation propagation active;
- current authorization re-check hooks exist for sensitive handlers;
- health checks active;
- Agent 4 review passed;
- Agent 3 concurrency/security QA passed.

---

# 34. Forward-Fix / Rollback Model

M1A should avoid a destructive rollback requirement.

## Schema additions

If runtime activation fails:

- disable Event Fabric runtime gate;
- leave additive columns/indexes/functions in place;
- existing producer triggers continue inserting compatible queued rows;
- no event is deleted;
- fix forward.

## Relay bug

Disable runtime.

Do not delete queued/retrying/needs_attention events.

Correct registry/runtime and replay only through approved operational path.

## Bad handler mapping

Stop relay/worker.

Rows already enqueued remain inspectable.

Do not mass-complete them.

Fix mapping and explicitly resolve/requeue.

## Migration defect before runtime activation

Since M1A is additive:

prefer a new forward corrective migration.

Do not edit applied migration history.

---

# 35. Risks and Mitigations

## Risk: outbox accumulates before relay

Mitigation:

- keep events durable;
- health degrades immediately when relay disabled with backlog;
- no new producers;
- no purge.

## Risk: duplicate relay execution

Mitigation:

- DB transaction boundary;
- deterministic job dedupe;
- unique job_type + dedupe_key.

## Risk: exactly-once myth

Mitigation:

Job enqueue exactly-once does not claim domain side-effect exactly-once.

Domain handlers remain independently idempotent.

## Risk: service_role bypasses RLS

Mitigation:

Every trusted scope and authorization dimension is reconstructed explicitly in server/worker code.

## Risk: poison contract

Mitigation:

needs_attention, no silent drop, health alert.

## Risk: oversized/secret payload

Mitigation:

size guard + runtime contract validator + secret-field reject + sanitized errors.

## Risk: worker replay after authorization changed

Mitigation:

execution-time authorization/entitlement/consent re-check.

## Risk: current producer event has no consumer

Mitigation:

relay activation coverage gate; no fake no-op handler.

---

# 36. Decisions Intentionally Deferred

M1A does not freeze:

- completed outbox retention duration;
- external paging vendor;
- exact cron cadence;
- future handler list beyond real authorized consumers;
- M1B audit implementation;
- M1C entitlement contract;
- M1D consent runtime;
- M1E notification inbox;
- Customer Identity;
- provider-specific event contracts not already authorized.

These do not block M1A implementation design.

---

# 37. Coordinator Review Checklist

Coordinator should confirm before actual implementation authorization:

1. one-migration proposal accepted;
2. outbox producer triggers remain enabled;
3. outbox relay uses no persistent lock columns;
4. event_idempotency remains unchanged;
5. producer/event version/correlation/causation/scope/dedupe columns accepted;
6. background_jobs outbox linkage/dedupe/correlation/job_version accepted;
7. atomic service-only dispatch RPC accepted;
8. service-only failure settlement RPC accepted;
9. no-consumer condition fails closed;
10. no-op handlers are forbidden;
11. direct application outbox DELETE removal accepted;
12. relay feature gate accepted;
13. health thresholds/formula accepted;
14. TypeScript registry file family accepted;
15. cron route authentication model accepted;
16. Agent 4 handoff complete;
17. Agent 3 matrix complete.

---

# 38. Final Status

```
M1A_IMPLEMENTATION_DESIGN:
COMPLETE

BASE_SHA:
26b78cc716eb35da18a12500d22a7703e8ce0aa6

EVENT_MODEL:
DEFINED

OUTBOX_DELTA:
DEFINED

RELAY_CONTRACT:
DEFINED

BACKGROUND_JOB_CONTRACT:
DEFINED

IDEMPOTENCY_MODEL:
DEFINED

FAILURE_MODEL:
DEFINED

OBSERVABILITY:
DEFINED

RETENTION:
DEFINED

SECURITY_HANDOFF:
READY

QA_PLAN:
READY

PROPOSED_MIGRATION_COUNT:
1

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

READY_FOR_COORDINATOR_REVIEW:
YES
```

END OF MISSION.
