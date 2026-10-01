# ORÇALY — M1B SHARED AUDIT CONTRACT DESIGN

STATUS: DESIGN COMPLETE — IMPLEMENTATION NOT AUTHORIZED

BASE SHA: `82056e08a0cdecf4a7f18146325ee83359828e95`

SCOPE: M1B only. No M1A modification. No M1C/M1D/M1E implementation. No migration or runtime code is created by this artifact.

---

## 1. Executive decision

M1B defines one **Shared Audit Contract** with two canonical audit classes:

- `ROW_CHANGE` — database/state-change provenance;
- `ACTION` — meaningful semantic command, decision or product/system action.

The canonical shared storage surface remains:

- `public.ecosystem_audit_events`

This follows the Coordinator reconciliation. M1B does **not** replace:

- `system_audit_logs`;
- `admin_audit_logs`;
- `affiliate_audit_logs`;
- `security_events`;
- integration/provider logs;
- application-error telemetry;
- product analytics;
- customer/order/proposal timelines and other operational domain histories.

Those structures retain their domain purpose. Selected meaningful actions may later **bridge** into the Shared Audit Contract, but existing specialized data is not bulk-migrated into it.

No second audit bus, Action Registry table, event bus, generic logging framework, or new shared audit table is introduced.

---

## 2. Inspected baseline

The design was derived from the repository at the certified M1A SHA and from non-mutating Supabase metadata inspection. No SQL was executed.

### 2.1 Shared audit surface already present in staging

Staging contains `public.ecosystem_audit_events` with 13 rows observed through metadata inspection.

Current physical columns:

- `id uuid`;
- `actor_id uuid nullable`;
- `event_type text`;
- `entity_id text`;
- `recorded_at timestamptz`.

The source migration on `codex/orcaly-ecosystem` shows that it is currently a minimal row-change ledger. The private trigger function `ecosystem_private.record_change()` records:

- `actor_id = auth.uid()`;
- `event_type = <table>.<insert|update|delete>`;
- `entity_id = row id/user id`;
- `recorded_at = database time`.

That trigger is attached in the source design to:

- `ecosystem_product_entitlements`;
- `ecosystem_context_consents`;
- `wealth_profiles`;
- `wealth_entries`;
- `wealth_goals`.

The table is RLS-enabled, browser roles are revoked, and the source grants `select, insert` to `service_role`.

### 2.2 Current semantic/system audit

`public.system_audit_logs` exists in production and staging.

Observed production count: 36.

Current fields include:

- `company_id`;
- `user_id`;
- `action`;
- `entity`;
- `entity_id`;
- `details`;
- `ip`;
- `user_agent`;
- `created_at`.

It is actively written by:

- `lib/orcaly-audit.ts#createAuditLog`;
- `lib/security/privileged-audit.ts#recordPrivilegedAudit`.

It is actively read by:

- `app/api/audit/logs/route.ts`;
- `app/painel/auditoria/page.tsx`.

It therefore remains a real compatibility surface. M1B does not rename, replace or bulk-copy it.

### 2.3 Platform-admin audit

`public.admin_audit_logs` exists in both environments.

Observed production count: 17.

`lib/platform-admin.ts#auditPlatformAction` writes it after sanitizing payloads with:

- secret-key redaction;
- bounded string lengths;
- bounded arrays;
- bounded object key counts;
- bounded recursion depth.

The platform admin audit UI reads `admin_audit_logs` together with `affiliate_audit_logs`.

### 2.4 Affiliate audit

`public.affiliate_audit_logs` is specialized and server-owned.

Observed production count: 3.

Its migration explicitly:

- enables RLS;
- revokes browser access;
- denies authenticated-client access;
- retains affiliate-specific actor/target/IP-hash semantics.

This remains a specialized record even after M1B.

### 2.5 Security and observability

Observed production counts include:

- `security_events`: 428;
- `application_error_events`: 1.

`security_events` includes severity, resolution workflow and security telemetry such as path/IP/user-agent. It is not a Shared Audit replacement candidate.

`application_error_events` is explicitly described by its migration as PII-minimized application-error telemetry, separate from business audit/analytics.

### 2.6 Operational/domain histories

Observed production structures include:

- `order_status_history`: 4 rows;
- `proposal_events`: 2 rows;
- `customer_portal_events`: 1 row;
- `subscription_events`: 3 rows;
- `whatsapp_message_logs`: 35 rows;
- `assistant_events`: 7 rows;
- `timeline_events`;
- `payment_webhook_events`;
- `whatsapp_webhook_events`;
- `product_analytics_events`;
- `platform_support_ticket_events`.

These are not evidence of one missing generic audit table. They are domain-specific histories, provider ledgers, telemetry, product analytics or presentation read models.

---

## 3. Canonical audit classes

### 3.1 ROW_CHANGE

Purpose:

- prove that protected persisted state changed;
- identify the affected database/resource identity;
- identify INSERT/UPDATE/DELETE;
- capture the human actor when one is available;
- preserve company/personal/product scope where deterministically available;
- optionally capture a tightly allowlisted before/after projection when justified.

ROW_CHANGE answers:

> What protected state changed, where, when and under which trace/context?

It does **not** attempt to explain the full business reason for the change.

Examples:

- entitlement row updated;
- consent row revoked;
- Wealth goal changed;
- protected configuration row deleted.

### 3.2 ACTION

Purpose:

- record a meaningful command, approval, rejection, confirmation or decision;
- describe who initiated it and on whose behalf/context;
- identify product/resource/purpose;
- record result and approval/confirmation evidence;
- correlate with Event Fabric, request and automation/AI traces where available.

ACTION answers:

> Who attempted or performed what meaningful action, in which context, against what resource, why, with what result?

Examples:

- entitlement grant/revoke;
- consent grant/revoke;
- platform-admin block/unblock;
- privileged approval;
- export;
- credential rotation;
- automation execution decision;
- AI recommendation/draft/confirmed execution;
- a future cross-product action.

---

## 4. One physical shared surface

`ecosystem_audit_events` is generalized to carry both classes.

The table name remains for compatibility. M1B does not introduce a new `shared_audit_events`, `action_audit_events` or equivalent duplicate.

Existing legacy columns remain:

- `id`;
- `actor_id`;
- `event_type`;
- `entity_id`;
- `recorded_at`.

Canonical logical mappings:

- `actor_id` = human actor user id when applicable;
- `event_type` = stable audit key;
- `entity_id` = resource/record id;
- `recorded_at` = audit occurrence/record time.

M1B adds dimensions around those fields rather than duplicating them with synonymous columns.

---

## 5. Proposed additive shared fields

All fields below are future migration design only.

### 5.1 Contract and class

- `audit_contract_version smallint nullable`
- `audit_kind text nullable`
  - `ROW_CHANGE`
  - `ACTION`
- `key_version smallint nullable`

Legacy rows may keep these fields null. New canonical writers must explicitly set them.

### 5.2 Actor and initiation

- existing `actor_id` — authenticated human actor when meaningful;
- `actor_kind text nullable`
  - `USER`
  - `SERVICE`
  - `SYSTEM`
  - `AUTOMATION`
  - `AI`
- `actor_key text nullable` — stable non-user actor identifier, e.g. `service.billing`, `system.database_trigger`, `automation.flow`.

Rules:

- `USER` requires `actor_id`;
- non-user actors require `actor_key`;
- service/system/automation/AI identity never comes from unvalidated request payload;
- browser-provided actor labels are not authority.

### 5.3 Subject and context

Actor, subject and context are distinct.

Add:

- `scope_kind text nullable`
  - `COMPANY`
  - `PERSONAL`
  - `PLATFORM`
- `company_id uuid nullable`
- `scope_user_id uuid nullable`
- `subject_user_id uuid nullable`

Semantics:

- `actor_id`: who initiated/confirmed the action;
- `company_id`: company whose protected context owns the action;
- `scope_user_id`: personal context principal when `scope_kind=PERSONAL`;
- `subject_user_id`: user affected or represented by the action when distinct from the actor;
- `entity_id`: resource identity, not user-context identity.

Scope invariants for canonical rows:

- COMPANY: `company_id != null`, `scope_user_id = null`;
- PERSONAL: `company_id = null`, `scope_user_id != null`;
- PLATFORM: both are null.

A company member acting for a company is therefore not represented as a personal action.

### 5.4 Product

- `product_id text nullable`

Product identity comes from the TypeScript-first canonical product contract. M1B creates no product registry table.

Product-specific actions must provide a valid product id.

Platform/global actions that are not product-owned may keep `product_id` null.

Known product identifiers from the inspected ecosystem registry include:

- `business`;
- `wealth`;
- `growth`;
- `flow`;
- `academy`;
- `market`;
- `partners`;
- `one`.

The database validates only bounded identifier shape. Semantic membership belongs to application registry code.

### 5.5 Resource

Add:

- `resource_type text nullable`

Reuse:

- `entity_id` as the physical resource id.

Canonical ACTION rows require a stable resource identity when the action targets a resource.

Canonical ROW_CHANGE rows identify the changed row/resource through `resource_type + entity_id`.

Human labels, customer names and e-mails are not resource identity.

### 5.6 Purpose and source

Add:

- `purpose_key text nullable`;
- `source text nullable`;
- `request_id text nullable`.

Examples of source identifiers:

- `business.api`;
- `platform_admin`;
- `event_fabric.worker`;
- `database_trigger`;
- `flow.automation`;
- `intelligence`.

`purpose_key` is a bounded stable reason/purpose identifier, not arbitrary prose.

### 5.7 Correlation / causation / Event Fabric

Add:

- `correlation_id uuid nullable`;
- `causation_id uuid nullable`;
- `event_id uuid nullable`.

Semantics:

- `correlation_id` groups one logical trace across request/action/event/job;
- `causation_id` identifies the immediate causal trace node when available;
- `event_id` records the M1A outbox event id when the semantic action is directly associated with an Event Fabric event.

No hard FK from shared audit to `transactional_outbox` is required. Audit retention must not block future completed-outbox retention, and outbox retention must not erase audit identity.

Audit delivery is synchronous/direct to the audit store. It is **not** delivered through Event Fabric.

Therefore:

- Event Fabric OFF does not disable audit;
- audit write failure does not enqueue an “audit event” back into Event Fabric;
- no `audit → event → audit` cycle exists;
- replay may carry the same correlation/event id but must respect audit dedupe.

---

## 6. ACTION contract

### 6.1 Stable action key

For `ACTION`, existing `event_type` becomes the physical stable action key.

New Action Registry keys should be globally qualified, lower-case and dot-separated.

Preferred shape:

`<domain>.<resource>.<verb>`

Examples:

- `business.order.cancel`;
- `platform.company.block`;
- `partners.payout.approve`;
- `wealth.goal.create`;
- `flow.automation.run`;
- `intelligence.recommendation.generate`.

Existing legacy two-part keys remain historical compatibility data. They are not rewritten.

### 6.2 Versioning

`key_version` starts at 1 for a new registered action.

Increment the version only when semantic interpretation changes materially, such as:

- changed subject/resource semantics;
- changed required approval semantics;
- changed result meaning;
- incompatible metadata contract.

Do not increment for:

- UI text;
- labels/icons;
- optional additive metadata;
- implementation-only refactors.

### 6.3 Action instance

Add:

- `action_instance_id uuid nullable`.

A logical action attempt receives one stable action-instance id.

Multiple immutable audit entries may share the same action-instance id to describe meaningful lifecycle checkpoints.

This is different from:

- the row's `id`;
- Event Fabric `event_id`;
- `correlation_id`;
- `dedupe_key`.

### 6.4 Result vocabulary

Add:

- `result text nullable`.

Canonical bounded ACTION result values:

- `ATTEMPTED`
- `REJECTED`
- `AUTHORIZED`
- `EXECUTED`
- `FAILED`
- `COMPLETED`
- `SKIPPED`

Semantics:

- ATTEMPTED — intent captured before a material policy decision; use selectively for high-risk actions;
- REJECTED — action denied before side effect;
- AUTHORIZED — policy/approval passed but side effect has not yet completed;
- EXECUTED — side effect was initiated/accepted and final completion may still be pending;
- FAILED — required execution failed;
- COMPLETED — intended action reached final success;
- SKIPPED — intentional no-op/idempotent/current-state result, not a failure.

Not every action must emit every lifecycle stage. The Action Registry defines which stages are audit-required.

Free-text status never becomes authority.

### 6.5 Approval, confirmation and risk

Add:

- `risk_class text nullable`;
- `approval_required boolean nullable`;
- `confirmation_required boolean nullable`.

The future TypeScript Action Registry owns:

- action risk policy;
- approval requirement;
- confirmation requirement;
- allowed initiator types.

The audit row snapshots the policy/evidence used at execution time. The audit row does not create or grant authority.

Approval itself may be represented by its own ACTION row and correlated to the protected action.

### 6.6 AI / automation

Add:

- `assistance_mode text nullable`.

Bounded values:

- `NONE`
- `AI_RECOMMENDATION`
- `AI_DRAFT`
- `AI_HUMAN_CONFIRMED`

Interpretation:

- human action: `actor_kind=USER`, assistance NONE;
- automation action: `actor_kind=AUTOMATION`;
- AI recommendation only: `actor_kind=AI` or product-defined system actor, assistance AI_RECOMMENDATION;
- AI-prepared draft: assistance AI_DRAFT;
- human-confirmed AI action: `actor_kind=USER`, assistance AI_HUMAN_CONFIRMED;
- system action: `actor_kind=SYSTEM`.

M1B authorizes no autonomous AI execution feature.

---

## 7. ROW_CHANGE contract

Add:

- `row_table text nullable`;
- `row_operation text nullable`;
- `changed_fields text[] nullable`;
- `before_snapshot jsonb nullable`;
- `after_snapshot jsonb nullable`.

Canonical operations:

- `INSERT`
- `UPDATE`
- `DELETE`

For new canonical ROW_CHANGE entries:

- `event_type` is a stable change key;
- `resource_type` identifies the logical entity/table contract;
- `entity_id` identifies the changed row/resource;
- `row_table` records the database relation for provenance;
- `row_operation` records the mutation operation.

### 7.1 Snapshot policy

Snapshots are **opt-in per audited table**, not automatic.

M1B explicitly rejects generic persistence of `to_jsonb(NEW)` or `to_jsonb(OLD)` for arbitrary rows.

Default behavior:

- identifiers;
- operation;
- changed-field names where safe;
- no full snapshots.

A table may enable before/after projections only with a reviewed allowlist.

Examples where snapshots should remain off by default:

- Wealth financial rows;
- consent rows containing sensitive context;
- provider/credential-related structures;
- document content.

When snapshots are justified:

- only allowlisted fields are copied;
- sensitive fields are redacted/omitted before storage;
- metadata/snapshots remain bounded;
- DELETE uses before only;
- INSERT uses after only;
- UPDATE may use both.

---

## 8. Data minimization and bounds

Shared Audit is not a payload dump.

Do not place in shared audit by default:

- raw e-mail;
- phone number;
- IP address;
- user-agent;
- authorization headers;
- cookies;
- OAuth tokens;
- API keys;
- WhatsApp tokens;
- credentials;
- raw payment/provider payloads;
- document bodies;
- arbitrary request bodies.

Specialized security/provider structures may keep justified telemetry under their own policies.

### 8.1 Shared metadata

Add:

- `metadata jsonb nullable`.

For canonical rows, future writer validation should enforce approximately:

- serialized metadata <= 8 KiB;
- max nesting depth 4;
- bounded object key count;
- bounded arrays;
- bounded strings;
- secret-key denylist;
- action-specific allowlist from TypeScript contract.

Database should enforce the byte bound; application code owns semantic allowlisting/depth validation.

### 8.2 Row snapshots

Combined before/after snapshot budget should not exceed 16 KiB for a single audit entry.

This is an upper boundary, not a target. Most shared audit rows should carry no snapshots.

---

## 9. Retention classes

Add:

- `retention_class text nullable`.

Canonical values:

- `OPERATIONAL_HISTORY`
- `AUDIT_STANDARD`
- `AUDIT_EXTENDED`
- `AGGREGATED_ARCHIVE`

Assignment rules:

- shared ACTION defaults conceptually to AUDIT_STANDARD;
- privileged/security-sensitive/financial/entitlement/consent actions may be AUDIT_EXTENDED according to registry/policy;
- row-change retention is defined by the audited domain;
- operational timelines remain OPERATIONAL_HISTORY in their specialized tables;
- analytics aggregates belong to AGGREGATED_ARCHIVE, not raw shared audit.

M1B does **not** freeze day counts.

Legal/security policy owns exact durations.

---

## 10. Append-only model

Shared audit is append-only application data.

Target privileges:

### Browser / anon

- no SELECT;
- no INSERT;
- no UPDATE;
- no DELETE;
- no TRUNCATE.

### authenticated

- no direct table access by default;
- company/personal audit is exposed only through authorized server read models.

### service_role

- SELECT for trusted server read models;
- INSERT for trusted server writers;
- no ordinary UPDATE;
- no ordinary DELETE;
- no ordinary TRUNCATE.

### database/maintenance owner

Retention/archival operations are a separate privileged maintenance concern.

Normal application service-role access must not acquire destructive audit privileges merely to support retention.

Updates to repair historical audit rows are not normal runtime behavior and require a separately authorized remediation.

---

## 11. RLS and read security

RLS remains enabled.

Shared audit receives no broad `authenticated SELECT` policy.

Read patterns are API/server-first.

### Company audit read

Server must:

1. authenticate user;
2. resolve current company context;
3. verify current company permission to view audit;
4. query only matching company-scope rows;
5. return a safe projection.

Historical audit membership does not grant current company access.

### Personal audit read

A personal product may expose selected rows only after:

1. authenticated current user;
2. exact personal `scope_user_id`;
3. product-access check where applicable;
4. safe projection.

### Platform admin

Use server-side platform authorization such as `audit.read`.

The audit row itself never grants platform-admin permission.

### Internal writers

Internal writers use trusted server/service context.

If a future privileged RPC is truly required, it must have:

- fixed safe `search_path`;
- explicit role grants;
- bounded input;
- no caller-controlled SQL identity;
- no permission inference from payload.

M1B prefers ordinary trusted service-role INSERT over adding a SECURITY DEFINER RPC solely for convenience.

### ROW_CHANGE trigger

`ecosystem_private.record_change()` remains a legitimate privileged trigger boundary because protected row changes may originate from authenticated DML that has no direct INSERT privilege on the audit table.

Future trigger design must:

- remain in a private schema;
- use fixed safe search path / schema-qualified relations;
- revoke direct execution from public/browser roles;
- write only bounded canonical fields;
- never use generic full-row payload dumps.

---

## 12. Action Registry relationship

Action Registry remains **TypeScript-first**.

M1B creates no registry table.

Future Action Registry definition owns, per action key/version:

- stable action id;
- action version;
- owning domain/product;
- allowed scope kinds;
- allowed actor/initiator kinds;
- resource contract;
- payload/metadata validator;
- audit requirement and required lifecycle stages;
- retention class;
- risk class;
- approval requirement;
- confirmation requirement;
- entitlement requirement;
- consent requirement.

The database owns durable values and structural integrity.

A future shared ACTION writer must resolve the action from the registry before insertion.

Unknown new ACTION keys fail closed in application code.

Legacy rows remain readable without pretending they were registry-validated.

---

## 13. Entitlement and consent boundary

Audit may record evidence such as:

- authorization decision code;
- evaluated entitlement grant ids;
- evaluated consent id/policy version;
- rejection reason code.

That evidence is historical.

It is **never** authorization authority.

An audit row must not:

- grant entitlement;
- grant consent;
- preserve access after permission revocation;
- bypass execution-time authorization checks.

M1C/M1D remain the future sources of truth for their own contracts.

---

## 14. Idempotency and dedupe

### 14.1 ROW_CHANGE

No artificial dedupe key is required for normal row-change triggers.

A committed database mutation is itself the provenance event.

Repeated real mutations should remain visible rather than being collapsed.

### 14.2 ACTION

ACTION requires optional stable idempotent insertion for retrying server operations.

Add:

- `dedupe_key text nullable`.

Semantics:

- identifies one exact immutable audit entry;
- caller must reuse it on retry;
- for lifecycle auditing, the key includes/stably represents the action instance + lifecycle result/stage;
- it is not the same as Event Fabric event idempotency;
- it is not the same as domain-side-effect idempotency.

Scope-aware uniqueness for canonical ACTION rows:

Company:

`(company_id, source, audit_kind, dedupe_key)`

Personal:

`(scope_user_id, source, audit_kind, dedupe_key)`

Platform:

`(source, audit_kind, dedupe_key)`

All are partial indexes for non-null dedupe keys and their respective scope.

Do **not** reuse `event_idempotency` as the audit uniqueness ledger.

---

## 15. Proposed structural constraints

Constraints apply strictly to new contract rows while preserving legacy history.

Use `audit_contract_version IS NULL` as the legacy compatibility boundary.

For `audit_contract_version = 1`:

- `audit_kind` must be ROW_CHANGE or ACTION;
- `key_version >= 1`;
- `event_type` must be a bounded stable identifier;
- `actor_kind` must be bounded;
- USER actor requires `actor_id`;
- non-user actor requires `actor_key`;
- scope invariant must be structurally valid;
- product/source/purpose keys must satisfy bounded identifier shape when present;
- `resource_type` and `entity_id` must be non-empty;
- `retention_class` must be canonical;
- metadata byte bound must hold;
- dedupe key length is bounded.

For ACTION:

- `action_instance_id` required;
- `result` required and bounded;
- `row_operation` must be null;
- approval/confirmation/risk/assistance fields follow bounded vocabularies.

For ROW_CHANGE:

- `row_table` required;
- `row_operation` required;
- `result` must be null;
- action-only approval fields must be null unless a later contract explicitly changes this.

This allows one owning-domain migration to add and validate its own constraints without a generic M1F validation migration.

---

## 16. Index plan

Only access-pattern-driven indexes are proposed.

### Shared query indexes

1. company timeline:
   `(company_id, recorded_at desc)` where company_id is not null

2. personal timeline:
   `(scope_user_id, recorded_at desc)` where scope_user_id is not null

3. product/action:
   `(product_id, event_type, recorded_at desc)` where product_id is not null

4. resource history:
   `(resource_type, entity_id, recorded_at desc)`

5. correlation:
   `(correlation_id, recorded_at desc)` where correlation_id is not null

6. actor investigation:
   reuse/extend current actor/date index around `actor_id, recorded_at desc`

7. audit class:
   `(audit_kind, recorded_at desc)`

### Idempotency indexes

Three scope-aware partial unique ACTION indexes described in section 14.

Do not create an index for every new column.

No index is proposed initially for:

- purpose_key alone;
- risk_class alone;
- result alone;
- request_id alone;
- retention_class alone.

Those can be added only when measured query patterns justify them.

---

## 17. Specialized log strategy

| Existing structure | Classification | M1B decision |
|---|---|---|
| `ecosystem_audit_events` | GENERALIZE INTO SHARED AUDIT | Canonical shared surface for ROW_CHANGE + ACTION. |
| `system_audit_logs` | BRIDGE TO SHARED AUDIT | Keep active company/system compatibility log. Selected future semantic actions also emit shared ACTION; no bulk copy. |
| `admin_audit_logs` | BRIDGE TO SHARED AUDIT | Keep current admin UI/log. High-value future admin actions can also emit canonical ACTION. |
| `affiliate_audit_logs` | BRIDGE TO SHARED AUDIT | Keep partner-specific details; selected privileged partner actions bridge. |
| `security_events` | KEEP SPECIALIZED | Security incident/telemetry + resolution workflow; do not copy raw IP/UA into shared audit. |
| `application_error_events` | KEEP SPECIALIZED | Error telemetry, not business audit. |
| `order_status_history` | KEEP SPECIALIZED | Operational order history/read model. |
| `proposal_events` | KEEP SPECIALIZED | Proposal operational history. |
| `timeline_events` | KEEP SPECIALIZED | Customer/business presentation timeline, not compliance audit. |
| `customer_portal_events` | KEEP SPECIALIZED | Portal/domain event history. |
| `subscription_events` | KEEP SPECIALIZED | Provider/billing lifecycle ledger; manual/privileged billing commands may bridge separately. |
| `payment_webhook_events` | KEEP SPECIALIZED | Provider idempotency/processing ledger. |
| `whatsapp_message_logs` | KEEP SPECIALIZED | Message transport history. |
| `whatsapp_webhook_events` | KEEP SPECIALIZED | Provider webhook processing ledger. |
| `assistant_events` | KEEP SPECIALIZED + SELECTIVE BRIDGE | Analytics/invocation events remain analytics; meaningful recommendation/draft/confirmed actions may create shared ACTION entries. |
| `product_analytics_events` | KEEP SPECIALIZED | Product analytics is not audit authority. |
| `platform_support_ticket_events` | KEEP SPECIALIZED | Support workflow history. |

Bridge means selective dual evidence for meaningful actions, **not** table replication.

---

## 18. Read model design

M1B does not create UI screens.

It defines safe future server read models.

### 18.1 Company audit timeline

Source:

- Shared Audit rows with COMPANY scope and matching company;
- optionally selected specialized history through explicit adapters.

Projection:

- id;
- audit kind;
- action/change key;
- result;
- safe actor display resolved separately;
- resource type/id;
- product;
- recorded_at;
- safe bounded metadata subset.

Do not return raw internal metadata by default.

### 18.2 Resource history

Filter:

- `resource_type`;
- `entity_id`;
- authorized current scope.

May combine shared ACTION and ROW_CHANGE rows chronologically.

### 18.3 Security investigation

Security UI remains centered on `security_events`.

Shared audit can be correlated by:

- actor;
- company;
- resource;
- correlation id;
- timestamp.

No automatic payload merge.

### 18.4 Platform support/admin

Platform API verifies `audit.read` and returns safe normalized records from:

- shared audit;
- current admin/affiliate compatibility logs where required.

### 18.5 Automation history

Filter:

- `actor_kind=AUTOMATION`;
- Flow/product;
- correlation/action instance/resource.

### 18.6 AI trace

Use:

- `actor_kind`;
- `assistance_mode`;
- product;
- action key;
- result;
- action instance/correlation.

Assistant analytics remains separate.

---

## 19. Backfill policy

### Decision: NO SEMANTIC BACKFILL

Do not fabricate historical ACTION records from:

- `system_audit_logs`;
- `admin_audit_logs`;
- affiliate logs;
- timelines;
- provider events;
- security events;
- application errors;
- analytics.

Do not infer:

- product;
- purpose;
- risk;
- approval;
- initiator;
- entitlement/consent state;
- correlation;
- action version.

### Existing 13 staging shared rows

The inspected source strongly indicates row-change origin, but M1B still does not rewrite those records merely to satisfy the new shape.

They remain legacy rows with `audit_contract_version = NULL`.

Future read model may label them as legacy row-change records using their existing key only where the UI explicitly supports legacy records.

No fake context/product/result fields are populated.

---

## 20. Compatibility

### M1A Event Fabric

Compatible.

M1B stores optional trace identifiers but:

- does not depend on Event Fabric activation;
- does not add an Event Fabric producer;
- does not use outbox for audit delivery;
- does not alter M1A tables/RPCs;
- does not alter Event Fabric idempotency.

### Business

Existing `system_audit_logs` and company audit UI continue unchanged during compatibility.

Future Business actions may gradually adopt shared ACTION writes.

### Wealth

Current staging row-change triggers remain provenance inputs.

M1B does not expose Wealth snapshots or financial details by default.

### Integrations

Provider/integration logs remain specialized.

Credential rotation or privileged integration configuration actions may produce shared ACTION rows without copying secrets/provider payloads.

### M1C Entitlements

M1C grant/revoke is a first-class candidate shared ACTION consumer.

Entitlement table row changes may also produce ROW_CHANGE, but ACTION describes the business decision and ROW_CHANGE describes persisted mutation.

### M1D Consent

Consent grant/revoke follows the same dual-evidence model.

The audit row is evidence, never consent authority.

### M1E Notifications

Notification delivery/read state remains outside M1B.

Audit may record a privileged notification administration action, not normal notification traffic.

### Action Registry

TypeScript-first and required for new canonical ACTION writes.

No DB Action Registry table.

### Orçaly Intelligence / Flow

M1B can represent recommendation, draft, human confirmation, automation and future AI initiation without authorizing autonomous execution.

---

## 21. Future migration plan

### Migration count: ONE owning-domain migration is sufficient

Suggested conceptual migration:

`m1b_shared_audit_contract`

Do not create it until separately authorized.

The migration should be forward-only and compatibility-safe.

### Step A — promote/reuse the existing surface

- `create table if not exists public.ecosystem_audit_events` with legacy-compatible base shape for environments where it is absent;
- preserve existing staging rows and current primary key;
- no table rename.

### Step B — additive columns

Add the fields defined by this document with nullable compatibility defaults.

Do not add misleading semantic defaults such as:

- default product;
- default human actor;
- default company scope;
- default result.

New writers supply contract fields explicitly.

### Step C — contract constraints

Add checks owned by M1B.

Legacy rows pass through `audit_contract_version IS NULL`.

Canonical version-1 rows receive strict structural checks.

Where a constraint requires phased rollout, use the owning M1B migration's own validation strategy. Do not create a generic M1F migration.

### Step D — ROW_CHANGE trigger hardening

Upgrade `ecosystem_private.record_change()` to emit canonical ROW_CHANGE fields for configured tables.

Requirements:

- private schema;
- fixed safe search path;
- schema-qualified target relation;
- direct execution revoked;
- no arbitrary full-row snapshots;
- deterministic scope extraction only;
- no secrets/PII dump.

Do not attach the trigger to every table.

Each audited table must be explicitly allowlisted.

### Step E — indexes

Create the limited read and dedupe indexes from this document.

### Step F — RLS/grants

- enable/retain RLS;
- revoke browser access;
- grant trusted server SELECT/INSERT only;
- remove ordinary UPDATE/DELETE/TRUNCATE from application service-role access if present;
- keep retention/destructive operations outside normal application privilege.

### Step G — no backfill

No historical semantic inserts.

No inferred update of legacy rows.

---

## 22. Production promotion gate

Coordinator reconciliation explicitly states:

> Do not promote production `ecosystem_audit_events` merely to have the table.

Therefore:

- M1B may be implemented/certified in staging when authorized;
- production application of the M1B migration remains gated;
- production promotion occurs together with the first real shared-contract consumer;
- the consumer must have its writer, security review and QA ready.

Likely future consumers include M1C grant/revoke or M1D consent operations, but M1B does not select or implement them.

---

## 23. Expected future runtime changes

Not authorized in this mission.

Probable implementation surfaces later:

- a server-only shared audit contract/validator;
- a TypeScript Action Registry adapter;
- a trusted ACTION writer;
- a safe shared-audit read adapter;
- compatibility bridges from selected privileged writers.

Current writers such as:

- `lib/orcaly-audit.ts`;
- `lib/security/privileged-audit.ts`;
- `lib/platform-admin.ts`

must not be silently redirected until an explicit compatibility plan is authorized.

No existing specialized log should stop receiving required domain records merely because Shared Audit exists.

---

## 24. Security review points for Agent 4

Agent 4 should review at implementation time:

1. service-role SELECT/INSERT only on shared audit;
2. UPDATE/DELETE/TRUNCATE revocation;
3. RLS with no accidental browser policy;
4. private ROW_CHANGE trigger SECURITY DEFINER boundary;
5. fixed search_path/schema qualification;
6. actor identity trust boundary;
7. company/personal scope integrity;
8. product key trust boundary;
9. metadata/snapshot byte bounds;
10. secret/PII key allowlist/denylist;
11. ACTION dedupe partial unique indexes;
12. legacy-row compatibility checks;
13. server read-model BOLA/IDOR protection;
14. platform-admin `audit.read`;
15. no Event Fabric circular dependency;
16. no authorization from historical audit evidence;
17. retention deletion separated from application service role.

---

## 25. Acceptance criteria for future M1B implementation

A future implementation is not complete unless independent QA proves at minimum:

### Contract

- ROW_CHANGE and ACTION are structurally distinguishable;
- legacy rows remain readable;
- new canonical rows require contract version;
- invalid scope combinations fail closed;
- invalid actor combinations fail closed;
- product/resource identifiers obey the contract;
- ACTION result vocabulary is enforced.

### Append-only

- anon cannot read/write;
- authenticated cannot directly read/write;
- service writer can insert;
- application service role cannot update/delete/truncate shared audit.

### Privacy

- secret-bearing metadata is rejected/redacted;
- raw request/provider bodies are not accepted;
- snapshot bounds enforced;
- full-row generic snapshot is absent.

### Idempotency

- same ACTION dedupe key in same scope/source dedupes;
- same local key may coexist in different company/personal scopes;
- ROW_CHANGE mutations are not incorrectly deduped.

### Event Fabric

- audit works while Event Fabric is disabled;
- correlation/event ids can be carried;
- audit insertion does not enqueue Event Fabric;
- outbox retention does not destroy shared audit trace identity.

### Specialized coexistence

- current company audit UI still works;
- admin audit still works;
- affiliate audit still works;
- security/error/provider/history logs remain available;
- no specialized table is bulk-copied or disabled.

### Row change

- allowlisted protected mutation creates one ROW_CHANGE entry;
- snapshots contain only allowed fields;
- sensitive rows default to no snapshots.

### ACTION

- human company action is distinguishable from personal action;
- service/system action carries actor_key;
- automation and AI modes are distinguishable;
- human-confirmed AI action identifies both the human actor and AI assistance;
- rejected/failed/completed semantics remain queryable.

---

## 26. Decisions resolved

### Canonical audit classes

DEFINED:

- ROW_CHANGE
- ACTION

### Canonical shared surface

DEFINED:

- `ecosystem_audit_events`

### Semantic ACTION fields

DEFINED:

- stable key/version;
- action instance;
- actor;
- subject/context;
- product;
- resource;
- purpose/source;
- correlation/causation/event;
- result;
- approval/confirmation/risk;
- AI assistance;
- retention;
- bounded metadata;
- optional dedupe.

### Actor/context model

DEFINED with separate:

- actor user;
- non-user actor;
- subject;
- company scope;
- personal scope;
- platform scope.

### Resource model

DEFINED:

- `resource_type + entity_id`.

### Action key model

DEFINED:

- TypeScript-first;
- globally qualified future action keys;
- versioned semantics;
- legacy keys preserved without rewrite.

### Result model

DEFINED:

- ATTEMPTED
- REJECTED
- AUTHORIZED
- EXECUTED
- FAILED
- COMPLETED
- SKIPPED

### Event Fabric relationship

DEFINED:

- trace integration only;
- no delivery dependency;
- no cycle;
- no Event Fabric idempotency reuse.

### Action Registry relationship

DEFINED:

- TypeScript authoritative;
- no database registry table.

### Privacy

DEFINED:

- explicit fields;
- bounded metadata;
- no raw secret/PII dumps;
- allowlisted optional row snapshots.

### Retention

DEFINED as conceptual classes, no day counts.

### Append-only

DEFINED:

- insert-only normal runtime;
- retention is separate privileged maintenance.

### RLS/grants

DEFINED:

- server/API first;
- browser denied;
- service SELECT/INSERT only;
- scoped reads after current authorization.

### Idempotency

DEFINED:

- ACTION uses optional scope-aware dedupe;
- ROW_CHANGE does not collapse real mutations;
- separate from Event Fabric/domain action idempotency.

### Specialized logs

DEFINED:

- coexistence + selective bridging;
- no destructive consolidation.

### Backfill

DEFINED:

- NO SEMANTIC BACKFILL.

### Migration sequence

DEFINED:

- one future owning-domain M1B migration;
- staging certification first;
- production promotion only with first real shared-audit consumer.

---

## 27. Explicit non-goals

M1B does not implement:

- Action Registry runtime;
- Product Registry migration;
- entitlements;
- consent;
- notifications;
- autonomous AI actions;
- Event Fabric changes;
- UI screens;
- retention cron;
- archival job;
- legal retention periods;
- customer identity;
- a new audit table;
- migration SQL in this design mission.

---

## 28. Final design status

`M1B_SHARED_AUDIT_DESIGN: COMPLETE`

The design is ready for Coordinator review.

Implementation remains not authorized.
