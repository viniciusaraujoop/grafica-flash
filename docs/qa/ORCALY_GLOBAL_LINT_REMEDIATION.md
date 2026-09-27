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

The requested Claude branch `claude/orcaly-ux-foundation` is not currently published in the GitHub repository, so a remote file-level diff is unavailable. The user-provided Claude ownership boundaries are therefore treated as hard exclusions.

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
