# Engineered P4 frontier candidate — local only

Base local checkpoint: `293660c20714b51c616e3af1841a6aede82b1124`.
The attached Founder/Agent 2 decision resolves is_orcaly_admin explicitly.
P3, can_manage_company and is_orcaly_admin decisions are all CLOSED/resolved.
Earlier decision reports are retained as historical checkpoints, not active gates.

## Selected model

Both approved preimages are STRUCTURAL_FAIL_CLOSED_PREIMAGE, with historical bodies
UNKNOWN. public.can_manage_company(p_company_id uuid) is constant FALSE until #7;
public.is_orcaly_admin() is constant FALSE until #26. Both are owned by postgres,
SECURITY INVOKER, fixed empty search_path, no callable grants to non-owner roles.
Neither has a private duplicate, data lookup, identity, or persistent catalog
comment. Source comments identify engineering, not historical reconstruction.

The architecture decision establishes no pre-26 requirement for a TRUE admin
result or indirect can_manage_company execution. This is supplied architecture
evidence, not an independently executed runtime test. #7 moves the same OIDs;
#26 replaces the admin body without replacing its identity. Twelve baseline
can_manage_company policies and two baseline company_members admin policies
bind the PUBLIC identities. Delivery policies (#12) and admin_users policy (#40)
remain exclusively ledger effects. Runtime OID verification is pending.

The other six #7 functions use surviving frozen bodies, not stubs. There is no
CREATE/body replacement for those six in the 51 replay forms. Only their function
declaration schema is reversed to PUBLIC; bodies, parameter names, return types,
postgres owner, SECURITY DEFINER behavior and fixed search_path are retained.
Known final ACLs provide the engineered baseline; #7 authoritatively resets its
four-role ACL set afterward. No extra role is added. Their SQL/PLpgSQL bodies
reference application tables and platform prerequisites, not private duplicates.

## Reverse derivation and minimality

The offline derive-frontier helper consumes the frozen lossless catalog and all
51 immutable replay forms; it never connects to a database or writes SQL there.
It excludes 50 ledger-declared tables, their dependent objects, ledger-added
columns/constraints/indexes/functions/views/triggers/policies, and the #44 body
renamed to refresh_company_data_quality_v1 by #46. Required column ordinals are
contiguous after removing ledger additions. No preimage column holes are invented.

The candidate contains 561 counted definition objects: api schema, 63 tables,
16 functions, 183 constraints, 174 standalone indexes, four unchanged internal
views, 18 triggers, 96 policies and six application bucket configurations.
Columns/ACLs/comments/RLS settings are attributes of those counted objects;
constraint-owned indexes and implicit composite types are not counted twice.
The full matrix has both retained and excluded objects and binds selected SQL
definitions to hashes. This is reverse-engineered pre-state, not an authentic
bootstrap or a wholesale production-head dump.

No business rows or auth users are seeded. The only top-level INSERTs define six
application Storage buckets, explicitly within the approved platform boundary;
there are no Storage objects, tenant configuration, credentials or cron jobs.
Existing function bodies retain their domain DML for future calls, but the
frontier does not invoke them. Platform auth/storage/vault/cron internals and
roles are prerequisites only and are NOT recreated.

is_active DEFAULT false is defined in the baseline payment-settings table.
automatic_payout_enabled is deliberately absent there: #1 adds NOT NULL DEFAULT
false. The tenant-specific UPDATE remains omitted by the unchanged P3 form.
Both defaults must still be proven by the deferred runtime security test.

## ACL and platform prerequisite limits

Untouched relation/column ACLs come from the frozen catalog, not blanket grants.
The two structural stubs revoke default PUBLIC/anon/authenticated/service_role
EXECUTE and receive no subsequent frontier grants. No grant option is invented.
The api schema is application-owned. public schema ownership, platform roles,
extension prerequisites and Supabase-managed default ACL records are recorded
in the matrix as prerequisites, not reproduced by platform DDL. The local
Supabase PostgreSQL 17 runtime must match these prerequisites; an incompatible
runtime must fail strict signature comparison, never acquire a wider allowlist.

The already reviewed four-entry allowlist remains byte-identical. No ignored
catalog field or new function-body exception has been introduced. Structural
inspection validates generated SQL from frozen definitions and explicit ledger
effect exclusions; it is NOT PostgreSQL parse/execution certification. Source
function-body CRLF bytes are preserved, because the strict comparator does not
ignore body whitespace. Frontier files have byte-preserving Git attributes.

## Review handoff

Candidate status is CANDIDATE_NOT_RUNTIME_CERTIFIED. Agent 4 must review:
the two engineered authorization preimages and ACLs; PUBLIC-to-PRIVATE policy/OID
bindings; the surviving six moved-function bodies; reverse-effect exclusions;
baseline ACL/column privileges; and platform prerequisite assumptions.

No push, workflow dispatch, SQL execution, fixed-point replay or production
signature match is claimed. All workflow triggers and runtime execution guards
remain unchanged. The original generic replay entry point stays disabled until
CERTIFIED, while candidate readers may inspect the pinned frontier without
executing it. Active migrations remain 71; P6 restructure is not performed.

PostgreSQL documents [replacement identity and permissions](https://www.postgresql.org/docs/17/sql-createfunction.html)
and [schema moves](https://www.postgresql.org/docs/17/sql-alterfunction.html).
These support the continuity plan; actual OID assertions require later runtime.
