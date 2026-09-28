# Orçaly — Final Visual QA Report

## Identification

- Branch: `gpt/orcaly-frontend-architecture`
- Original base: `claude/orcaly-academy-mvp`
- Base SHA: `925d1b89740f5c765333c9cb17fe2312972566fa`
- Certified implementation SHA before this report: `932673491b179c6ef5ccb25548da4ad17976bf2f`
- Previously certified implementation build: `2650d8cb02ad813c986c17cafbb83bb7cd422d90`
- Current certified deployment: `dpl_6WXS2nerUdFt9JT8sZ7qwm3gxtLq`
- Current certified Preview: `https://orcaly-iuecktbqe-vinicius-araujos-projects.vercel.app`
- Deployment state: **READY**
- Production: **not touched**

## Final status

**IMPLEMENTATION_DONE**  
**HOSTED_BUILD_VALIDATED**  
**VISUAL_CERTIFICATION_PARTIAL**

Recommendation: **REQUIRES_FOLLOW_UP**.

Reason for PARTIAL: the exact repository Node/Playwright harness and Axe could not be executed in the available agent runtime. A source-faithful Chromium render harness was executed instead and passed the full responsive/light-dark matrix after verified fixes. Axe remains `NOT_RUN`, never PASS.

There is no known blocking frontend defect after the executed QA. The remaining follow-up is certification infrastructure, not a known product bug.

---

## Executed build evidence

### Vercel Preview

Deployment `dpl_6WXS2nerUdFt9JT8sZ7qwm3gxtLq` for SHA `932673491b179c6ef5ccb25548da4ad17976bf2f` reached **READY**.

The project build command is `npm run build`. Its existing npm `prebuild` lifecycle runs:

- `npm test`
- `verify:payments`
- focused ESLint commands
- then `next build`

Therefore, for the certified implementation SHA:

- `npm test`: **PASS** through Vercel build lifecycle
- `verify:payments`: **PASS** through Vercel build lifecycle
- focused prebuild lint: **PASS**
- `next build`: **PASS**
- Next.js TypeScript build gate: **PASS**

The repository `next.config.ts` does not suppress TypeScript build errors.

Standalone commands not independently executed:

- `npm run typecheck`: **NOT_RUN**
- full `npm run lint`: **NOT_RUN**

---

## Frontend contract audit

A connector-side deterministic source audit was rerun on the final implementation SHA.

Result: **73 / 73 PASS**.

Covered:

- required viewport constants;
- all 18 page archetypes;
- required state vocabulary;
- scoped CSS and absence of new global `:root`;
- reduced-motion contracts;
- mobile safe-area handling;
- skin accent derivation;
- 44px navigation target corrections;
- 320px Flow wrapping correction;
- Partners pipeline bleed removal;
- all required preview identifiers;
- deterministic demo content;
- skip navigation;
- mobile navigation;
- breadcrumbs;
- table caption and header scope;
- form ARIA relationships.

The dedicated repository script `scripts/test-orcaly-frontend-contracts.mjs` itself was **NOT_RUN** because a full checkout with the repository runtime was unavailable in the local agent environment.

---

## Visual QA method

The repository's exact Node harness requires injected packages:

- `ORCALY_QA_ESBUILD`
- `ORCALY_QA_PLAYWRIGHT`
- `ORCALY_QA_NODE_PATH`
- optional `ORCALY_QA_AXE`

Those packages were not available to the agent and external DNS was unavailable for installing/cloning them.

The environment did provide Chromium plus Python Playwright. A source-faithful static render harness was therefore created outside the repository, using:

- the actual Design System CSS;
- the actual Shell CSS;
- the actual Frontend Preview CSS;
- the same semantic shell and representative preview markup;
- actual product skin accent/surface contracts;
- Chromium rendering.

This alternative harness is valid evidence for CSS/layout/responsive/visual behavior, but it is **not equivalent** to executing the repository's TSX bundle. That distinction is why overall certification remains PARTIAL.

---

## Responsive matrix

Rendered widths:

| Width | Light | Dark |
| ---: | :---: | :---: |
| 320 | PASS | PASS |
| 390 | PASS | PASS |
| 768 | PASS | PASS |
| 1024 | PASS | PASS |
| 1440 | PASS | PASS |
| 1920 | PASS | PASS |

Rendered representative surfaces:

- Business dashboard
- Business list
- Detail
- Growth analytics
- Wealth overview
- Academy reader
- Flow canvas
- Market discovery
- Partners performance
- Settings
- Command surface
- Empty state
- Error state
- Editor

Total render contexts: **168**  
Automated render checks after final fixes: **874 PASS / 0 FAIL**.

Checks included:

- horizontal overflow;
- runtime/page errors in the harness;
- landmark count;
- h1 hierarchy;
- labelled navigation;
- form labels;
- internal 44px target baseline;
- focus-visible presence;
- reduced-motion behavior;
- launcher containment;
- mobile table summary transformation;
- approximate 200% zoom/reflow check.

### 320px reflow

Final result: **PASS** for all rendered surfaces after the Flow and Partners fixes.

The 200% zoom check was an approximation using browser/CSS zoom rather than an OS/browser user zoom preference, so it is evidence but not a full assistive-technology certification.

---

## Light / dark

Light matrix: **PASS** in the alternative render harness.  
Dark matrix: **PASS** in the alternative render harness.

A verified skin-token defect was found during QA: the new Design System did not consume `--ox-skin-accent-text` and `--ox-skin-accent-surface` in light mode, diverging from the certified Foundation contract.

Fix: the Design System now derives light accent text/surface from the skin variables and continues to recompute dark-mode accent text/surface from the product accent.

---

## Contrast

A computed-color audit was executed over leaf text samples at:

- 390px light/dark
- 1440px light/dark
- all 14 representative surfaces

Samples checked: **3,502**  
Failures after final token fix: **0**.

The checker applied WCAG-style 4.5:1 normal text / 3:1 large text thresholds against the nearest non-transparent rendered background.

This is strong contrast evidence, but it is not Axe.

---

## Accessibility

### PASS / verified in alternative harness or source contract

- one `main` landmark per rendered surface;
- one page `h1` per rendered surface;
- labelled navigation landmarks;
- visible skip link behavior;
- persistent form labels;
- table captions;
- scoped table headers;
- mobile table labels;
- `aria-describedby` and `aria-invalid` contract in shared fields;
- visible focus ring;
- reduced-motion override;
- 44px internal navigation/control target baseline after fixes;
- light/dark contrast sample audit;
- semantic empty/error distinction;
- color not used as the only status signal;
- exact values accompany chart visuals.

### Axe

**NOT_RUN**

Reason: `axe-core` / `@axe-core/playwright` was not available in the executable local environment and external package installation was unavailable.

No Axe result is represented as PASS.

### Still requiring exact-environment verification

- screen-reader traversal with the actual React preview;
- final focus restoration for future interactive modal/drawer implementations;
- physical iOS safe-area behavior;
- real browser text-size accessibility settings;
- exact TSX bundle semantics under the official harness.

---

## Screenshot evidence

Final QA captured **115 PNG screenshots**.

Human review covered representative mobile, desktop and dark contact sheets plus individual Flow/Partners cases used to diagnose overflow.

Visual review result: **PASS with no blocking visual defect**.

Observed product differentiation remains structural:

- Business: dense operating brief/table/activity;
- Growth: experiment comparison;
- Wealth: calm financial hierarchy;
- Academy: editorial reader;
- Flow: technical node canvas;
- Market: problem-first discovery;
- Partners: pipeline;
- Settings: form/state composition;
- Command: floating command surface.

No blocking evidence of:

- universal card grids;
- glassmorphism;
- generic decorative gradients;
- product identity reduced only to color;
- desktop layout merely compressed into mobile;
- hidden primary actions;
- unreadable dark mode;
- inconsistent hierarchy.

Non-blocking observation: short desktop demo surfaces naturally leave unused vertical space. This is sample-data length, not a layout failure.

Session-local evidence files:

- `qa-results.json`
- `contrast-results.json`
- `screenshots/*.png`
- `final-mobile-light-contact.png`
- `final-desktop-light-contact.png`
- `final-dark-contact.png`

These artifacts were generated outside the repository and were not committed.

---

## Defects found and fixed

### 1. Header brand target below internal 44px baseline

Evidence:
- rendered height: 32px.

Fix:
- `.brand` now has `min-height:44px`, flex alignment.

Status: **FIXED / RETEST PASS**.

### 2. Academy Reader TOC links at 40px

Evidence:
- rendered link height: 40px across widths.

Fix:
- Reader aside links now `min-height:44px`.

Status: **FIXED / RETEST PASS**.

### 3. Editor outline links at 40px

Evidence:
- rendered link height: 40px.

Fix:
- Editor aside links now `min-height:44px`.

Status: **FIXED / RETEST PASS**.

### 4. Flow toolbar overflow at 320px

Evidence:
- document width 338px at 320px viewport;
- toolbar scroll width 326px inside 296px content width.

Fix:
- mobile `.workflowToolbar` now wraps.

Status: **FIXED / RETEST PASS**.

### 5. Partners pipeline 2px page overflow at 320px

Evidence:
- document width 322px at 320px viewport;
- negative right margin caused edge bleed outside the page.

Fix:
- mobile negative right margin removed.

Status: **FIXED / RETEST PASS**.

### 6. New Design System omitted light skin accent derivation

Evidence:
- `skinStyle` supplies `--ox-skin-accent-text` / `--ox-skin-accent-surface`;
- certified Foundation consumes those variables;
- new Design System originally left `--ox-accent-text` / `--ox-accent-surface` on Business defaults in light mode.

Fix:
- light Design System variables now derive from skin variables;
- dark mode continues to derive accessible accents from `--ox-accent`.

Status: **FIXED / RETEST PASS**.

---

## Regression coverage

### PASS through hosted build lifecycle

- npm test
- verify:payments
- focused lint
- Next build
- TypeScript build gate

### Additional Agent 5 audit

- frontend source contracts: **73/73 PASS**
- responsive alternative Chromium matrix: **874/874 PASS**
- contrast sample audit: **3,502/3,502 PASS**

### Dedicated suites not independently executed

- `scripts/test-orcaly-frontend-contracts.mjs`: **NOT_RUN**
- Growth domain dedicated command: **NOT_RUN**
- Growth visual official harness: **NOT_RUN**
- Academy domain dedicated command: **NOT_RUN**
- Academy mutation dedicated command: **NOT_RUN**
- Academy visual official harness: **NOT_RUN**
- Registry dedicated command: **NOT_RUN**
- Axe: **NOT_RUN**

The successful hosted `npm test` still provides broad ecosystem regression coverage, but it is not represented as a substitute for the dedicated commands above.

---

## Scope audit

Final diff remains inside the approved architecture/design/test namespaces:

- `components/orcaly-next/**`
- `lib/orcaly-next/**`
- `docs/design/**`
- `scripts/test-orcaly-frontend-*.mjs`

No changes were made to:

- `supabase/**`
- runtime APIs
- migrations
- pricing
- billing
- providers
- production infrastructure
- main branch
- production deployment

Dependencies added: **NONE**  
Migrations: **NONE**  
Database changes: **NONE**  
Production changes: **NONE**

---

## Known limitations

1. Exact repository Node/Playwright visual harness was not executable.
2. Axe was not executable.
3. The alternative Chromium render harness mirrors the source CSS/semantics but does not bundle the React TSX.
4. Physical-device safe-area behavior was not tested.
5. Browser/OS accessibility text-size settings were not tested directly.
6. Dedicated Growth/Academy/Registry commands were not separately executed.

---

## Freeze decision

A full `DONE / FROZEN` certification is **not issued** because Axe and the official visual harness remain `NOT_RUN`.

The implementation itself is stable, build-valid and has no known blocking visual defect. Do not add new frontend work on this branch while certification follow-up is pending.

Required final follow-up unit:

1. run `scripts/test-orcaly-frontend-visual.mjs` with the injected Node QA packages;
2. run Axe in that harness;
3. run the dedicated Growth/Academy/Registry commands if full suite certification is required;
4. inspect official harness screenshots;
5. if green, change final status to `DONE / FROZEN` without adding features.
