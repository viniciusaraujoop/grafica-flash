# Orçaly Global Lint Remediation

## Scope

Branch: `gpt/orcaly-quality-hardening`
Base branch: `codex/orcaly-ecosystem`
Base SHA: `9a2c66dbb2e6bf00c484b1791103b2bccd15becd`
Baseline source: GitHub Actions `global-lint-baseline` job `108636042611` on 2026-09-27.

This work is behavior-preserving quality hardening only. No production, database, migrations, Supabase, CI, package/dependency, Wealth, Orçaly Next/UX Foundation, auth core, billing core, entitlement core, or WhatsApp changes are permitted.

## Baseline

```
405 problems
257 errors
148 warnings
0 errors and 13 warnings potentially fixable with --fix
```

## Rule catalogue

| Rule | Count | Severity profile | Classification | Risk | Strategy |
| --- | ---: | --- | --- | --- | --- |
| `@typescript-eslint/no-explicit-any` | 191 | errors | SAFE_MANUAL / OUT_OF_SCOPE by file | Medium | Replace only where the contract is obvious from local usage. Prefer `unknown`, concrete interfaces, `Record<string, unknown>`, or inferred SDK types. Do not change runtime logic. |
| `react-hooks/set-state-in-effect` | 52 | errors | BEHAVIOR_RISK | High | Do not bulk-rewrite. Handle only where state is clearly derivable or the asynchronous boundary preserves exact behavior; otherwise document and skip. |
| `@typescript-eslint/no-unused-vars` | 48 | warnings | SAFE_MANUAL | Low | Remove dead imports/locals/parameters only when proven unused. Preserve side-effect imports. |
| `@next/next/no-img-element` | 45 | warnings | SAFE_MANUAL / BEHAVIOR_RISK by file | Medium | Prefer static semantic fixes only when dimensions/loading behavior remain equivalent. Do not redesign or alter external image behavior merely to silence lint. |
| `react-hooks/exhaustive-deps` | 23 | warnings | BEHAVIOR_RISK | High | Add dependencies only when closure semantics are demonstrably unchanged. Otherwise record for later review. |
| `@next/next/no-location-assign-relative-destination` | 19 | warnings | SAFE_MANUAL where event-driven | Low/Medium | Replace internal navigation with the existing Next router only when navigation timing and history semantics remain equivalent. |
| unused ESLint disable directives | 13 | warnings | SAFE_AUTOFIX | Low | Remove only the obsolete directive/rule entry. Do not introduce new disables. |
| `react/no-unescaped-entities` | 6 | errors | SAFE_MANUAL | Low | Escape text entities without changing visible copy. |
| `react-hooks/purity` | 3 | errors | BEHAVIOR_RISK | High | Move impure time/random reads out of render only where refresh semantics are explicit; otherwise skip. |
| `react-hooks/preserve-manual-memoization` | 2 | errors | BEHAVIOR_RISK | Medium/High | Avoid changing memoization semantics without component-level validation. |
| `@typescript-eslint/no-require-imports` | 2 | errors | OUT_OF_SCOPE | Low technically, but files are historical correction package | Historical artifact is not product runtime; do not touch in this branch. |
| `@next/next/no-html-link-for-pages` | 1 | warning | SAFE_MANUAL | Low | Replace internal anchor with Next Link only if behavior is equivalent. |

## Initial classification

- SAFE_AUTOFIX / SAFE_MANUAL: 280 findings.
- BEHAVIOR_RISK: 70 findings.
- OUT_OF_SCOPE: 55 findings.

The classification is conservative. A rule being generally safe does not make every occurrence safe. Each file is checked before modification.

## OUT_OF_SCOPE findings

The current lint scan includes findings in explicitly frozen or non-product paths. These remain visible in the global total but are not modified here.

Primary groups:

- `app/api/whatsapp/**`
- `app/painel/whatsapp/**`
- `lib/whatsapp.ts`
- `lib/whatsapp-notifications.ts`
- `.orcaly-*-backup-*/**`
- `pacote-correcoes-qa-criticos-altos-orcaly-*/**`
- any Wealth, Orçaly Next, Supabase, migrations/baselines, auth/billing/entitlement core, CI, package/dependency, or environment file if surfaced by later scans.

## Conflict avoidance

Recent changes from `231dc82a1ff778e2564d720717bf0fc0b1855251` to the base SHA affect Wealth, CI, package metadata, staging scripts, and a Supabase migration. Those files are not touched.

At the initial baseline, a remote file-level diff for the Claude work was unavailable. The user-provided Claude ownership boundaries were therefore treated as hard exclusions throughout this remediation, and no Claude-owned path was modified by the hardening work.

## Fix order

1. Remove obsolete lint-disable directives.
2. Remove dead imports/locals and trivial dead code.
3. Fix text escaping and other static JSX issues.
4. Fix obvious type errors where the runtime contract is locally provable.
5. Fix internal link/navigation patterns when semantics remain identical.
6. Review deterministic rendering and hook findings individually.
7. Leave behavior-sensitive or ownership-conflicted findings documented rather than masking them.

## Regression gates

After each meaningful group, use the existing GitHub Actions quality gates as the executable environment because this agent does not have direct network access from the local container.

Final evidence target:

- global lint
- typecheck / build gate
- relevant existing tests
- exact remaining errors/warnings by rule and file
- no migrations
- no database changes
- no dependencies
- no behavior changes

## Final certified snapshot

Certification date: 2026-09-27

Code HEAD before this documentation-only update: `b9532d16078e26084c13a58a40a330d0bf0e0b8d`

Latest certified global lint source: GitHub Actions `global-lint-baseline` job `108653802042`.

```
181 problems
88 errors
93 warnings
```

Reduction from the original baseline:

- 405 -> 181 total findings: **224 removed** (55.3%).
- 257 -> 88 errors: **169 removed** (65.8%).
- 148 -> 93 warnings: **55 removed** (37.2%).

### Remaining findings by rule

| Rule | Remaining | Final classification | Reason for stopping |
| --- | ---: | --- | --- |
| `react-hooks/set-state-in-effect` | 52 errors | BEHAVIOR_RISK / OUT_OF_SCOPE by file | Requires lifecycle/state-flow changes; several occurrences are also in historical backup paths. |
| `@next/next/no-img-element` | 42 warnings | BEHAVIOR_RISK / OUT_OF_SCOPE by file | Bulk conversion can change loading, dimensions, external image handling, or visual behavior. |
| `@typescript-eslint/no-explicit-any` | 28 errors | OUT_OF_SCOPE | 25 are in frozen WhatsApp paths; 3 are in `app/api/company/team/route.ts`, adjacent to auth/team core. |
| `react-hooks/exhaustive-deps` | 23 warnings | BEHAVIOR_RISK / OUT_OF_SCOPE by file | Dependency changes can alter effect timing and closure semantics. |
| `@next/next/no-location-assign-relative-destination` | 19 warnings | BEHAVIOR_RISK / OUT_OF_SCOPE by file | Router conversion may alter navigation/history semantics; some occurrences are in frozen/core or backup paths. |
| `@typescript-eslint/no-unused-vars` | 9 warnings | OUT_OF_SCOPE | All remaining occurrences are in `.orcaly-cupons-backup-20260728193111/**`. |
| `react-hooks/purity` | 3 errors | BEHAVIOR_RISK | Moving time/random reads changes render-time semantics. |
| `react-hooks/preserve-manual-memoization` | 2 errors | BEHAVIOR_RISK | Subscription component memoization is behavior-sensitive and core-adjacent. |
| `@typescript-eslint/no-require-imports` | 2 errors | OUT_OF_SCOPE | Historical correction package under `pacote-correcoes-qa-criticos-altos-orcaly-*/**`. |
| `@next/next/no-html-link-for-pages` | 1 error | BEHAVIOR_RISK | Google Calendar OAuth/navigation flow is intentionally not rewritten without integration-level validation. |

All remaining global-lint findings are therefore classified as `BEHAVIOR_RISK` or `OUT_OF_SCOPE`. No ESLint rule was weakened and no broad `eslint-disable` was introduced.

## Final regression evidence

On code HEAD `b9532d16078e26084c13a58a40a330d0bf0e0b8d`:

- QA job `108653802216`: PASS.
  - domain invariant tests: PASS
  - focused lint: PASS
  - TypeScript + production build: PASS
  - dependency audit baseline: PASS
- QA job `108653801898`: PASS.
  - partner invariant tests: PASS
  - focused lint: PASS
  - TypeScript + production build: PASS
  - dependency audit: PASS
- QA job `108653801933`:
  - domain/regression invariants: PASS
  - payment boundary regression: PASS
  - focused lint: PASS
  - TypeScript + production build: PASS
  - protected payment diff check: PASS
  - only failure: `git diff --check`, caused by trailing whitespace in this remediation document. This documentation-only update removes that whitespace.

The production build includes Next.js TypeScript validation. The earlier TypeScript regression introduced while replacing legacy `any` contracts was fully resolved before lint remediation resumed.

## Scope integrity

- No production action was performed.
- No database or Supabase mutation was performed by the hardening work.
- No migration was authored or edited by the hardening work.
- No dependency or ESLint rule change was made.
- No WhatsApp path was modified.
- No Wealth or Claude-owned path was modified by the hardening work.
- No auth, billing, or entitlement core behavior was changed.
- Upstream synchronization already present on the branch was preserved; hardening edits stayed outside the excluded ownership areas.
