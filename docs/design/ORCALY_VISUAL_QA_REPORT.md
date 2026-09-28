# Orçaly — Visual QA Report

Branch: `gpt/orcaly-frontend-architecture`  
Base: `claude/orcaly-academy-mvp` @ `925d1b89740f5c765333c9cb17fe2312972566fa`

## Status

Overall visual certification: **PARTIAL**.

The implementation and build gates that were actually executed are recorded below. The isolated Playwright visual harness and Axe suite were not executable in the current agent environment because the required injected Node packages (`ORCALY_QA_ESBUILD`, `ORCALY_QA_PLAYWRIGHT`, `ORCALY_QA_NODE_PATH`, optional `ORCALY_QA_AXE`) were not available there. They remain **NOT_RUN**, never PASS.

## Executed evidence

### Vercel Preview build

Deployment:
- ID: `dpl_5Wv4QU6QtCYFRrXrNcADHzD6vHf1`
- SHA: `2650d8cb02ad813c986c17cafbb83bb7cd422d90`
- URL: `https://orcaly-g8a0yvnua-vinicius-araujos-projects.vercel.app`
- state: **READY**

The project build command is `npm run build`. Its npm lifecycle executes the existing `prebuild`, which runs `npm test`, `verify:payments` and the repository's focused ESLint commands before `next build`. The READY deployment therefore certifies that lifecycle for this SHA.

The repository `next.config.ts` does not enable `typescript.ignoreBuildErrors`, so the successful Next build also passed Next's TypeScript build gate.

### Source-contract audit

A connector-side deterministic audit of the final source contract passed **67 / 67 checks** covering:
- required viewport constants: 320 / 390 / 768 / 1024 / 1440 / 1920;
- all 18 page archetype identifiers;
- the full required state vocabulary;
- scoped CSS, with no new `:root`;
- reduced-motion rules in the design-system and shell layers;
- safe-area handling for mobile navigation;
- all required product preview identifiers;
- explicit DEMO / SAMPLE labeling;
- deterministic preview data;
- skip navigation;
- labelled mobile navigation and breadcrumbs;
- table captions and scoped headers;
- form `aria-describedby` and `aria-invalid`.

Diff audit from the required base found **zero** changes under forbidden paths such as `app/**`, `supabase/**`, `.github/**`, package files or global CSS.

## Visual matrix

Required widths:
- 320
- 390
- 768
- 1024
- 1440
- 1920

Themes:
- light
- dark

Isolated Playwright rendering matrix: **NOT_RUN**.

Reason: the repository intentionally keeps the harness dependency-injected and adds no package dependency for convenience. The current execution environment had a browser but did not expose the Node React/esbuild/Playwright package set required by the repository harness. Adding dependencies or a real route solely to force screenshots would violate this mission's dependency and runtime boundaries.

## Axe

**NOT_RUN**.

No Axe result is represented as PASS.

## Responsive / interaction source review

Source-level review confirms:
- desktop sidebar + context header;
- tablet shell contraction;
- purpose-built mobile bottom navigation rather than merely hiding desktop navigation;
- safe-area handling;
- table row-summary fallback below 768px;
- reader TOC reflow;
- workflow vertical reflow;
- settings/detail/analytics column collapse;
- reduced-motion override;
- visible focus token and skip link.

Rendered verification remains required before changing these items from source-reviewed to visually certified.

## Anti-template / anti-AI design review

Status: **PARTIAL** pending rendered screenshots.

Static inspection:
- zero pill-radius declarations in the new CSS;
- zero `backdrop-filter`;
- zero glassmorphism terms;
- zero generic purple/blue decorative gradients;
- zero hover transforms that move layout;
- shadows restricted to elevation surfaces;
- product layouts differ by composition rather than only accent color;
- metrics, activity, reader, workflow, marketplace and pipeline use different structures instead of one repeated card primitive.

## Remaining visual certification unit

Run:

```bash
ORCALY_QA_ESBUILD=<esbuild package> \
ORCALY_QA_PLAYWRIGHT=<playwright package> \
ORCALY_QA_NODE_PATH=<node_modules with react/react-dom> \
ORCALY_QA_AXE=<axe-core package> \
ORCALY_QA_EVIDENCE=<evidence dir> \
node scripts/test-orcaly-frontend-visual.mjs
```

Then inspect the generated screenshots at the required widths/themes and update this report from **PARTIAL** to **PASS** only if the rendered evidence supports it.
