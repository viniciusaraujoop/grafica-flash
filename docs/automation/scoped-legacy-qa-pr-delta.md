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
