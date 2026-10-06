# P4 derivation decision gate — no candidate SQL

> HISTORICAL CHECKPOINT RECORD, not the current blocker list.
> The can_manage_company decision below was explicitly RESOLVED by the Founder-
> supplied Agent 2 STRUCTURAL_FAIL_CLOSED_PREIMAGE decision in the resume request.
> Current selected fragment, policy plan and the new is_orcaly_admin decision gate
> are recorded in RESUME_DECISION_EVIDENCE.md and DERIVATION_STATUS.json.
> Entry #30 remains CLOSED_BY_P3; no pending #30 decision is asserted here.

Input checkpoint: `8e5cc45839c3ffb38f141b522b51afb531ec4a21`.
All work was repository-only. No frontier SQL or descriptor was materialized;
the frontier pin remains null, so the disposable runner still fails closed.
P3 and its four reviewed neutralizations remain unchanged; #30 is CLOSED.

## Required existence versus engineered preimage

The first replay form requires payment-settings and payout tables; the second
requires subscription-events and plan-payments. Archived payment-settings DDL and
the frozen catalog both establish `is_active DEFAULT false`. Ledger #1 declares
`automatic_payout_enabled DEFAULT false`. Their data/identity bootstrap statements
must not be copied. Those preliminary dependencies are in the JSON matrix; it is
explicitly NOT a complete frontier object inventory.

The specific unresolved dependency is `public.can_manage_company(uuid)`:

1. Replay #7 unconditionally applies `ALTER FUNCTION ... SET SCHEMA orcaly_private`.
   The original public identity must exist; creating only the frozen private
   identity would fail this prerequisite.
2. The same replay form then uses `CREATE OR REPLACE` to replace the function body
   with its owner/tester/member/admin predicate, before explicitly restoring ACLs.
3. The frozen head records that later private definition, not its earlier body.
   The first six replay forms do not mention `can_manage_company`.
4. Scoped archive searches and full-ref SQL history searches for lower/upper-case
   public CREATE declarations did not locate the earlier declaration. This is a
   bounded negative search result, NOT proof that no such artifact ever existed.

Reverse replacement is non-unique. A deliberate deny-all bootstrap stub and an
adaptation of the later predicate to the original public/helper identities have
different authorization behavior before #7. Both can be overwritten by #7;
matching the final body cannot establish which preimage is the intended security
baseline. These are conceptual models, not tested replays or emitted SQL.

This is NOT a demand to restore authentic historical function bytes. The frontier
is engineered, as authorized. The decision is which engineered authorization
preimage rule is approved when ALTER requires an erased definition. Choosing an
unapproved stub or silently treating the later body as its predecessor would be a
semantics choice. The instruction to stop when materially different frontier
models remain plausible therefore gates this dependency.

## Decision requested

`FRONTIER_DECISION_REQUIRED` and `AGENT_2_ARCHITECTURE_ESCALATION_REQUIRED`.
Agent 2 / Coordinator, with Agent 1 migration ownership, must define the permitted
preimage rule for overwritten functions, including interim fail-closed behavior,
helper dependency reversal, ownership and ACL handling. No allowlist expansion,
ledger editing or business data is proposed. Continue the remaining dependency
closure only after that rule is explicit. No source is declared irrecoverable.

## Evidence integrity and limits

The JSON matrix binds the #7 replay hash and frozen function-definition hash.
The 51 ledger identities, frozen lossless catalog, manifest and M1A/M1B pins were
checked locally. Only derivation status, this report, preliminary matrix and their
manifest bindings changed. Existing replay forms, migrations, security allowlist,
runtime scripts and workflows are unchanged. No candidate hash or runtime PASS
is fabricated. Structural SQL validation and fixed-point/signature matching remain
unexecuted because no candidate was selected and runtime dispatch is prohibited.

PostgreSQL documents that string-body function dependencies are not completely
tracked by the catalog; source-level dependency review remains necessary:
[Dependency Tracking](https://www.postgresql.org/docs/17/ddl-depend.html).
