# Products: implementation evidence

| Product | Status | Evidence and limits |
| --- | --- | --- |
| Business | PARTIAL (existing application preserved) | `/painel/**` unchanged; original marketing at `/business`; pricing still Essencial 49.90, Profissional 99.90, Premium 149.90 BRL. Existing invariant/payment suites pass; full live order-to-finance E2E not certified here. |
| Wealth | PARTIAL | Personal profile, declared budget/reserve, income/expense/asset/liability entries, goals, deterministic simulator, server actions, explicit grants/RLS and local browser-to-Postgres tests. Hosted staging certified for core/lifecycle/recurrences; automatic clock tested and paused during QA. No investment execution or regulated advice. |
| Growth | NOT_STARTED beyond registry/discovery | No new campaign or Experiment OS backend. Existing admin growth/partner features must be audited before reuse. |
| Flow | NOT_STARTED beyond registry/discovery | Existing jobs/automations preserved. No new visual builder or human-approval execution engine. |
| Academy | NOT_STARTED beyond registry/discovery | No hosted books, AI summaries, reading journal or recommendation provider added. |
| Market | NOT_STARTED beyond registry/discovery | Existing tenant storefront marketplace is preserved; it is not misrepresented as the new ecosystem tools marketplace. |
| Partners | PARTIAL (existing portal preserved) | Existing `/parceiros/**`, profile/referral/commission tables reused by Hub discovery. No payout mutation performed. |
| One | NOT_STARTED beyond registry/discovery | Premium bundle proposal only; no invented price or transitive authorization from a One grant. |

Life is not a product and is not a route. Personal financial features belong to Wealth. Generic productivity was not added to Wealth.

Wealth amounts use integer cents, explicit BRL and bounded values; complete database aggregates return exact strings and use BigInt formatting. Simulations use integer arithmetic, end-of-month contributions and explicit hypothetical rates. Market quotes are not configured. Legacy recurrence annotations remain references; the dedicated scheduling model now generates declared entries through an idempotent worker. Overview lists 15 recent active entries/goals while totals include ALL own active records. History and goal management paginate 25 rows, entry/goal edit and archive/restore enforce ownership/entitlement/version, and CSV requires export permission with an explicit 1,000-row cap. Lifecycle/aggregates evidence: `docs/qa/ORCALY_WEALTH_LIFECYCLE.md`. Recurring UI/Actions/worker are implemented and verified against hosted staging; automatic clock validated against staging pg_cron, intentionally paused during QA. Investment holdings, debt optimization and family workspaces remain open work. Recurrence evidence: docs/qa/ORCALY_WEALTH_RECURRENCE.md.
