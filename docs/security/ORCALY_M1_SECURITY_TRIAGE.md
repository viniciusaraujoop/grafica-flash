# ORÇALY — M1 Security Triage & Notification Isolation Review

**Status:** SECURITY_READ_ONLY_REVIEW_AUTHORIZED  
**Repository:** `viniciusaraujoop/grafica-flash`  
**M1 design SHA:** `2ad113837a25a6ed3e04f00453bec3ac45a9e960`  
**Architecture Challenge SHA / docs branch base:** `ee35fb9835939b2edd15247ee29aee5fc3de0c26`  
**Review date:** 2026-09-29

## Mission controls

- Code changes: **NONE**
- Database mutation: **NONE**
- Migration creation: **NONE**
- Production mutation: **NONE**
- Staging mutation: **NONE**
- WhatsApp implementation: **NONE**
- Documentation-only output: this file

---

# 1. Executive Summary

The two notification-isolation claims raised by Agent 2 are independently **CONFIRMED**.

The current active notification API uses a server-side Supabase client created with the service-role key. The API authenticates the caller and resolves the caller's company, but both notification read and read-state mutation restore only the **company** predicate after bypassing RLS.

For `app_notifications` rows that have a non-null `user_id`, the current runtime does **not** enforce:

`notification.user_id = requester.id`

on either GET or PATCH.

This creates two current defects:

1. an authenticated principal of a company can read the content of notification rows targeted to another user in the same company;
2. an authenticated principal can mark another user's notification row as read.

This is not merely theoretical. Read-only production inspection found:

- `app_notifications`: **27** rows total;
- rows with non-null `user_id`: **23**;
- rows with null `user_id`: **4**;
- companies with user-scoped notification rows: **2**;
- one company currently has **3 distinct authorized principals**;
- in that company, **12 user-scoped notification rows** have another authorized company principal distinct from their intended `user_id`;
- all 12 are currently `unread`;
- types among those 12: 9 `order`, 2 `task`, 1 `crm`;
- current principals in that company include owner, tester and gerente.

No user IDs, company IDs or notification content were exported into this report.

The direct Supabase Data API is **not** the current exploit path for `app_notifications`:

- RLS is enabled;
- no RLS policies exist on `app_notifications`;
- `authenticated` has table SELECT/UPDATE grants;
- with RLS enabled and no applicable policy, direct authenticated row access is denied.

The vulnerable path is the service-role-backed Next.js API, which bypasses RLS and fails to restore recipient isolation in application predicates.

Therefore:

**CURRENT_EXPLOITABLE_DEFECT = YES**

M1E-b personal notification scope must remain **HOLD/DEFERRED** until recipient isolation and read-state semantics are corrected.

---

# 2. Evidence Reviewed

## Repository

Exact design:

- `docs/migrations/ORCALY_M1_SHARED_FOUNDATION_MIGRATION_DESIGN.md`
- SHA: `2ad113837a25a6ed3e04f00453bec3ac45a9e960`

Architecture challenge:

- `docs/migrations/ORCALY_M1_AGENT2_ARCHITECTURE_CHALLENGE.md`
- SHA: `ee35fb9835939b2edd15247ee29aee5fc3de0c26`

Runtime/security-relevant files inspected at Architecture Challenge SHA:

- `app/api/notifications/route.ts`
- `lib/orcaly-audit.ts`
- `lib/orcaly-smart-notifications.ts`
- `app/api/notifications/smart-scan/route.ts`
- `app/api/cron/smart-notifications/route.ts`
- `lib/company-access.ts`
- `lib/access-control-core.ts`

## Live read-only database inspection

Production:

`ozrasuktfthsvbqprtel`

Staging:

`zwxulgpjucxudadjdqov`

Read-only catalog/data checks covered:

- `app_notifications` columns, constraints, indexes, grants and RLS;
- `notifications` legacy grants and RLS;
- aggregate notification scope/read-state counts;
- authorized-principal counts without exposing identities;
- `ecosystem_product_entitlements`;
- `ecosystem_context_consents`;
- `ecosystem_audit_events`;
- `background_jobs`;
- `transactional_outbox`;
- `event_idempotency`;
- worker SECURITY DEFINER RPCs;
- public-schema CREATE privileges;
- legacy WhatsApp secret-column presence and non-empty counts.

No mutation query was executed.

---

# 3. Notification Runtime Review

## 3.1 Current API access boundary

`app/api/notifications/route.ts` calls:

1. `getSupabaseAdmin()`;
2. `getRequester()`;
3. `getCompanyAccess()`.

`getSupabaseAdmin()` is built with `SUPABASE_SERVICE_ROLE_KEY`.

`getCompanyAccess()` accepts:

- company owner/tester;
- active `company_members`;
- platform super-admin path.

The notifications API adds no notification-specific permission beyond having a resolved company.

This means any active company principal accepted by `getCompanyAccess()` reaches the notification queries.

## 3.2 GET behavior

Current GET:

- queries `app_notifications`;
- selects notification content including `id`, `tipo`, `titulo`, `mensagem`, `link_url`, `payload`, `status/read_at`;
- filters only:

`company_id = requester_company_id`

There is no recipient predicate.

The selected response does not expose the `user_id` column itself, but hiding the recipient column does not protect the notification content.

### Classification

**CURRENT_EXPLOITABLE_SECURITY_DEFECT**  
**PRIVACY_GAP**

Severity: **P1**

## 3.3 PATCH behavior

Current PATCH:

- accepts `ids[]` or `all=true`;
- updates `status='read'`;
- writes `read_at=now`;
- filters only by `company_id`;
- when IDs are supplied, adds only `id in (...)`.

There is no `user_id=requester.id` predicate.

Because GET returns notification IDs from all rows in the company, an attacker does not need to guess another user's notification ID.

### Classification

**CURRENT_EXPLOITABLE_SECURITY_DEFECT**  
**PRIVACY_GAP**

Severity: **P1**

---

# 4. Exact Current Attack Paths

## 4.1 Cross-user notification read

Preconditions:

1. attacker has a valid authenticated Orçaly session/token;
2. `getCompanyAccess()` resolves the attacker to the same company as another notification recipient;
3. the target notification has `company_id` equal to that company and `user_id` belonging to another user.

Path:

`authenticated company principal`
→ `GET /api/notifications`
→ `getRequester()`
→ `getCompanyAccess()`
→ service-role client
→ `app_notifications WHERE company_id = caller_company`
→ response contains target row title/message/link/payload.

Missing check:

`user_id IS NULL OR user_id = requester.id`

Affected possible roles:

- owner;
- tester;
- active manager;
- active attendant;
- active production member;
- active employee/member;
- platform admin path where company access resolves.

Current live affected company has owner + tester + gerente.

## 4.2 Cross-user read-state mutation

Preconditions: same as above.

Path A:

`GET /api/notifications`
→ obtain target notification ID
→ `PATCH /api/notifications { ids: [target_id] }`
→ service-role UPDATE
→ `WHERE company_id = caller_company AND id IN (...)`
→ target recipient's row becomes read.

Path B:

`PATCH /api/notifications { all: true }`
→ every matching company notification row is marked read, including rows with another user's `user_id`.

Current production evidence:

12 user-targeted rows in the currently multi-principal affected company are still unread and are reachable by this company-only predicate.

---

# 5. RLS / Grants — What Is and Is Not Protecting the Current Table

## app_notifications

Production and staging:

- RLS: enabled;
- FORCE RLS: false;
- RLS policies: none;
- anon SELECT: false;
- authenticated SELECT: granted;
- authenticated UPDATE: granted;
- service role SELECT/UPDATE: granted.

Effective direct Data API behavior for authenticated callers:

**deny-all**, because RLS has no allowing policy.

### Classification

Direct authenticated Data API cross-user read:

**NOT_A_DEFECT currently**

However, the authenticated table grants are unnecessary attack surface if the intended architecture is API-only. Future M1 work must make an explicit choice:

1. API-only: revoke unnecessary `anon/authenticated` grants and keep no client policies; or
2. Data API supported: add recipient-aware RLS and appropriate indexes.

Do not leave the security model dependent on “RLS currently has zero policies”.

## Service-role behavior

Service role bypasses the row policies.

Therefore any service-role route/helper must manually restore all relevant authorization dimensions:

- tenant/company;
- recipient user;
- resource ownership;
- product boundary.

The current notification route restores only company scope.

### Classification

**CURRENT_EXPLOITABLE_SECURITY_DEFECT**

---

# 6. Scope Modeling Findings

Current `app_notifications` shape:

- `company_id uuid NOT NULL`;
- `user_id uuid NULL`;
- one row-level `status`;
- one row-level `read_at`.

No foreign key currently exists on either `company_id` or `user_id` in the inspected table definition.

There is no explicit `scope_kind` / `recipient_kind`.

Current data happens to be internally consistent:

- all 23 rows with non-null `user_id` reference a current principal of the same company in the read-only snapshot.

That consistency is **not enforced by the database**.

## Classification

### Nullable user_id as implicit scope

**ARCHITECTURE_GAP**

It is sufficient only as an implicit convention:

- `user_id IS NULL` → company/broadcast;
- `user_id IS NOT NULL` → user-targeted within company.

It is not sufficient as the future cross-product personal/company contract.

### Single read_at/status for company broadcasts

**PRODUCT_AMBIGUITY**  
**ARCHITECTURE_GAP**

A single company-broadcast row can represent either:

- a genuinely shared company inbox item, where one shared read-state is intentional; or
- a broadcast shown independently to multiple users, where read-state must be per recipient.

M1 must not silently choose one meaning.

For a personal inbox model, company-broadcast read state requires either:

- per-user receipts; or
- fan-out into recipient rows.

M1E-b must not place personal scope on top of the current shared `read_at/status` semantics.

---

# 7. Legacy notifications Table

Current production/staging:

- row count observed by prior M1 inventory: 0;
- RLS enabled;
- authenticated SELECT/UPDATE granted;
- SELECT/UPDATE policies allow:
  - the row user;
  - company owner/tester;
  - any active company member;
  - active admin-user email match.

If user-targeted rows were written there, company membership would permit other members to read/update them.

Because the table is currently empty and the active runtime does not use it:

### Classification

**ARCHITECTURE_GAP**  
**PRIVACY_GAP**  
**NOT CURRENTLY EXPLOITABLE WITH EXISTING DATA**

Required M1 disposition:

- no new writes;
- do not promote it as the shared inbox;
- freeze or later reduce grants/policies deliberately;
- do not preserve these broad policies as a template for `app_notifications`.

---

# 8. Minimal Remediation Recommendation — DO NOT IMPLEMENT IN THIS MISSION

Because `CURRENT_EXPLOITABLE_DEFECT = YES`, a minimal remediation is required for Coordinator review.

## Immediate application-layer guard

For GET on the existing company-shaped table:

require:

`company_id = requester_company_id`

AND

`(user_id IS NULL OR user_id = requester.id)`.

For PATCH of a user-targeted row:

require:

`company_id = requester_company_id`

AND

`user_id = requester.id`.

Do not rely on the service role to provide recipient isolation.

## Company-broadcast read state

Do not “fix” company broadcast read-state by continuing to update the shared base row unless Product explicitly defines that row as a shared company inbox state.

Until receipts/fan-out are defined, safest personal-inbox behavior is:

- user-targeted rows: recipient can mark own row;
- company broadcast: read-state semantics remain explicitly separate/undecided.

## Defense in depth

Future migration/runtime unit should also decide:

- add FK/integrity for scope fields where compatible;
- revoke authenticated Data API grants if `app_notifications` remains server-only;
- or add recipient-aware RLS if direct Data API access is intentionally supported.

---

# 9. M1E Mandatory Security Requirements

## M1E-a — company scope only

M1E-a may remain additive only if it introduces **no new personal-scope exposure**.

Mandatory:

1. existing Business company scope remains explicit;
2. new dedupe/source/correlation fields contain no secret or unnecessary PII;
3. notification payload has a bounded schema/size;
4. no provider token, OAuth secret, WhatsApp secret, payment secret or document content in payload;
5. existing API cross-user defect must be remediated before interpreting non-null `user_id` as a secure recipient boundary;
6. legacy `notifications` receives no new writes.

## M1E-b — personal scope

**HOLD until recipient/read-state model is approved.**

Mandatory before implementation:

1. explicit recipient semantics, not an undocumented nullable-column convention;
2. personal user-only notification:
   - `recipient_user_id` required;
   - personal access requires `auth.uid() = recipient_user_id`;
3. company-targeted user notification:
   - company context required;
   - recipient user required;
   - recipient/company relationship validated at creation;
   - reader must be both the recipient and currently authorized for that company context, unless retention policy deliberately permits post-membership access;
4. company broadcast:
   - no user recipient on base event;
   - read state per recipient via receipts or fan-out if UX is per-user;
5. no single shared `read_at` for a personal inbox broadcast;
6. service-role APIs must enforce the same recipient predicates as RLS would;
7. no global “admin sees every personal inbox” shortcut without a separately authorized support/security workflow;
8. personal notification content must not be reused across products without consent where cross-product context is involved.

---

# 10. Data API / RLS Requirements for Shared Foundation

For every new/altered M1 table:

1. decide whether browser/Data API access is required at all;
2. if not required:
   - revoke `anon/authenticated` privileges;
   - keep server/service access only;
3. if required:
   - enable RLS;
   - create subject/tenant-specific policies;
   - index RLS predicate fields;
4. never treat `TO authenticated` by itself as authorization;
5. user-owned rows require `auth.uid()` recipient/subject predicate;
6. company rows require current company relationship plus any required company permission;
7. cross-product reads require entitlement and consent where applicable;
8. UPDATE policies require both old-row visibility and post-update invariants;
9. service-role callers must restore every RLS predicate in application logic.

---

# 11. Event Fabric Worker Security Requirements

Current production/staging worker primitives were independently reviewed:

- `claim_background_jobs`;
- `settle_background_job`;
- `recover_stale_background_jobs`.

Current positive properties:

- SECURITY DEFINER;
- fixed search path;
- anon EXECUTE: false;
- authenticated EXECUTE: false;
- service_role EXECUTE: true;
- `FOR UPDATE SKIP LOCKED` claim;
- worker ownership recorded;
- settlement requires matching `locked_by`;
- stale recovery is bounded;
- exhausted jobs reach `needs_attention`.

`public` schema CREATE is not granted to `anon` or `authenticated` in either inspected environment, reducing search-path hijack risk in the current fixed `pg_catalog, public` claim function.

### Classification

Current worker RPC boundary:

**NOT_A_DEFECT**

## Mandatory future relay/worker requirements

1. no `anon/authenticated` table access to outbox/jobs;
2. new relay/dispatcher preferably lives in an unexposed/private schema;
3. SECURITY DEFINER only when required;
4. fixed empty or explicitly safe search path;
5. revoke EXECUTE from PUBLIC/anon/authenticated;
6. service worker identity only;
7. handler registry allowlist;
8. schema validation for job payload by versioned action/event key;
9. job payload may not contain secrets;
10. error/metadata fields must be bounded and sanitized;
11. dedupe/idempotency must be enforced before side effects;
12. company/user/product scope is trusted server metadata, never accepted as authoritative from provider/user payload;
13. sensitive handlers re-check entitlement, permissions and consent at execution time when those can change between enqueue and run;
14. worker claims do not create authorization; they only lease already-authorized work;
15. replay must not bypass revocation or consent changes.

---

# 12. Entitlement Security Review

## Current staging state

`ecosystem_product_entitlements`:

- rows: 0;
- RLS enabled;
- authenticated SELECT only;
- no authenticated INSERT/UPDATE/DELETE;
- service role controls mutation;
- exactly one of `user_id/company_id`;
- active/revoked/expired states;
- time window;
- permissions;
- source/source_reference.

Current unique indexes enforce one row per:

- `(user_id, product_id)`; or
- `(company_id, product_id)`.

### Self-grant

Current authenticated self-grant:

**NOT_CONFIRMED / effectively blocked**

No authenticated write grant exists.

### Multiple grant sources

Current one-row-per-subject/product design cannot safely represent independent concurrent grant sources.

### Classification

**ARCHITECTURE_GAP**

No current exploitable privilege escalation was established because there are zero rows and mutations are server-only.

## Mandatory M1 entitlement requirements

1. no client/authenticated grant creation;
2. issuers must be trusted server-side actions with an allowlisted `source`;
3. multiple independent sources must remain independently revocable/expirable;
4. uniqueness must not force unrelated sources to overwrite one another;
5. effective resolver evaluates only grants that are:
   - exact subject;
   - exact product;
   - started;
   - not revoked;
   - not expired;
   - source-valid;
   - permission-valid;
6. effective permission is derived only from still-valid source grants;
7. revoking one source must not revoke access supported by another valid source;
8. expiration is source-specific;
9. grace/read-only must be represented as an explicit restricted grant/permission set with a finite rule, not an access bypass;
10. company entitlement does **not** bypass company membership or company action permission;
11. entitlement does **not** imply consent;
12. consent does **not** create entitlement;
13. bundle/One logic must not return universal access by special case;
14. if a bundle grants products, trusted issuance should create/resolve explicit child grants with traceable source provenance;
15. raw grant provenance such as `source_reference` must be non-secret; otherwise expose only an effective-entitlement read model to company members.

---

# 13. Consent Security Review

## Current staging state

`ecosystem_context_consents`:

- rows: 0;
- authenticated SELECT only for own `user_id`;
- no authenticated INSERT;
- authenticated has column-level UPDATE only for `revoked_at`;
- RLS UPDATE requires own row, currently unrevoked, resulting row revoked;
- service role controls grant creation/full mutation.

The current personal-consent self-revoke design is narrowly constrained.

### Classification

Current own-personal revoke:

**NOT_A_DEFECT**

The future generalized company/personal model requires stronger authority semantics.

## Mandatory M1 consent requirements

1. explicit subject kind:
   - personal;
   - company;
2. explicit subject identity/context;
3. grant authority derived from trusted authenticated context, never a caller-supplied user/company id alone;
4. personal grant requires the personal subject's explicit action;
5. company grant requires a narrowly defined company permission/authority, not mere membership;
6. source product and target product are explicit and validated;
7. source/target company context is trusted/runtime-derived;
8. purpose is explicit, stable and allowlisted;
9. data scope is explicit, stable and allowlisted;
10. policy/version of the consent text/purpose is recorded;
11. grant provenance is recorded without PII/secrets;
12. expiry is mandatory/bounded where appropriate;
13. revocation is monotonic and immediate;
14. no client “unrevoke”;
15. future generalized revocation should use a narrow RPC or equivalently strict column-level contract that:
    - verifies subject authority;
    - changes only revocation fields;
    - writes audit;
16. valid entitlement does not imply consent;
17. subscription/payment/bundle/One does not imply consent;
18. company membership does not imply consent;
19. cross-product use must validate consent at the time of use;
20. consent use must be auditable without copying transferred sensitive data into audit metadata.

---

# 14. Cross-Product Security Boundary

For a cross-product data flow to proceed, the existence of one control cannot bypass another.

Conceptual gate:

`authenticated subject/context`
AND `product entitlement`
AND `company permission where company-scoped`
AND `feature/rollout availability where required`
AND `valid consent for exact source → target + purpose + scope`.

One/bundle, admin convenience, internal jobs or service-role execution do not remove the consent requirement when the data flow is consent-gated.

Service role is a technical capability, not user authorization.

---

# 15. Customer Identity — M1D Deferred

No M1D design or implementation is authorized here.

Mandatory future security requirements only:

1. tenant isolation is structural;
2. every identity link belongs to exactly one company;
3. external namespace/reference uniqueness is tenant-bound;
4. profile link must be tenant-consistent with the identity link;
5. no global person graph;
6. no cross-company lookup by phone/email/external reference;
7. normalized phone/email are attributes/evidence, not automatic identity ownership;
8. external IDs arriving through provider connections remain owned by the integration mapping boundary;
9. import/manual external IDs must have an explicit namespace owner;
10. CSV/provider content can never choose company ownership;
11. merge requires explicit authorized company action and audit;
12. automatic merge based on name/similarity is forbidden;
13. unmerge must define deterministic ownership of external links before restoration;
14. IDOR/BOLA protection requires company predicate on every profile/link lookup;
15. provider/external identity references are not broadly exposed to client surfaces without need;
16. no provider token/secret is identity metadata.

### Classification

M1D deferred status:

**NOT_A_DEFECT**

Security requirements:

**DEFINED**

---

# 16. Audit Security Boundaries

Current staging:

- `ecosystem_audit_events`: 13 rows;
- all 13 currently have null `actor_id`;
- table is server/service-only;
- no authenticated read/write grant;
- `ecosystem_private.record_change()` is SECURITY DEFINER;
- fixed empty search path;
- not directly executable by anon/authenticated/service_role;
- trigger writes only small identifiers/event name.

The null actor pattern is consistent with server/service-triggered mutations, but future canonical audit needs explicit actor semantics instead of pretending null always means the same thing.

## Required separation

### A. Row-change audit

Purpose:

durable fact that a protected record changed.

Allowed:

- record kind;
- action/change key;
- actor kind;
- actor user id when meaningful;
- product;
- company/personal scope;
- resource type/id;
- correlation id;
- timestamp.

Forbidden:

- full BEFORE/AFTER rows;
- raw PII;
- secret fields;
- provider payloads.

### B. Action audit

Purpose:

meaningful user/system command such as grant, revoke, approve, merge, export, credential rotation.

Must record:

- stable action key/version;
- actor kind/id;
- target resource;
- scope;
- result;
- correlation/request id;
- bounded allowlisted metadata.

Do not duplicate the action payload.

### C. Security events

Remain specialized.

Examples:

- auth failure;
- MFA challenge/failure;
- session/security anomaly;
- authorization denial;
- credential misuse;
- suspicious webhook/provider verification failure.

Security logs may have justified security telemetry such as IP/user-agent, subject to retention. These fields must not be copied into general shared audit merely because they exist.

### D. Admin audit

Platform/admin privilege use remains specialist.

Admin audit should identify:

- platform actor;
- privileged action;
- target tenant/resource;
- reason/support context where required;
- correlation.

Do not collapse admin history into ordinary product row-change audit.

### E. Integration audit

Provider connection lifecycle remains integration-owned:

- connect;
- refresh;
- revoke;
- webhook verification/result;
- sync result.

Never include:

- access token;
- refresh token;
- API key;
- webhook secret;
- OAuth authorization code;
- raw credential bundle.

Shared audit may contain a correlation/reference to an integration audit event, not a duplicate raw provider payload.

## Mandatory audit properties

1. append-only for normal application roles;
2. no authenticated UPDATE/DELETE;
3. SECURITY DEFINER trigger functions use fixed search path;
4. function EXECUTE revoked from public/anon/authenticated when not intended as RPC;
5. no cascade delete that erases evidence merely because a user/resource is deleted;
6. bounded metadata size;
7. allowlisted metadata keys by action family;
8. no secrets;
9. no unnecessary PII;
10. actor kind distinguishes user/admin/system/service/worker;
11. null actor is not treated as authenticated-user attribution;
12. stable correlation IDs link specialized records without centralizing sensitive content.

---

# 17. Notification Audit / Privacy Metadata

Notification payload is not an audit sink.

Mandatory:

- notification payload must not become a generic place to copy event payloads;
- avoid customer PII unless the notification itself needs it for rendering;
- prefer resource IDs + product-side rendering;
- do not copy secrets/provider responses;
- recipient user id is authorization metadata;
- read receipts are privacy-sensitive behavioral metadata and must be isolated per recipient.

The current GET exposes full `payload` for every company row, amplifying the cross-user leak if writers place sensitive information there.

---

# 18. WhatsApp Interaction — Frozen Feature

No WhatsApp feature work is authorized.

Read-only production check confirms the legacy columns still exist:

- `companies.whatsapp_access_token text`;
- `companies.whatsapp_verify_token text`.

Current non-empty rows:

- access token: 0;
- verify token: 0.

M1 interaction requirements only:

1. do not move these fields as part of M1;
2. do not copy them into shared audit metadata;
3. do not copy them into notification payloads;
4. do not include them in event/job payloads;
5. shared-foundation migrations must not create a second secret store;
6. future WhatsApp credential work remains under its dedicated security reconciliation.

### Classification

Current M1 interaction:

**ARCHITECTURE_GAP TRACKED OUTSIDE M1**

No currently populated legacy secret was found in the inspected production snapshot.

---

# 19. Findings Classification

| ID | Finding | Classification | Priority |
|---|---|---|---|
| N1 | GET notification API returns user-targeted rows to other company principals | CURRENT_EXPLOITABLE_SECURITY_DEFECT + PRIVACY_GAP | P1 |
| N2 | PATCH can mark another recipient's notification read | CURRENT_EXPLOITABLE_SECURITY_DEFECT + PRIVACY_GAP | P1 |
| N3 | Recipient scope represented only by nullable `user_id`; no explicit scope contract/FK | ARCHITECTURE_GAP | P2 |
| N4 | Company broadcast shares one `status/read_at` with no per-recipient semantics | PRODUCT_AMBIGUITY + ARCHITECTURE_GAP | P2 |
| N5 | Legacy `notifications` policies permit company members to read/update user rows if populated | ARCHITECTURE_GAP + PRIVACY_GAP; currently empty | P2 |
| N6 | Direct Data API access to `app_notifications` is denied by RLS/no policies | NOT_A_DEFECT currently | — |
| E1 | Entitlement table cannot represent multiple independent grant sources concurrently | ARCHITECTURE_GAP | P2 |
| E2 | Authenticated users cannot self-grant entitlement in current staging contract | NOT_A_DEFECT | — |
| C1 | Personal consent own-revoke is narrowly column/RLS constrained | NOT_A_DEFECT | — |
| C2 | Future company/personal consent needs explicit subject/grant authority | ARCHITECTURE_GAP | P2 |
| A1 | Shared audit currently lacks rich actor/scope semantics; 13 current rows have null actor | ARCHITECTURE_GAP | P2 |
| A2 | Current audit trigger security-definer/search-path/execute boundary | NOT_A_DEFECT | — |
| J1 | Current worker RPC service-role/lease boundary | NOT_A_DEFECT | — |
| W1 | Legacy WhatsApp plaintext columns remain schema debt, currently empty | ARCHITECTURE_GAP outside M1 | tracked |

---

# 20. Required Fixes Before M1E Personal Scope

1. remediate current GET recipient leak;
2. remediate current PATCH recipient mutation;
3. define company broadcast read semantics;
4. introduce recipient/read-state model for M1E-b;
5. decide API-only vs direct Data API for inbox;
6. if API-only, minimize authenticated grants;
7. if Data API, add recipient-aware RLS;
8. add scope integrity/recipient validation;
9. keep legacy `notifications` frozen;
10. run hosted cross-user read/read-state tests with at least two users in one company.

---

# 21. QA Requirements

## Current notification remediation QA

Use two authenticated users A/B in the same company plus a company broadcast.

A must not:

- receive B-targeted notification content;
- receive B-targeted payload;
- mark B-targeted notification read by ID;
- mark B-targeted notification read using `all=true`.

B must not perform the symmetric actions.

Both may see company-broadcast content if that remains product intent.

Read-state test for company broadcast must follow the Coordinator-approved model:

- shared company state; or
- per-user receipt/fan-out.

## Data API QA

If `app_notifications` remains API-only:

- authenticated direct SELECT → denied;
- authenticated direct UPDATE → denied.

If direct access is introduced:

- recipient user can read own targeted row;
- other company member cannot;
- company broadcast rules are explicit;
- recipient can mutate only own receipt/read state.

## Entitlement QA

- authenticated cannot INSERT/UPDATE/DELETE grant rows;
- two grant sources for same subject/product coexist;
- revoking one source leaves other effective source active;
- expiry of one source does not erase another;
- grace/read-only does not permit write;
- company entitlement does not bypass company permission;
- entitlement does not bypass consent.

## Consent QA

- user cannot self-grant;
- personal subject can revoke own valid consent;
- user cannot revoke another subject's consent;
- ordinary company member cannot grant/revoke company consent unless authorized;
- expired/revoked consent fails cross-product use;
- One/bundle/subscription cannot bypass consent;
- purpose/scope mismatch fails closed.

## Worker/RPC QA

- anon/authenticated cannot call claim/settle/recover;
- two workers cannot claim the same job;
- wrong worker cannot settle;
- stale recovery preserves attempt semantics;
- unknown job contract → needs_attention;
- job replay re-checks current entitlement/consent where required.

---

# 22. Coordinator Decisions Required

1. immediate remediation owner for current `/api/notifications` cross-user defect;
2. whether company-broadcast inbox read-state is shared or per-user;
3. receipts table vs fan-out rows for future M1E-b;
4. API-only vs Data API access for the shared inbox;
5. whether authenticated grants on `app_notifications` are retained before M1E;
6. whether raw entitlement grant provenance remains client-readable or only effective entitlement is exposed;
7. final multiple-grant source identity/uniqueness contract;
8. company consent grant/revoke authority;
9. audit routing policy between shared row/action audit and specialized security/admin/integration logs;
10. retention rules for audit and notification/read-receipt data.

---

# 23. Final Status

```
M1_SECURITY_TRIAGE:
FINDINGS

NOTIFICATION_CROSS_USER_READ:
CONFIRMED

NOTIFICATION_CROSS_USER_READ_STATE:
CONFIRMED

CURRENT_EXPLOITABLE_DEFECT:
YES

ENTITLEMENT_SECURITY_REQUIREMENTS:
DEFINED

CONSENT_SECURITY_REQUIREMENTS:
DEFINED

AUDIT_SECURITY_REQUIREMENTS:
DEFINED

CUSTOMER_IDENTITY_REQUIREMENTS:
DEFINED

CODE_CHANGED:
NO

MIGRATIONS_CREATED:
NONE

DATABASE_MUTATION:
NONE

PRODUCTION_MUTATION:
NONE

READY_FOR_COORDINATOR_RECONCILIATION:
YES
```

M1E personal-scope notification work should remain deferred until the current P1 recipient-isolation defects and read-state model are resolved.

**STOP — END OF MISSION**
