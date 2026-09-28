# ORÇALY — AGENT 2 — SMART SETUP PURE ENGINE T2 — IMPLEMENTATION REPORT

**Normative source:** `ORCALY_SMART_SETUP_RULESET_PRODUCT_APPROVAL.md` (Agent 7, PRODUCT_APPROVED, READY_FOR_AGENT2_T2)
**Scope:** PURE CORE ONLY — recommendation + proposal data. No endpoint, UI, persistence, DB reader, migration, provider, AI/LLM, pack apply, automation runtime, analytics, tracking or feature flags.

## BASE SHA
`38b5aeb94d7bb258689cb7c34e699bc0648bf75e` — tip of `claude/orcaly-wave1-pure-core` (T1, CERTIFIED_BY_COORDINATOR). Not `main`, not `feat/integrations-expansion`, not reconciliation/security branches.

## BRANCH
`claude/orcaly-smart-setup-t2`

## HEAD / COMMITS
| Commit | Content |
| --- | --- |
| `a2e22100b00104df824cbab41450a1e44641a82a` | feat(smart-setup): T2 pure recommendation engine (core, tests, mutation suite, manifest section, `test:wave1`) |
| (next commit) | docs(smart-setup): this report — the final HEAD is stated in the handoff |

## FILES CREATED
- `lib/smart-setup/core/types.ts` — contract types (questions, answers, signals, scores, outcome, result shape)
- `lib/smart-setup/core/questionnaire.ts` — Questionnaire V1 + deterministic branching + BusinessType authority mapping
- `lib/smart-setup/core/validate-answers.ts` — untrusted-input validation (no raw values echoed)
- `lib/smart-setup/core/normalize.ts` — ANSWERED / NOT_SURE / UNANSWERED / HIDDEN classification
- `lib/smart-setup/core/capabilities.ts` — capability inference over the 15 certified keys
- `lib/smart-setup/core/ruleset.ts` — weights, thresholds, evidence table (each row cites the approval section), families, counter rules, hard-contradiction rules
- `lib/smart-setup/core/score.ts` — pack scoring and completeness (integer arithmetic)
- `lib/smart-setup/core/recommend.ts` — outcome resolution, cross-segment alternatives, fingerprints, `recommendSmartSetup`
- `lib/smart-setup/core/rationale.ts` — deterministic rationale codes
- `lib/smart-setup/core/proposal.ts` — proposal DATA via T1 `resolvePack` → `diffPackAgainstCompany` → `buildPackProposal`
- `lib/smart-setup/core/index.ts` — public surface
- `lib/smart-setup/legacy-prefill.ts` — pure prefill suggestion from legacy BusinessType / NichoId
- `scripts/wave1/test-smart-setup.mjs` — 50 tests
- `scripts/wave1/test-smart-setup-mutation.mjs` — 20 mutants
- `docs/wave1/ORCALY_SMART_SETUP_T2_IMPLEMENTATION_REPORT.md` — this report

## FILES MODIFIED
- `lib/wave1/manifest.ts` — adds `buildSmartSetupManifest()` (safe metadata only)
- `scripts/wave1/print-manifests.mjs` — prints the `smartSetup` section
- `package.json` — `test:wave1` now also runs `scripts/wave1/test-smart-setup.mjs` (one line; no dependency added)

Not touched: `app/**`, `components/**`, `supabase/**`, `vercel.json`, `lib/business-types.ts`, `lib/segment-modules.ts`, `lib/orcaly-nichos.ts`, `lib/plan-limits.ts`, `lib/orcaly-smart-notifications.ts`, automation-recipe runtime, integration runtime, Security B1, M0 reconciliation, and every T1 file under `lib/industry-packs/**`, `lib/automation-recipes/**`, `lib/wave1/shared/**`.

## QUESTIONNAIRE VERSION
`smart-setup.questionnaire.v1`

| Question | Role | Selection | Condition |
| --- | --- | --- | --- |
| `q.business_type` | PRIMARY_AUTHORITY | single | — |
| `q.subsegment` | PACK_EVIDENCE | single | supported declared business type (options per type, §3 Q2) |
| `q.offer_kind` | PACK_EVIDENCE | single | — |
| `q.sales_channels` | PACK_EVIDENCE + capability | multi | — |
| `q.quote_flow` | PACK_EVIDENCE + capability | single | — |
| `q.production` | PACK_EVIDENCE + capability | single | — |
| `q.art_approval` | PACK_EVIDENCE + capability | single | `business_type = GRAPHICS` or `production = CUSTOM_TO_ORDER` |
| `q.fulfillment` | PACK_EVIDENCE + capability | multi | — |
| `q.scheduling` | PACK_EVIDENCE + capability | single | hidden only when clearly irrelevant: `offer_kind = PRODUCTS`, `business_type ≠ SERVICES`, and fulfillment has neither `ON_SITE` nor `DIGITAL_OR_REMOTE` |
| `q.stock_control` | PACK_EVIDENCE + capability | single | — |
| `q.team_mode` | CAPABILITY_ONLY | single | — |
| `q.lead_followup` | PACK_EVIDENCE + capability | single | hidden when `business_type = FOOD` (§3 Q12 "neutral for Food") |

`q.deposit`, `q.main_goal`, `q.team_size`, `q.delivery` are not V1 questions: answers to them are ignored and reported as `REMOVED_QUESTION`.

## RULESET VERSION
`smart-setup.ruleset.v1.0.0`

## WEIGHTS
| Item | Value |
| --- | --- |
| BusinessType | **authority / eligibility gate — no numeric weight** (no `W_BT`) |
| Subsegment (known value, declared pack only) | +10 |
| Strong pack evidence | +6 |
| Weak pack evidence | +3 |
| Explicit contradiction (mapped rules only) | −8 |
| Goal alignment | 0 (`q.main_goal` absent) |
| `MAX_PACK_POINTS_PER_QUESTION` | 6 (subsegment exception: 10) |
| `q.team_mode` pack / completeness contribution | 0 / 0 |

Evidence table: `lib/smart-setup/core/ruleset.ts#EVIDENCE_RULES` — 50 rows, each citing its approval section. Multi-select per-pack contribution = the single strongest matching option (max, not sum), so many selections never inflate confidence.

## THRESHOLDS
`T_CLEAR = 0.70`, `T_MIN = 0.45`, `MARGIN = 0.15`, `MIN_COMPLETENESS = 0.40` — stored in basis points and compared with exact integer cross-multiplication (persona F1 sits exactly on 0.700 and resolves deterministically).

- `CONFIDENCE = max(0, RAW_SUPPORT − RAW_PENALTY) / MAX_AVAILABLE_SUPPORT`, clamped 0..1; the denominator is the same for every pack (sum of the maximum positive points of the answered, applicable, scored questions: 10 for subsegment, 6 otherwise). It is **not a probability** (confidences do not sum to 1).
- `COMPLETENESS = answered scored / presented scored`. Excluded: `q.business_type`, `q.team_mode`, hidden questions. `NOT_SURE` is presented but never counts as answered (identical to leaving the question unanswered).

## OUTCOME RULES (as implemented)
**Declared supported BusinessType** — primary is always the mapped pack.
- `CLEAR_MATCH` iff completeness ≥ 0.40, declared-pack confidence ≥ 0.70, no hard contradiction, declared pack available, and no cross-segment alternative signal.
- otherwise `BUSINESS_TYPE_ONLY` (low completeness, low confidence, mixed evidence, counter-signal, contradiction, or declared pack unavailable).
- `ALTERNATIVE_SIGNAL` (never primary): another pack with confidence ≥ 0.70 that exceeds the declared pack by ≥ 0.15, **or** (severe counter-signal rule) the declared pack received an explicit −8 counter-signal and the other pack has confidence ≥ 0.45 and exceeds the declared pack by ≥ 0.15.

**No authority (`NOT_SURE` / unanswered)**
1. hard contradiction → `NO_CLEAR_MATCH`
2. completeness < 0.40 → `NO_CLEAR_MATCH`
3. best < 0.45 → `NO_CLEAR_MATCH`
4. best ≥ 0.70 and best − second ≥ 0.15 → `CLEAR_MATCH`
5. ≥ 2 packs ≥ 0.45 → `AMBIGUOUS` (`primary = null`; `candidates` = every pack ≥ 0.45)
6. otherwise (single moderate candidate) → `NO_CLEAR_MATCH`

No tie is ever broken: candidate/score ordering (raw score desc, then canonical pack order) is display-only and never produces a primary.

## TECHNICAL ADAPTATIONS (registered as required by the mission §4)
| Id | What | Why | Status |
| --- | --- | --- | --- |
| **A1** | Evidence family `family.service_attendance`: `q.fulfillment=ON_SITE` + `q.scheduling` add at most one strong unit (6) to `services.general`. | With the literal evidence intentions persona **A1** is a mathematically clear Services match (0.714 vs 0.500, margin 0.214), contradicting its normative `AMBIGUOUS`. No symmetric reading of `BOTH`/`lead_followup` fixes it. The family applies the §7.1 anti-inflation principle across two questions that express one trait (§3 Q9 asks scheduling *because* on-site work is plausible). Result: A1 = 0.571 × 0.500 → AMBIGUOUS; the other 13 personas unchanged. | Chosen by the user among 3 options (2026-09-28). **Pending Agent 7 ratification.** |
| **A2** | `SIMPLE_STOCK` is **weak** Store evidence; `WAREHOUSE_OR_DEPOSIT` / `MULTI_LOCATION` are **strong** Store evidence. | "Stock structure strongly supports Store" is read as the structure options Q10 added. Literal reading makes persona **A2** a clear Store match (0.80 vs 0.60). The personas themselves encode this reading: Store personas use warehouse/multi-location; Food/Graphics/A2 use simple stock. | Documented reading; no product rule changed. |
| A3 | `q.scheduling` / `q.lead_followup` branching conditions (see table above). | The approval gives intent ("when plausible", "neutral for Food"), not an exact predicate. | Deterministic, tested. |
| A4 | `q.subsegment = OTHER` is an answered scored question with zero support (counts in completeness and the denominator); `NOT_SURE` does not count. | §3 Q2: "Known subsegments support the declared segment"; OTHER is not NOT_SURE. | Documented; see limitations. |
| A5 | Explicit counter rule: `q.offer_kind = SERVICES` → −8 for `store.local_store` (the only −8 mapping). | §14.1 B example (Store declared, services-only). No stereotype penalties (§14.2 cases are tested as zero). | Tested. |
| A6 | Hard contradiction rule: `q.fulfillment` includes `NONE_OR_NOT_APPLICABLE` together with a concrete mode. | §14.1 A example (`NO_STOCK` vs warehouse) cannot occur in V1 because `q.deposit` was absorbed into single-choice `q.stock_control`; this is the V1 structural equivalent. | Tested. |
| A7 | A declared type whose pack is missing from the catalog or marked unavailable by the caller stays `BUSINESS_TYPE_ONLY` with that pack as primary reference, `DECLARED_PACK_UNAVAILABLE`, and a `blockedOrUnavailable` entry; the proposal returns `PACK_UNAVAILABLE`. | Sovereignty: never switch segment; never invent a pack. | Tested. |
| A8 | A cross-segment `ALTERNATIVE_SIGNAL` blocks `CLEAR_MATCH` for the declared pack (→ `BUSINESS_TYPE_ONLY`). | §10.2 lists strong cross-segment counter-signals as a BUSINESS_TYPE_ONLY reason. | Tested. |
| A9 | Rationale lists every matched evidence code, including evidence absorbed by caps (counted points stay visible per signal). | Caps limit the score, not the explanation; persona S1's expected rationale names appointments. | Tested. |

## RESULT SHAPE
`SmartSetupRecommendation` (`types.ts`): `outcome`, `primaryPack | null`, `declaredBusinessType | null`, `candidates`, `packScores` (raw support/penalty/score, max available support, confidence as `{numerator, denominator, bps}`), `completeness`, `supportingSignals` (per pack/question/option, nominal and counted points), `counterSignals`, `hardContradictions`, `alternativeSignals`, `recommendedCapabilities` (with sources), `blockedOrUnavailable` (caller context), `rationaleCodes`, `rationale` (primary reason, supporting, counter, uncertainty, next choice), `inputIssues`, `questions`, `rulesetVersion`, `questionnaireVersion`, `catalogFingerprint`, `inputFingerprint`, `applied: false`, `applyStatus: 'NOT_AUTHORIZED'`.

Proposal: `buildSetupProposal()` → `PROPOSAL_READY` (T1 `PackProposal`, itself `notApplied: true`, `MIGRATION_REQUIRED_BLOCKED_BY_M0`) · `REFERENCE_ONLY_NO_COMPANY_SNAPSHOT` · `USER_CHOICE_REQUIRED` (AMBIGUOUS / NO_CLEAR_MATCH) · `PACK_UNAVAILABLE` · `INVALID_USER_SELECTION`. Always `requiresUserConfirmation: true`, `notApplied: true`, `applyStatus: 'NOT_AUTHORIZED'`. Manual choice (`userSelection`) is always possible, including against the declared type (explicit user action only).

## 14 PERSONA RESULTS
Confidence order: graphic / food / services / store.

| Persona | Outcome | Primary | Candidates | Alternative | Completeness | Confidence | Rationale codes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| G1 | CLEAR_MATCH ✅ | graphic.print_shop | — | — | 70.00% | 0.804 / 0.261 / 0.261 / 0.261 | DECLARED_BUSINESS_TYPE, SUBSEGMENT_MATCH, OFFER_PRODUCTS_AND_SERVICES, QUOTE_LED_OPERATION, CUSTOM_PRODUCTION, ART_APPROVAL, DELIVERY_OPERATION, PICKUP_OPERATION, STOCK_OPERATION |
| G2 | CLEAR_MATCH ✅ | graphic.print_shop | — | — | 70.00% | 0.804 / 0.261 / 0.522 / 0.261 | DECLARED_BUSINESS_TYPE, SUBSEGMENT_MATCH, OFFER_PRODUCTS_AND_SERVICES, QUOTE_LED_OPERATION, ART_APPROVAL, PRODUCTION_TRACKING, PICKUP_OPERATION, CRM_FOLLOWUP |
| F1 | CLEAR_MATCH ✅ | food.restaurant | — | — | 85.71% | 0.300 / **0.700** / 0.075 / 0.450 | DECLARED_BUSINESS_TYPE, SUBSEGMENT_MATCH, OFFER_PRODUCTS, FOOD_PREPARATION, DELIVERY_OPERATION, PICKUP_OPERATION, STOCK_OPERATION |
| F2 | CLEAR_MATCH ✅ | food.restaurant | — | — | 85.71% | 0.300 / 0.700 / 0.075 / 0.525 | DECLARED_BUSINESS_TYPE, SUBSEGMENT_MATCH, OFFER_PRODUCTS, FOOD_PREPARATION, DELIVERY_OPERATION, STOCK_OPERATION |
| S1 | CLEAR_MATCH ✅ | services.general | — | — | 66.66% | 0.225 / 0.000 / 0.775 / 0.000 | DECLARED_BUSINESS_TYPE, SUBSEGMENT_MATCH, OFFER_SERVICES, QUOTE_LED_OPERATION, ON_SITE_SERVICE, APPOINTMENT_LED_SERVICE, CRM_FOLLOWUP |
| S2 | CLEAR_MATCH ✅ | services.general | — | — | 77.77% | 0.196 / 0.000 / 0.739 / 0.000 | DECLARED_BUSINESS_TYPE, SUBSEGMENT_MATCH, OFFER_SERVICES, QUOTE_LED_OPERATION, REMOTE_SERVICE, APPOINTMENT_LED_SERVICE, CRM_FOLLOWUP |
| R1 | CLEAR_MATCH ✅ | store.local_store | — | — | 62.50% | 0.265 / 0.353 / 0.000 / 0.824 | DECLARED_BUSINESS_TYPE, SUBSEGMENT_MATCH, OFFER_PRODUCTS, PICKUP_OPERATION, DEPOSIT_OR_MULTI_LOCATION |
| R2 | CLEAR_MATCH ✅ | store.local_store | — | — | 62.50% | 0.265 / 0.353 / 0.000 / 1.000 | DECLARED_BUSINESS_TYPE, SUBSEGMENT_MATCH, OFFER_PRODUCTS, DELIVERY_OPERATION, PICKUP_OPERATION, CATALOG_SALES, DEPOSIT_OR_MULTI_LOCATION, MARKETPLACE_SALES |
| A1 | AMBIGUOUS ✅ | null | services.general, graphic.print_shop | — | 77.77% | 0.500 / 0.071 / 0.571 / 0.143 | OFFER_PRODUCTS_AND_SERVICES, QUOTE_LED_OPERATION, CUSTOM_PRODUCTION, ON_SITE_SERVICE, APPOINTMENT_LED_SERVICE, CRM_FOLLOWUP, CLOSE_CANDIDATES |
| A2 | AMBIGUOUS ✅ | null | store.local_store, food.restaurant | — | 71.42% | 0.400 / 0.600 / 0.100 / 0.700 | OFFER_PRODUCTS, FOOD_PREPARATION, DELIVERY_OPERATION, PICKUP_OPERATION, CATALOG_SALES, STOCK_OPERATION, CLOSE_CANDIDATES |
| N1 | NO_CLEAR_MATCH ✅ | null | — | — | 100.00% | 0.063 / 0.063 / 0.063 / 0.063 | WEAK_EVIDENCE |
| N2 | NO_CLEAR_MATCH ✅ | null | — | — | 12.50% | 0 / 0 / 0 / 0 | INSUFFICIENT_COMPLETENESS |
| B1 | BUSINESS_TYPE_ONLY ✅ | services.general | — | — | 0.00% | 0 / 0 / 0 / 0 | DECLARED_BUSINESS_TYPE, INSUFFICIENT_COMPLETENESS, WEAK_EVIDENCE |
| C1 | BUSINESS_TYPE_ONLY ✅ | store.local_store | — | services.general (SEVERE_COUNTER_SIGNAL) | 88.88% | 0.231 / 0.000 / 0.462 / 0.096 | DECLARED_BUSINESS_TYPE, SUBSEGMENT_MATCH, CRM_FOLLOWUP, WEAK_EVIDENCE, CROSS_SEGMENT_SIGNAL, COUNTER_SIGNAL_EXPLICIT |

All 14 match the normative expected outcome and primary. The exact confidences are frozen by the "persona score snapshot" test.

## DETERMINISM TESTS
- Same input + same catalog → byte-equivalent canonical output (`stableStringify`) for all personas.
- Input key order and multi-select order shuffled 10× per persona → identical output.
- Catalog shuffled **100×** (seeded LCG in the test only) → identical output and catalog fingerprint for all 14 personas.
- Fingerprints: SHA-256 via injected `HashFn`; input fingerprint covers only effective normalized answers + versions (ignored/hidden answers do not change it).
- Exact tie (Food = Store = 0.75) → `AMBIGUOUS`, `primary = null`, with the catalog in either order.

Other required tests (all PASS): invalid option dropped/reported · unknown question dropped/reported · removed questions (`q.main_goal`, `q.deposit`, …) zero impact · free text / PII-shaped fields zero score impact and never copied into the result · NOT_SURE zero score and zero answered evidence · hidden question zero completeness penalty · multi-select per-question cap · BusinessType authority never overridden · AMBIGUOUS/NO_CLEAR_MATCH primary null · BUSINESS_TYPE_ONLY declared pack primary · cross-segment alternative never automatic primary · no pack apply · static purity scan (no fetch, Supabase, env, clock, randomness, crypto, node imports, app/components imports, AI providers, apply calls).

## TEST TOTALS
| Suite | Result |
| --- | --- |
| T2 `scripts/wave1/test-smart-setup.mjs` | **50/50 PASS** |
| T2 mutation `scripts/wave1/test-smart-setup-mutation.mjs` | **20/20 mutants killed** (authority-as-score, primary replaced, ambiguity auto-picked, T_CLEAR 0.69, completeness 0.30, strict margin, cap removed, A1/A2 undone, NOT_SURE counted, hidden counted, team_mode scored, stereotype −8, hard contradiction ignored, alternatives suppressed, invalid option accepted, input-order leak, free-text echo, lead_followup for Food, clamp removed) |
| `npm run test:wave1` (T1 + T2) | **127/127 PASS** |

## T1 REGRESSION
T1 suites (`test-shared`, `test-industry-packs`, `test-automation-recipes`): **77/77 PASS** — same as the certified baseline. No T1 file changed.

## TYPECHECK
- Project-equivalent flags (`strict`, `isolatedModules`, `moduleResolution: bundler`, path alias) over `lib/smart-setup/**`, `lib/wave1/manifest.ts` and their whole import graph: **0 errors** (TypeScript 6.0.3).
- Extra-strict (`noUnusedLocals`, `noUnusedParameters`) on T2 files: **0 errors** (the only hit is pre-existing, in untouched `lib/segment-modules.ts`, and the project config does not enable that flag).
- `npm test` (repository gate): **PASS**.

## LINT
**NOT_RUN** — ESLint is not installed and the npm registry is not reachable from this environment (`node_modules` absent). The code follows the existing T1 style; run `npx eslint lib/smart-setup scripts/wave1/test-smart-setup*.mjs` in CI or locally.

## BUILD
**PASS** — Vercel Preview (`next build`, full project typecheck; the repository has no `ignoreBuildErrors`) of `a2e22100b00104df824cbab41450a1e44641a82a`: deployment `dpl_GDk2wEnaxtNAhsHTT98BDuVi3VNy`, state **READY**, target **preview** (not production). This docs-only follow-up commit triggers one more Preview of identical code.

## COVERAGE
`node --test --experimental-test-coverage --test-coverage-include='lib/smart-setup/**'`:

| File | Lines | Branches | Functions |
| --- | --- | --- | --- |
| capabilities.ts | 100% | 92.31% | 100% |
| normalize.ts | 100% | 100% | 100% |
| proposal.ts | 100% | 100% | 100% |
| questionnaire.ts | 100% | 100% | 100% |
| rationale.ts | 100% | 90.20% | 100% |
| recommend.ts | 100% | 93.98% | 100% |
| ruleset.ts | 100% | 100% | 100% |
| score.ts | 100% | 100% | 100% |
| validate-answers.ts | 100% | 98.08% | 100% |
| legacy-prefill.ts | 100% | 100% | 100% |
| **All files** | **100%** | **96.29%** | **100%** |

Goal (≥ 90% branches) met for every file.

## MANIFEST
`buildSmartSetupManifest()` (printed by `scripts/wave1/print-manifests.mjs` under `smartSetup`): `questionnaireVersion`, `rulesetVersion`, `supportedPacks`, question ids/roles (no options text, no answers), `weights`, `thresholds`, `outcomes`, `businessTypeRole: AUTHORITY_ELIGIBILITY_GATE`, `adaptations`, `runtimeStatus: PURE_RECOMMENDATION_ONLY`, `applyStatus: NOT_AUTHORIZED`. No user answer, fingerprint or company id.

## KNOWN LIMITATIONS
1. **A1 adaptation awaits Agent 7 ratification.** If Agent 7 prefers another resolution, only `EVIDENCE_FAMILIES` (and the snapshot/mutant expectations) change.
2. `q.subsegment = OTHER` adds 10 points to the denominator with zero support, which lowers confidence more than `NOT_SURE` does (literal reading of §7.2). Product may want OTHER treated like NOT_SURE.
3. `cap.menu_daily_orders` is not inferable from any V1 answer; it only appears via the Food primary pack.
4. Hard contradictions: V1 has one structural rule (fulfillment none + modes). The §14.1 example cannot occur in V1.
5. Confidence is "share of answered evidence", not a probability; UI copy must follow §7.2.
6. Wave 1 has one pack per type, so subsegments are evidence only (no sub-pack selection).

## SECURITY NOTES
- No PII in the contract: no name, email, phone, CPF/CNPJ, address, customer data or free-text description. Unknown fields are dropped; issues carry only the question id (and only when it is a well-formed `q.*` key), never the raw value. A test injects name/email/phone/CPF/address/free text and asserts none appear anywhere in the serialized result.
- Free text is never scored: a free-text value in a controlled field is an `INVALID_OPTION` and is ignored.
- Bounded input: at most 64 fields processed per multi-select; `TOO_MANY_FIELDS` reported.
- No I/O, no env, no clock, no randomness, no provider/AI, no `node:crypto` in the core (hash injected; `sha256.server.ts` is only used by tests/callers). Enforced by a static scan test.
- Nothing is applied or persisted: `applied: false`, `applyStatus: 'NOT_AUTHORIZED'` on every result and proposal; T1 proposal keeps `MIGRATION_REQUIRED_BLOCKED_BY_M0`.

## MIGRATION DEPENDENCIES
None for T2. Future runtime needs (not authorized here): persisted onboarding answers (with consent/retention policy), audit of accepted proposals, and M0 reconciliation before any pack apply (`MIGRATION_REQUIRED_BLOCKED_BY_M0` from T1).

## UI DEPENDENCIES
None implemented. A future UI must: render questions from `QUESTIONNAIRE_V1` + `isApplicable`; always offer `NOT_SURE`; never call confidence a probability; show AMBIGUOUS candidates with per-pack reasons (`supportingSignals` grouped by pack) and let the user choose or continue without a pack; show `ALTERNATIVE_SIGNAL` as a labeled, explained alternative that requires explicit change; always allow manual choice (`buildSetupProposal({ userSelection })`); never auto-apply.

## FINAL STATUS
**SMART_SETUP_T2_COMPLETE**
**READY_FOR_AGENT3_QA**
