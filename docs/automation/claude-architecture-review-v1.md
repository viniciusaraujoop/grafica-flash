# Orçaly — Claude Architecture Review V1

**Status:** draft implementation, founder approval pending, AI execution NOT authorized.

**Owner:** Agent 2 (architecture); **executor:** Claude Code GitHub Action. This executor does not replace Agent 3 (QA), Agent 4 (Security), Agent 5 (Frontend), Agent 7 (Product Strategy) or the coordinator.

## Purpose

Read-only architecture review for an existing **founder-created, same-repository, open PR**. The founder must manually start the GitHub Actions run on `main` and supply the **exact PR HEAD SHA**. The action reviews a bounded public patch and generates a structured report in the Actions job summary.

No comment is posted, no branch or PR is created by Claude, and no code is changed. This is **not** a formal GitHub review, a security certification, or a production gate.

## Files

- `.github/workflows/orcaly-claude-architecture-review-v1.yml`: workflow dispatched manually by repository founder only.
- `.github/workflows/orcaly-claude-architecture-review-static-qa.yml`: automatic PR static policy check.
- `scripts/automation/verify-claude-architecture-review-v1.cjs`: static policy and syntax assertions.
- This document.

## Trust boundaries

- `workflow_dispatch` only, `main` only, exact GitHub actor `viniciusaraujoop`. No comments, public Issues, schedules, pushes or PR-event triggers invoke paid AI.
- The workflow validates an open PR created by `viniciusaraujoop`, inside the same repository, with `base.ref=main`, exact `base.sha=workflow github.sha`, and exact `head.sha=expected_head_sha`. Any drift blocks execution.
- At most **15 files** and **65,536 UTF-8 bytes of diff**; only added/modified textual patches. Files named `.env*`, missing patches, renames and deletions block the pilot. Obvious key/private-key patterns are blocked; this is defense-in-depth, **not a proof that no sensitive content exists**.
- The trusted main SHA is checked out; **the PR head is never executed or checked out into the workspace root**. PR diff is written as untrusted JSON data only.
- `GITHUB_TOKEN` is explicitly passed to Claude; this token has only `contents: read`, `pull-requests: read` and `issues: read`. Do not omit the explicit override or rely on write-capable Claude GitHub App tokens in this pilot.
- `--allowedTools Read,Glob,Grep` and `--disallowedTools Bash,Edit,Write,NotebookEdit,WebFetch,WebSearch,Task`. All PR data is untrusted; the trusted prompt forbids instruction-following within the patch.
- The Claude Action and supporting GitHub actions are **pinned by full commit SHA**. The Claude action SHA was resolved from the official `v1` tag on 2026-10-08; pinning prevents silent tag drift but still requires independent supply-chain review.
- `--max-turns 8`, `--max-budget-usd 1.00` and a 15-minute job timeout reduce runaway consumption but **do not replace a provider-enforced spending limit**.
- Structured JSON output is validated, length-bounded and HTML-escaped into the Actions summary. `show_full_output=false` and `display_report=false` reduce the risk of writing model tool output or credentials into public logs.
- Tracked changes after the action fail the job. No write-permission job, issue comment, PR authoring, artifact upload, merge, deployment, DB access or migration is available here.

## Steps before first paid review

1. Independently review this implementation in its draft PR and approve the security controls with Agent 4.
2. Inspect the GitHub Actions static QA and the existing platform Quality Gate. Pre-existing dependency findings are **not** an excuse to override or weaken the gate.
3. In Anthropic Console, configure a dedicated project/workspace and spending controls. Confirm that the GitHub Actions secret **`ANTHROPIC_API_KEY`** exists for this repository. Never reveal the key or any token in a chat, issue, PR or Markdown file.
4. Receive explicit founder approval to merge. The new workflow becomes available for manual dispatch from the default branch only **after merge**.
5. Ask the coordinator to identify an approved test PR and its exact HEAD SHA. For the first candidate use PR #22 only if it remains open, founder-owned, has not drifted and satisfies the strict diff limits.
6. Ask for a **separate explicit authorization to spend API credits and run the first review**, with an exact PR number and SHA. Do not run merely because the workflow exists.
7. Open GitHub → Actions → Orçaly Claude Architecture Review V1 → Run workflow; select `main`, enter `pr_number` and `expected_head_sha` exactly.
8. Review the Actions summary; Agent 4 / Agent 3 still perform independent security / QA. Claude never authorizes merge.

## Failure and cost handling

- A SHA mismatch, too many files, missing/unsafe patch or non-founder dispatch blocks before paid execution.
- If the provider secret is unavailable, authentication fails without successful analysis.
- Missing/invalid structured JSON must fail. Never translate an absent report into PASS.
- The official Claude action's automation mode has had public bug reports of unresponsive sessions / missing structured output in some versions. Pinning plus timeouts and fail-closed output validation mitigate but do not prove reliability. The first real run is a pilot, not production readiness.
- The repo is public. Public PR diffs sent to Anthropic must not include secrets or confidential customer data. Move sensitive agent reports to a private coordination repository in a later phase.

## Relationship to other work

- **PR #22:** separate Codex orchestration pilot, awaiting security review and dependency Quality Gate.
- **R10:** unchanged, no P4 dispatch, no M1A/M1B mutation.
- **Agent 7:** frontend blueprint available; Agent 8 must propose Founder-approved visual concepts before Agent 5's visual implementation.
- **Claude V1:** limited to architecture review; any future implementation role needs a newly reviewed separate workflow and explicit founder authorization.

**Final V1 gate:** `SECURITY_REVIEW_PENDING / STATIC_QA_PENDING / MERGE_NOT_AUTHORIZED / PAID_AI_NOT_AUTHORIZED`.
