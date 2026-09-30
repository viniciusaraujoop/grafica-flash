# ORÇALY — M1B SHARED AUDIT CONTRACT — SECURITY AMENDMENT RE-REVIEW

**Status:** SECURITY_DELTA_REVIEW_AUTHORIZED  
**Implementation:** NOT AUTHORIZED  
**Migration creation:** NOT AUTHORIZED  
**SQL execution:** NOT AUTHORIZED  
**Database mutation:** NOT AUTHORIZED  
**Staging mutation:** NOT AUTHORIZED  
**Production mutation:** NOT AUTHORIZED  
**Main merge:** NOT AUTHORIZED  

**Repository:** `viniciusaraujoop/grafica-flash`  
**Original design SHA:** `d88173d8779f90b3535f49edd316dea4d5e7b2d8`  
**Original security review SHA:** `3c700bf7fb639cb0a80d26535484c16e01af1541`  
**Amended design branch:** `reconcile/m1b-shared-audit-security-amendment`  
**Exact amended SHA reviewed:** `5d5834bbc622002109bfb76ea26121d947b42b9a`  
**Amended artifact:** `docs/migrations/ORCALY_M1B_SHARED_AUDIT_CONTRACT_DESIGN_AMENDED.md`  
**Review date:** 2026-09-30

---

# 1. Executive Decision

```
M1B_SECURITY_AMENDMENT_REVIEW:
PASS_WITH_REQUIREMENTS
```

The amendment closes the two original P2 findings and all four original P3 hardening findings at design level.

No unresolved P0/P1/P2 remains.

No new P3 finding is opened.

The remaining requirements are implementation-time security conditions already compatible with the amended architecture, especially for the exact implementation mode of the new-row version guard.

`READY_FOR_M1B_DESIGN_FREEZE: YES`

No implementation authorization is implied.

---

# 2. Target / Drift / Amendment Scope

Live amended branch head:

`5d5834bbc622002109bfb76ea26121d947b42b9a`

Requested exact target:

`5d5834bbc622002109bfb76ea26121d947b42b9a`

`TARGET_DRIFT: NO`

Compared with the original M1B design SHA, the amended target is exactly one documentation commit adding:

`docs/migrations/ORCALY_M1B_SHARED_AUDIT_CONTRACT_DESIGN_AMENDED.md`

No runtime, SQL migration or M1A implementation file is part of the amendment.

---

# 3. Architecture Preservation

The accepted M1B architecture remains preserved.

Confirmed unchanged:

- `public.ecosystem_audit_events` remains the canonical shared audit surface;
- audit classes remain:
  - `ROW_CHANGE`;
  - `ACTION`;
- specialized logs remain specialized;
- no second shared audit table;
- no audit bus;
- no DB Action Registry;
- Action Registry remains TypeScript-first;
- no semantic backfill;
- audit is independent from Event Fabric activation;
- audit is not delivered through Event Fabric;
- Event Fabric identifiers remain trace evidence only;
- normal application audit access remains append-only;
- exact retention durations remain outside M1B;
- production promotion remains deferred until a real consumer is ready.

The amendment adds security constraints and failure semantics only.

No unnecessary architecture expansion was identified.

---

# 4. P2-1 — Legacy Contract-Version Escape

`P2_LEGACY_VERSION_ESCAPE: RESOLVED`

The original bypass was:

`audit_contract_version = NULL`

remaining a valid future-write mode.

The amendment structurally changes NULL semantics to:

> historical read compatibility only.

The proposed private:

`ecosystem_private.enforce_shared_audit_insert_contract()`

runs through a:

`BEFORE INSERT FOR EACH ROW`

trigger on:

`public.ecosystem_audit_events`.

For every future INSERT it requires:

1. non-null contract version;
2. explicitly supported version;
3. matching version-specific structural contract.

Initial supported write-version set:

`{1}`

The design explicitly freezes:

- no default on `audit_contract_version`;
- omitted version fails;
- explicit NULL fails;
- ACTION writer cannot opt into legacy mode;
- ROW_CHANGE trigger cannot emit legacy mode;
- direct service_role INSERT with NULL fails;
- unsupported versions fail closed;
- historical NULL rows are not rewritten.

No semantic backfill is necessary.

The original P2 is closed.

---

# 5. Version Guard Security

`VERSION_GUARD_SECURITY: PASS`

The guard is a database trigger boundary, not request authorization.

It cannot rely on:

- client actor labels;
- client scope;
- browser-provided contract version authority;
- application convention alone.

## Preferred implementation security mode

The guard only needs to inspect `NEW` and enforce structural/version invariants.

Therefore it does **not** require SECURITY DEFINER merely to perform its canonical duty.

Preferred implementation:

- private schema;
- trigger-only function;
- SECURITY INVOKER/default invoker semantics;
- no dynamic SQL;
- no relation/function names derived from caller data;
- no external authorization inference.

## If implementation chooses SECURITY DEFINER

That is a privileged implementation choice and must satisfy:

- fixed safe `search_path`;
- explicit schema qualification;
- direct EXECUTE revoked from PUBLIC/anon/authenticated;
- no dynamic SQL;
- no caller-controlled object identifiers;
- no trusted actor/scope derivation from payload.

Such SECURITY DEFINER use must be justified by an actual privilege requirement, not convenience.

## Trigger bypass

Normal application service_role is designed to receive only table:

- SELECT;
- INSERT.

It does not receive table ownership/DDL authority.

Ordinary INSERT therefore cannot disable the trigger or opt into legacy mode.

A database/maintenance owner can exercise stronger administrative authority, but that is an explicitly separate trusted maintenance boundary and not normal application capability.

The guard must not be intentionally bypassed by maintenance/import tooling without a separately reviewed authorization.

---

# 6. Migration Ordering for Version Enforcement

`VERSION_GUARD_MIGRATION_ORDER: PASS`

The amended one-migration ordering is safe:

1. expected-shape preflight;
2. additive canonical columns;
3. historical identity hardening;
4. strict version-specific structural checks compatible with legacy NULL history;
5. upgrade ROW_CHANGE trigger to always emit canonical v1;
6. only then enable the INSERT version guard;
7. indexes;
8. final RLS/grants;
9. final constraint validation;
10. commit or rollback atomically.

The key invariant is preserved:

There is no committed state where the old ROW_CHANGE trigger still emits NULL while the new INSERT guard rejects NULL.

Because the migration is one transaction, the change converges atomically.

No cleanup/M1F migration is required.

---

# 7. P2-2 — Historical Identity

`P2_HISTORICAL_IDENTITY: RESOLVED`

The amendment correctly treats audit identity as durable evidence instead of entity ownership.

It removes the destructive existing behavior:

`actor_id REFERENCES auth.users(id) ON DELETE SET NULL`

without rewriting stored UUID values.

Canonical historical identity fields:

- `actor_id`;
- `company_id`;
- `scope_user_id`;
- `subject_user_id`.

The design prohibits destructive lifecycle semantics for these fields:

- no `ON DELETE CASCADE`;
- no `ON DELETE SET NULL`.

This closes:

- actor evidence loss;
- indirect history mutation;
- company/user hard-delete coupling through destructive actions;
- future incompatibility where `actor_kind=USER` requires actor_id.

Historical evidence survives source-entity deletion.

The audit store does not own Auth/company lifecycle.

---

# 8. Identity Insert Validation

`IDENTITY_INSERT_VALIDATION: PASS`

Removing lifecycle FKs does not make historical identity caller-trusted.

The amended trust model is explicit.

## ACTION

Canonical server writer derives:

- `actor_id` from verified current session/admin identity;
- `company_id` from current authorized company context;
- `scope_user_id` from authenticated personal context;
- `subject_user_id` from action/resource contract plus authorized target lookup;
- `actor_key` from registered service/system/automation/AI configuration.

Browser/body UUIDs do not become trusted merely because they are syntactically valid.

## ROW_CHANGE

Table-specific trigger contract derives:

- resource identity from audited relation;
- company/personal/platform scope from reviewed ownership mapping;
- authenticated human actor from trusted database auth context where applicable;
- otherwise a static registered non-user actor.

Changed row content cannot arbitrarily select a privileged system identity.

## Direct service_role

service_role remains an accepted application trust root.

M1B does not claim cryptographic non-forgeability against full service-role compromise.

Source ownership is centralized around:

- canonical ACTION writer;
- reviewed ROW_CHANGE trigger infrastructure;
- separately authorized maintenance/import tooling.

This is consistent with the accepted threat model.

---

# 9. P3-1 — Combined Snapshot Bound

`P3_SNAPSHOT_BOUND: RESOLVED`

The amendment freezes one combined DB-enforced budget:

**16,384 UTF-8 serialized bytes total**

across:

- `before_snapshot`;
- `after_snapshot`.

NULL contributes zero.

Therefore:

- before alone may consume the full budget;
- after alone may consume the full budget;
- two individually valid snapshots whose combined serialized bytes exceed the limit fail;
- the limit is not 16 KiB per field.

Application validation may reject earlier, but database enforcement is mandatory.

The design remains opt-in per table/field and rejects generic full-row snapshot archival.

---

# 10. P3-2 — ACTION Dedupe

`P3_ACTION_DEDUPE: RESOLVED`

Canonical v1 ACTION dedupe is now deterministic and mandatory.

Format:

`a1:<sha256(canonical tuple)>`

Canonical tuple contains:

1. action key / `event_type`;
2. `key_version`;
3. `action_instance_id`;
4. lifecycle/result stage.

Consequences:

- different action keys cannot accidentally share canonical input;
- different action versions differ;
- different action instances differ;
- different lifecycle/result stages differ;
- retry of the same immutable audit entry converges.

The `a1:` prefix versions the dedupe derivation independently.

No arbitrary browser-supplied dedupe key is accepted by the canonical writer.

Database partial unique indexes remain scope-aware:

- company;
- personal;
- platform.

Concurrency is resolved by unique insertion semantics.

No SELECT-before-INSERT existence race is part of the design.

Audit dedupe remains explicitly separate from:

- Event Fabric `event_idempotency`;
- outbox dedupe;
- background-job dedupe;
- domain side-effect idempotency.

---

# 11. P3-3 — Identifier Bounds

`P3_IDENTIFIER_BOUNDS: RESOLVED`

The amendment freezes explicit v1 limits:

| Identifier | Maximum |
|---|---:|
| event_type / action key | 160 chars |
| resource_type | 96 chars |
| entity_id | 256 chars |
| request_id | 128 chars |
| actor_key | 128 chars |
| source | 96 chars |
| product_id | 64 chars |
| purpose_key | 128 chars |
| dedupe_key | 67 chars |
| row_table | 128 chars |
| changed_fields item | 96 chars |

Canonical stable identifiers use bounded lower-case ASCII syntax with controlled separators.

`entity_id` remains opaque and identity-preserving.

The design explicitly forbids semantic normalization such as:

- forced lowercase;
- punctuation stripping;
- reinterpretation.

No unlimited indexed text identity remains in the canonical v1 contract.

Identifiers remain evidence only.

They never grant:

- company access;
- personal access;
- platform access;
- authorization.

---

# 12. P3-4 — Bridge Consistency

`P3_BRIDGE_CONSISTENCY: RESOLVED`

No dual-write implementation is authorized or introduced.

Every future bridge must have a reviewed Bridge Specification containing:

- canonical semantic evidence source;
- specialized source responsibility;
- coupling mode;
- Shared Audit failure semantics;
- specialized-log failure semantics;
- shared `action_instance_id`;
- shared correlation identity;
- safe metadata projection;
- normalized read dedupe;
- protected-side-effect behavior when audit persistence fails.

Three explicit modes are defined:

- `ATOMIC_DB_COUPLED`;
- `EXTERNAL_SIDE_EFFECT_PHASED`;
- `SUPPLEMENTAL_COMPATIBILITY`.

For mandatory high-risk audit:

- pre-side-effect Shared Audit failure fails closed;
- DB-local mutations must not commit without required audit when atomic coupling is available;
- external effect must not start if mandatory pre-effect audit failed;
- post-effect audit failure becomes explicit audit-incomplete incident state.

No generic payload copying is allowed.

No Event Fabric repair loop is introduced.

Existing specialized writers remain unchanged until separately authorized.

---

# 13. Append-Only Final Model

`APPEND_ONLY_MODEL: PASS`

The amended design closes both direct and indirect mutation paths.

Normal application service_role target privilege:

- SELECT;
- INSERT.

Explicitly no normal:

- UPDATE;
- DELETE;
- TRUNCATE.

Browser roles remain denied.

Historical identity references do not cascade/delete/set-null evidence.

Retention/remediation is a separate privileged maintenance concern.

A database owner may naturally retain administrative power, but owner/maintenance authority is outside normal application semantics and does not invalidate the append-only application model.

---

# 14. No Semantic Backfill

`NO_SEMANTIC_BACKFILL: PASS`

Existing legacy rows remain:

`audit_contract_version IS NULL`

exactly as stored.

The amendment forbids inventing:

- product;
- audit kind;
- actor kind;
- scope;
- purpose;
- result;
- risk;
- approval;
- consent;
- entitlement;
- correlation;
- causation;
- action version.

No existing specialized log is converted into fabricated canonical ACTION history.

Legacy NULL means:

**READ COMPATIBILITY**

and no longer means:

**FUTURE WRITE MODE**.

---

# 15. Migration Design Security

`MIGRATION_DESIGN_SECURITY: PASS`

The one future owning-domain migration is now security-complete enough to freeze.

It includes:

1. expected existing-table shape assertion;
2. create path if table absent;
3. additive canonical columns;
4. removal of destructive actor FK without UUID rewrite;
5. historical non-destructive identity model;
6. strict v1 structural checks;
7. explicit identifier bounds;
8. metadata <= 8 KiB DB bound;
9. combined snapshots <= 16 KiB DB bound;
10. upgraded canonical ROW_CHANGE trigger;
11. INSERT-only contract-version guard;
12. scope-aware ACTION dedupe unique indexes;
13. justified query indexes;
14. RLS/browser revokes;
15. service_role SELECT + INSERT only;
16. explicit UPDATE/DELETE/TRUNCATE revocation;
17. final constraint validation;
18. NO SEMANTIC BACKFILL.

The migration ordering places trigger modernization before enabling the INSERT guard and commits atomically.

No second cleanup migration is security-required by the design.

---

# 16. Implementation-Time Guard Requirements

These are requirements for implementation review, not unresolved design findings.

For `ecosystem_private.enforce_shared_audit_insert_contract()`:

- use SECURITY INVOKER unless an actual privilege need is demonstrated;
- if SECURITY DEFINER is used:
  - fixed safe search_path;
  - explicit schema qualification;
  - EXECUTE restricted appropriately;
  - no dynamic SQL;
  - no caller-controlled object names;
- no version default;
- explicit supported write-version set;
- fail closed for NULL and unknown versions;
- ordinary service_role must not own/DDL-disable the trigger;
- maintenance bypass remains separately privileged/authorized.

Future QA must prove the guard applies to:

- canonical ACTION;
- canonical ROW_CHANGE;
- direct service_role INSERT.

These requirements do not change the M1B architecture.

---

# 17. Finding Reconciliation

Original findings:

## P2

### M1B-S1 — Legacy NULL contract bypass

**RESOLVED**

### M1B-S2 — Destructive actor FK

**RESOLVED**

## P3

### M1B-H1 — Combined snapshot DB enforcement

**RESOLVED**

### M1B-H2 — ACTION dedupe namespace/lifecycle

**RESOLVED**

### M1B-H3 — Indexed identifier bounds

**RESOLVED**

### M1B-H4 — Bridge consistency

**RESOLVED**

No new P0/P1/P2/P3 finding is opened by this delta review.

The implementation-time guard controls in section 16 are acceptance requirements, not a separate architecture finding.

---

# 18. Production Gate

The production gate remains closed.

M1B must not be promoted merely to generalize/create the shared audit table.

First production consumer requires:

- canonical writer;
- Action Registry contract;
- Bridge Specification where relevant;
- security approval;
- independent QA;
- compatibility plan;
- explicit production authorization.

This re-review does not authorize implementation or production.

---

# 19. Final Status

```
M1B_SECURITY_AMENDMENT_REVIEW:
PASS_WITH_REQUIREMENTS

TARGET_SHA:
5d5834bbc622002109bfb76ea26121d947b42b9a

TARGET_DRIFT:
NO

P2_LEGACY_VERSION_ESCAPE:
RESOLVED

P2_HISTORICAL_IDENTITY:
RESOLVED

VERSION_GUARD_SECURITY:
PASS

VERSION_GUARD_MIGRATION_ORDER:
PASS

IDENTITY_INSERT_VALIDATION:
PASS

P3_SNAPSHOT_BOUND:
RESOLVED

P3_ACTION_DEDUPE:
RESOLVED

P3_IDENTIFIER_BOUNDS:
RESOLVED

P3_BRIDGE_CONSISTENCY:
RESOLVED

APPEND_ONLY_MODEL:
PASS

NO_SEMANTIC_BACKFILL:
PASS

MIGRATION_DESIGN_SECURITY:
PASS

P0_FINDINGS:
0

P1_FINDINGS:
0

P2_FINDINGS:
0

P3_FINDINGS:
0

SECURITY_ARTIFACT:
docs/security/ORCALY_M1B_SHARED_AUDIT_AMENDMENT_REVIEW.md

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

MAIN_MUTATION:
NONE

READY_FOR_M1B_DESIGN_FREEZE:
YES
```

No implementation authorization is implied.

**STOP — END OF MISSION**
