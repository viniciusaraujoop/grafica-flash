# ORÇALY — M1B SHARED AUDIT CONTRACT DESIGN — SECURITY AMENDED

**Status:** DESIGN AMENDMENT COMPLETE — IMPLEMENTATION NOT AUTHORIZED  
**Original design SHA:** `d88173d8779f90b3535f49edd316dea4d5e7b2d8`  
**Security review SHA:** `3c700bf7fb639cb0a80d26535484c16e01af1541`  
**Certified M1A base:** `82056e08a0cdecf4a7f18146325ee83359828e95`

This document is the **freeze authority for M1B** and supersedes the original
`ORCALY_M1B_SHARED_AUDIT_CONTRACT_DESIGN.md` for implementation-design freeze purposes.

All original M1B decisions that are not explicitly amended here remain preserved.

This amendment resolves exactly:

- 2 P2 findings;
- 4 P3 hardening findings.

It does not authorize implementation, migration creation, SQL execution, staging mutation, production mutation, or main merge.

---

# 1. PRESERVED ARCHITECTURE

The following accepted M1B decisions are unchanged:

- `public.ecosystem_audit_events` remains the canonical Shared Audit surface;
- audit classes remain `ROW_CHANGE` and `ACTION`;
- specialized logs remain specialized;
- there is no second audit table or audit bus;
- Action Registry remains TypeScript-first;
- there is no database Action Registry table;
- Shared Audit remains independent from Event Fabric activation;
- audit delivery is not routed through Event Fabric;
- `event_id`, `correlation_id`, and `causation_id` remain trace evidence only;
- Shared Audit is append-only for normal application paths;
- exact retention durations remain outside M1B;
- existing legacy rows receive **NO SEMANTIC BACKFILL**;
- existing specialized writers remain unchanged until separately authorized;
- production promotion remains gated on the first real shared-audit consumer.

The amendment does not redesign M1B. It closes structural and consistency gaps identified by the independent security review.

---

# 2. SECURITY FINDING RESOLUTION MATRIX

| Finding | Requirement | Amended rule | Future migration implication | Status |
|---|---|---|---|---|
| **M1B-P2-1** | Legacy `audit_contract_version IS NULL` must remain readable, but NULL must not remain a future-write mode. Explicit NULL and omitted version must fail for all new rows. | Add a database **new-row contract-version guard**. Every future INSERT must carry a supported non-null version. Legacy NULL rows are preserved because the guard is INSERT-only. Initial supported set is exactly v1. | Install/upgrade canonical ROW_CHANGE trigger first, then install the INSERT guard in the same migration transaction. Strict v1 checks remain structurally validated. | **RESOLVED** |
| **M1B-P2-2** | Historical actor/user/company identity must survive source entity deletion. `ON DELETE SET NULL/CASCADE` is incompatible with append-only evidence. | Historical UUID fields are stored as durable evidence identifiers, not ownership FKs. Existing `actor_id` destructive FK is removed without rewriting values. New `company_id`, `scope_user_id`, and `subject_user_id` receive no destructive lifecycle FK. Identity is validated at INSERT time by trusted writer/trigger context. | Drop the destructive `actor_id → auth.users ON DELETE SET NULL` constraint only. Preserve values. Add future historical identity columns as UUID evidence columns without destructive FK actions. | **RESOLVED** |
| **M1B-P3-1** | Combined before/after snapshots must have one DB-enforced 16 KiB total budget. | Database check enforces `serialized(before_snapshot) + serialized(after_snapshot) <= 16 KiB`. NULL contributes zero. This is one combined budget, not 16 KiB per column. | Add a v1 structural check using serialized UTF-8 byte length of both JSONB projections together. | **RESOLVED** |
| **M1B-P3-2** | ACTION dedupe must include immutable action identity/version/instance/lifecycle semantics and resolve concurrency through uniqueness. | Every canonical v1 ACTION gets a deterministic `dedupe_key` derived by the canonical writer from action key + action version + action_instance_id + lifecycle/result stage. Database partial unique indexes enforce scope-aware uniqueness. No SELECT-before-INSERT race check. | Make `dedupe_key` mandatory for v1 ACTION, bound its syntax/size, and keep the three scope-aware partial unique indexes. | **RESOLVED** |
| **M1B-P3-3** | Indexed/canonical identifiers need frozen length and syntax bounds; opaque resource IDs must not be normalized. | Explicit maximum lengths and canonical syntax are frozen in section 8. `entity_id` remains opaque and byte-for-byte identity-preserving. Resource identifiers never authorize tenant access. | Add v1 length/shape checks for canonical identifiers before creating indexes. | **RESOLVED** |
| **M1B-P3-4** | Selective bridges need explicit authority and partial-failure semantics. | Every future bridge requires a bridge contract defining canonical evidence source, coupling, both failure directions, shared action identity, safe projection, read dedupe, and side-effect behavior on audit failure. High-risk mandatory Shared Audit fails closed before side effect where possible. | No bridge is created by M1B migration. Consumer implementation cannot dual-write until its bridge contract is separately reviewed and tested. | **RESOLVED** |

---

# 3. P2-1 — NEW-ROW CONTRACT VERSION GUARD

## 3.1 Legacy meaning is historical only

Existing rows with:

`audit_contract_version IS NULL`

mean only:

> row created before canonical M1B contract enforcement.

They do **not** mean:

> legacy write mode available to current or future writers.

Existing NULL rows remain untouched and receive no inferred semantic fields.

## 3.2 Exact conceptual database mechanism

The future one owning-domain M1B migration installs a private **BEFORE INSERT row trigger** on:

`public.ecosystem_audit_events`

Conceptual components:

- private trigger function:
  `ecosystem_private.enforce_shared_audit_insert_contract()`
- table trigger:
  `ecosystem_audit_events_insert_contract_guard`
- timing:
  `BEFORE INSERT FOR EACH ROW`

The guard is database-enforced and executes for:

- canonical ACTION writer inserts;
- canonical ROW_CHANGE trigger inserts;
- direct `service_role` table inserts;
- maintenance/import inserts unless separately privileged tooling intentionally uses a future reviewed path.

For every new row, the guard requires:

1. `audit_contract_version IS NOT NULL`;
2. the version is in the currently supported write-version set;
3. the row satisfies the version-specific structural contract.

Initial supported write-version set:

- `1` only.

Therefore:

- omitted version fails because it remains NULL;
- explicit NULL fails;
- an ACTION writer cannot select legacy mode;
- a ROW_CHANGE trigger cannot select legacy mode;
- direct service-role INSERT with NULL fails;
- unsupported future version fails closed.

There is **no default value** on `audit_contract_version`.

A default would hide missing writer behavior and could silently classify unmodernized producers as canonical.

## 3.3 Why an INSERT guard is used

A pure validated CHECK requiring non-null version cannot coexist with untouched historical NULL rows.

A forever-unvalidated CHECK would preserve legacy rows and protect new rows, but would leave an intentionally unvalidated schema invariant.

M1B instead freezes a clearer model:

- version-specific structural CHECK constraints can be fully validated because they explicitly allow historical `audit_contract_version IS NULL`;
- the **INSERT-only trigger guard** makes NULL impossible for all future rows;
- ordinary application UPDATE is revoked, so legacy rows cannot be repurposed through normal runtime mutation.

This gives read compatibility for legacy history without retaining a future-write escape hatch.

## 3.4 Future version evolution

A future v2 migration must atomically:

1. add v2-specific structural checks;
2. deploy v2-capable canonical writer/trigger contract where required;
3. update the new-row guard supported-version set from `{1}` to `{1,2}`;
4. preserve v1 checks;
5. reject all other versions.

The guard never accepts “any positive version”.

Unknown versions fail closed.

---

# 4. ATOMIC MIGRATION ORDER FOR VERSION ENFORCEMENT

M1B remains **one owning-domain migration**.

The migration must run atomically. Any failure aborts the whole migration.

The required order is frozen as follows.

## Step 0 — expected-shape preflight

Before altering an existing `ecosystem_audit_events`, inspect catalog shape inside the migration and abort if the existing table is incompatible with the expected legacy contract.

If the table already exists, verify at minimum:

- expected primary key;
- `id` type;
- `actor_id` type;
- `event_type` type;
- `entity_id` type;
- `recorded_at` type;
- RLS state can be safely hardened;
- known actor FK state is recognizable.

Do not silently accept an incompatible pre-existing table merely because the relation name exists.

If the table is absent in an authorized target, create the canonical base shape directly.

## Step 1 — add canonical fields

Add M1B v1 columns as additive nullable columns required for legacy compatibility.

Do not assign semantic defaults for:

- audit version;
- product;
- actor kind;
- company/personal scope;
- result;
- action version;
- purpose;
- retention class.

## Step 2 — establish non-destructive historical identity

Remove the existing destructive:

`actor_id → auth.users ON DELETE SET NULL`

foreign-key semantics without changing stored `actor_id` values.

Add future historical identity columns without destructive ownership FKs.

## Step 3 — install strict version-specific structural checks

Install the v1 structural checks using a compatibility predicate:

- legacy NULL rows remain accepted as historical rows;
- any row with non-null version must satisfy a known version contract;
- only supported frozen versions are structurally recognized.

These checks include:

- audit class;
- actor shape;
- scope shape;
- action/row-change requirements;
- identifier bounds;
- metadata byte bound;
- combined snapshot byte bound;
- dedupe shape;
- bounded vocabularies.

## Step 4 — upgrade the canonical ROW_CHANGE trigger function

Upgrade `ecosystem_private.record_change()` so every new ROW_CHANGE insert explicitly emits:

- `audit_contract_version = 1`;
- `audit_kind = ROW_CHANGE`;
- required v1 actor/scope/resource/table/operation fields;
- reviewed retention class;
- bounded metadata/snapshot projection.

The trigger must no longer be capable of producing the legacy NULL-version shape.

## Step 5 — enable the new-row version guard

Only after Step 4, install/enable:

`ecosystem_audit_events_insert_contract_guard`.

From this point every new INSERT requires a supported non-null version.

Because the entire migration is one database transaction, no other session can observe a committed intermediate state where:

- legacy ROW_CHANGE still writes NULL;
- while the new guard already rejects NULL.

There is no second cleanup migration.

## Step 6 — create indexes

Create:

- justified query indexes;
- scope-aware ACTION unique indexes.

## Step 7 — freeze RLS and grants

Final normal application privileges:

- anon: none;
- authenticated: none directly;
- service_role: SELECT + INSERT only.

Explicitly revoke normal:

- UPDATE;
- DELETE;
- TRUNCATE.

## Step 8 — validate final contract

Validate all final version-specific structural constraints that are designed to be valid across:

- historical NULL rows; and
- canonical v1 rows.

The INSERT guard itself remains the new-row-only historical boundary and therefore does not require rewriting legacy rows.

## Step 9 — commit or abort

The migration commits only if all prior steps succeed.

---

# 5. P2-2 — HISTORICAL IDENTITY MODEL

## 5.1 Canonical rule

Audit identity is evidence, not an ownership relation.

Historical identifiers must survive deletion of the source entity.

For Shared Audit, the following fields are historical UUID evidence:

- `actor_id`;
- `company_id`;
- `scope_user_id`;
- `subject_user_id`.

They must not use referential actions that:

- delete the audit row;
- set the historical identifier to NULL;
- mutate the historical identifier when the source entity lifecycle changes.

Therefore canonical M1B prohibits for these audit identity fields:

- `ON DELETE CASCADE`;
- `ON DELETE SET NULL`.

## 5.2 actor_id amendment

The existing staging source relation:

`actor_id REFERENCES auth.users(id) ON DELETE SET NULL`

is not canonical M1B.

The future M1B migration removes that FK while preserving every existing UUID value.

`actor_id` remains a UUID column.

Deleting an Auth user later does not rewrite prior audit evidence.

## 5.3 Future user/company references

M1B chooses **validated historical identifiers without lifecycle FKs** for:

- `company_id`;
- `scope_user_id`;
- `subject_user_id`.

This avoids two bad outcomes:

1. destructive FK actions rewriting/deleting evidence;
2. restrictive FKs indefinitely preventing legitimate hard deletion solely because audit evidence exists.

Audit retention is governed by audit policy, not entity garbage collection.

## 5.4 Insert-time identity validation

Removing lifecycle FKs does not authorize arbitrary UUIDs.

Validation is performed before/while the audit row is created by trusted execution boundaries.

### ACTION writer

The canonical server-only ACTION writer derives and validates:

- `actor_id` from verified current session/admin identity;
- `company_id` from the current authorized company context;
- `scope_user_id` from the authenticated personal context;
- `subject_user_id` from the action/resource contract and its authorized target lookup;
- `product_id`, `source`, and `purpose_key` from static TypeScript Action/Product Registry definitions;
- `actor_key` for non-user identities from static service/system/automation/AI registry configuration.

Client/request payload does not become trusted actor or scope identity merely because it contains a UUID.

### ROW_CHANGE trigger

The canonical table-specific trigger contract derives:

- resource id from the audited relation;
- company/personal/platform scope from reviewed table ownership mapping;
- authenticated human actor from trusted database auth context where available;
- otherwise static registered SYSTEM/SERVICE actor identity.

The changed row cannot supply an arbitrary privileged `actor_key`.

### Direct service-role INSERT

Direct ad-hoc application INSERT outside the canonical writer is not an approved ownership pattern.

The DB still enforces:

- non-null supported contract version;
- actor/scope structural invariants;
- bounds;
- canonical vocabularies;
- dedupe uniqueness.

The trusted service-role remains an application trust root. M1B does not claim cryptographic non-forgeability against a fully compromised service-role credential.

Source/CI ownership should assert that ACTION inserts are centralized in the canonical writer once implementation is authorized.

---

# 6. APPEND-ONLY FINAL RULE

Normal application paths must not be capable of:

- UPDATE of historical Shared Audit rows;
- DELETE of historical Shared Audit rows;
- TRUNCATE of Shared Audit;
- indirect identity rewrite via user/company deletion;
- indirect audit deletion via ownership cascade.

The append-only model therefore consists of **both**:

1. privilege controls:
   - service_role SELECT + INSERT only;
2. lifecycle-reference controls:
   - no destructive historical identity FKs.

Maintenance, retention, archival, and exceptional remediation remain separate privileged future-authorized operations.

A maintenance owner may eventually delete/transform evidence under an explicit retention/remediation authorization, but that capability is not granted to normal application service-role access.

---

# 7. P3-1 — COMBINED SNAPSHOT BOUND

## 7.1 Frozen budget

The total serialized storage budget for:

- `before_snapshot`;
- `after_snapshot`;

combined is:

**16 KiB total = 16,384 UTF-8 bytes.**

It is not:

- 16 KiB before + 16 KiB after;
- 32 KiB combined.

## 7.2 Database enforcement

For canonical v1 rows, the database structural check computes the serialized UTF-8 byte size of:

- before snapshot, with NULL contributing zero;
- plus after snapshot, with NULL contributing zero.

The sum must be:

`<= 16,384 bytes`.

Application validation may reject earlier, but database enforcement is mandatory.

## 7.3 Snapshot policy remains opt-in

Default ROW_CHANGE remains:

- resource identity;
- row operation;
- safe changed-field names;
- no arbitrary before/after row copy.

Snapshots remain default-OFF for:

- financial/Wealth sensitive detail;
- provider credentials/state;
- documents/document bodies;
- payment/provider payloads;
- sensitive consent context;
- large JSON/blob-like fields.

When specifically approved:

- INSERT → after projection only;
- DELETE → before projection only;
- UPDATE → reviewed before/after projections;
- allowlisted fields only;
- no generic `to_jsonb(NEW)` / `to_jsonb(OLD)` persistence.

---

# 8. P3-3 — CANONICAL IDENTIFIER BOUNDS

M1B freezes explicit v1 limits.

Lengths are measured as stored character length for text-shape constraints; byte-size limits are separately used for JSON payload budgets.

| Field | v1 maximum | Canonical rule |
|---|---:|---|
| `event_type` / ACTION key | 160 chars | lower-case stable dot-separated key |
| `resource_type` | 96 chars | lower-case stable dot-separated resource name |
| `entity_id` | 256 chars | opaque non-empty evidence id; **no normalization** |
| `request_id` | 128 chars | bounded trace id; preserve exact accepted value |
| `actor_key` | 128 chars | lower-case registered non-user actor key |
| `source` | 96 chars | lower-case registered/static writer source |
| `product_id` | 64 chars | lower-case registered product id |
| `purpose_key` | 128 chars | lower-case stable purpose key |
| `dedupe_key` | 67 chars for v1 canonical ACTION | `a1:` + 64 lower-case hex characters |
| `row_table` | 128 chars | schema-qualified lower-case relation identifier |
| `changed_fields[]` item | 96 chars | bounded field name, allowlisted by table contract |

## 8.1 Canonical syntax

For v1 stable keys such as:

- action/event key;
- resource type;
- actor key;
- source;
- product id;
- purpose key;

use lower-case ASCII identifiers composed from:

- letters;
- digits;
- dot;
- underscore;
- hyphen;

with:

- non-empty first segment;
- no whitespace;
- no control characters;
- no leading/trailing dot;
- no empty dot segment.

The TypeScript registry remains semantic authority.

The database shape check is defense in depth.

## 8.2 Opaque identifiers

`entity_id` is evidence identity and may represent:

- UUID;
- provider object id;
- domain text id;
- other reviewed resource key.

It is bounded but **not normalized**.

Do not:

- lowercase;
- trim semantic content after validation;
- remove punctuation;
- reinterpret provider/domain IDs.

If a domain identifier exceeds 256 characters, that consumer must define a stable internal identity or separately reviewed digest/reference contract before adoption.

## 8.3 request_id

`request_id` is bounded to 128 characters.

The writer accepts only its reviewed safe trace format and stores the accepted value unchanged.

An unsafe/unbounded external request token is not copied into Shared Audit merely because a provider called it an “id”.

## 8.4 Resource identifiers are not authorization

`resource_type + entity_id` answers:

> which resource does this evidence refer to?

It does not answer:

> may this requester access that resource?

Cross-company/cross-user read authorization always comes from:

- `scope_kind`;
- `company_id` or `scope_user_id`;
- current membership/permission/product access;
- current platform permission where relevant.

Knowledge of a resource id never grants access.

---

# 9. METADATA DATABASE BOUND

The original positive-allowlist privacy model remains.

Canonical v1 `metadata` total serialized UTF-8 size is capped by database structural check at:

**8 KiB = 8,192 bytes.**

Application validation additionally owns:

- positive action-specific key allowlist;
- recursive secret denylist;
- maximum depth;
- maximum key count;
- maximum array length;
- maximum individual string length.

The database byte bound is the final storage-safety boundary.

---

# 10. P3-2 — ACTION DEDUPE HARDENING

## 10.1 Canonical v1 rule

Every canonical v1 `ACTION` row requires:

- `action_instance_id`;
- stable action key in `event_type`;
- `key_version`;
- lifecycle/result stage in `result`;
- deterministic `dedupe_key`.

`dedupe_key` is no longer optional for v1 ACTION.

ROW_CHANGE does not use ACTION dedupe.

## 10.2 Deterministic derivation

The canonical server writer deterministically derives:

`dedupe_key = a1:<sha256(canonical tuple)>`

The canonical tuple contains exactly, in a fixed versioned serialization:

1. action key (`event_type`);
2. action key version (`key_version`);
3. `action_instance_id`;
4. lifecycle/result stage (`result`).

The serializer must be deterministic and unambiguous, for example a fixed JSON-array representation or length-prefixed fields defined by the writer contract.

No caller supplies its own arbitrary dedupe key.

The `a1:` prefix versions the dedupe derivation itself independently of the action contract version.

## 10.3 Collision isolation

Consequences:

- same exact immutable lifecycle entry → same dedupe key;
- different action key → different canonical input;
- different action version → different canonical input;
- different action instance → different canonical input;
- different result/lifecycle stage → different canonical input.

A retry therefore converges without suppressing a later legitimate lifecycle checkpoint.

## 10.4 Database uniqueness, not race-prone lookup

Concurrency is resolved by database unique insertion semantics.

Do **not** implement:

1. SELECT “does dedupe key exist?”;
2. then INSERT.

That pattern is race-prone.

Retain the three scope-aware partial unique indexes:

### Company ACTION

unique identity over:

- `company_id`;
- `source`;
- `audit_kind`;
- `dedupe_key`;

for canonical company ACTION rows.

### Personal ACTION

unique identity over:

- `scope_user_id`;
- `source`;
- `audit_kind`;
- `dedupe_key`;

for canonical personal ACTION rows.

### Platform ACTION

unique identity over:

- `source`;
- `audit_kind`;
- `dedupe_key`;

for canonical platform ACTION rows.

The canonical writer handles a uniqueness conflict as:

> the exact immutable audit entry already exists.

It must not treat a uniqueness conflict as evidence that the protected domain side effect itself already happened.

Audit dedupe remains separate from:

- Event Fabric `event_idempotency`;
- outbox dedupe;
- background-job dedupe;
- domain action idempotency.

---

# 11. VERSION-SPECIFIC V1 CHECKS

Legacy rows remain readable with NULL contract version.

For `audit_contract_version = 1`, the final contract is fail-closed.

At minimum v1 structural checks require:

## Common

- `audit_kind IN (ROW_CHANGE, ACTION)`;
- `key_version >= 1`;
- bounded valid `event_type`;
- bounded valid `resource_type`;
- non-empty bounded `entity_id`;
- bounded source/product/purpose/request/actor identifiers where present;
- canonical scope shape;
- canonical actor shape;
- canonical retention class;
- metadata <= 8,192 bytes;
- combined snapshots <= 16,384 bytes.

## Actor

- USER → `actor_id` required and `actor_key` absent;
- SERVICE/SYSTEM/AUTOMATION/AI → registered `actor_key` required;
- actor classes are never selected from arbitrary browser payload.

## Scope

COMPANY:

- `company_id` required;
- `scope_user_id` absent.

PERSONAL:

- `scope_user_id` required;
- `company_id` absent.

PLATFORM:

- both absent.

## ACTION

- `action_instance_id` required;
- `result` required and from bounded result vocabulary;
- deterministic-format `dedupe_key` required;
- row-only fields such as `row_operation` absent;
- approval/risk/assistance fields obey bounded vocabularies.

## ROW_CHANGE

- `row_table` required;
- `row_operation IN (INSERT, UPDATE, DELETE)`;
- `dedupe_key` absent;
- `action_instance_id` absent unless a later contract version explicitly changes the model;
- ACTION-only lifecycle fields absent.

Unknown contract versions are rejected by the new-row guard.

---

# 12. P3-4 — SPECIALIZED LOG BRIDGE CONTRACT

No existing writer is changed by this amendment.

The following continue unchanged until separately authorized:

- `system_audit_logs`;
- `admin_audit_logs`;
- `affiliate_audit_logs`;
- `assistant_events`;
- every other specialized writer.

M1B defines only the future bridge contract.

## 12.1 Every bridge requires a reviewed Bridge Specification

Before any consumer dual-writes, its implementation design must declare all of the following.

### 1. Canonical evidence source

State separately:

- which store is canonical for the **semantic action**;
- which specialized log remains canonical for its domain/provider/operational detail.

Once a bridge declares Shared Audit mandatory for a semantic action key/version:

- Shared Audit is canonical proof of semantic action auditing;
- specialized logs remain canonical only for their specialized purpose.

Pre-bridge historical actions remain governed by their historical specialized source.

### 2. Transactional coupling

Declare one of:

- `ATOMIC_DB_COUPLED`;
- `EXTERNAL_SIDE_EFFECT_PHASED`;
- `SUPPLEMENTAL_COMPATIBILITY`.

The bridge may not leave this implicit.

### 3. Shared ACTION failure semantics

The bridge must state what happens when Shared Audit persistence fails:

- before protected side effect;
- after a non-transactional external side effect.

### 4. Specialized-log failure semantics

The bridge must state whether specialized log persistence is:

- required for the protected action;
- required only for provider/domain observability;
- compatibility-only.

It must define whether failure:

- rolls back/blocks;
- surfaces an operational failure;
- permits completion with explicit degraded-audit state.

### 5. Shared identity

Use the same logical:

- `action_instance_id`;
- `correlation_id`;

across the bridge where both stores can safely carry them.

If a specialized schema lacks a dedicated column, only a reviewed safe metadata projection may carry the correlation identity.

Do not invent a second logical action id.

### 6. Safe metadata projection

Never copy a specialized:

- payload;
- raw request;
- provider body;
- credential object;
- arbitrary metadata blob

into Shared Audit wholesale.

The bridge defines a positive allowlist.

### 7. Normalized read deduplication

Normalized read models group bridge evidence by:

- `action_instance_id`;
- lifecycle stage/result;
- bridge/source identity.

They do not render a specialized record and Shared Audit record as two independent logical actions when both represent the same semantic action.

Different lifecycle stages remain distinct audit entries within one action instance.

Legacy pre-bridge specialized rows remain standalone historical entries.

### 8. Protected side-effect rule

The bridge explicitly states whether the protected side effect is allowed when required Shared Audit evidence cannot be persisted.

No consumer gets to decide this accidentally at runtime.

---

# 13. BRIDGE EXECUTION MODES

## 13.1 ATOMIC_DB_COUPLED

Use when:

- protected side effect;
- required specialized log;
- required Shared ACTION

can participate in the same database transaction.

For a high-risk mandatory-audit action:

- Shared Audit INSERT fails → transaction aborts;
- required specialized-log INSERT fails → transaction aborts;
- domain mutation fails → transaction aborts;
- no success is reported.

This is the preferred model for DB-local privileged state changes.

## 13.2 EXTERNAL_SIDE_EFFECT_PHASED

Use when the protected side effect is external and cannot be atomically committed with Postgres.

For mandatory Shared Audit:

1. validate authorization;
2. persist required pre-effect ACTION stage such as AUTHORIZED/ATTEMPTED;
3. if this audit insert fails, **do not call the external side effect**;
4. call the external system;
5. persist terminal COMPLETED/FAILED evidence with same action instance/correlation;
6. persist specialized provider/domain result according to the bridge contract.

If the external side effect succeeds but terminal Shared Audit insertion fails:

- the system must not report the operation as “securely audited”;
- it must expose an explicit audit-persistence incident/degraded state to operations;
- available specialized provider/domain evidence may be used for manual reconciliation;
- the missing Shared Audit row is not silently fabricated later;
- Event Fabric is not used as a repair loop.

A consumer for which this partial-failure state cannot be handled safely is not ready for bridge activation.

## 13.3 SUPPLEMENTAL_COMPATIBILITY

Use only when:

- existing specialized log remains canonical for that consumer;
- Shared Audit is explicitly supplemental;
- the action is not classified as requiring canonical Shared Audit.

A Shared Audit failure may be non-blocking only if the bridge specification explicitly says so.

Even then:

- failure must be observable;
- the UI/read model must not claim canonical Shared Audit coverage;
- no Event Fabric repair loop is introduced.

---

# 14. HIGH-RISK ACTION RULE

For an action whose Action Registry/consumer contract marks Shared Audit as mandatory:

- failure to persist the required pre-side-effect Shared ACTION fails closed;
- a DB-local protected mutation must not commit without required audit evidence when atomic coupling is available;
- a non-transactional external side effect must not be initiated if required pre-effect audit persistence failed;
- if post-effect terminal audit persistence fails after an irreversible external effect, the operation enters an explicit audit-incomplete incident state and cannot be described as fully/successfully audited.

M1B does not authorize silently deferring mandatory evidence.

M1B does not create an Event Fabric audit-repair workflow.

---

# 15. SPECIALIZED LOG CLASSIFICATION REMAINS UNCHANGED

The original classification is preserved:

- `ecosystem_audit_events` → GENERALIZE INTO SHARED AUDIT;
- `system_audit_logs` → future selective BRIDGE;
- `admin_audit_logs` → future selective BRIDGE;
- `affiliate_audit_logs` → future selective BRIDGE;
- `assistant_events` → KEEP SPECIALIZED + future selective bridge for semantic AI actions;
- `security_events` → KEEP SPECIALIZED;
- `application_error_events` → KEEP SPECIALIZED;
- domain histories/provider ledgers/analytics → KEEP SPECIALIZED unless separately reviewed.

No dual write is enabled by this design amendment.

---

# 16. ROW_CHANGE TABLE CONTRACT REQUIREMENT

The accepted table-specific trigger model is now explicit freeze criteria.

Every relation added to Shared ROW_CHANGE auditing must have a static reviewed table contract defining:

- product id or explicit no-product case;
- resource_type;
- entity-id extraction;
- scope_kind;
- company-id extraction if company scoped;
- scope-user extraction if personal scoped;
- actor rules;
- changed-field allowlist;
- snapshot policy;
- snapshot field allowlist;
- retention class;
- metadata projection.

The generic trigger infrastructure may execute a static per-table contract.

It may not infer security semantics from arbitrary row contents or caller-supplied table names.

---

# 17. SERVICE-ROLE TRUST AND CENTRAL WRITER OWNERSHIP

The security review’s accepted trust model is preserved.

Normal application service_role receives:

- SELECT;
- INSERT.

It does not receive normal:

- UPDATE;
- DELETE;
- TRUNCATE.

This model does not claim tamper-proofness against full service-role compromise.

ACTION insertion ownership must be centralized in one server-only canonical writer/validator.

Future implementation QA/CI should assert that application code does not add ad-hoc:

`.from('ecosystem_audit_events').insert(...)`

outside:

- the canonical ACTION writer;
- reviewed ROW_CHANGE trigger infrastructure;
- separately authorized maintenance/import tooling.

A SECURITY DEFINER ACTION RPC is not introduced merely for convenience.

---

# 18. RESOURCE / TENANT SECURITY CLARIFICATION

Historical evidence fields are descriptive.

Neither:

- `resource_type`;
- `entity_id`;
- `actor_id`;
- `correlation_id`;
- `action_instance_id`;

grants access.

Company reads require current:

- authenticated requester;
- authorized company context;
- COMPANY scope;
- exact historical `company_id`;
- current audit-view permission.

Personal reads require current:

- authenticated requester;
- PERSONAL scope;
- exact `scope_user_id`;
- current product access where applicable.

Platform reads require current:

- platform identity;
- `audit.read` or stronger explicit permission.

Historical membership or identifiers never preserve revoked access.

---

# 19. ONE FUTURE M1B MIGRATION — AMENDED FREEZE PLAN

M1B still requires only **one** future owning-domain migration.

No migration is created by this mission.

Conceptual migration:

`m1b_shared_audit_contract`

It must include, in one atomic transaction:

1. expected existing-table shape validation;
2. canonical table creation path if the table is absent;
3. additive canonical columns;
4. removal of destructive historical actor FK without rewriting actor UUIDs;
5. historical UUID model for future actor/company/personal/subject evidence;
6. strict v1 structural checks with legacy NULL read compatibility;
7. explicit identifier bounds;
8. DB metadata bound of 8 KiB;
9. DB **combined** snapshot bound of 16 KiB;
10. canonical ROW_CHANGE trigger upgrade;
11. INSERT-only contract-version guard;
12. scope-aware ACTION dedupe unique indexes;
13. justified query indexes;
14. RLS/browser revokes;
15. service_role SELECT + INSERT only;
16. explicit UPDATE/DELETE/TRUNCATE revocation;
17. validation of final version-specific constraints;
18. **NO SEMANTIC BACKFILL**.

No separate M1F or cleanup migration is required because sequencing is owned by M1B.

---

# 20. LEGACY ROW POLICY

Existing historical rows with:

`audit_contract_version IS NULL`

remain exactly as stored.

Do not:

- rewrite them;
- assign v1;
- infer audit kind;
- infer actor kind;
- infer company or personal scope;
- invent product;
- invent action result;
- invent consent or entitlement evidence;
- invent correlation or causation;
- derive new semantic ACTION rows from specialized logs.

Legacy compatibility is **read compatibility only**.

It is not a writer mode after the M1B migration commits.

---

# 21. EVENT FABRIC BOUNDARY — PRESERVED

Nothing in this amendment changes M1A.

Shared Audit remains synchronous/direct storage.

It does not:

- enqueue an audit event;
- depend on Event Fabric activation;
- use `event_idempotency` as audit dedupe;
- use Event Fabric to repair missing audit;
- create audit → event → audit recursion.

Event Fabric identifiers remain optional trace evidence where a real causal relationship exists.

---

# 22. PRODUCTION PROMOTION GATE — PRESERVED

The production rule remains:

> Do not promote M1B merely to have the shared table/contract.

Production promotion requires the first real shared-audit consumer to be ready with:

- canonical writer;
- relevant Action Registry contract;
- bridge specification if specialized logs are involved;
- security approval;
- independent QA;
- compatibility plan;
- explicit production authorization.

This amendment does not authorize production.

---

# 23. FUTURE QA ACCEPTANCE ADDITIONS

In addition to the original M1B QA matrix, future implementation must prove:

## Contract-version guard

- existing legacy NULL rows remain unchanged;
- new INSERT with omitted version fails;
- new INSERT with explicit NULL fails;
- direct service_role INSERT NULL fails;
- canonical ACTION v1 insert succeeds;
- canonical ROW_CHANGE v1 insert succeeds;
- unsupported version fails;
- legacy row remains readable;
- no semantic backfill occurred.

## Historical identity

- deleting a source Auth user does not NULL/delete historical `actor_id`;
- deleting a company does not NULL/delete historical `company_id` evidence;
- source entity lifecycle does not rewrite `scope_user_id` or `subject_user_id`;
- invalid current identity/context is rejected by canonical writer/trigger validation before insertion.

## Snapshot bound

- before+after exactly at the approved bound is accepted;
- combined size above 16,384 bytes fails;
- two individually-small snapshots whose sum exceeds the bound fail;
- default audited sensitive tables persist no snapshots.

## Dedupe

- concurrent retries of the same immutable ACTION lifecycle entry converge to one row;
- same action_instance with different lifecycle result produces distinct rows;
- same action_instance with different action key/version cannot collide;
- same derived local digest in different tenant scopes does not cross-dedupe;
- no SELECT-before-INSERT race mechanism is used.

## Identifier bounds

- maximum valid lengths succeed;
- over-length action/resource/entity/request/actor/source/product/purpose identifiers fail;
- opaque entity id is stored exactly, without normalization;
- resource id knowledge does not bypass scope authorization.

## Bridge consistency

For every activated bridge, QA must exercise:

- Shared Audit failure;
- specialized-log failure;
- DB-side-effect failure;
- external-side-effect failure where relevant;
- normalized read dedupe;
- correlation/action-instance propagation;
- safe metadata projection;
- required-audit fail-closed behavior;
- no Event Fabric repair loop.

---

# 24. SECURITY RE-REVIEW CHECKLIST

Agent 4 re-review should verify:

1. new-row guard applies to every INSERT path;
2. omitted and explicit NULL contract version fail;
3. supported-version set is explicit and fail-closed;
4. ROW_CHANGE trigger writes canonical v1 before guard activation;
5. migration sequencing is atomic;
6. actor FK no longer rewrites history;
7. new user/company historical fields have no destructive lifecycle FKs;
8. central writer performs trusted insert-time identity validation;
9. snapshot byte check is combined 16 KiB;
10. metadata byte check is 8 KiB;
11. identifier bounds match section 8;
12. ACTION dedupe derivation includes action/version/instance/result;
13. database uniqueness resolves concurrent retry;
14. bridges cannot activate without partial-failure contract;
15. mandatory Shared Audit failure cannot be silently treated as success;
16. browser access remains closed;
17. service_role remains SELECT + INSERT only;
18. UPDATE/DELETE/TRUNCATE remain revoked;
19. no semantic backfill;
20. production gate remains closed.

---

# 25. FINAL AMENDED DECISIONS

## Canonical audit surface

PRESERVED:

`public.ecosystem_audit_events`

## Audit classes

PRESERVED:

- ROW_CHANGE
- ACTION

## New-row version enforcement

DEFINED:

- database BEFORE INSERT guard;
- no version default;
- v1 only initially;
- NULL/omitted/unknown version rejected for all future inserts;
- legacy NULL remains read-only historical state.

## Historical identity

DEFINED:

- historical UUID evidence;
- no destructive lifecycle FK;
- insert-time trusted validation;
- source deletion does not rewrite evidence.

## Snapshot bound

DEFINED:

- 16,384 bytes combined before+after;
- DB enforced.

## Metadata bound

PRESERVED AND FROZEN:

- 8,192 serialized bytes;
- DB enforced.

## ACTION dedupe

DEFINED:

- required for v1 ACTION;
- canonical writer derives `a1:<sha256>`;
- tuple = action key + action version + action_instance_id + lifecycle/result;
- database uniqueness resolves concurrency.

## Identifier bounds

DEFINED:

- explicit limits and syntax in section 8;
- opaque entity IDs are never normalized.

## Resource/tenant boundary

DEFINED:

- resource identity is evidence only;
- authorization comes from validated scope + current authorization.

## Bridge consistency

DEFINED:

- mandatory per-consumer Bridge Specification;
- coupling/failure authority explicit;
- no silent mandatory-audit failure;
- no Event Fabric repair loop.

## Append-only

DEFINED:

- privilege append-only;
- lifecycle-reference append-only;
- maintenance is separate.

## No semantic backfill

PRESERVED.

## Migration plan

DEFINED:

- one atomic future M1B migration;
- no cleanup/M1F migration.

---

# 26. FINAL STATUS

`M1B_SECURITY_AMENDMENT: COMPLETE`

All 2 P2 findings and all 4 P3 hardening findings from Security Review SHA
`3c700bf7fb639cb0a80d26535484c16e01af1541`
are resolved at design level.

Implementation remains not authorized.

The amended design is ready for independent security re-review.
