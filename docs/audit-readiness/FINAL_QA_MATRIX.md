# Final QA Matrix

Audit snapshot: 2026-09-27
Base SHA: 9a2c66dbb2e6bf00c484b1791103b2bccd15becd

## Status vocabulary

PASS / PARTIAL / NOT_TESTED / NOT_APPLICABLE / BLOCKED_EXTERNAL / UNKNOWN

PASS is used only where this audit found concrete executable or recorded evidence. A product being marked available in the registry is not QA evidence.

## Evidence anchors

- docs/qa/ORCALY_QA_MATRIX.md
- docs/qa/ORCALY_SECURITY_TESTS.md
- docs/qa/ORCALY_EVIDENCE.json
- Wealth unit-specific QA docs already in the base tree
- exact Vercel deployment metadata for SHA 9a2c66d...
- Agent 1 post-certification handoff that identifies the same exact 9a2c66d runtime for Morning/Night
- read-only Supabase staging/production schema and Advisor state
- package.json test scripts/workflows

Important:
Agent 1 evidence created after the audit branch was frozen can certify the same immutable runtime SHA, but it does not make later Agent 1 feature commits part of this matrix.

## Product state

| Product | Product/feature state | Evidence |
| --- | --- | --- |
| Mother / Hub | PARTIAL | ecosystem product registry + local/browser evidence; global release not certified |
| Business | PARTIAL | broad active runtime; full live customer→order→finance journey not certified |
| Wealth | PARTIAL | many units certified in staging/Preview through Morning/Night at base SHA; roadmap continues |
| Growth | NOT_TESTED | registry says planned; no product backend runtime found |
| Flow | NOT_TESTED | registry says planned; no product backend runtime found |
| Academy | NOT_TESTED | registry says planned; no product backend runtime found |
| Market | NOT_TESTED | registry says planned; existing Business marketplace is not Orçaly Market product |
| Partners | PARTIAL | existing portal/runtime and workflow exist; no complete current final matrix collected here |
| One | NOT_TESTED | registry says planned |
| Intelligence | PARTIAL | preexisting Business assistant only; shared Intelligence explicitly incomplete |

## Identity / authorization matrix

| PRODUCT | FEATURE | AUTH | RLS | OWNER | TENANT | ENTITLEMENT | CONSENT |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Mother / Hub | PARTIAL | PARTIAL | PARTIAL | NOT_APPLICABLE | PARTIAL | PASS | PARTIAL |
| Business | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | NOT_APPLICABLE |
| Wealth | PARTIAL | PASS | PASS | PASS | PASS | PASS | PASS |
| Growth | NOT_TESTED | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | PARTIAL | NOT_APPLICABLE |
| Flow | NOT_TESTED | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | PARTIAL | NOT_APPLICABLE |
| Academy | NOT_TESTED | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | PARTIAL | NOT_APPLICABLE |
| Market | NOT_TESTED | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | PARTIAL | NOT_APPLICABLE |
| Partners | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | PARTIAL | NOT_APPLICABLE |
| One | NOT_TESTED | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | PARTIAL | NOT_APPLICABLE |
| Intelligence | PARTIAL | PARTIAL | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN |

### Why Wealth access dimensions are PASS

For the certified Wealth units through Morning/Night at the exact base runtime, recorded QA covers:
- real hosted staging auth;
- anonymous redirect;
- RLS/owner/cross-user;
- unentitled denial;
- exact product entitlement;
- consent boundaries in the ecosystem foundation;
- cleanup of QA identities/data after hosted runs.

This PASS applies to the certified runtime units, not to future Alerts/Ask Wealth/Market/Open Finance/Regulatory features that were not part of the base SHA.

### Why Business is not PASS

RLS is enabled, company access exists and multiple scoped tests exist. However docs/qa/ORCALY_QA_MATRIX.md explicitly records Business customer→order→finance as not started as a live journey. Final tenant/nested-resource coverage is therefore PARTIAL, not PASS.

## UX / accessibility matrix

| PRODUCT | MOBILE | DESKTOP | LIGHT | DARK | A11Y | KEYBOARD | REDUCED_MOTION | ERROR | EMPTY | LOADING |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Mother / Hub | PASS | PASS | PARTIAL | PARTIAL | PASS | PARTIAL | PASS | PARTIAL | PARTIAL | PARTIAL |
| Business | PARTIAL | PARTIAL | UNKNOWN | UNKNOWN | PARTIAL | NOT_TESTED | NOT_TESTED | PARTIAL | PARTIAL | PARTIAL |
| Wealth | PASS | PASS | PASS | PASS | PASS | PASS | PASS | PARTIAL | PARTIAL | PARTIAL |
| Growth | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE |
| Flow | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE |
| Academy | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE |
| Market | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE |
| Partners | PARTIAL | PARTIAL | UNKNOWN | UNKNOWN | PARTIAL | NOT_TESTED | NOT_TESTED | PARTIAL | PARTIAL | PARTIAL |
| One | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE |
| Intelligence | PARTIAL | PARTIAL | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | PARTIAL | PARTIAL | PARTIAL |

### UX evidence notes

Mother/Hub:
- existing ecosystem browser evidence covers 320/390/768/1440/1920 and axe on public Home;
- PWA master manifest exists;
- full product-specific PWA/accessibility remains open.

Wealth:
- exact Morning/Night runtime evidence records 320/390/768/1024/1440/1920, light/dark, Axe, keyboard/focus, reduced motion and no overflow.
- earlier certified units carry similar rolling V8 evidence.
- manual full screen-reader audit is still a global gate, so PASS here means automated a11y/keyboard evidence for certified Wealth flows, not total accessibility certification.

Business/Partners:
- existing workflows and UI tests exist but a fresh integrated final matrix was not collected by Agent 4; conservative PARTIAL/NOT_TESTED is intentional.

## Runtime / release matrix

| PRODUCT | E2E | HOSTED | PRODUCTION_DIFF | CLEANUP | OBSERVABILITY |
| --- | --- | --- | --- | --- | --- |
| Mother / Hub | PASS | PARTIAL | PARTIAL | PARTIAL | PARTIAL |
| Business | PARTIAL | PARTIAL | PARTIAL | NOT_TESTED | PARTIAL |
| Wealth | PASS | PASS | PARTIAL | PASS | PARTIAL |
| Growth | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE |
| Flow | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE |
| Academy | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE |
| Market | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE |
| Partners | PARTIAL | PARTIAL | UNKNOWN | NOT_TESTED | PARTIAL |
| One | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE | NOT_APPLICABLE |
| Intelligence | PARTIAL | PARTIAL | UNKNOWN | NOT_TESTED | PARTIAL |

### Production difference

Wealth:
- staging has 25 migrations through Morning/Night at audit snapshot;
- production does not contain Wealth migrations/functions;
- no production promotion was performed.

Integrations:
- production contains foundation + Google Calendar;
- repository contains later Resend/public-API/integration migrations;
- staging baseline is focused on Wealth and does not mirror production feature-flag seed state.

Therefore production-diff is a first-class QA dimension, not a checkbox to dismiss.

## Feature-level critical matrix

| Product | Feature | AUTH | RLS/TENANT | E2E | HOSTED | OBSERVABILITY | Result |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Business | products/catalog | PARTIAL | PARTIAL | NOT_TESTED | NOT_TESTED | PARTIAL | NEEDS_TEST |
| Business | orders/order_items | PARTIAL | PARTIAL | PARTIAL | NOT_TESTED | PARTIAL | NEEDS_TEST |
| Business | checkout | NOT_APPLICABLE public | tenant binding PARTIAL | PARTIAL | NOT_TESTED | PARTIAL | NEEDS_TEST |
| Business | delivery | PARTIAL | PARTIAL | NOT_TESTED | NOT_TESTED | PARTIAL | NEEDS_TEST |
| Business | finance | PARTIAL | PARTIAL | NOT_TESTED | NOT_TESTED | PARTIAL | NEEDS_TEST |
| Business | marketplace/payments | PARTIAL | PARTIAL | PARTIAL | BLOCKED_EXTERNAL | PARTIAL | BLOCKED_EXTERNAL |
| Business | company settings | PARTIAL | PARTIAL | PARTIAL | NOT_TESTED | PARTIAL | NEEDS_HARDENING |
| Business | reports | PARTIAL | PARTIAL | NOT_TESTED | NOT_TESTED | PARTIAL | NEEDS_TEST |
| Business | integrations hub | PARTIAL | PARTIAL | PARTIAL | BLOCKED_EXTERNAL | PARTIAL | PARTIAL |
| Wealth | identity/entitlement/consent | PASS | PASS | PASS | PASS | PARTIAL | PASS |
| Wealth | core financial foundation | PASS | PASS | PASS | PASS | PARTIAL | PASS |
| Wealth | Calendar | PASS | PASS | PASS | PASS | PARTIAL | PASS |
| Wealth | Planning | PASS | PASS | PASS | PASS | PARTIAL | PASS |
| Wealth | Documents/Vault | PASS | PASS | PASS | PASS | PARTIAL | PASS for base certified scope |
| Wealth | Timeline | PASS | PASS | PASS | PASS | PARTIAL | PASS |
| Wealth | Family | PASS | PASS | PASS | PASS | PARTIAL | PASS |
| Wealth | Automation | PASS | PASS | PASS | PASS | PARTIAL | PASS |
| Wealth | Fees | PASS | PASS | PASS | PASS | PARTIAL | PASS |
| Wealth | Shield | PASS | PASS | PASS | PASS | PARTIAL | PASS |
| Wealth | Tax Center | PASS | PASS | PASS | PASS | PARTIAL | PASS |
| Wealth | Morning/Night | PASS | PASS | PASS | PASS | PARTIAL | PASS |
| Wealth | Alerts | NOT_TESTED at base | NOT_TESTED at base | NOT_TESTED at base | NOT_TESTED at base | NOT_TESTED | not part of frozen base |
| Wealth | Ask Wealth | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | future |
| Wealth | Portfolio Intelligence | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | future |
| Wealth | Market/Radar | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | future |
| Wealth | Open Finance | BLOCKED_EXTERNAL | NOT_TESTED | NOT_TESTED | BLOCKED_EXTERNAL | NOT_TESTED | future |
| Wealth | Regulatory Mode | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | NOT_TESTED | future |

The Wealth PASS rows represent the evidence already produced by Agent 1 for each certified unit and the rolling V8 chain. They do not authorize production promotion.

## Required final integrated QA

After parallel branch integration, execute one final matrix on the candidate SHA:

### Global
- exact SHA build
- global lint
- typecheck
- unit/invariant tests
- dependency/security scan
- Supabase Advisors
- migration reconciliation
- Preview exact-SHA check
- runtime error check

### Auth / authorization
- anonymous
- normal authenticated user
- owner
- manager
- production/operator role
- platform admin roles
- unentitled user
- cross-company attacker
- cross-user Wealth attacker
- MFA enrollment/challenge/step-up

### UI
- 320 / 390 / 768 / 1024 / 1440 / 1920
- light / dark where supported
- keyboard-only
- focus visibility/order
- reduced motion
- axe automated checks
- manual screen-reader sample for critical journeys
- error / empty / loading / retry

### Business E2E
public storefront → checkout → order → order items → delivery → payment/finance → reports, plus tenant denial and duplicate/retry paths.

### Wealth rolling gate
rerun all certified Wealth modules on the merged candidate and confirm no production requests.

### Cleanup
verify test users/sessions, Storage objects, background jobs, outbox events and product-specific fixtures are removed or intentionally retained.

## Final QA verdict

The system is not globally PASS at this snapshot. The evidence is strongest for the certified Wealth units and ecosystem foundation, weaker for integrated Business end-to-end coverage, and intentionally absent for planned products.
