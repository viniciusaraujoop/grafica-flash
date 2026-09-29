# ORÇALY — M1 Shared Foundation Migration Design

## Executive Summary

M1 defines the **migration architecture and execution order only** for the Orçaly Shared Foundation.

No SQL migration file is created by M1. No DDL, DML, database mutation, deployment, staging bootstrap, production change, or main merge is authorized or performed.

Baseline:

- Repository: `viniciusaraujoop/grafica-flash`
- Canonical main: `2da6a56cf7edc67a1598c18302d73dfdfecbea97`
- M0.2 branch: `reconcile/m0-2-provenance-remediation`
- M0.2 exact commit: `c03d3e845a17c52f9fec8218a07cb6fa2dd0e22e`
- Production ledger: 51 migrations
- Staging ledger: 27 migrations
- Last canonical applied migration frontier: `20260927170000`
- Current collision-safe date prefix: `20260929`, to be revalidated immediately before any future migration file creation.

Architecture principle preserved:

> Uma plataforma, contratos compartilhados, armazenamento particionado por escopo.

The design deliberately does **not** introduce microservices, Kafka, a second event system, full event sourcing, full CQRS, or an external workflow engine.

The current database already contains most of the infrastructure that Shared Foundation needs:

- `event_idempotency`
- `transactional_outbox`
- `background_jobs`
- `timeline_events`
- `customer_profiles`
- `customer_duplicate_candidates`
- `integration_*`
- `company_members`
- several notification/audit surfaces.

Staging additionally already contains the first ecosystem contracts:

- `ecosystem_product_entitlements`
- `ecosystem_context_consents`
- `ecosystem_audit_events`

The correct Shared Foundation therefore is mostly **canonicalization + additive extension + compatibility transition**, not a greenfield replacement.

### Canonical decisions

1. **Event Fabric**
   - Reuse `event_idempotency`, `transactional_outbox` and `background_jobs`.
   - Do not create another event bus or queue table family.
   - Keep `needs_attention` as the human-intervention/dead-letter terminal state.
   - Add contract/correlation/scope metadata only where required.
   - Preserve SKIP LOCKED worker consumption.

2. **Customer Identity**
   - `customer_profiles` remains the canonical customer record inside a company tenant.
   - `merged_into_id` + `archived` remain canonical merge semantics.
   - Introduce only one missing primitive: a tenant-bound `customer_identity_links` relation for multiple source references.
   - Do not infer identity from phone/email similarity.
   - Existing provider mappings remain in `integration_mappings`; do not duplicate provider identity mapping.

3. **Entitlement**
   - Promote `ecosystem_product_entitlements` as the future canonical product-access authority.
   - Billing/subscription fields are **facts feeding entitlement issuance**, not entitlement themselves.
   - `company_members.permissions` remains operational company authorization and does not become product entitlement.
   - No entitlement is inferred from plan name, trial field, payment state, membership, or consent.

4. **Consent**
   - Reuse and extend `ecosystem_context_consents`.
   - Consent remains separate from entitlement.
   - A valid entitlement never implies consent; consent never creates entitlement.
   - Grants remain server-operated and fail closed; user self-service revocation remains supported.

5. **Audit**
   - Reuse and extend `ecosystem_audit_events` as the canonical **shared-contract audit** sink.
   - Do not delete or bulk-copy specialized audit histories.
   - `system_audit_logs`, `admin_audit_logs`, `security_events`, `affiliate_audit_logs`, customer portal event history and other specialist records remain domain-owned.
   - Canonical audit metadata must be allow-listed and avoid duplicating raw PII.

6. **Action Registry**
   - Canonical action/event/job/product identifiers belong primarily in TypeScript registries.
   - The database stores stable identifiers and validates shape/integrity, but does not become a mutable catalog of arbitrary application strings.
   - No Shared Foundation “action registry table” is proposed.

7. **Integration Foundation**
   - Reuse the five canonical integration migrations and current `integration_*` model.
   - No duplicate connection/OAuth/mapping/queue schema.
   - Continue using Vault-backed credential references and shared background jobs/outbox.
   - Legacy WhatsApp secret fields are a security follow-up, not M1 migration work.

8. **Notification / Inbox**
   - Reuse active `app_notifications` as the migration target instead of inventing another table.
   - Generalize it so it can represent company and personal notifications while preserving existing Business consumers.
   - Keep `smart_notification_events` and `smart_notification_settings` Business-specific.
   - Treat the currently empty `notifications` table as legacy/overlap; do not create new writes into it.

---

# Current-State Inventory

## A. Event Fabric

### Existing objects

#### public.event_idempotency

Presence:

- Production: YES
- Staging: YES
- Current rows: 0 in production, 0 in staging.

Current contract:

- provider + event_id unique identity
- optional company scope
- event type
- payload hash
- receive/process timestamps
- status
- attempt counter
- error
- metadata.

Current status model already supports:

- received
- processing
- processed
- ignored
- failed
- retrying
- needs_attention.

Repository / ledger provenance:

- production reliability foundation: `20260907232527 orcaly_3_1_reliability_foundation`
- current repository equivalent source: `20260907233000_orcaly_3_1_reliability_foundation.sql`.

Current consumers:

- provider-specific payment webhook ledger mirror
- WhatsApp webhook mirror
- server-side reliability/event observability.

Decision:

**REUSE + EXTEND MINIMALLY**

It remains the canonical external-event idempotency ledger. It is not a general event log and should not be stretched into one.

#### public.transactional_outbox

Presence:

- Production: YES
- Staging: YES
- Current rows: 0 / 0.

Current contract:

- optional company scope
- event_type
- aggregate_type / aggregate_id
- payload
- queued/processing/completed/failed/retrying/needs_attention state
- attempts / max_attempts
- available_at / created_at / processed_at
- last_error.

Decision:

**REUSE + EXTEND**

Missing shared-contract capabilities:

- explicit product/producer ownership
- personal-user scope for non-company products
- contract version
- correlation/causation identity
- optional deterministic dedupe key
- worker lock ownership if the outbox is claimed directly.

No second outbox is proposed.

#### public.background_jobs

Presence:

- Production: YES
- Staging: YES
- Current rows: 0 / 0.

Existing worker primitives:

- `claim_background_jobs`
- `settle_background_job`
- `recover_stale_background_jobs`

The live claim operation already uses `FOR UPDATE SKIP LOCKED`, moves queued/retrying work to running, increments attempts and records worker lock ownership.

Settlement supports:

- completed
- failed
- retrying
- needs_attention.

Stale worker recovery also uses SKIP LOCKED and transitions exhausted jobs to `needs_attention`.

Additional consumers already exist in schema:

- generic `integration.sync`
- Google Calendar full resync
- staging Wealth recurrence.

Decision:

**REUSE AS CANONICAL JOB QUEUE**

Do not create provider/product-specific job tables unless a future requirement proves the generic contract insufficient.

#### public.timeline_events

Presence:

- Production: YES
- Staging: YES
- Current rows: 0 / 0.

Purpose:

Business/customer-facing operational timeline.

Decision:

**REUSE AS DOMAIN TIMELINE, NOT AS EVENT FABRIC**

It is intentionally presentation/business-history oriented and should not replace outbox/idempotency/audit.

---

## B. Customer Identity

### public.customer_profiles

Presence:

- Production: YES
- Staging: YES.

Production population:

- 21 profiles
- all 21 currently have a `source_id`
- source distribution observed: 18 `public_site`, 3 `manual`
- 11 have normalized phone
- 10 have normalized email
- 0 currently archived
- 0 currently merged.

Current semantics:

- company-scoped canonical profile
- `contact_key`
- normalized/raw email and phone
- source + source_id
- `merged_into_id`
- `archived`
- metadata.

Tenant integrity:

- `company_id` FK
- unique `(company_id, contact_key)`
- source check
- company-scoped indexes.

Decision:

**REUSE AS CANONICAL CUSTOMER RECORD**

### public.customer_duplicate_candidates

Presence:

- Production: YES
- Staging: YES.

Production population:

- 36 rows
- all currently `needs_review`
- observed confidence: 95.

Current merge contract:

`merge_customer_profiles`:

- requires same company
- locks both active profiles
- repoints orders, proposals, CRM leads, notes, followups, financial transactions and timeline events
- enriches the primary profile only from non-null values
- archives the duplicate
- sets `merged_into_id`
- records timeline event.

Decision:

**REUSE**

### Missing primitive: customer_identity_links

A canonical customer can accumulate multiple source references over time. `customer_profiles.source/source_id` represents the profile's originating source, while `integration_mappings` covers provider-connection mappings only.

Shared Foundation therefore requires a small tenant-scoped identity-link relation conceptually containing:

- company scope
- customer_profile reference
- source namespace
- source reference/id
- creation/last-seen timestamps
- optional non-PII metadata
- deterministic uniqueness for one source reference within a tenant.

Important boundary:

- normalized phone/email remain customer attributes, not automatic identity links.
- no cross-company lookup.
- no merge based only on similarity.
- provider identities already represented by `integration_mappings` remain there.

Merge behavior:

Identity links do not need destructive reassignment when a profile is merged. Resolution should follow the linked profile's `merged_into_id` to its canonical active profile. This preserves historical source provenance.

Backfill:

The initial backfill may use only existing `customer_profiles.source` + `source_id` values where present. In current production all 21 profiles have source_id, so that transition is deterministic.

No email/phone-derived identity rows are allowed.

---

## C. Entitlement Foundation

### Existing competing sources

Current product/business access facts are spread across:

- `companies.plano`
- `companies.assinatura_status`
- `companies.assinatura_plano`
- subscription/trial timestamps and provider identifiers
- partner profile status
- company ownership/membership
- `company_members.permissions`
- rollout flags
- staging `ecosystem_product_entitlements`.

These concepts are not equivalent.

Canonical separation:

- **billing/subscription** = commercial/payment facts
- **membership** = relationship with a company
- **company permission** = operational action authorization inside that company
- **rollout flag** = feature release availability
- **entitlement** = right to enter/use a product surface
- **consent** = permission to move/use context for a stated purpose.

### public.ecosystem_product_entitlements

Presence:

- Production: NO
- Staging: YES
- Staging rows: 0.

Source provenance:

- branch: `codex/orcaly-ecosystem`
- migration: `20260926014103_ecosystem_identity_wealth.sql`
- source commit: `c3f367b87b844dbe85220264ebe6fa0f5b647a3c`.

Current strengths:

- exactly one user/company subject
- explicit active/revoked/expired state
- start/expiry timestamps
- permissions
- source + source reference
- deny-by-default RLS
- authenticated read only
- service-role mutation
- Wealth access helper checks entitlement + permission + time window.

Current limitations:

- product/context rules are hard-coded in DB checks
- permission vocabulary is limited to `product.read/write/export`
- partner/bundle context semantics are not fully expressed
- no explicit revocation actor/time separate from generic status
- no updated timestamp / controlled metadata.

Decision:

**PROMOTE + EXTEND, DO NOT REPLACE**

Canonical authority after migration/cutover:

`ecosystem_product_entitlements`.

The TypeScript product registry owns valid product identity/context/capability definitions. DB integrity should enforce subject/time/status/identifier shape, but should not become a second mutable product catalog.

### Data transition rule

Production creation of this table must **not** automatically create grants from `plano`, subscription status, trial timestamps, payment history or company membership.

Entitlement issuance/backfill requires a separately approved deterministic mapping from an authoritative billing/product rule.

Ambiguous cases fail closed and receive no entitlement.

Business may temporarily continue its legacy access path during the compatibility window; that legacy path is not redefined as canonical entitlement.

---

## D. Consent Foundation

### public.ecosystem_context_consents

Presence:

- Production: NO
- Staging: YES
- Staging rows: 0.

Source:

- `20260926014103_ecosystem_identity_wealth.sql`
- commit `c3f367b87b844dbe85220264ebe6fa0f5b647a3c`.

Current strengths:

- user subject
- source product / target product
- source/target company references
- explicit data scope
- purpose
- grant/expiry/revoke timestamps
- maximum consent lifetime
- authenticated read-own
- authenticated revoke-own
- no authenticated INSERT
- service-role controlled grants.

Decision:

**REUSE + GENERALIZE**

Required canonical additions/clarifications:

- explicit grant/source provenance
- request/correlation identity where appropriate
- optional grant actor/reference only when evidence exists
- controlled non-PII metadata if necessary
- stable scope/purpose identifiers validated by server registries
- maintain explicit revocation and expiry.

No consent rows are backfilled or inferred.

Entitlement and consent remain two required independent checks for cross-product context transfer.

---

## E. Audit Foundation

Existing fragmented audit/event surfaces include:

- `system_audit_logs`: 36 production rows
- `admin_audit_logs`: 17 production rows
- `security_events`: 428 production rows, 24 staging rows
- `affiliate_audit_logs`: 3 production rows
- `customer_portal_events`: 1 production row
- `ecosystem_audit_events`: 13 staging rows
- plus domain event tables such as subscription/proposal/webhook histories.

These tables have different security and retention purposes and should not be collapsed.

### public.ecosystem_audit_events

Presence:

- Production: NO
- Staging: YES.

Current columns are intentionally small:

- actor_id
- event_type
- entity_id
- recorded_at.

Current Wealth/ecosystem triggers use it for insert/update/delete audit identifiers.

Decision:

**REUSE + EXTEND AS SHARED-CONTRACT AUDIT**

Canonical shared audit dimensions:

- actor kind
- actor user id where applicable
- action key
- resource type
- resource id
- scope kind
- company id when company-scoped
- product id when product-owned
- timestamp
- correlation id
- request id where supplied
- source/producer
- bounded metadata.

PII rule:

The canonical shared audit table must not copy raw email, phone, IP, user agent, payment payload, provider secret, document content or other high-risk values merely for convenience. Specialized security/admin logs retain their own justified fields.

Existing specialized audit rows are **not bulk-copied**.

Staging's 13 existing ecosystem audit rows may be compatibility-mapped mechanically from existing event_type/entity_id fields during a future migration, without inventing company/product context.

---

## F. Action Registry

Current schema contains many free-form or semi-constrained identifiers:

- `event_type`
- `job_type`
- `automation_rules.trigger_key`
- automation action payload strings
- notification type
- audit action/event values
- product permission strings.

A database table that attempts to enumerate every application action would create synchronization drift between code and DB.

Canonical decision:

### TypeScript registry owns

- action identifiers
- event identifiers
- job identifiers
- product identifiers
- permission identifiers
- contract version
- owning product/domain
- payload validator/type
- whether an action is auditable
- whether it requires entitlement
- whether it requires consent
- whether it is server-only.

### Database owns

- durable action/event/job identifier values attached to records
- identifier shape constraints
- foreign-key scope/resource integrity where available
- dedupe/idempotency uniqueness
- timestamps/status/attempt state.

### Both

The same stable identifier appears in code registry and durable rows, but the DB does not maintain a second mutable registry catalog.

### Neither

Presentation labels, translated copy, icons and UI route names are not part of the durable action contract.

No database Action Registry table is proposed.

---

## G. Customer / Product Shared Contracts

Minimum shared primitives only:

1. Auth user identity remains Supabase Auth.
2. Company workspace identity remains `companies`.
3. Operational company membership remains `company_members`.
4. Product identity/context/capability registry remains TypeScript-owned.
5. Product access becomes `ecosystem_product_entitlements`.
6. Cross-product data permission remains `ecosystem_context_consents`.
7. Company customer identity remains `customer_profiles` + identity links.
8. Shared events/jobs/audit use stable product/action/event identifiers.

There is no proposal to merge Business, Wealth, Growth, Flow, Academy, Market, Partners or One into one domain schema.

---

## H. Integration Foundation

Production and staging already contain:

- `integration_connections`
- `integration_sync_cursors`
- `integration_mappings`
- `integration_usage_daily`
- `integration_oauth_states`
- `integration_push_channels`
- Vault-backed credential RPCs
- background job integration sync constraints.

Canonical provenance remains the restored integration migration line:

- `20260910001442 integration_platform_foundation`
- `20260910004555 integration_google_oauth_security`
- `20260910122922 background_job_worker_transitions`
- `20260910135326 company_timezone_foundation`
- `20260910150730 google_calendar_complete`.

Decision:

**REUSE AS-IS FOR SHARED FOUNDATION**

M1 does not create a second provider connection model, OAuth state table, mapping table, sync cursor, event queue, or secret store.

Provider external customer identifiers remain in `integration_mappings`; the proposed generic customer identity-link primitive is for non-provider/cross-source local identity references and must not duplicate those mappings.

Security-sensitive follow-ups outside M1:

- legacy WhatsApp secret fields
- any remaining client-facing company serialization risk
- secret migration/rotation
- provider-specific security work.

M1 does not move or expose secrets.

---

## I. Notification / Inbox Foundation

Current overlap:

### app_notifications

- Production: 27 rows
- Staging: 0
- active current Business runtime consumer
- written by `lib/orcaly-audit.ts`
- smart scanner writes through the same helper
- read/mark-read API uses this table.

Current table is company-required and therefore Business-shaped.

All 27 production rows have valid company references; any non-null user references observed are valid.

### smart_notification_events / smart_notification_settings

Business-specific dedupe and scanner configuration.

Decision:

**KEEP SPECIALIZED**

These are not the shared inbox contract.

### notifications

- Production: 0 rows
- Staging: 0
- broader but currently unused by the active notification API
- has separate RLS policies.

Decision:

**LEGACY / NO NEW WRITES**

A cleaner name is not a sufficient reason to move the platform onto an unused table.

### Canonical migration target

**app_notifications**

Extend it additively so future writes can represent:

- company-wide notification
- user-specific notification within a company
- personal-product notification with no company
- stable product/source identifier
- stable notification/dedupe key
- priority
- bounded payload/metadata
- read timestamp/state.

Product-specific UI remains product-owned. Shared Foundation only supplies durable inbox state/transport identity.

Compatibility:

- existing Business API continues reading existing columns
- new fields are initially nullable/additive
- existing 27 rows do not need invented product metadata
- personal notification support is enabled only after Agent 4 reviews RLS/grants.

---

# Canonical Shared Contracts

## 1. Event Contract

A durable event must identify:

- stable event key
- contract version
- producer product/domain
- scope: company, user, or platform
- aggregate/resource identity where relevant
- payload
- correlation id
- optional causation id
- optional idempotency/dedupe key
- creation/availability state.

The TypeScript event registry owns payload validation and event ownership.

## 2. Job Contract

A background job must identify:

- stable job/action key
- producer/owner
- scope
- payload
- retry policy represented by max_attempts
- scheduling time
- lock owner/time
- execution state
- bounded error
- correlation identity.

Existing `background_jobs` already covers almost all of this and remains canonical.

## 3. Customer Identity Contract

- canonical customer = `customer_profiles.id` inside exactly one company
- source references may be many
- a source reference resolves to one profile in that company
- archived merged profiles remain historical aliases
- resolution follows `merged_into_id`
- phone/email similarity may generate duplicate candidates, not automatic identity links.

## 4. Entitlement Contract

Access requires:

- known product
- correct user/company context
- active entitlement
- time-valid entitlement
- required permission
- membership/operational permission when company product
- rollout enabled where applicable.

Entitlement mutation is server-controlled.

## 5. Consent Contract

Context transfer requires:

- valid actor
- source access
- target access
- matching source/target product
- matching source/target workspace context
- matching scope
- matching purpose
- grant still active
- not revoked
- not expired.

## 6. Audit Contract

A shared audit event answers:

- who/what acted
- what action
- what resource
- what scope
- which company/product if applicable
- when
- correlation/request identity
- bounded non-secret metadata.

## 7. Notification Contract

A shared notification identifies:

- recipient scope
- optional company
- optional user
- source product
- stable notification key
- type/priority
- content reference/presentation payload
- created/read state
- dedupe semantics.

---

# Object Reuse Matrix

| Current object | Prod | Staging | Provenance | Current owner / consumers | Decision | Replacement? | Extension? |
| --- | --- | --- | --- | --- | --- | --- | --- |
| event_idempotency | YES | YES | 3.1 reliability foundation | webhook/provider reliability | REUSE | NO | YES, contract/scope metadata only if required |
| transactional_outbox | YES | YES | 3.1 reliability foundation | reliability / future automation/integrations | REUSE | NO | YES |
| background_jobs | YES | YES | 3.1 + worker transitions | integrations, Calendar, Wealth recurrence | REUSE AS-IS CORE | NO | minor metadata only if required |
| timeline_events | YES | YES | 3.1 reliability/customer quality | Business/customer timeline | KEEP DOMAIN-SPECIFIC | NO | NO shared-event conversion |
| customer_profiles | YES | YES | customer-data-quality line | orders, proposals, CRM, notes, finance, timeline | REUSE | NO | NO core rewrite |
| customer_duplicate_candidates | YES | YES | customer-data-quality line | customer merge workflow | REUSE | NO | NO |
| customer_identity_links | NO | NO | new M1 design primitive | future multi-source customer resolution | NEW MINIMAL OBJECT | N/A | N/A |
| company_members | YES | YES | existing Business foundation | company membership/permissions | REUSE | NO | NO entitlement replacement |
| ecosystem_product_entitlements | NO | YES | staging 20260926014103 / c3f367b... | Wealth access; future ecosystem | PROMOTE | NO | YES |
| ecosystem_context_consents | NO | YES | staging 20260926014103 / c3f367b... | privacy/context transfer | PROMOTE | NO | YES |
| ecosystem_audit_events | NO | YES | staging 20260926014103 / c3f367b... | ecosystem mutation audit | PROMOTE | NO | YES |
| system_audit_logs | YES | YES | legacy Business audit | Business operational audit | KEEP SPECIALIZED | NO | NO |
| admin_audit_logs | YES | YES | admin/security lineage | platform admin | KEEP SPECIALIZED | NO | NO |
| security_events | YES | YES | security lineage | security/admin | KEEP SPECIALIZED | NO | NO |
| affiliate_audit_logs | YES | YES | affiliate lineage | Partners | KEEP SPECIALIZED | NO | NO |
| integration_connections | YES | YES | canonical integration foundation | integration server routes | REUSE | NO | NO |
| integration_mappings | YES | YES | canonical integration foundation | provider entity mapping | REUSE | NO | NO |
| integration_oauth_states | YES | YES | canonical integration + OAuth security | OAuth flows | REUSE | NO | NO |
| integration_push_channels | YES | YES | Google Calendar complete | provider push/watch channels | REUSE | NO | NO |
| integration_sync_cursors | YES | YES | canonical integration foundation | synchronization | REUSE | NO | NO |
| app_notifications | YES | YES | 20260628_notificacoes_inteligentes | active Business inbox + smart scanner | PROMOTE/GENERALIZE | NO | YES |
| smart_notification_events | YES | YES | 20260628 notifications | Business notification dedupe | KEEP SPECIALIZED | NO | NO |
| smart_notification_settings | YES | YES | 20260628 notifications | Business scanner config | KEEP SPECIALIZED | NO | NO |
| notifications | YES | YES | legacy | no active shared consumer found; 0 rows | LEGACY | NO | NO |
| companies subscription fields | YES | YES | billing history | Business billing | KEEP AS BILLING FACTS | NO | NO |
| company_members.permissions | YES | YES | Business membership | company operational auth | KEEP | NO | NO |

---

# Proposed Migration Sequence

No final timestamp is assigned in M1.

The sequence below is dependency order, not authorization to implement.

## M1A — Shared Event Contract Hardening

### Working name

`shared_event_fabric_contract`

### Purpose

Finish the existing Event Fabric without creating a second event system.

### Dependencies

- current reliability foundation
- background job worker transitions
- Agent 4 review of server-only RPC exposure.

### Objects affected

- `event_idempotency`
- `transactional_outbox`
- optionally `background_jobs` only for shared metadata consistency
- worker functions around outbox claiming/settlement if direct outbox dispatch is selected.

### New objects

No new event/job table.

A server-only outbox claim/settlement primitive may be needed, but it should be implemented as a function boundary rather than a new queue schema.

### Altered contract

Conceptual additive fields:

- product/producer identifier
- optional user scope for personal products
- contract version
- correlation id
- causation id
- optional dedupe/idempotency key
- lock metadata on outbox only if direct claims require it.

### Data backfill

Current production/staging populations for event_idempotency, transactional_outbox and background_jobs are 0, so no historical event inference is required at the observed baseline.

### Lock risk

LOW for additive nullable columns and indexes while tables are empty.

### RLS impact

Remain server-only.

### Grants impact

No browser write access.

### Security review

YES.

### Application compatibility

Existing event writers may omit new nullable fields during transition.

### Fail-safe / rollback

Old consumers continue functioning while new metadata is nullable. New readers must fail closed when a contract requiring product/scope metadata encounters an unclassified event.

### Staging prerequisite

M0.2 structural baseline only.

### Production prerequisite

None beyond existing reliability/worker migrations.

---

## M1B — Shared Audit Contract Extension

### Working name

`shared_audit_contract`

### Purpose

Promote `ecosystem_audit_events` into a durable shared-contract audit surface before entitlement/consent are promoted into production.

### Dependencies

M1A identifiers/correlation conventions.

### Objects affected

- `ecosystem_audit_events`
- ecosystem audit trigger/function boundary.

### New objects

None if the staging object is reused.

Production requires creation of the existing staging contract before extension.

### Additive canonical dimensions

- actor kind
- action key
- resource type
- resource id
- scope kind
- company id
- product id
- source/producer
- correlation id
- request id
- bounded metadata.

Legacy `event_type` / `entity_id` remain during compatibility.

### Data backfill

Only staging's existing 13 ecosystem rows require transition.

Safe deterministic mapping:

- action key from existing event_type
- resource id from existing entity_id
- actor kind from presence/absence of actor_id.

Do not infer company, product, request or correlation context.

### Lock risk

LOW at current 13-row population.

### RLS / grants

Keep service-controlled writes. Direct authenticated access is not required for the canonical audit table.

### Security review

YES, especially metadata boundaries and SECURITY DEFINER trigger design.

### Compatibility

Specialized audit tables remain untouched.

### Fail-safe

If canonical audit insertion fails, security-sensitive actions must define whether the domain action fails closed or whether specialist audit remains the required record. Agent 4 must classify this per action category.

---

## M1C — Product Entitlement & Consent Promotion

### Working name

`shared_access_and_consent_contracts`

### Purpose

Promote staging's ecosystem entitlement/consent structures into the canonical shared access model.

### Dependencies

- M1B audit contract
- canonical TypeScript product/permission/scope/purpose registries
- explicit Coordinator decisions for Partners/One context behavior.

### Objects affected

- `ecosystem_product_entitlements`
- `ecosystem_context_consents`
- `ecosystem_private.has_personal_access`
- shared access helpers/policies.

### New objects

No replacement tables.

Production will need the objects that already exist in staging.

### Data backfill

Entitlement: **NO inferred backfill**.

Consent: **NO backfill**.

If a later entitlement issuance migration is approved, it may only use an explicit deterministic product/billing mapping approved by Product/Commercial/Coordinator.

### Existing data

Staging entitlement rows: 0.

Staging consent rows: 0.

Therefore schema promotion itself has no legacy-row ambiguity.

### Lock risk

LOW.

### RLS impact

HIGH importance.

Deny-by-default remains mandatory.

Company product access must combine:

- product entitlement
- active company membership/ownership
- operational permission where required.

Personal product access requires user-scoped entitlement.

### Grants

Authenticated users may read only their own relevant grants and consents. Entitlement writes and consent grants remain server-controlled. Consent self-revocation remains allowed only for the subject's own active consent.

### Security review

MANDATORY.

### Compatibility

Business legacy subscription/access checks are not removed in this migration. Cutover is a separate application transition after explicit entitlement issuance rules exist.

### Fail-safe

Missing/ambiguous entitlement => deny.

Missing/expired/revoked consent => deny context transfer.

---

## M1D — Customer Multi-Source Identity Links

### Working name

`shared_customer_identity_links`

### Purpose

Allow one canonical company customer profile to retain multiple source references without changing customer product behavior.

### Dependencies

- existing customer_profiles
- existing merge semantics.

### New object

`customer_identity_links` conceptual relation.

### Integrity requirements

- company-scoped
- FK to customer profile
- source namespace
- source reference
- unique source reference per company/source
- no cross-tenant linkage
- no PII required in the link key
- customer/company consistency enforced at DB level.

### Existing-data backfill

Deterministic source:

`customer_profiles.source + customer_profiles.source_id`.

Observed production:

- 21 customer profiles
- 21 have source_id.

Therefore the initial link backfill can be exact and does not require inference.

### Ambiguity handling

No email/phone matching creates identity links.

Duplicate candidates continue through the existing review/merge path.

### Merge semantics

Links may continue pointing at archived merged profiles; resolution follows `merged_into_id` to canonical profile. This retains source provenance and avoids destructive relinking.

### Lock risk

LOW at current population, but backfill should be batched/controlled as customer volume grows.

### RLS

Company tenant boundary mandatory. Prefer server-side customer APIs as today.

### Security review

YES.

### Compatibility

Current `source/source_id` columns remain. They are not dropped.

---

## M1E — Shared Notification Inbox Generalization

### Working name

`shared_notification_inbox_contract`

### Purpose

Generalize the active notification table without forcing all products into one presentation UI.

### Dependencies

- product identifier registry
- Agent 4 RLS review.

### Objects affected

- `app_notifications`.

### Existing data

27 production rows.

Observed referential state:

- missing company references: 0
- invalid non-null user references: 0.

### Additive concept

Support:

- company scope
- personal user scope
- optional company+specific-user scope
- source product
- stable notification key
- priority
- source
- bounded payload
- existing read state.

The current Business fields remain compatible.

### Data transition

No invented product metadata is assigned to the existing 27 rows.

New writes begin populating new contract fields after application compatibility is deployed.

### RLS impact

HIGH.

Personal notifications introduce a new access mode. Direct read/update policies must ensure the current user can access only their own personal notification or an allowed company notification.

### Existing grants

Both `app_notifications` and legacy `notifications` currently have authenticated grants and RLS enabled. `app_notifications` has no direct authenticated policies in the inspected state, so browser access is effectively fail-closed while current API routes use server access.

Do not weaken that accidentally.

### Legacy

`notifications` remains present but receives no new shared-foundation writes.

### Security review

MANDATORY.

### Compatibility

Current `/api/notifications` and `lib/orcaly-audit.ts` remain functional.

No simultaneous UI cutover required.

---

## M1F — Shared Contract Constraint Validation

### Working name

`shared_foundation_constraint_validation`

### Purpose

After compatible application code is deployed, validate stronger invariants separately from the initial additive migrations.

### Dependencies

M1A–M1E plus application compatibility.

### Scope

Potentially:

- validate event scope rules
- validate audit/action identifier shape
- validate notification recipient scope
- validate customer identity-link tenant consistency
- replace overly rigid staging-only entitlement/consent hard-coded checks only after registry semantics are approved
- add final NOT NULL constraints where new writers have proven compliant.

### Data backfill

Only deterministic, previously approved transitions.

### Lock risk

MEDIUM depending on future row counts.

Prefer NOT VALID constraints + later validation when applicable, and safe index creation strategy appropriate to table size.

### Rollback/fail-safe

If validation finds incompatible historical rows, stop. Do not auto-repair semantic data.

---

# Dependency Graph

Conceptual order:

```
TypeScript shared identifier contracts
        |
        v
M1A Event Fabric Contract
        |
        v
M1B Shared Audit Contract
        |
        +----------------------+
        |                      |
        v                      v
M1C Entitlement/Consent   M1D Customer Identity Links
        |                      |
        +-----------+----------+
                    |
                    v
          M1E Notification Inbox
                    |
                    v
          Application compatibility
                    |
                    v
          M1F Constraint Validation
```

Integration foundation is a reused dependency beneath M1A and does not receive a duplicate migration.

Action registry is a code contract that must exist before new strict identifiers are required; it is not a DB table migration.

---

# Data Transition Strategy

## Event Fabric

Observed queues/ledgers are empty, so M1A should avoid unnecessary backfill. New contract metadata begins on new writes.

## Audit

Only the 13 existing staging ecosystem audit rows are candidates for mechanical compatibility mapping. Specialized audit histories stay where they are.

## Entitlement

Do not infer.

A future entitlement issuance batch requires:

- explicit product
- subject
- start/end state
- source
- source reference
- evidence from an approved authority.

Rows that cannot be derived deterministically remain absent, producing deny-by-default access.

## Consent

No inference and no migration from entitlement.

## Customer identity

Backfill exactly from existing source/source_id only.

No phone/email auto-link.

## Notifications

Keep 27 existing rows intact. New nullable shared fields start on new writes. Do not invent product ownership for historical notification rows.

---

# RLS / Security Impact

## Event Fabric

- server-only
- no anon/authenticated direct table mutations
- worker claim/settle boundaries remain tightly granted
- prefer internal/private-schema functions for new privileged boundaries when practical
- if a SECURITY DEFINER function remains in public, explicit PUBLIC/anon/authenticated revoke is mandatory.

## Customer identity

- strict company scope
- no cross-tenant identity search
- no global phone/email identity table
- identity links must not become a cross-company PII graph.

## Entitlement

- deny by default
- writes server-controlled
- company membership does not create entitlement
- entitlement does not create company operational permission.

## Consent

- grants server-controlled and based on explicit user action/evidence
- user may revoke own consent
- entitlement and consent checks remain independent.

## Audit

- service-controlled write
- metadata allow-list
- no secret values
- no raw provider payload
- no gratuitous PII duplication.

## Notifications

- new personal scope requires new RLS design
- existing Business server API remains compatible
- do not copy the broader legacy `notifications` policies into the canonical path without review.

## Integrations

- Vault-backed credentials remain
- no secret relocation in M1
- legacy WhatsApp secret field remediation remains separate Security work.

---

# Compatibility Strategy

1. Additive schema first.
2. New fields nullable/default-safe initially.
3. Existing Business code continues operating.
4. Introduce TypeScript registries and server adapters before making new fields mandatory.
5. Dual-write only where genuinely needed:
   - notification compatibility may briefly require dual-shape writes into the same `app_notifications` row, not two tables.
6. Customer source/source_id remains while identity links are introduced.
7. Legacy Business access continues while explicit product entitlement issuance is designed.
8. No legacy audit history rewrite.
9. Strong constraints arrive in M1F after compatibility is proven.
10. No frontend/backend/DB simultaneous cutover is required.

---

# Agent 4 Review Points

Agent 4 review is mandatory before implementation for:

1. Event/outbox worker functions, especially SECURITY DEFINER location and grants.
2. New user/company scope columns on shared infrastructure.
3. `ecosystem_product_entitlements` RLS and company membership composition.
4. Consent grant/revoke semantics and server-only grant path.
5. Audit metadata boundaries and actor attribution.
6. Customer identity-link tenant integrity and any RLS.
7. Personal notification RLS/grants.
8. Current `notifications` legacy policies and whether they should be explicitly frozen/deprecated.
9. Integration Vault functions and existing secret boundaries only insofar as M1 references them.
10. Legacy WhatsApp secret columns: confirm they remain excluded from M1 and tracked by Security remediation.
11. Any public-schema SECURITY DEFINER function introduced by implementation.
12. Data API exposure/grants for every new or altered public table.

---

# Agent 2 Architecture Challenge Points

## 1. Event Fabric scope representation

Challenge whether optional `user_id + company_id` is sufficient for all products, or whether a generic scope abstraction is justified without overengineering.

Preferred M1 direction: explicit user/company columns plus platform-null scope, not a generic polymorphic scope table.

## 2. Outbox consumption

Challenge whether `transactional_outbox` should gain its own SKIP LOCKED claim/settle RPC or whether dispatch should always materialize a `background_jobs` task.

Constraint: do not create a second queue.

## 3. Entitlement hard-coded product checks

Staging currently hard-codes products/context/permission shapes in CHECK constraints.

Challenge the balance between:

- DB integrity
- future product extensibility
- TypeScript registry authority.

Preferred direction: DB validates structural shape; TypeScript registry validates product semantics.

## 4. Partners and One semantics

Current TypeScript registry describes:

- Partners as `partner` context
- One as `bundle` context.

Current access evaluator natively handles personal/company contexts only.

Challenge whether:

- Partners entitlement should be user-scoped plus affiliate-profile status
- One should be a commercial bundle that issues child-product entitlements rather than a directly accessed data domain.

## 5. Consent generalization

Current data_scope and purpose checks are intentionally narrow.

Challenge whether new scopes/purposes remain TypeScript registry values with shape checks, or require stronger DB-domain enforcement.

## 6. Customer identity links vs integration_mappings

Ensure provider mappings stay in `integration_mappings` and that `customer_identity_links` only fills the non-provider/multi-source gap.

Avoid duplicate external identity ownership.

## 7. Audit canonicalization

Challenge extending `ecosystem_audit_events` versus introducing another shared audit table.

Preferred direction: extend the existing staging table; keep specialist logs.

## 8. Notification canonical table

Challenge the decision to generalize active `app_notifications` instead of moving to currently unused `notifications`.

Preferred direction: reuse the active table because a cleaner English name is not an architectural requirement.

## 9. Action registry placement

Challenge the no-DB-registry decision.

Preferred direction: TypeScript is authoritative; DB stores durable stable keys and validates shape only.

## 10. Production/staging asymmetry

Production lacks the three ecosystem tables while staging already has them.

Challenge migration design so one forward migration sequence safely:

- creates missing objects in production
- extends existing objects in staging
- does not replay staging history
- does not depend on the missing `20260926030809` baseline source.

---

# Risks

1. **Premature entitlement cutover**
   - Risk: locking existing Business users out because explicit entitlement rows do not yet exist.
   - Mitigation: schema first; application cutover only after deterministic issuance rules.

2. **Consent conflation**
   - Risk: product access being treated as permission to share context.
   - Mitigation: separate tables and separate runtime checks.

3. **Registry drift**
   - Risk: DB string values and TypeScript action/product/event registries diverge.
   - Mitigation: stable versioned registries, tests, shape checks and CI contract fixtures.

4. **Audit PII growth**
   - Risk: canonical audit becomes a duplicate dump of emails, IPs and provider payloads.
   - Mitigation: explicit metadata allow-list and specialized logs for sensitive domains.

5. **Customer identity overmatching**
   - Risk: users/companies merged based on phone/email similarity.
   - Mitigation: duplicate candidates only; explicit merge remains authoritative.

6. **Notification permission regression**
   - Risk: generalizing company notifications to personal scope opens cross-user reads.
   - Mitigation: Agent 4 review and fail-closed RLS before enabling personal notification writes.

7. **Outbox/job double processing**
   - Risk: two competing worker ownership models.
   - Mitigation: one documented dispatch path and deterministic dedupe keys.

8. **Migration history confusion**
   - Risk: implementation authors assume staging ledger == production ledger.
   - Mitigation: M0/M0.1/M0.2 remain authoritative provenance records; forward-only migrations start after the global frontier.

9. **Integration duplication**
   - Risk: new Shared Foundation invents integration-specific queues, OAuth or mapping tables.
   - Mitigation: explicit reuse requirement.

---

# Open Questions

1. Is `One` a directly entitled product surface or only a commercial bundle/source of child entitlements?
2. Is Partners product entitlement user-scoped with affiliate-profile status as an independent operational requirement?
3. Should Shared Foundation outbox dispatch claim outbox rows directly or enqueue generic background jobs?
4. Which billing/subscription states deterministically issue/revoke Business product entitlements?
5. Which entity owns entitlement issuance: billing lifecycle service, dedicated access service, or product activation workflow?
6. Which consent scopes/purposes are approved beyond the two currently in staging?
7. Is notification retention shared across products or product-specific?
8. Should legacy `notifications` be formally deprecated/documented now or only after the new `app_notifications` contract is certified?
9. What retention policy applies to canonical ecosystem audit records?
10. Should correlation identifiers be UUID-only or accept externally supplied trace/request identifiers as bounded text?

These are architecture/product decisions, not database discovery gaps. They do not prevent Agent 2 challenge; several are specifically what Agent 2 is expected to challenge.

---

# Implementation Preconditions

No implementation may begin until all of the following are satisfied:

1. Coordinator explicitly authorizes implementation after reviewing M1.
2. Agent 2 completes architecture challenge.
3. Agent 4 completes security review for the affected migration boundaries.
4. Product/action/event/permission registry ownership is resolved.
5. Partners/One entitlement semantics are resolved before strict entitlement constraints.
6. An explicit entitlement issuance rule exists before Business access cutover.
7. M0.2 accepted staging gaps remain tracked separately and are not silently bundled into Shared Foundation.
8. `20260929` prefix is revalidated against main, staging ledger and active migration branches immediately before any migration file creation.
9. Migration files are created only through the authorized migration workflow.
10. Each migration has staging-only validation before any production consideration.
11. Production/staging migration ledgers are not “equalized” by replaying historical migrations.
12. No Shared Foundation migration moves or exposes secrets.

---

# Recommended First Migration Boundary

## M1A — Shared Event Contract Hardening

Recommended as the first implementation boundary because:

- the underlying tables already exist in both production and staging;
- current observed row populations are zero;
- integrations already reuse these structures;
- background job SKIP LOCKED semantics already exist;
- additive event contract metadata can be introduced without product-access cutover;
- it establishes correlation/ownership conventions required by later audit/notification/access work;
- rollback/fail-closed behavior is straightforward because existing writers can continue using the old compatible shape.

M1A must **not** include:

- entitlement tables
- consent changes
- notification migration
- customer identity backfill
- staging seed/bootstrap
- Storage bucket creation
- cron remediation
- new provider integration.

---

# AGENT_2_CHALLENGE_PACKAGE

Agent 2 should challenge these architectural decisions before any implementation authorization:

1. **Reuse, not replace, the existing Event Fabric**:
   `event_idempotency + transactional_outbox + background_jobs`.

2. **Use background_jobs as the only generic job queue** and decide whether outbox needs a claim RPC or a dispatcher-to-job pattern.

3. **Keep customer_profiles as canonical company customer identity** and add only `customer_identity_links` for multi-source references.

4. **Preserve merge aliases through merged_into_id** rather than destructively rewriting every historical identity link.

5. **Promote ecosystem_product_entitlements** as canonical product access while keeping membership, operational permissions, rollout flags and billing as separate facts.

6. **Never infer entitlements** from plan/subscription fields without an approved deterministic rule.

7. **Promote ecosystem_context_consents** separately from entitlement and preserve server-operated grant + self-revoke semantics.

8. **Extend ecosystem_audit_events** instead of creating another generic audit table.

9. **Keep specialized audit logs** for security/admin/affiliate/customer-portal concerns and avoid bulk migration into canonical audit.

10. **Keep product/action/event/job registries TypeScript-owned**, with the DB storing stable identifiers rather than a second application-string catalog.

11. **Generalize active app_notifications**, not the unused `notifications` table, for shared inbox state.

12. **Reuse canonical integration schema completely**; no second provider/OAuth/mapping/queue model.

13. **Leave legacy WhatsApp secret remediation outside M1** but ensure Shared Foundation does not create new secret exposure.

14. **Handle production/staging asymmetry forward-only**: production lacks the three ecosystem tables, staging already has them.

15. **Keep the sequence additive and staged**:
    Event Fabric → Audit → Entitlement/Consent + Customer Identity → Notification → Constraint Validation.

Agent 2 should return:

- accepted decisions
- challenged decisions
- proposed alternatives
- compatibility concerns
- any blockers requiring Coordinator choice.

Agent 2 does not receive implementation authorization from this document.

---

# Final Status

```
M1_SHARED_FOUNDATION_DESIGN:
COMPLETE

MIGRATION_SEQUENCE:
DEFINED

CURRENT_OBJECT_REUSE:
MAPPED

DATA_TRANSITION:
DEFINED

RLS_SECURITY_IMPACT:
MAPPED

AGENT4_REVIEW_REQUIRED:
YES

AGENT2_CHALLENGE_REQUIRED:
YES

MIGRATION_FILES_CREATED:
NONE

MIGRATIONS_EXECUTED:
NONE

DATABASE_MUTATION:
NONE

STAGING_MUTATION:
NONE

PRODUCTION_MUTATION:
NONE

READY_FOR_AGENT2_ARCHITECTURE_CHALLENGE:
YES
```

END OF MISSION.
