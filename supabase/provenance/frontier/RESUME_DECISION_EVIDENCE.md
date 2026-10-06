# P4 resume: approved preimage selected; next dependency decision required

Input local checkpoint: `1bae161ef79415f2932bf9ad3018dfcfb80096d8`.
Mode: LOCAL_REPOSITORY_ONLY. P3 remains CLOSED. No runtime was executed.

## Resolved: can_manage_company

The Founder-provided Agent 2 decision explicitly selects
STRUCTURAL_FAIL_CLOSED_PREIMAGE for `public.can_manage_company(p_company_id uuid)`.
The selected SQL fragment is `CAN_MANAGE_COMPANY_PREIMAGE.sql`, derivation evidence
outside migration discovery, NOT a complete or runnable production-base frontier.
Its historical body remains UNKNOWN; constant false is an engineered decision,
not recovered history. The SQL fragment has no table reads, calls, seeds, persistent
catalog comment, or grants. NULL inputs execute the same constant-false body.

`CAN_MANAGE_COMPANY_POLICY_PLAN.json` records the actual frozen expressions and
their required public-schema preimages. There are 14 final dependent policies:
12 frontier-owned policies, plus the two delivery policies created by ledger #12.
Their names and both USING/WITH CHECK expressions come from the frozen catalog.
The 12 preimages bind once to the public function; ledger #7 moves the same OID
and replaces the body. No private duplicate and no later policy rebind is planned.
Runtime OID assertions remain pending. No catalog-comment mismatch is introduced.

## New STOP: public.is_orcaly_admin()

Ledger #7 (`20260728182610`) requires this pre-existing PUBLIC function, moves it,
sets search_path, and restores authenticated/service_role EXECUTE. Unlike
can_manage_company, #7 does NOT replace its body. The only explicit later CREATE
declaration in the 51 replay forms is ledger #26 (`20260811231921`), not #7.
That authoritative replacement uses active platform_admins and the role set
owner/super_admin/admin/support/suporte. The frozen head records this postimage.

This erased preimage remains operationally relevant between #7 and #26:
#7's authoritative can_manage_company body calls orcaly_private.is_orcaly_admin(),
and the frozen company_members policies also reference its OID. Neither its
historical body nor its pre-#26 role semantics are established by the frozen head.
No claim is made that those calls execute during migration SQL: complete
pre-#26 behavioral unobservability has NOT been proven. Final schema equality
alone would hide changes to this interim privilege decision.

Two materially different engineered choices exist: (a) deny-all until #26, or
(b) install #26's active-platform-admin authorization earlier. The latest
authorization expressly forbids generalizing can_manage_company's stub contract
to other missing preimages. Neither choice is approved here. No is_orcaly_admin
stub or early authorization predicate has been emitted.

Decision required: Agent 2/Coordinator, with Agent 1 ownership, must specify the
permitted preimage for this exact function, whether #7-to-#26 behavior may be
neutralized, and its owner/ACL/OID handling. This is FRONTIER_DECISION_REQUIRED.
No allowlist expansion or ledger change is proposed or presumed necessary.

## Bounded source search and evidence

- Archive/replay search: is_orcaly_admin declarations occur only at #26; #7
  contains ALTER and the can_manage_company call; #40 creates an admin_users policy.
- Full-ref Git content search: `git log --all -G 'is_orcaly_admin'` identified
  755caa67ce4701fd87a3eace243ed5b78ea11b65 (schema move),
  ebefe07647fd90a42a6f9fe6df72a871771e65a5 (#26 definition),
  4728d50ab3134e7b05b226f58d09436f934f0ed0 (post-ledger staging snapshot),
  3dd89fc2a1e9b3b458539f46b76624865154a68b (policy fix),
  df87d092d617facf9d937fb8fcfb1e095837b53b (later baseline), and
  4f3c50056df9f23822e53cc36bfb68663a95c022 (archive).
  CREATE-specific SQL-history search found #26 and later baseline/archive
  representations, not the pre-#7 PUBLIC declaration. These are bounded negative
  results, NOT proof that the historical source never existed.
- The seven local July Asaas schema-before.json files contain no
  is_orcaly_admin definition/reference; these are limited table/column evidence.
- Remaining six moved functions have no later explicit CREATE declaration in
  the 51 forms. Their frozen definitions may recover unchanged bodies, but full
  dependency/ACL/pre-ledger review is NOT complete. They are not stubbed.

The matrix records this distinction for every function moved by #7. It is still
preliminary, not a complete frontier object inventory. Derivation stopped at the
new material uncertainty; production_base_frontier.sql and FRONTIER.json remain
absent and their pin remains null. The disposable runner continues to fail closed.

PostgreSQL's [CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html)
documents replacement identity/permission preservation; its
[ALTER FUNCTION](https://www.postgresql.org/docs/17/sql-alterfunction.html) documents
the schema move. The continuity plan uses these operations, never DROP/recreate.

## Validation limits

Focused checks are STATIC_VERIFIED only. SQL inspection proves the selected
fragment's text contract, not executable PostgreSQL behavior or OID convergence.
Payment-default evidence remains historical is_active DEFAULT false plus ledger
#1 automatic_payout_enabled DEFAULT false; there is no complete frontier/runtime
payment-default proof. No workflow, database, active migration, P3 replay, security
allowlist, or M1A/M1B bytes are modified by this checkpoint.
