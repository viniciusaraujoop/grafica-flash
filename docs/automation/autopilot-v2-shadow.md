# ORÇALY — AUTOPILOT V2 SHADOW DISPATCHER

**STATE:** SECURITY_REVIEW_REQUIRED / IMPLEMENTATION_IN_ISOLATED_BRANCH / MAIN_UNCHANGED / ZERO_PAID_AI.

The founder authorized progress towards overnight, high-quality development with GPT-6 High for planning and cheaper Codex for narrow implementation. This PR does **not** perform unattended development. It implements the safe first dispatcher stage, which proposes candidates **without invoking any model, modifying GitHub or spending API credits**.

## Delivered

- Hourly (minute 43 UTC) GitHub Action, activated only after separate founder-authorized merge into the default branch. It has a manual `workflow_dispatch` as well, allowed only for the founder.
- Trusted checked-out source only, GitHub Issue metadata via read-only token.
- Only the explicit Issue #23 is considered a **public documentation proposal example**. The output is `SHADOW_ONLY_NO_EXECUTION`, not `READY_FOR_RUN`, and it cannot approve or dispatch a model.
- A machine-readable fail-closed policy with `autonomous_paid_execution_enabled=false`, zero concurrent paid workers and no approved monetary values.
- No key access or secret in the workflow. No checkout or execution of PR code; no source writes, GitHub write permissions, Supabase, Vercel, P4, migrations, prices or main changes.
- Offline tests verify that policy modification to enable spending or repository writes fails, and that private-looking or non-founder tasks are not eligible.

## Known limitations

- A GitHub schedule runs at best effort and can be delayed; it does not create a durable 24/7 worker.
- The current public repo is unsuitable for client information, private security reports or sensitive agent prompts.
- A GitHub Issue only proves a task was recorded, not that an autonomous agent is working.
- There is no connection to external chats as if they were always-on workers.
- Even GPT-6 High in this chat cannot be made a free unattended GPT-6 API scheduler. The GPT-6 Astra API is separately metered.
- The `blocked_patterns` list and pathname allowlist are **not** a security boundary for real code execution; this workflow deliberately lacks any execution capability.

## Activation plan, separate authorization required at each gate

1. Independent Agent 4 review of the V2 shadow code and GitHub permissions on its exact SHA.
2. Static QA PASS and resolution of pre-existing high-severity runtime dependency audit failure without suppressing findings.
3. Explicit founder approval for merge. Only then the hourly **no-cost shadow scheduler** starts.
4. Private coordination queue with exact mission ID, allowlisted code paths, authorized founder identity, immutable SHA, idempotency key, hard stop and artifact proof.
5. Confirm Anthropic and OpenAI provider limits and **founder-approved** monthly USD and per-mission USD caps. Null is **not unlimited**: it means not authorized.
6. Security certification for Codex PR #22 and Claude PR #25; do not merge or activate a paid workflow on their behalf.
7. A tiny paid one-off task requires a separate explicit founder authorization. After measured costs, QA and security, design a safely resumable overnight dispatcher.
8. Merges, releases, secrets, migrations, production, R10, billing/entitlements and pricing continue to require their existing explicit human approvals.

## GPT-6 / Codex intelligence routing, planned only

- Founder coordinator: GPT-6 ChatGPT high-thinking UI, no background hosting through this conversation.
- Future hard planning: `gpt-6-astra` with `reasoning.effort=high` only for difficult architecture and major dependency tradeoffs.
- Future routine agent: narrow Codex tasks with Low thinking, Medium for ordinary implementation, never downgrade security review merely for cost.
- Claude: read-only external architecture challenger until independently approved for any other role.

**Important:** No code in this PR calls any GPT-6, Codex or Anthropic endpoint. A real 24/7 autonomous coding system remains NOT_ACTIVE.

## Evidence protocol

Every report must identify the exact GitHub run, PR and SHA if work is claimed as done. Shadow decisions must be reported as simulated, never `IN_PROGRESS` or `COMPLETED`. Agent chat sessions without linked evidence are `UNKNOWN_EXTERNAL_ACTIVITY`.
