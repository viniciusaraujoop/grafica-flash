# ORÇALY — Scoped legacy QA: exact PR delta baseline

**Status:** review pending, no merge authorized.
**Repository base:** main `9611d195290247694ad60d5aa2638ac8b96ecefb`.

## Problem (evidence from PR #31, exact SHA da24a8b3…)

- Main Site v2 QA [37711895778](https://github.com/viniciusaraujoop/grafica-flash/actions/runs/37711895778): `Protected checkout and auth diff check` failed.
- Storefront Marketplace v2 QA [37711895853](https://github.com/viniciusaraujoop/grafica-flash/actions/runs/37711895853): `Diff whitespace check` failed.
- Both workflows used fixed SHA baselines from old feature implementations, so their historical ranges included unrelated changes across months even when the current PR altered only lockfile and dependency checking.
- Both also reported `global-lint-baseline` failures from project-wide existing lint errors. That job is intentionally `continue-on-error: true`; it has **not** passed and is **not** fixed by this PR.
- The Orçaly Platform Quality Gate [37711895802](https://github.com/viniciusaraujoop/grafica-flash/actions/runs/37711895802) **passed** on dependency patch SHA da24a8b3…; this result applies to that SHA only and does not certify the scoped-QA fix or separate branches.

## Solution

- Replace legacy fixed-`SHA...HEAD` domain diff checks with the event's exact `github.event.pull_request.base.sha` and `github.event.pull_request.head.sha`.
- Run fail-closed `scripts/ci/verify-focused-pr-delta.cjs`, validating exact 40-digit hashes and known scope. Git with `--no-renames` ensures rename-away from a protected file still counts as a protected deletion.
- Main site still rejects changes under protected checkout, auth and payments paths in its PR's actual delta.
- Storefront still rejects protected checkout and payment changes.
- Both preserve whitespace checks across the **current PR**, not across historical unrelated commits.
- Manual `workflow_dispatch` runs remain available for functional smoke tests but **do not confer PR-delta certification** because there is no authoritative PR base/head in a manual run. Explicit notice emitted.
- No focus lint, npm test, payment regression, build or existing `global-lint-baseline` diagnostics are removed or weakened.
- Negative tests construct a real temporary git repository and test unrelated changes, login/checkout edits, renames, whitespace, malformed SHA and missing commit.

## Separation of review gates

This PR does not update `package.json`, Supabase, auth/business code, frontend, migrations, the dependency lock, billing or prices. PR #31 remediation stays isolated.

Do NOT mark global lint clean: there are many real legacy lint errors and their fix remains tracked separately (existing draft PR #11). Do NOT suppress or downgrade those diagnostics just to make every UI badge green.

QA sequence: offline tests and domain checks, independent Agent 3/4 focused reviews, then founder authorization for merge. No automatic merge or production deployment under this draft.

## PR32 Agent 10 scoped remediation (2026-10-08)

**Status:** PR32_REMEDIATION_SUBMITTED / INDEPENDENT_REVIEW_PENDING / NO_MERGE.
Only the existing draft branch is being changed. Nothing below authorizes bootstrap,
main, PR #31, deployment, production, or administrative changes.

### Fixes

1. Corrected both scopes to protect the historical `lib/mercado-pago*` prefix,
   including `lib/mercado-pago.ts`. The original `base...head` event SHA
   validation, `--no-renames` semantics, and whitespace checks are retained.
   Added negative fixtures for .ts edits, deletion, move out/in, nested directory.
2. Restored the historical full marketing-tree dead-link grep in Main Site.
   The separately proposed trusted guard scans the **entire PR head tree**, not
   merely changed files, including app/page.tsx, app/solucoes/* and components/marketing/*.
3. Removed workflow_dispatch from both domain PR QA workflows. Manual testing
   now has a **different workflow and job identity**:
   `Orçaly Manual Smoke (Informational Only) / manual-smoke-no-pr-certification`.
   Neither manual nor candidate-only offline tests certify a PR.
4. Pinned actions/checkout at
   `11d5960a326750d5838078e36cf38b85af677262` and actions/setup-node at
   `49933ea5288caeca8642d1e84afbd3f7d6820020`.
   Confirmed both SHAs exist in the canonical actions repositories.
   Added read-only contents permission and checkout persist-credentials:false.
   Existing npm test, payment verification, focused lint, build, audit,
   and separate continue-on-error global lint remain present.
5. Candidate static test workflow now runs on **every** PR to main with no
   path filters, but is explicitly named informational. Main Site/Storefront
   path filters additionally include protected checkout/payment/auth paths.
   **None of these candidate-executed jobs is the independent trust gate.**

### Independent trust boundary: designed, NOT YET OPERATIONAL

`.github/workflows/orcaly-trusted-pr-boundary.yml` declares
`pull_request_target` and **no path filters**. When installed into the
protected default branch, GitHub loads its workflow definition from that
trusted branch. It checks out its trusted verifier from the event's exact
`pull_request.base.sha`, and separately checks out the PR as inert Git
objects in `candidate/`. Only the **trusted** base-branch Node script runs.
No npm, build, PR scripts, checkout-executed hook, untrusted input interpolation
in shell commands, write token, or secrets are made available to candidate code.
Both action checkouts have persist-credentials:false. The GitHub event is checked
for name, integer PR number, base ref/repo, and exact base/head SHAs; candidate
HEAD must equal the event head SHA, with both SHA commits and merge base present.
All protected checkout/auth/payment paths, modifications of workflows or CI
policy scripts, .gitattributes, PR-delta whitespace, and marketing dead links
fail closed. Rename-out and rename-in are detected with --no-renames.

**Bootstrap blocker (founder/coordinator approval required):**
- The workflow/script added in PR #32 are candidate files, so they have **zero
  trusted-gate enforcement until integrated into main**. Do not mark
  `trusted-pr-boundary` PASS or required yet.
- After Agent 3 and Agent 4 independent SHA-specific approval and founder
  merge authorization, integrate the audited workflow and verifier into main
  through the approved governance path. Existing branch rules must be inspected
  and set by the authorized owner to require the independently generated
  **`trusted-pr-boundary`** GitHub Actions job context. No settings changes
  are authorized in this mission.
- Before relying on it, execute a dedicated harmless PR against main and a
  negative security PR, verify that the check appears on the **correct PR head
  SHA**, cannot be satisfied by workflow_dispatch, and blocks merge when
  missing/failed. A fork PR must be tested for checkout/event semantics.
  Until proven, enforce **NO MERGE** under the claimed independent boundary.
- Current branch rules also reference `quality-gates` while the observed
  actual Quality Gate context is `quality-gate`. Correcting it requires
  explicit administrative authorization and is not part of Agent 10's work.

### CI and release limitations

Existing runtime advisories in main remain until separately controlled PR #31
is merged. Never suppress `npm audit` to force green CI. Old global lint
failures remain genuine and tracked separately in PR #11. PR #32 does not
certify either dependency or lint fixes. Re-evaluate its exact final SHA,
all relevant GitHub Actions runs, Agent 3 independent QA, and Agent 4
Security; no auto-merge, no release, no database effects.
