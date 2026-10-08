# ORÇALY — AUTOPILOT V1: WATCHTOWER + INTELLIGENCE ROUTING POLICY

**STATUS:** IMPLEMENTED_IN_ISOLATED_BRANCH / SECURITY_REVIEW_REQUIRED / MERGE_NOT_AUTHORIZED / PAID_AUTONOMY_DISABLED

Base: `viniciusaraujoop/grafica-flash@9611d195290247694ad60d5aa2638ac8b96ecefb`.
This version **does not change** R10, M1 migrations, production, prices, backend, frontend, or the existing Codex/Claude pilot PRs.

## Founder vision

The founder wants Orçaly to continue progressing while asleep, using high-quality GPT-6 reasoning for strategic decisions and cheaper Codex execution for routine work, with transparent evidence of actual activity.

**Fundamental distinction:** A ChatGPT GPT-6 conversation and paid OpenAI API/automated Codex executions are different services. This conversation cannot autonomously call itself from GitHub, nor can a GitHub Actions job use unlimited ChatGPT Plus tokens. A future GPT-6 API worker is metered separately. Claude also has separate billing.

## What V1 actually implements

- `.github/workflows/orcaly-autopilot-watchtower-v1.yml`: **hourly** GitHub Actions scheduled check, at minute 23 UTC, plus manual trigger. It reads only metadata from open Issues, PRs and the 100 most recent workflow runs, and writes an Actions job summary and a small JSON artifact. No external AI is called.
- `scripts/automation/autopilot-watchtower-v1.cjs`: classifies **genuine running executor workflows** separately from ordinary CI runs, open Issues and drafts. A mission in an Issue is NOT proof of execution. Lack of a running action does NOT prove someone is idle in a separate ChatGPT session.
- `scripts/automation/autopilot-watchtower-v1.test.cjs`: offline tests for false activity, SHA drift, stale/failed CI and untrusted issue names.
- `docs/automation/autopilot-v1-model-policy.json`: a machine-readable policy **proposal**, but intentionally **NOT wired to any paid runtime**.
- `.github/workflows/orcaly-autopilot-watchtower-static-qa.yml`: checks policy and evidence processing without secrets.

**GitHub schedule only becomes active after this workflow is merged into the default branch**. GitHub can delay or skip scheduled events during high load. V1 does not guarantee exact hourly execution.

## Evidence-based status language

- `ACTIVE_AI_RUNS > 0`: an exact allowlisted Codex/Claude executor workflow is currently running.
- `QUEUED_AI_RUNS > 0`: an allowlisted AI workflow is actually queued or pending.
- `REGISTERED_NO_EXECUTION_EVIDENCE`: a live GitHub Issue requesting a mission; **not running**.
- `DRAFT_REVIEW_PENDING`: a draft pull request exists; **not automatically active**.
- `CI_BLOCKED`: a matching exact-SHA PR Quality Gate run failed.
- `UNVERIFIED`: no matching run observed in the bounded evidence window; **not PASS**.
- External agents (ChatGPT conversations, standalone Claude sessions) remain `UNKNOWN_EXTERNAL_ACTIVITY` unless they publish verifiable evidence.

No invented percentage complete, no synthetic activity heartbeat, no claims of autonomous code generation.

## Intelligence and economics policy

### Interactive founder/coordinator
- GPT-6 ChatGPT; **High** thinking when available and selected in the ChatGPT model menu.
- Reasoning in a chat follows the user's ChatGPT plan limits. It cannot be reused by scheduled GitHub Jobs for free.
- Strategic coordination, mission approval, governance and risk are the intended focus.

### Future API planner (NOT active)
- `gpt-6-astra`, `reasoning.effort = high`.
- Invoke only for difficult architecture, conflicting requirements, security tradeoffs and dependency planning; at most one planner call per authorized mission as a starting rule.
- Never route trivial statuses to the expensive model. Prefer deterministic policies and cheaper classification if necessary.
- Strong reasoning is not permission to alter security boundaries. AI output is a proposed plan, never approval.

### Future Codex executor (NOT active)
- Use **low** reasoning effort on small, narrow, well-specified tasks and **medium** for routine implementation.
- Agent must work only on a sandboxed branch and a fixed base SHA; timeouts, tool restrictions, maximum two retry attempts, independent test evidence.
- Do not automatically lower effort on sensitive changes just to save money. Escalate complexity to a human-approved higher-effort review instead.
- Do not assume the current `openai/codex-action` supports a particular model/effort flag until its active version and CLI integration have been validated.

### Budget and dispatch controls
- There is NO approved paid AI monthly budget or per-task ceiling in this document. The values are `null`; not `0 = unlimited`.
- Until budget, secrets, service identity, provider limits, permissions, threat model, and founder approval are completed: `paid_ai_dispatch_enabled=false`, `autonomous_code_dispatch_enabled=false`, `concurrent_paid_executors=0`.
- Provider-side spending caps, rate limits, usage reporting, separate service identities, a kill switch, no uncontrolled retries, and secure private task context are required before any paid dispatcher.
- PR #22 and #25 are independent pilots awaiting their existing independent security and CI gates. Do NOT bypass them to activate an autopilot.

## Proposed later autonomous development pipeline (NOT implemented)

```
Founder-approved milestone
  -> private scoped mission queue (task ID + owner + base SHA + allowed paths)
  -> deterministic eligibility check, idempotency and quota reservation
  -> optionally GPT-6 Astra HIGH architecture plan (metered)
  -> small bounded Codex implementation (LOW/MEDIUM, metered)
  -> static tests and independent QA/security reviews
  -> draft PR with evidence links and cost accounting
  -> HUMAN founder authorization for merge, production and sensitive decisions
  -> watchtower confirms evidence and surfaces blockers
```

The orchestrator must NEVER infer authority from a PR comment, title, model response, changed file or GitHub status. **Only explicit founder-approved scoped mission records authorize a future agent action.** Failure to verify any required attribute means `BLOCKED`.

Allowed future low-risk scope: docs, verified UI states, strictly scoped tests, small code changes explicitly approved by owner/coordinator. Prohibited without direct founder authorization: `main` merges, R10, migrations, service credentials, Supabase/Vercel production, Entitlements/Billing mutations, prices, and cross-tenant data changes.

## Next gates

1. Independent Agent 4 workflow/security review and Agent 3 static QA on exact SHA of this PR.
2. Resolve or formally triage the existing Quality Gate dependency audit failure **without bypass**.
3. Founder explicitly authorizes merge into `main`. This only activates the free read-only hourly watchtower, **not paid AI**.
4. Inspect first hourly summary and ensure the source is accurate.
5. Draft private orchestration repository and budgeted executor workflow, separately reviewed and founder-authorized.
6. For paid AI, configure appropriate OpenAI/Anthropic keys, spending controls and allowed models; review model usage before pilot. No charges should be triggered by V1.

## Success criteria

- Every report distinguishes verified activity, backlog, under-review and blocked.
- Every claim of CI PASS/FAIL is tied to the PR HEAD SHA as observed.
- Zero paid AI usage, zero code deployments, zero production writes, zero merges by this workflow.
- No secret or customer data enters a public status artifact.
- No new false-positive agent progress indicators.
