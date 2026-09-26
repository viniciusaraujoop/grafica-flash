# QA matrix

Evidence timestamp: 2026-09-26 UTC. The entire ecosystem release is not certified.

| Layer / journey | Result | Evidence |
| --- | --- | --- |
| Existing unit/invariant verification | PASS | `npm test`: existing foundation, auth, partner, admin, storefront, marketing, permissions, MFA, integration, timezone, calendar/email suites retained |
| Shared contracts + Wealth arithmetic | PASS | `npm run test:ecosystem`: product identity/assets, expiry, tenant/user boundary, permission denial, exact consent scope/purpose, revoked grants, money/date validation, deterministic scenarios |
| New migration + real RLS | PASS locally | Same command runs PGlite SQL tests with synthetic Company A/B, Owner A/B and unentitled member; grants, read/write/owner reassignment denial, expiry retention, idempotency, consent revocation, audit privacy |
| TypeScript | PASS after stale type regeneration | `npm run typecheck`; initial generated `.next/dev/types` referenced removed routes |
| Production build | PASS | `npm run build`; repeated after dependency/UX updates before final checkpoint |
| Scoped lint | PASS | New apps/products/Wealth/ecosystem components and libraries; no suppressed rules |
| Global lint | Preexisting failures | Initial 258 errors/129 warnings; final count recorded in execution state |
| Public navigation / pricing | PASS local browser | Home → product; preserved `/business` pricing; login redirect; invalid Life/product route |
| Responsive / reduced motion | PASS local browser | 320, 390, 768, 1440, 1920 widths; no horizontal overflow; original images loaded and captured |
| App Hub | PASS with test protocol fixture | Verified user → Hub; home redirect; unauthorized Wealth has no editing form |
| Wealth critical journey | PASS with test protocol fixture + PostgreSQL | Profile → budget → entry → goal → scenario → reload; persisted integer cents inspected; B cannot see A |
| Accessibility | Automated checks in E2E | axe WCAG A/AA scans of Home and Wealth; see browser report for current result; manual full screen-reader review remains open |
| Hosted Supabase Auth/RLS | BLOCKED_EXTERNAL | No isolated hosted staging branch/project confirmed; protocol fixture does not certify real hosted Auth |
| Business customer→order→finance | NOT_STARTED as a live journey | Existing invariant tests preserved; no customer/order production mutations |
| Academy / affiliate / Flow / Growth / Market / Partners new journeys | NOT_STARTED | No new feature backend exists for those workstreams |
| Product-specific PWA/push/offline | NOT_STARTED | Master Hub manifest/install affordance only; individual products gated |
| Dependency audit | PASS after compatible fixes | `npm audit`: zero reported vulnerabilities; no force/major upgrade |
| Preview / production | Preview PASS / production unchanged | Vercel c3f367b READY; 7 read-only hosted browser checks pass. No hosted migration or production promotion. |

Run local browser QA with `npm run build`, then `npm start -- --hostname 127.0.0.1 --port 4173` and `npm run e2e:ecosystem`. Chrome must be available; set `ECOSYSTEM_BROWSER_CHANNEL` for another installed Playwright-supported browser. Fixtures bind only to 127.0.0.1:54329 and the test Next server to 4174, use synthetic users and an in-memory database, and shut down after the test. No real credentials are required for those fixture flows.
